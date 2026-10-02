begin;
-- Open catalogue: new destinations require data, not an enum/schema rewrite.
create table public.places (
  id text primary key check (id ~ '^[a-z][a-z0-9_]*$'),
  name_ar text not null check (btrim(name_ar) <> ''),
  name_en text not null check (btrim(name_en) <> ''),
  place_type text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.places enable row level security;
revoke all on public.places from public, anon, authenticated;
grant select on public.places to anon, authenticated;
grant all on public.places to service_role;
create policy places_active_read on public.places for select to anon, authenticated using(active);
insert into public.places (id,name_ar,name_en,place_type,sort_order) values
 ('kuwait_university','جامعة الكويت','Kuwait University','university',10),
 ('paaet','التطبيقي','PAAET','education_authority',20),
 ('gust','GUST','GUST','university',30);

alter table public.parking_posts
 add column place_id text references public.places(id),
 add column location_description text,
 alter column college drop not null,
 alter column zone drop not null,
 alter column gate drop not null;

-- Snapshot of the existing client contract, not a claim of current official gate metadata.
create function mawqifi_safety.valid_legacy_ku_location(c text,z text,g text) returns boolean
language sql immutable set search_path = '' as $$
 select exists(select 1 from (values
    ('كلية التربية','A','Gate 5'),
    ('كلية الآداب','A','Gate 2'),
    ('كلية الآداب','A','Gate 3'),
    ('كلية العلوم','A','Gate 4'),
    ('كلية العلوم','A','Gate 5'),
    ('كلية العلوم الإدارية','A','Gate 5'),
    ('كلية العلوم الحياتية','A','Gate 4'),
    ('كلية الهندسة والبترول','B','Gate 6'),
    ('كلية الهندسة والبترول','B','Gate 7'),
    ('كلية الحقوق','B','Gate 7'),
    ('كلية الشريعة','B','Gate 6'),
    ('كلية العلوم الاجتماعية','B','Gate 6'),
    ('كلية العلوم الاجتماعية','B','Gate 7'),
    ('كلية الطب','B','Gate 6'),
    ('كلية الصيدلة','B','Gate 7')
 ) as legacy(college,zone,gate) where legacy.college=c and legacy.zone=z and legacy.gate=g);
$$;
revoke all on function mawqifi_safety.valid_legacy_ku_location(text,text,text) from public, anon, authenticated;

-- Never infer from arbitrary text. Unknown legacy rows stay NULL and are excluded
-- from new scoped feeds; status-only updates continue working.
update public.parking_posts set place_id='kuwait_university'
 where place_id is null and mawqifi_safety.valid_legacy_ku_location(college,zone,gate);

create function mawqifi_safety.guard_post_place() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 if TG_OP='UPDATE' and
   row(new.place_id,new.location_description,new.college,new.zone,new.gate)
   is not distinct from row(old.place_id,old.location_description,old.college,old.zone,old.gate)
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
 if new.place_id='kuwait_university' then
   if not mawqifi_safety.valid_legacy_ku_location(new.college,new.zone,new.gate) then
     raise exception 'PLACE_INVALID_KU_LOCATION' using errcode='23514';
   end if;
 else
   if new.college is not null or new.zone is not null or new.gate is not null then
     raise exception 'PLACE_UNEXPECTED_KU_FIELDS' using errcode='23514';
   end if;
   if length(regexp_replace(coalesce(new.location_description,''),'[[:space:]​‌‍‎‏﻿]','','g')) < 3 then
     raise exception 'PLACE_LOCATION_REQUIRED' using errcode='23514';
   end if;
 end if;
 if length(coalesce(new.location_description,''))>500 then
   raise exception 'PLACE_LOCATION_TOO_LONG' using errcode='23514';
 end if;
 return new;
end; $$;
revoke all on function mawqifi_safety.guard_post_place() from public, anon, authenticated;
create trigger place_post_guard before insert or update on public.parking_posts
 for each row execute function mawqifi_safety.guard_post_place();
create index parking_posts_place_active_expiry_idx on public.parking_posts(place_id,expires_at desc)
 where status='active';
-- Current Auth, ownership RLS, reporting, blocking, expiry and safety triggers remain.

-- Compatibility routing only, not a privilege grant. New clients explicitly
-- advertise nullable-location support; old KU-only clients never receive other
-- institutions' nullable college/zone/gate rows in their unfiltered feeds.
create policy place_legacy_client_read on public.parking_posts as restrictive
 for select to authenticated using (
   place_id='kuwait_university'
   or coalesce(nullif(current_setting('request.headers',true),'')::jsonb,'{}'::jsonb)
      ->>'x-mawqifi-place-aware'='1'
 );

-- Add location snapshots while preserving notification preferences and delivery.
create or replace function public.enqueue_parking_post_app_notifications()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
 insert into public.app_notifications(user_id,kind,post_id,actor_id,data)
 select preferences.user_id,'parking_post',new.id,new.user_id,
  jsonb_build_object('college',new.college,'zone',new.zone,'gate',new.gate,
    'departure_minutes',new.departure_minutes,'place_id',new.place_id,
    'location_description',new.location_description,
    'place_name_ar',place.name_ar,'place_name_en',place.name_en)
 from public.user_notification_preferences preferences
 join public.places place on place.id=new.place_id
 where preferences.user_id<>new.user_id and preferences.in_app_enabled and preferences.parking_push_enabled
 on conflict do nothing;
 return new;
end; $$;
revoke execute on function public.enqueue_parking_post_app_notifications() from public,anon,authenticated;

notify pgrst, 'reload schema';
commit;
