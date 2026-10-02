begin;
-- ASCII Unicode escapes survive Windows tooling and strip invisible location text.
create or replace function mawqifi_safety.guard_post_place() returns trigger
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
   if length(regexp_replace(coalesce(new.location_description,''),U&'[[:space:]\200B\200C\200D\200E\200F\FEFF]','','g')) < 3 then
     raise exception 'PLACE_LOCATION_REQUIRED' using errcode='23514';
   end if;
 end if;
 if length(coalesce(new.location_description,''))>500 then
   raise exception 'PLACE_LOCATION_TOO_LONG' using errcode='23514';
 end if;
 return new;
end; $$;
revoke all on function mawqifi_safety.guard_post_place() from public, anon, authenticated;

notify pgrst, 'reload schema';
commit;
