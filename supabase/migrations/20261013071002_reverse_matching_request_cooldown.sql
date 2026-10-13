
CREATE TABLE mawqifi_safety.parking_request_submission_times(
 user_id uuid primary key references public.users(id) on delete cascade,
 last_created_at timestamptz not null default clock_timestamp());
ALTER TABLE mawqifi_safety.parking_request_submission_times ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON mawqifi_safety.parking_request_submission_times FROM anon,authenticated;
CREATE OR REPLACE FUNCTION public.create_parking_request(p_place_id text, p_sub_place_id text, p_lat double precision, p_lng double precision, p_accuracy double precision)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE existing public.parking_requests%ROWTYPE; result public.parking_requests%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING errcode='42501'; END IF;
 PERFORM mawqifi_safety.assert_unrestricted();
 IF NOT EXISTS (SELECT 1 FROM public.places WHERE id=p_place_id AND active)
   OR (p_place_id IN ('kuwait_university','paaet') AND (p_sub_place_id IS NULL OR p_sub_place_id=''))
   OR (p_sub_place_id IS NOT NULL AND (length(p_sub_place_id)>100 OR p_sub_place_id !~ '^[a-z0-9_]+$'))
 THEN RAISE EXCEPTION 'REQUEST_INVALID_SCOPE'; END IF;
 IF p_lat IS NULL OR p_lng IS NULL OR p_lat NOT BETWEEN -90 AND 90
    OR p_lng NOT BETWEEN -180 AND 180 OR p_accuracy IS NULL
    OR p_accuracy NOT BETWEEN 0 AND 100
 THEN RAISE EXCEPTION 'REQUEST_LOCATION_REQUIRED'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(auth.uid()::text), 31925);
 PERFORM mawqifi_safety.expire_reverse_matches();
 SELECT * INTO existing FROM public.parking_requests
 WHERE requester_id=auth.uid() AND status IN ('active','offered') FOR UPDATE;
 IF FOUND THEN
   RETURN jsonb_build_object('id',existing.id,'status',existing.status,
     'created_at',existing.created_at,'expires_at',existing.expires_at,
     'place_id',existing.place_id,'sub_place_id',existing.sub_place_id);
 END IF;

 IF EXISTS (SELECT 1 FROM mawqifi_safety.parking_request_submission_times
   WHERE user_id=auth.uid() AND last_created_at>clock_timestamp()-interval '30 seconds')
 THEN RAISE EXCEPTION 'REQUEST_RATE_LIMIT'; END IF;
 INSERT INTO mawqifi_safety.parking_request_submission_times(user_id,last_created_at)
 VALUES(auth.uid(),clock_timestamp())
 ON CONFLICT(user_id) DO UPDATE SET last_created_at=excluded.last_created_at;
 INSERT INTO public.parking_requests(requester_id,place_id,sub_place_id)
 VALUES(auth.uid(),p_place_id,p_sub_place_id) RETURNING * INTO result;
 INSERT INTO mawqifi_safety.parking_request_coordinates
 (request_id,latitude,longitude,accuracy_meters)
 VALUES(result.id,p_lat,p_lng,p_accuracy);
 RETURN jsonb_build_object('id',result.id,'status',result.status,
   'created_at',result.created_at,'expires_at',result.expires_at,
   'place_id',result.place_id,'sub_place_id',result.sub_place_id);
END $function$;
