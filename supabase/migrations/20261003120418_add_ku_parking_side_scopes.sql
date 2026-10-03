-- User-confirmed North/South choices for all 11 existing KU colleges.
-- Reuse sub_place_id: additive validation metadata only. No data backfill.
-- Legacy college-only IDs remain valid, without inferring a parking side.
begin;
alter table public.parking_posts drop constraint parking_posts_valid_sub_place;
alter table public.parking_posts add constraint parking_posts_valid_sub_place check (
 sub_place_id is null or
 (place_id is not null and ((place_id='kuwait_university' and sub_place_id in ('education','arts','science','administrative_sciences','life_sciences','engineering_petroleum','law','sharia','social_sciences','medicine','pharmacy','education_north','education_south','arts_north','arts_south','science_north','science_south','administrative_sciences_north','administrative_sciences_south','life_sciences_north','life_sciences_south','engineering_petroleum_north','engineering_petroleum_south','law_north','law_south','sharia_north','sharia_south','social_sciences_north','social_sciences_south','medicine_north','medicine_south','pharmacy_north','pharmacy_south'))
 or (place_id='paaet' and sub_place_id in ('basic_education_ardiya','basic_education_jahra','nursing_shuwaikh','health_sciences_shuwaikh','technological_studies_shuwaikh','business_studies_ardiya','communications_navigation_shuwaikh','energy_shuwaikh','industrial_shuwaikh','industrial_sabah_al_salem','nursing_institute_shuwaikh','administrative_services_hawally_girls','administrative_services_hawally_boys','construction_south_sabahiya','vocational_sharq')))));
commit;
