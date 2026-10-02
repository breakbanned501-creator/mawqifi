-- Data-preserving parking handoffs. Staging must be validated before production review.
begin;
grant usage on schema mawqifi_safety to authenticated;
alter table public.parking_posts add column handoff boolean not null default false;
alter table public.parking_posts drop constraint parking_posts_status_check;
alter table public.parking_posts add constraint parking_posts_status_check check(status in ('active','expired','closed','claimed','completed','cancelled'));
create table public.parking_post_locations(
 post_id uuid primary key references public.parking_posts(id) on delete cascade,
 owner_id uuid not null references public.users(id),
 latitude double precision not null check(latitude between -90 and 90),
 longitude double precision not null check(longitude between -180 and 180),
 accuracy_meters double precision check(accuracy_meters between 0 and 100000),
 created_at timestamptz not null default now()
);
create index parking_post_locations_owner_idx on public.parking_post_locations(owner_id);
create table public.parking_claims(
 id uuid primary key default gen_random_uuid(),
 post_id uuid not null unique references public.parking_posts(id),
 owner_id uuid not null references public.users(id),
 claimant_id uuid not null references public.users(id),
 conversation_id uuid not null unique references public.conversations(id),
 status text not null default 'claimed' check(status in ('claimed','arrived','completed','cancelled')),
 claimed_at timestamptz not null default now(),
 arrived_at timestamptz,
 chat_closes_at timestamptz,
 completed_at timestamptz,
 check(owner_id<>claimant_id),
 check((arrived_at is null and chat_closes_at is null) or chat_closes_at=arrived_at+interval '15 minutes')
);
create index parking_claims_owner_idx on public.parking_claims(owner_id);
create index parking_claims_claimant_idx on public.parking_claims(claimant_id);
create table mawqifi_safety.handoff_settings(id boolean primary key default true check(id),arrival_radius_meters double precision not null check(arrival_radius_meters between 10 and 100));
insert into mawqifi_safety.handoff_settings values(true,25);
revoke all on mawqifi_safety.handoff_settings from public,anon,authenticated;
alter table public.parking_post_locations enable row level security;
alter table public.parking_claims enable row level security;
revoke all on public.parking_post_locations,public.parking_claims from public,anon,authenticated;
grant select on public.parking_post_locations,public.parking_claims to authenticated;
create policy claims_participants_read on public.parking_claims for select to authenticated
 using((select auth.uid()) in(owner_id,claimant_id));
create policy locations_matched_read on public.parking_post_locations for select to authenticated
 using(owner_id=(select auth.uid()) or exists(select 1 from public.parking_claims c where c.post_id=parking_post_locations.post_id and c.claimant_id=(select auth.uid()) and c.status in('claimed','arrived','completed') and not public.is_user_blocked(c.owner_id)));
-- A post cancellation or expiry must never cascade into chat history.
alter table public.conversations drop constraint conversations_post_id_fkey;
alter table public.conversations add constraint conversations_post_id_fkey foreign key(post_id) references public.parking_posts(id) on delete restrict;
revoke delete on public.parking_posts,public.conversations from anon,authenticated;
-- Only read markers can be changed by a normal client, never moderation/lifecycle fields.
revoke update on public.conversations from anon,authenticated;
grant update(owner_last_read_at,requester_last_read_at) on public.conversations to authenticated;

-- A row lock serializes every conversation/claim entry path, including cached clients.
create or replace function mawqifi_safety.guard_conversation() returns trigger
language plpgsql security definer set search_path='' as $$
declare p public.parking_posts%rowtype;
begin
 if TG_OP='UPDATE' then
  if new.owner_id<>old.owner_id or new.requester_id<>old.requester_id or new.post_id<>old.post_id then raise exception 'Participants are immutable'; end if;
  return new;
 end if;
 if auth.uid() is null or new.requester_id<>auth.uid() then raise exception 'Authentication required' using errcode='42501'; end if;
 perform mawqifi_safety.assert_unrestricted();
 select * into p from public.parking_posts where id=new.post_id for update;
 if not found or p.user_id<>new.owner_id or new.owner_id=new.requester_id then raise exception 'HANDOFF_INVALID'; end if;
 perform mawqifi_safety.lock_pair(new.owner_id,new.requester_id);
 if mawqifi_safety.blocked_pair(new.owner_id,new.requester_id) then raise exception 'SAFETY_BLOCKED'; end if;
 if exists(select 1 from public.parking_claims where post_id=p.id) then raise exception 'HANDOFF_ALREADY_CLAIMED'; end if;
 -- Legacy publication retains its 30-second grace; new handoffs must still be active.
 if p.handoff then
  if p.status<>'active' or p.expires_at<=clock_timestamp() then raise exception 'SAFETY_POST_EXPIRED'; end if;
  if not exists(select 1 from public.parking_post_locations where post_id=p.id) then raise exception 'HANDOFF_LOCATION_REQUIRED'; end if;
 elsif p.status not in('active','expired') or p.expires_at<=clock_timestamp()-interval '30 seconds' then raise exception 'SAFETY_POST_EXPIRED';
 end if;
 new.closed:=false;
 return new;
end; $$;
create function mawqifi_safety.reserve_conversation_post() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 insert into public.parking_claims(post_id,owner_id,claimant_id,conversation_id,claimed_at)
 values(new.post_id,new.owner_id,new.requester_id,new.id,clock_timestamp());
 update public.parking_posts set status='claimed' where id=new.post_id;
 return new;
end; $$;
revoke all on function mawqifi_safety.reserve_conversation_post() from public,anon,authenticated;
create trigger handoff_reserve_after_conversation after insert on public.conversations for each row execute function mawqifi_safety.reserve_conversation_post();

-- Prevent normal clients reopening, moving, or extending an already reserved spot.
create function mawqifi_safety.guard_reserved_post() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.parking_claims where post_id=old.id) then
  if new.place_id is distinct from old.place_id or new.college is distinct from old.college or new.zone is distinct from old.zone or new.gate is distinct from old.gate or new.location_description is distinct from old.location_description or new.expires_at<>old.expires_at or new.handoff<>old.handoff then raise exception 'HANDOFF_IMMUTABLE'; end if;
  if new.status in('active','expired') then raise exception 'HANDOFF_ALREADY_CLAIMED'; end if;
 end if;
 return new;
end; $$;
revoke all on function mawqifi_safety.guard_reserved_post() from public,anon,authenticated;
create trigger handoff_reserved_post_guard before update on public.parking_posts for each row execute function mawqifi_safety.guard_reserved_post();
create function mawqifi_safety.cancel_handoff_on_post() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.status in('closed','cancelled') and new.status is distinct from old.status then
  update public.parking_claims set status='cancelled',completed_at=clock_timestamp() where post_id=new.id and status in('claimed','arrived');
  update public.conversations set closed=true where post_id=new.id;
 end if;
 return new;
end; $$;
revoke all on function mawqifi_safety.cancel_handoff_on_post() from public,anon,authenticated;
create trigger handoff_cancel_post after update on public.parking_posts for each row execute function mawqifi_safety.cancel_handoff_on_post();

-- Keep the existing spam, duplicate, block and rate guards; add server-clock closure.
create function mawqifi_safety.guard_handoff_message() returns trigger
language plpgsql security definer set search_path='' as $$
declare c public.parking_claims%rowtype;
begin
 select * into c from public.parking_claims where conversation_id=new.conversation_id for update;
 if found and (c.status in('completed','cancelled') or c.chat_closes_at<=clock_timestamp()) then raise exception 'HANDOFF_CHAT_CLOSED'; end if;
 return new;
end; $$;
revoke all on function mawqifi_safety.guard_handoff_message() from public,anon,authenticated;
create trigger handoff_message_guard before insert on public.messages for each row execute function mawqifi_safety.guard_handoff_message();
create or replace function public.on_message_insert() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 update public.conversations set last_message_text=case new.type when 'text' then new.text when 'image' then 'Image' when 'location' then 'Location' end,last_message_at=new.created_at,updated_at=clock_timestamp()
 where id=new.conversation_id;
 return new;
end; $$;
revoke all on function public.on_message_insert() from public,anon,authenticated;
create or replace function public.expire_old_parking_posts() returns void
language plpgsql security definer set search_path='' as $$
begin
 update public.parking_posts set status='expired' where status='active' and expires_at<=clock_timestamp();
 update public.parking_claims set status='completed',completed_at=clock_timestamp() where status='arrived' and chat_closes_at<=clock_timestamp();
 update public.conversations c set closed=true where exists(select 1 from public.parking_claims pc where pc.conversation_id=c.id and pc.status in('completed','cancelled'));
 update public.parking_posts p set status='completed' where status='claimed' and exists(select 1 from public.parking_claims c where c.post_id=p.id and c.status='completed');
end; $$;
revoke all on function public.expire_old_parking_posts() from public,anon;
grant execute on function public.expire_old_parking_posts() to authenticated;

create function mawqifi_safety.handoff_state(cid uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c public.parking_claims%rowtype; result jsonb;
begin
 select * into c from public.parking_claims where conversation_id=cid;
 if not found then
  if not exists(select 1 from public.conversations where id=cid and auth.uid() in(owner_id,requester_id)) then raise exception 'Authentication required' using errcode='42501'; end if;
  return jsonb_build_object('claim',null,'server_now',clock_timestamp());
 end if;
 if auth.uid() is null or auth.uid() not in(c.owner_id,c.claimant_id) then raise exception 'Authentication required' using errcode='42501'; end if;
 result:=jsonb_build_object('claim',to_jsonb(c),'server_now',clock_timestamp(),'arrival_radius_meters',(select arrival_radius_meters from mawqifi_safety.handoff_settings where id));
 if c.status<>'cancelled' and (auth.uid()=c.owner_id or not mawqifi_safety.blocked_pair(c.owner_id,c.claimant_id)) then
  result:=result||jsonb_build_object('location',(select to_jsonb(l) from public.parking_post_locations l where post_id=c.post_id));
 end if;
 return result;
end; $$;
revoke all on function mawqifi_safety.handoff_state(uuid) from public,anon;
grant execute on function mawqifi_safety.handoff_state(uuid) to authenticated;
create function public.get_parking_handoff(conversation_id uuid) returns jsonb
language sql security invoker set search_path='' as $$select mawqifi_safety.handoff_state(conversation_id)$$;
revoke all on function public.get_parking_handoff(uuid) from public,anon;
grant execute on function public.get_parking_handoff(uuid) to authenticated;

create function mawqifi_safety.claim_post(pid uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p public.parking_posts%rowtype; c public.parking_claims%rowtype; cid uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 perform mawqifi_safety.assert_unrestricted();
 select * into p from public.parking_posts where id=pid for update;
 if not found or p.user_id=auth.uid() then raise exception 'HANDOFF_INVALID'; end if;
 perform mawqifi_safety.lock_pair(p.user_id,auth.uid());
 if mawqifi_safety.blocked_pair(p.user_id,auth.uid()) then raise exception 'SAFETY_BLOCKED'; end if;
 select * into c from public.parking_claims where post_id=pid;
 if found then
  if c.claimant_id=auth.uid() then return mawqifi_safety.handoff_state(c.conversation_id); end if;
  raise exception 'HANDOFF_ALREADY_CLAIMED';
 end if;
 if p.status<>'active' or p.expires_at<=clock_timestamp() then raise exception 'SAFETY_POST_EXPIRED'; end if;
 -- Reuse a pre-migration conversation for this same pair; don't rewrite other history.
 select id into cid from public.conversations where post_id=pid and requester_id=auth.uid();
 if cid is null then
  insert into public.conversations(post_id,owner_id,requester_id) values(pid,p.user_id,auth.uid()) returning id into cid;
 else
  insert into public.parking_claims(post_id,owner_id,claimant_id,conversation_id) values(pid,p.user_id,auth.uid(),cid);
  update public.parking_posts set status='claimed' where id=pid;
  update public.conversations set closed=false where id=cid;
 end if;
 return mawqifi_safety.handoff_state(cid);
end; $$;
revoke all on function mawqifi_safety.claim_post(uuid) from public,anon;
grant execute on function mawqifi_safety.claim_post(uuid) to authenticated;
create function public.claim_parking_post(post_id uuid) returns jsonb
language sql security invoker set search_path='' as $$select mawqifi_safety.claim_post(post_id)$$;
revoke all on function public.claim_parking_post(uuid) from public,anon;
grant execute on function public.claim_parking_post(uuid) to authenticated;

create function mawqifi_safety.publish_handoff(payload jsonb,lat double precision,lng double precision,accuracy double precision) returns uuid
language plpgsql security definer set search_path='' as $$
declare pid uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if lat is null or lng is null then raise exception 'HANDOFF_LOCATION_REQUIRED'; end if;
 insert into public.parking_posts(user_id,place_id,location_description,college,zone,gate,car_desc,departure_minutes,expires_at,handoff)
 values(auth.uid(),payload->>'place_id',payload->>'location_description',payload->>'college',payload->>'zone',payload->>'gate',payload->>'car_desc',(payload->>'departure_minutes')::integer,clock_timestamp()+make_interval(mins=>(payload->>'departure_minutes')::integer),true) returning id into pid;
 insert into public.parking_post_locations(post_id,owner_id,latitude,longitude,accuracy_meters) values(pid,auth.uid(),lat,lng,accuracy);
 return pid;
end; $$;
revoke all on function mawqifi_safety.publish_handoff(jsonb,double precision,double precision,double precision) from public,anon;
grant execute on function mawqifi_safety.publish_handoff(jsonb,double precision,double precision,double precision) to authenticated;
create function public.publish_parking_handoff(payload jsonb,latitude double precision,longitude double precision,accuracy_meters double precision default null) returns uuid
language sql security invoker set search_path='' as $$select mawqifi_safety.publish_handoff(payload,latitude,longitude,accuracy_meters)$$;
revoke all on function public.publish_parking_handoff(jsonb,double precision,double precision,double precision) from public,anon;
grant execute on function public.publish_parking_handoff(jsonb,double precision,double precision,double precision) to authenticated;

create function mawqifi_safety.arrive_handoff(cid uuid,manual boolean,lat double precision,lng double precision,accuracy double precision) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c public.parking_claims%rowtype; l public.parking_post_locations%rowtype; radius double precision; distance double precision; arrived timestamptz;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 perform mawqifi_safety.assert_unrestricted();
 select * into c from public.parking_claims where conversation_id=cid for update;
 if not found or c.claimant_id<>auth.uid() then raise exception 'Authentication required' using errcode='42501'; end if;
 perform mawqifi_safety.lock_pair(c.owner_id,c.claimant_id);
 if mawqifi_safety.blocked_pair(c.owner_id,c.claimant_id) then raise exception 'SAFETY_BLOCKED'; end if;
 if c.status in('cancelled','completed') then raise exception 'HANDOFF_CHAT_CLOSED'; end if;
 if c.arrived_at is not null then return mawqifi_safety.handoff_state(cid); end if;
 if manual is not true then
  select * into l from public.parking_post_locations where post_id=c.post_id;
  select arrival_radius_meters into radius from mawqifi_safety.handoff_settings where id;
  if not found or lat is null or lng is null or lat not between -90 and 90 or lng not between -180 and 180 or accuracy is null or accuracy<0 or accuracy>radius then raise exception 'HANDOFF_NOT_NEAR'; end if;
  distance:=6371000*2*asin(least(1,sqrt(power(sin(radians(lat-l.latitude)/2),2)+cos(radians(lat))*cos(radians(l.latitude))*power(sin(radians(lng-l.longitude)/2),2))));
  if distance is null or distance>radius then raise exception 'HANDOFF_NOT_NEAR'; end if;
 end if;
 arrived:=clock_timestamp();
 update public.parking_claims set arrived_at=arrived,chat_closes_at=arrived+interval '15 minutes',status='arrived' where id=c.id;
 return mawqifi_safety.handoff_state(cid);
end; $$;
revoke all on function mawqifi_safety.arrive_handoff(uuid,boolean,double precision,double precision,double precision) from public,anon;
grant execute on function mawqifi_safety.arrive_handoff(uuid,boolean,double precision,double precision,double precision) to authenticated;
create function public.arrive_parking_handoff(conversation_id uuid,manual boolean default false,latitude double precision default null,longitude double precision default null,accuracy_meters double precision default null) returns jsonb
language sql security invoker set search_path='' as $$select mawqifi_safety.arrive_handoff(conversation_id,manual,latitude,longitude,accuracy_meters)$$;
revoke all on function public.arrive_parking_handoff(uuid,boolean,double precision,double precision,double precision) from public,anon;
grant execute on function public.arrive_parking_handoff(uuid,boolean,double precision,double precision,double precision) to authenticated;
commit;
