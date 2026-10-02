begin;
-- Repair a staging-only Windows SQL transport encoding issue. The original
-- repository migration contains the correct Unicode; this additive repair is
-- harmless after a correctly encoded application and never invents a location.
create or replace function mawqifi_safety.valid_legacy_ku_location(c text,z text,g text) returns boolean
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
update public.places set name_ar='جامعة الكويت',name_en='Kuwait University' where id='kuwait_university';
update public.places set name_ar='التطبيقي',name_en='PAAET' where id='paaet';
update public.parking_posts set place_id='kuwait_university' where place_id is null and mawqifi_safety.valid_legacy_ku_location(college,zone,gate);
notify pgrst, 'reload schema';
commit;
