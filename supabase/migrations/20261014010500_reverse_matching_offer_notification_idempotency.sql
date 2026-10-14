-- Each matching attempt needs its own in-app notification idempotency key so a
-- declined offer can be followed by another legitimate offer for the request.

create or replace function public.offer_parking_to_request(p_request_id uuid, p_post_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  request_row public.parking_requests%rowtype;
  post_row public.parking_posts%rowtype;
  post_location public.parking_post_locations%rowtype;
  request_location mawqifi_safety.parking_request_coordinates%rowtype;
  meters double precision;
  until_at timestamptz;
  offer_row public.parking_match_offers%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  perform mawqifi_safety.assert_unrestricted();
  perform mawqifi_safety.expire_reverse_matches();

  select * into post_row from public.parking_posts where id = p_post_id for update;
  if not found or post_row.user_id <> auth.uid() or post_row.status <> 'active'
     or not post_row.handoff or post_row.expires_at <= clock_timestamp() then
    raise exception 'OFFER_SPOT_UNAVAILABLE';
  end if;

  select * into request_row from public.parking_requests where id = p_request_id for update;
  if not found or request_row.status <> 'active' or request_row.expires_at <= clock_timestamp()
     or request_row.requester_id = auth.uid() then
    raise exception 'OFFER_REQUEST_UNAVAILABLE';
  end if;
  if request_row.place_id <> post_row.place_id
     or request_row.sub_place_id is distinct from post_row.sub_place_id
     or mawqifi_safety.blocked_pair(request_row.requester_id, auth.uid()) then
    raise exception 'OFFER_SCOPE_MISMATCH';
  end if;

  select * into post_location from public.parking_post_locations where post_id = post_row.id;
  select * into request_location
  from mawqifi_safety.parking_request_coordinates
  where request_id = request_row.id;
  if not found or post_location.post_id is null then
    raise exception 'OFFER_LOCATION_MISSING';
  end if;

  meters := 6371000 * 2 * asin(least(1, sqrt(
    power(sin(radians(request_location.latitude - post_location.latitude) / 2), 2)
    + cos(radians(post_location.latitude)) * cos(radians(request_location.latitude))
      * power(sin(radians(request_location.longitude - post_location.longitude) / 2), 2))));
  if meters is null or meters > 500 then
    raise exception 'OFFER_TOO_FAR';
  end if;

  until_at := least(clock_timestamp() + interval '60 seconds', request_row.expires_at, post_row.expires_at);
  if until_at <= clock_timestamp() then
    raise exception 'OFFER_EXPIRED';
  end if;

  insert into public.parking_match_offers(
    request_id, post_id, departing_user_id, requester_id, expires_at)
  values(
    request_row.id, post_row.id, post_row.user_id, request_row.requester_id, until_at)
  returning * into offer_row;

  update public.parking_requests set status = 'offered' where id = request_row.id;
  insert into public.app_notifications(user_id, kind, actor_id, data)
  select request_row.requester_id, 'system', post_row.user_id,
    jsonb_build_object(
      'event_key', 'parking_match_offer:' || offer_row.id::text,
      'offer_id', offer_row.id,
      'post_id', post_row.id,
      'title', 'في شخص قريب يبي يعطيك موقف',
      'body', 'افتح موقفي خلال دقيقة للموافقة أو الرفض',
      'href', '/')
  from public.user_notification_preferences preference
  where preference.user_id = request_row.requester_id and preference.in_app_enabled;

  return jsonb_build_object(
    'offer_id', offer_row.id,
    'requester_id', request_row.requester_id,
    'expires_at', offer_row.expires_at);
end
$$;

revoke all on function public.offer_parking_to_request(uuid, uuid) from public, anon;
grant execute on function public.offer_parking_to_request(uuid, uuid) to authenticated;

