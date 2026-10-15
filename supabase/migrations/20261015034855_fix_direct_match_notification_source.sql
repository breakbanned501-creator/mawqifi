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
  request_row public.parking_requests%rowtype;
  request_location mawqifi_safety.parking_request_coordinates%rowtype;
  new_post uuid;
  new_offer uuid;
  conversation_id uuid;
  meters double precision;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  perform mawqifi_safety.assert_unrestricted();
  if p_lat is null or p_lng is null or p_lat not between -90 and 90
     or p_lng not between -180 and 180 or p_accuracy is null
     or p_accuracy not between 0 and 100 then
    raise exception 'OFFER_LOCATION_REQUIRED';
  end if;

  perform mawqifi_safety.expire_reverse_matches();
  select * into request_row
  from public.parking_requests
  where id = p_request_id
  for update;

  if not found or request_row.status <> 'active'
     or request_row.expires_at <= clock_timestamp()
     or request_row.requester_id = auth.uid()
     or request_row.auto_match is not true then
    raise exception 'OFFER_REQUEST_UNAVAILABLE';
  end if;
  if request_row.place_id <> p_place_id
     or request_row.sub_place_id is distinct from p_sub_place_id
     or mawqifi_safety.blocked_pair(request_row.requester_id, auth.uid()) then
    raise exception 'OFFER_SCOPE_MISMATCH';
  end if;

  select * into request_location
  from mawqifi_safety.parking_request_coordinates
  where request_id = request_row.id
  for update;
  if not found then
    raise exception 'OFFER_LOCATION_MISSING';
  end if;

  meters := 6371000 * 2 * asin(least(1,sqrt(
    power(sin(radians(request_location.latitude - p_lat) / 2),2)
    + cos(radians(p_lat)) * cos(radians(request_location.latitude))
      * power(sin(radians(request_location.longitude - p_lng) / 2),2))));
  if meters is null or meters > 500 then
    raise exception 'OFFER_TOO_FAR';
  end if;

  perform pg_catalog.set_config('mawqifi.reverse_matching','yes',true);
  new_post := mawqifi_safety.publish_handoff(
    jsonb_build_object(
      'place_id', p_place_id,
      'sub_place_id', p_sub_place_id,
      'departure_minutes', 10),
    p_lat,p_lng,p_accuracy);

  insert into public.parking_match_offers(
    request_id,post_id,departing_user_id,requester_id,status,expires_at,
    accepted_at,auto_created_post,distance_meters)
  values(
    request_row.id,new_post,auth.uid(),request_row.requester_id,'accepted',
    request_row.expires_at,clock_timestamp(),true,round(meters)::integer)
  returning id into new_offer;

  update public.parking_requests
  set status = 'matched', matched_at = clock_timestamp()
  where id = request_row.id;

  perform pg_catalog.set_config(
    'mawqifi.direct_match_requester',request_row.requester_id::text,true);
  insert into public.conversations(post_id,owner_id,requester_id)
  values(new_post,auth.uid(),request_row.requester_id)
  returning id into conversation_id;
  perform pg_catalog.set_config('mawqifi.direct_match_requester','',true);

  delete from mawqifi_safety.parking_request_coordinates
  where request_id = request_row.id;

  insert into public.app_notifications(user_id,kind,actor_id,data)
  select request_row.requester_id,'system',auth.uid(),
    jsonb_build_object(
      'event_key','parking_match_offer:' || new_offer::text,
      'offer_id',new_offer,
      'post_id',new_post,
      'title','حصلنا لك موقف!',
      'body','افتح المحادثة والموقع',
      'distance_meters',round(meters)::integer,
      'sub_place_id',p_sub_place_id,
      'href','/post/' || new_post::text || '?chat=' || conversation_id::text)
  from public.user_notification_preferences pref
  where pref.user_id = request_row.requester_id and pref.in_app_enabled;

  return jsonb_build_object(
    'offer_id',new_offer,
    'post_id',new_post,
    'conversation_id',conversation_id,
    'requester_id',request_row.requester_id,
    'distance_meters',round(meters)::integer,
    'expires_at',request_row.expires_at);
end
$$;

revoke all on function public.give_parking_to_request(
  uuid,text,text,double precision,double precision,double precision)
  from public,anon;
grant execute on function public.give_parking_to_request(
  uuid,text,text,double precision,double precision,double precision)
  to authenticated;

