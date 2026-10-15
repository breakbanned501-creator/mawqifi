begin;

alter table public.parking_claims
  add column if not exists reverse_match boolean not null default false;

comment on column public.parking_claims.reverse_match is
  'True only for Mawqifi 2.0 direct matches whose chat closes 60 minutes after matching.';

alter table public.parking_claims
  drop constraint if exists parking_claims_check1;

alter table public.parking_claims
  add constraint parking_claims_chat_clock_check check (
    (reverse_match and arrived_at is null and
      chat_closes_at = claimed_at + interval '60 minutes')
    or
    (not reverse_match and (
      (arrived_at is null and chat_closes_at is null)
      or chat_closes_at = arrived_at + interval '15 minutes'))
  ) not valid;

alter table public.parking_claims
  validate constraint parking_claims_chat_clock_check;

create or replace function mawqifi_safety.guard_reverse_match_clock()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if old.reverse_match and (
      new.reverse_match is distinct from old.reverse_match
      or new.arrived_at is distinct from old.arrived_at
      or new.chat_closes_at is distinct from old.chat_closes_at) then
    raise exception 'HANDOFF_ARRIVAL_NOT_REQUIRED';
  end if;
  return new;
end
$$;

revoke all on function mawqifi_safety.guard_reverse_match_clock()
  from public, anon, authenticated;

drop trigger if exists reverse_match_clock_immutable on public.parking_claims;
create trigger reverse_match_clock_immutable
before update on public.parking_claims
for each row execute function mawqifi_safety.guard_reverse_match_clock();

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
      where o.request_id = r.id and o.status = 'pending'
        and o.expires_at > clock_timestamp());

  update public.parking_requests
  set status = 'expired'
  where status in ('active', 'offered') and expires_at <= clock_timestamp();

  delete from mawqifi_safety.parking_request_coordinates c
  using public.parking_requests r
  where c.request_id = r.id and r.status not in ('active', 'offered');

  update public.conversations c
  set closed = true
  where not c.closed and exists (
    select 1 from public.parking_claims claim
    where claim.conversation_id = c.id
      and claim.reverse_match
      and claim.status = 'claimed'
      and claim.chat_closes_at <= clock_timestamp());
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
  new_conversation_id uuid;
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
  returning id into new_conversation_id;
  perform pg_catalog.set_config('mawqifi.direct_match_requester','',true);

  update public.parking_claims claim
  set reverse_match = true,
      chat_closes_at = claimed_at + interval '60 minutes'
  where claim.conversation_id = new_conversation_id;

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
      'href','/post/' || new_post::text || '?chat=' || new_conversation_id::text)
  from public.user_notification_preferences pref
  where pref.user_id = request_row.requester_id and pref.in_app_enabled;

  return jsonb_build_object(
    'offer_id',new_offer,
    'post_id',new_post,
    'conversation_id',new_conversation_id,
    'requester_id',request_row.requester_id,
    'distance_meters',round(meters)::integer,
    'expires_at',request_row.expires_at,
    'chat_closes_at',(select claim.chat_closes_at from public.parking_claims claim where claim.conversation_id = new_conversation_id));
end
$$;

revoke all on function public.give_parking_to_request(
  uuid,text,text,double precision,double precision,double precision)
  from public,anon;
grant execute on function public.give_parking_to_request(
  uuid,text,text,double precision,double precision,double precision)
  to authenticated;


commit;

