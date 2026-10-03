-- Official PAAET directory: https://www.paaet.edu.kw/ar/call/ (2026-10-03).
-- Additive allowlist only: no row changes, new columns/tables, RPC or RLS changes.
begin;
alter table public.parking_posts drop constraint parking_posts_valid_sub_place;
alter table public.parking_posts add constraint parking_posts_valid_sub_place check (
 sub_place_id is null or
 (place_id is not null and ((place_id='kuwait_university' and sub_place_id in ('education','arts','science','administrative_sciences','life_sciences','engineering_petroleum','law','sharia','social_sciences','medicine','pharmacy'))
 or (place_id='paaet' and sub_place_id in ('basic_education_ardiya','basic_education_jahra','nursing_shuwaikh','health_sciences_shuwaikh','technological_studies_shuwaikh','business_studies_ardiya','communications_navigation_shuwaikh','energy_shuwaikh','industrial_shuwaikh','industrial_sabah_al_salem','nursing_institute_shuwaikh','administrative_services_hawally_girls','administrative_services_hawally_boys','construction_south_sabahiya','vocational_sharq')))));
commit;
