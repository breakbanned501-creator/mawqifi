-- Retire automatically-created offer posts when their matching attempt ends,
-- and run reverse-request expiry independently of client activity.

alter table public.parking_match_offers
  add column if not exists auto_created_post boolean not null default false;

create or replace function mawqifi_safety.retire_reverse_offer_post(p_offer_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  target public.parking_match_offers%rowtype;
begin
  select * into target
  from public.parking_match_offers
  where id = p_offer_id
  for update;

  if not found or not target.auto_created_post or target.status = 'accepted' then
    return;
  end if;

  if exists (select 1 from public.parking_claims where post_id = target.post_id) then
    return;
  end if;

  update public.parking_posts
  set status = 'cancelled'
  where id = target.post_id and status in ('active', 'expired');

  delete from public.parking_post_locations
  where post_id = target.post_id
    and not exists (select 1 from public.parking_claims where post_id = target.post_id);
end
$$;

revoke all on function mawqifi_safety.retire_reverse_offer_post(uuid)
  from public, anon, authenticated;

create or replace function mawqifi_safety.expire_reverse_matches()
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  expired_offer record;
begin
  for expired_offer in
    select id
    from public.parking_match_offers
    where status = 'pending' and expires_at <= clock_timestamp()
    order by id
    for update
  loop
    update public.parking_match_offers
    set status = 'expired'
    where id = expired_offer.id and status = 'pending';
    perform mawqifi_safety.retire_reverse_offer_post(expired_offer.id);
  end loop;

  update public.parking_requests r
  set status = 'active'
  where status = 'offered' and expires_at > clock_timestamp()
    and not exists (
      select 1 from public.parking_match_offers o
      where o.request_id = r.id and o.status = 'pending' and o.expires_at > clock_timestamp()
    );

  update public.parking_requests
  set status = 'expired'
  where status in ('active', 'offered') and expires_at <= clock_timestamp();

  delete from mawqifi_safety.parking_request_coordinates c
  using public.parking_requests r
  where c.request_id = r.id and r.status not in ('active', 'offered');
end
$$;

revoke all on function mawqifi_safety.expire_reverse_matches()
  from public, anon, authenticated;

create or replace function public.decline_parking_offer(p_offer_id uuid)
returns boolean
language plpgsql
security definer
set search_path to ''
as $$
declare
  offer_row public.parking_match_offers%rowtype;
  request_row public.parking_requests%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  perform mawqifi_safety.assert_unrestricted();

  select * into offer_row
  from public.parking_match_offers
  where id = p_offer_id
  for update;

  if not found or offer_row.requester_id <> auth.uid() then
    raise exception 'OFFER_NOT_ALLOWED' using errcode = '42501';
  end if;
  if offer_row.status <> 'pending' then
    return false;
  end if;

  select * into request_row
  from public.parking_requests
  where id = offer_row.request_id
  for update;

  update public.parking_match_offers set status = 'declined' where id = offer_row.id;
  perform mawqifi_safety.retire_reverse_offer_post(offer_row.id);

  if request_row.status = 'offered' and request_row.expires_at > clock_timestamp() then
    update public.parking_requests set status = 'active' where id = request_row.id;
  end if;
  return true;
end
$$;

revoke all on function public.decline_parking_offer(uuid) from public, anon;
grant execute on function public.decline_parking_offer(uuid) to authenticated;

create or replace function public.cancel_parking_request(p_request_id uuid)
returns boolean
language plpgsql
security definer
set search_path to ''
as $$
declare
  request_row public.parking_requests%rowtype;
  offer_row record;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  perform mawqifi_safety.assert_unrestricted();

  select * into request_row
  from public.parking_requests
  where id = p_request_id
  for update;

  if not found or request_row.requester_id <> auth.uid() then
    raise exception 'REQUEST_UNAVAILABLE' using errcode = '42501';
  end if;
  if request_row.status not in ('active', 'offered') then
    return false;
  end if;

  for offer_row in
    select id
    from public.parking_match_offers
    where request_id = request_row.id and status = 'pending'
    order by id
    for update
  loop
    update public.parking_match_offers set status = 'cancelled' where id = offer_row.id;
    perform mawqifi_safety.retire_reverse_offer_post(offer_row.id);
  end loop;

  update public.parking_requests set status = 'cancelled' where id = request_row.id;
  delete from mawqifi_safety.parking_request_coordinates where request_id = request_row.id;
  return true;
end
$$;

revoke all on function public.cancel_parking_request(uuid) from public, anon;
grant execute on function public.cancel_parking_request(uuid) to authenticated;

create or replace function public.give_parking_to_request(
  p_request_id uuid,
  p_place_id text,
  p_sub_place_id text,
  p_lat double precision,
  p_lng double precision,
  p_accuracy double precision)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  new_post uuid;
  response jsonb;
  new_offer uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  perform mawqifi_safety.assert_unrestricted();
  if p_lat is null or p_lng is null or p_lat not between -90 and 90
     or p_lng not between -180 and 180 or p_accuracy is null or p_accuracy not between 0 and 100 then
    raise exception 'OFFER_LOCATION_REQUIRED';
  end if;

  perform pg_catalog.set_config('mawqifi.reverse_matching', 'yes', true);
  new_post := mawqifi_safety.publish_handoff(
    jsonb_build_object(
      'place_id', p_place_id,
      'sub_place_id', p_sub_place_id,
      'departure_minutes', 10),
    p_lat, p_lng, p_accuracy);

  response := public.offer_parking_to_request(p_request_id, new_post);
  new_offer := (response ->> 'offer_id')::uuid;
  update public.parking_match_offers
  set auto_created_post = true
  where id = new_offer and post_id = new_post and departing_user_id = auth.uid();

  return response || jsonb_build_object('post_id', new_post);
end
$$;

revoke all on function public.give_parking_to_request(
  uuid, text, text, double precision, double precision, double precision)
  from public, anon;
grant execute on function public.give_parking_to_request(
  uuid, text, text, double precision, double precision, double precision)
  to authenticated;

create extension if not exists pg_cron;

select cron.schedule(
  'mawqifi-expire-reverse-matches',
  '* * * * *',
  $cron$select mawqifi_safety.expire_reverse_matches();$cron$
);

