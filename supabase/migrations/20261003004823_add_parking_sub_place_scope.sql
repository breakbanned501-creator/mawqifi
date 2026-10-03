-- Additive, staging-first scope. No new tables or changes to handoff lifecycle/RLS.
begin;
alter table public.parking_posts add column sub_place_id text;
create function mawqifi_safety.ku_sub_place(c text) returns text
language sql immutable set search_path='' as $$
 select id from (values
 ('كلية التربية','education'),
 ('كلية الآداب','arts'),
 ('كلية العلوم','science'),
 ('كلية العلوم الإدارية','administrative_sciences'),
 ('كلية العلوم الحياتية','life_sciences'),
 ('كلية الهندسة والبترول','engineering_petroleum'),
 ('كلية الحقوق','law'),
 ('كلية الشريعة','sharia'),
 ('كلية العلوم الاجتماعية','social_sciences'),
 ('كلية الطب','medicine'),
 ('كلية الصيدلة','pharmacy')
 ) as colleges(name,id) where name=c;
$$;
revoke all on function mawqifi_safety.ku_sub_place(text) from public,anon,authenticated;

alter table public.parking_posts add constraint parking_posts_valid_sub_place check (
 sub_place_id is null or
 (place_id is not null and ((place_id='kuwait_university' and sub_place_id in ('education','arts','science','administrative_sciences','life_sciences','engineering_petroleum','law','sharia','social_sciences','medicine','pharmacy'))
 or (place_id='paaet' and sub_place_id in ('basic_education_ardiya','basic_education_jahra','nursing_shuwaikh')))));
-- Only the existing valid KU contract proves a college. No GPS/description inference.
update public.parking_posts set sub_place_id=mawqifi_safety.ku_sub_place(college)
 where place_id='kuwait_university' and sub_place_id is null
 and mawqifi_safety.valid_legacy_ku_location(college,zone,gate);
create or replace function mawqifi_safety.guard_post_place() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 if TG_OP='UPDATE' and
   row(new.place_id,new.location_description,new.college,new.zone,new.gate,new.sub_place_id)
   is not distinct from row(old.place_id,old.location_description,old.college,old.zone,old.gate,old.sub_place_id)
 then return new; end if;
 if new.place_id is null then
   if TG_OP='INSERT' and new.location_description is null
     and mawqifi_safety.valid_legacy_ku_location(new.college,new.zone,new.gate)
   then new.place_id:='kuwait_university';
   else raise exception 'PLACE_REQUIRED' using errcode='23514'; end if;
 end if;
 if not exists(select 1 from public.places where id=new.place_id and active) then
   raise exception 'PLACE_UNAVAILABLE' using errcode='23514';
 end if;

 if new.sub_place_id is not null and new.place_id='kuwait_university' and new.college is not null
   and new.sub_place_id is distinct from mawqifi_safety.ku_sub_place(new.college) then
   raise exception 'PLACE_INVALID_SUB_PLACE' using errcode='23514';
 end if;
 -- Legacy verified KU payloads carry a proven college; GPS-only rows remain NULL.
 if TG_OP='INSERT' and new.sub_place_id is null and new.place_id='kuwait_university'
    and mawqifi_safety.valid_legacy_ku_location(new.college,new.zone,new.gate) then
   new.sub_place_id:=mawqifi_safety.ku_sub_place(new.college);
 end if;

 -- Only an RPC-created private row authorizes the exception; no client flags/GUCs.
 if TG_OP='INSERT' and new.handoff and new.user_id=auth.uid()
   and new.college is null and new.zone is null and new.gate is null
   and new.location_description is null
   and exists(select 1 from public.parking_post_locations l
              where l.post_id=new.id and l.owner_id=new.user_id)
 then return new; end if;

 if new.place_id='kuwait_university' then
   if not mawqifi_safety.valid_legacy_ku_location(new.college,new.zone,new.gate) then
     raise exception 'PLACE_INVALID_KU_LOCATION' using errcode='23514';
   end if;
 else
   if new.college is not null or new.zone is not null or new.gate is not null then
     raise exception 'PLACE_UNEXPECTED_KU_FIELDS' using errcode='23514';
   end if;
   if length(regexp_replace(coalesce(new.location_description,''),U&'[[:space:]\200B\200C\200D\200E\200F\FEFF]','','g')) < 3 then
     raise exception 'PLACE_LOCATION_REQUIRED' using errcode='23514';
   end if;
 end if;
 if length(coalesce(new.location_description,''))>500 then
   raise exception 'PLACE_LOCATION_TOO_LONG' using errcode='23514';
 end if;
 return new;
end; $$;

create or replace function mawqifi_safety.publish_handoff(payload jsonb,lat double precision,lng double precision,accuracy double precision) returns uuid
language plpgsql security definer set search_path='' as $$
declare pid uuid:=pg_catalog.gen_random_uuid();
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 perform mawqifi_safety.assert_unrestricted();
 if lat is null or lng is null or lat not between -90 and 90 or lng not between -180 and 180
    or (accuracy is not null and accuracy not between 0 and 100000)
 then raise exception 'HANDOFF_LOCATION_REQUIRED'; end if;
 -- Defer only within this RPC; verify the FK before returning.
 set constraints public.parking_post_locations_post_id_fkey deferred;
 insert into public.parking_post_locations(post_id,owner_id,latitude,longitude,accuracy_meters)
 values(pid,auth.uid(),lat,lng,accuracy);
 insert into public.parking_posts(id,user_id,place_id,sub_place_id,location_description,college,zone,gate,car_desc,departure_minutes,expires_at,handoff)
 values(pid,auth.uid(),payload->>'place_id',payload->>'sub_place_id',payload->>'location_description',payload->>'college',payload->>'zone',payload->>'gate',payload->>'car_desc',
 (payload->>'departure_minutes')::integer,clock_timestamp()+make_interval(mins=>(payload->>'departure_minutes')::integer),true);
 set constraints public.parking_post_locations_post_id_fkey immediate;
 return pid;
end; $$;


create or replace function mawqifi_safety.guard_reserved_post() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.parking_claims where post_id=old.id) then
  if new.sub_place_id is distinct from old.sub_place_id or new.place_id is distinct from old.place_id or new.college is distinct from old.college or new.zone is distinct from old.zone or new.gate is distinct from old.gate or new.location_description is distinct from old.location_description or new.expires_at<>old.expires_at or new.handoff<>old.handoff then raise exception 'HANDOFF_IMMUTABLE'; end if;
  if new.status in('active','expired') then raise exception 'HANDOFF_ALREADY_CLAIMED'; end if;
 end if;
 return new;
end; $$;

create index parking_posts_sub_place_discovery_idx on public.parking_posts(place_id,sub_place_id,status,expires_at);
notify pgrst,'reload schema';
commit;
