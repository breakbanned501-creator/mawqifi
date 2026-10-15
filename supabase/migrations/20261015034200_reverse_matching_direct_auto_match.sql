begin;

alter table public.parking_requests
  add column if not exists auto_match boolean not null default false;

alter table public.parking_match_offers
  add column if not exists distance_meters integer
    check (distance_meters is null or distance_meters between 0 and 500);

comment on column public.parking_requests.auto_match is
  'Explicit seeker opt-in required for immediate reverse matching.';

drop function if exists public.create_parking_request(
  text, text, double precision, double precision, double precision);

create function public.create_parking_request(
  p_place_id text,
  p_sub_place_id text,
  p_lat double precision,
  p_lng double precision,
  p_accuracy double precision,
  p_auto_match boolean default false)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  existing public.parking_requests%rowtype;
  result public.parking_requests%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  perform mawqifi_safety.assert_unrestricted();
  if not exists (select 1 from public.places where id = p_place_id and active)
     or (p_place_id in ('kuwait_university','paaet') and
         (p_sub_place_id is null or p_sub_place_id = ''))
     or (p_sub_place_id is not null and
         (length(p_sub_place_id) > 100 or p_sub_place_id !~ '^[a-z0-9_]+$')) then
    raise exception 'REQUEST_INVALID_SCOPE';
  end if;
  if p_lat is null or p_lng is null or p_lat not between -90 and 90
     or p_lng not between -180 and 180 or p_accuracy is null
     or p_accuracy not between 0 and 100 then
    raise exception 'REQUEST_LOCATION_REQUIRED';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(auth.uid()::text), 31925);
  perform mawqifi_safety.expire_reverse_matches();

  select * into existing
  from public.parking_requests
  where requester_id = auth.uid() and status in ('active','offered')
  for update;

  if found then
    return jsonb_build_object(
      'id', existing.id, 'status', existing.status,
      'created_at', existing.created_at, 'expires_at', existing.expires_at,
      'place_id', existing.place_id, 'sub_place_id', existing.sub_place_id,
      'auto_match', existing.auto_match);
  end if;

  if exists (
    select 1 from mawqifi_safety.parking_request_submission_times
    where user_id = auth.uid()
      and last_created_at > clock_timestamp() - interval '30 seconds') then
    raise exception 'REQUEST_RATE_LIMIT';
  end if;

  insert into mawqifi_safety.parking_request_submission_times(user_id,last_created_at)
  values(auth.uid(),clock_timestamp())
  on conflict(user_id) do update set last_created_at = excluded.last_created_at;

  insert into public.parking_requests(
    requester_id, place_id, sub_place_id, auto_match)
  values(auth.uid(), p_place_id, p_sub_place_id, p_auto_match is true)
  returning * into result;

  insert into mawqifi_safety.parking_request_coordinates(
    request_id, latitude, longitude, accuracy_meters)
  values(result.id, p_lat, p_lng, p_accuracy);

  return jsonb_build_object(
    'id', result.id, 'status', result.status,
    'created_at', result.created_at, 'expires_at', result.expires_at,
    'place_id', result.place_id, 'sub_place_id', result.sub_place_id,
    'auto_match', result.auto_match);
end
$$;

revoke all on function public.create_parking_request(
  text,text,double precision,double precision,double precision,boolean)
  from public,anon;
grant execute on function public.create_parking_request(
  text,text,double precision,double precision,double precision,boolean)
  to authenticated;

create or replace function mawqifi_safety.guard_conversation()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  p public.parking_posts%rowtype;
  direct_requester text;
begin
  if tg_op = 'UPDATE' then
    if new.owner_id <> old.owner_id or new.requester_id <> old.requester_id
       or new.post_id <> old.post_id then
      raise exception 'Participants are immutable';
    end if;
    return new;
  end if;

  direct_requester :=
    pg_catalog.current_setting('mawqifi.direct_match_requester', true);

  if auth.uid() is null or (
      new.requester_id <> auth.uid()
      and not (
        new.owner_id = auth.uid()
        and direct_requester = new.requester_id::text
        and exists (
          select 1
          from public.parking_match_offers o
          where o.post_id = new.post_id
            and o.departing_user_id = new.owner_id
            and o.requester_id = new.requester_id
            and o.status = 'accepted'
            and o.auto_created_post))) then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  perform mawqifi_safety.assert_unrestricted();
  select * into p from public.parking_posts where id = new.post_id for update;
  if not found or p.user_id <> new.owner_id or new.owner_id = new.requester_id then
    raise exception 'HANDOFF_INVALID';
  end if;
  perform mawqifi_safety.lock_pair(new.owner_id,new.requester_id);
  if mawqifi_safety.blocked_pair(new.owner_id,new.requester_id) then
    raise exception 'SAFETY_BLOCKED';
  end if;
  if exists(select 1 from public.parking_claims where post_id = p.id) then
    raise exception 'HANDOFF_ALREADY_CLAIMED';
  end if;
  if p.handoff then
    if p.status <> 'active' or p.expires_at <= clock_timestamp() then
      raise exception 'SAFETY_POST_EXPIRED';
    end if;
    if not exists(select 1 from public.parking_post_locations where post_id = p.id) then
      raise exception 'HANDOFF_LOCATION_REQUIRED';
    end if;
  elsif p.status not in ('active','expired')
        or p.expires_at <= clock_timestamp() - interval '30 seconds' then
    raise exception 'SAFETY_POST_EXPIRED';
  end if;
  new.closed := false;
  return new;
end
$$;

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

  insert into public.app_notifications(user_id,kind,post_id,actor_id,data)
  select request_row.requester_id,'system',new_post,auth.uid(),
    jsonb_build_object(
      'event_key','parking_match_offer',
      'offer_id',new_offer,
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

create or replace function public.cancel_reverse_match(p_conversation_id uuid)
returns boolean
language plpgsql
security definer
set search_path to ''
as $$
declare
  claim_row public.parking_claims%rowtype;
  offer_row public.parking_match_offers%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  perform mawqifi_safety.assert_unrestricted();

  select * into claim_row
  from public.parking_claims
  where conversation_id = p_conversation_id
  for update;

  if not found or auth.uid() not in (claim_row.owner_id,claim_row.claimant_id) then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into offer_row
  from public.parking_match_offers
  where post_id = claim_row.post_id
    and auto_created_post
    and status = 'accepted'
  for update;

  if not found then
    raise exception 'MATCH_CANCEL_NOT_AVAILABLE';
  end if;
  if claim_row.status in ('cancelled','completed') then
    return false;
  end if;

  update public.parking_match_offers
  set status = 'cancelled'
  where id = offer_row.id;

  update public.parking_requests
  set status = 'cancelled'
  where id = offer_row.request_id and status = 'matched';

  update public.parking_posts
  set status = 'cancelled'
  where id = claim_row.post_id;

  return true;
end
$$;

revoke all on function public.cancel_reverse_match(uuid) from public,anon;
grant execute on function public.cancel_reverse_match(uuid) to authenticated;

create or replace function mawqifi_safety.handoff_state(cid uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  c public.parking_claims%rowtype;
  result jsonb;
begin
  select * into c from public.parking_claims where conversation_id = cid;
  if not found then
    if not exists(
      select 1 from public.conversations
      where id = cid and auth.uid() in (owner_id,requester_id)) then
      raise exception 'Authentication required' using errcode = '42501';
    end if;
    return jsonb_build_object(
      'claim',null,'server_now',clock_timestamp(),'reverse_match',false);
  end if;
  if auth.uid() is null or auth.uid() not in (c.owner_id,c.claimant_id) then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  result := jsonb_build_object(
    'claim',to_jsonb(c),
    'server_now',clock_timestamp(),
    'arrival_radius_meters',
      (select arrival_radius_meters from mawqifi_safety.handoff_settings where id),
    'reverse_match',
      exists(select 1 from public.parking_match_offers o
             where o.post_id = c.post_id and o.auto_created_post));
  if c.status <> 'cancelled'
     and (auth.uid() = c.owner_id
          or not mawqifi_safety.blocked_pair(c.owner_id,c.claimant_id)) then
    result := result || jsonb_build_object(
      'location',(select to_jsonb(l)
                  from public.parking_post_locations l
                  where post_id = c.post_id));
  end if;
  return result;
end
$$;

revoke all on function mawqifi_safety.handoff_state(uuid)
  from public,anon;
grant execute on function mawqifi_safety.handoff_state(uuid)
  to authenticated;

commit;
