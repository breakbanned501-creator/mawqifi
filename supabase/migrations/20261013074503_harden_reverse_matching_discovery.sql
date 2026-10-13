-- Staging hardening after the prototype migrations.
-- This does not expose exact requester coordinates: distance is used only for
-- server-side ordering and the response continues returning coarse bands.

create index if not exists parking_match_offers_departing_user_idx
  on public.parking_match_offers(departing_user_id, status, expires_at);

alter table mawqifi_safety.parking_discovery_rate enable row level security;
revoke all on mawqifi_safety.parking_discovery_rate from public, anon, authenticated;

create or replace function public.nearby_parking_requests(
  p_place_id text,
  p_sub_place_id text,
  p_lat double precision,
  p_lng double precision,
  p_accuracy double precision,
  p_limit integer default 20
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  results jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;
  perform mawqifi_safety.assert_unrestricted();
  if p_lat is null or p_lng is null or p_lat not between -90 and 90
     or p_lng not between -180 and 180 or p_accuracy is null
     or p_accuracy not between 0 and 100 then
    raise exception 'REQUEST_LOCATION_REQUIRED';
  end if;
  perform mawqifi_safety.throttle_parking_discovery();
  perform mawqifi_safety.expire_reverse_matches();

  with candidates as (
    select r.id, r.created_at, r.expires_at,
      6371000 * 2 * asin(least(1, sqrt(
        power(sin(radians(c.latitude - p_lat) / 2), 2)
        + cos(radians(p_lat)) * cos(radians(c.latitude))
          * power(sin(radians(c.longitude - p_lng) / 2), 2)
      ))) as meters
    from public.parking_requests r
    join mawqifi_safety.parking_request_coordinates c on c.request_id = r.id
    where r.status = 'active'
      and r.expires_at > clock_timestamp()
      and r.requester_id <> auth.uid()
      and r.place_id = p_place_id
      and r.sub_place_id is not distinct from p_sub_place_id
      and not mawqifi_safety.blocked_pair(r.requester_id, auth.uid())
  ),
  selected as (
    select id, created_at, expires_at, meters,
      case
        when meters <= 150 then 'near'
        when meters <= 300 then 'medium'
        else 'far'
      end as distance_band
    from candidates
    where meters <= 500
    order by meters, created_at, id
    limit least(greatest(coalesce(p_limit, 20), 1), 20)
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', id,
        'created_at', created_at,
        'expires_at', expires_at,
        'distance_band', distance_band
      )
      order by meters, created_at, id
    ),
    '[]'::jsonb
  )
  into results
  from selected;

  return results;
end
$$;

revoke all on function public.nearby_parking_requests(
  text, text, double precision, double precision, double precision, integer
) from public, anon;
grant execute on function public.nearby_parking_requests(
  text, text, double precision, double precision, double precision, integer
) to authenticated;
