DO $$
DECLARE existing_check text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='parking_requests_verified_subplace' AND conrelid='public.parking_requests'::regclass) THEN
    SELECT pg_get_constraintdef(oid) INTO existing_check
    FROM pg_constraint
    WHERE conrelid='public.parking_posts'::regclass AND conname='parking_posts_valid_sub_place';
    IF existing_check IS NULL OR existing_check NOT LIKE 'CHECK%' THEN
       RAISE EXCEPTION 'MISSING_PARKING_SCOPE_CONSTRAINT';
    END IF;
    EXECUTE 'ALTER TABLE public.parking_requests ADD CONSTRAINT parking_requests_verified_subplace ' || existing_check;
  END IF;
END $$;