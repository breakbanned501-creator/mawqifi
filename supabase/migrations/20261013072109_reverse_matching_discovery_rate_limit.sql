
CREATE TABLE IF NOT EXISTS mawqifi_safety.parking_discovery_rate (
 user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
 last_lookup_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
REVOKE ALL ON mawqifi_safety.parking_discovery_rate FROM anon,authenticated;
CREATE OR REPLACE FUNCTION mawqifi_safety.throttle_parking_discovery()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE old_time timestamptz;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING errcode='42501'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(auth.uid()::text),31926);
 SELECT last_lookup_at INTO old_time
 FROM mawqifi_safety.parking_discovery_rate WHERE user_id=auth.uid() FOR UPDATE;
 IF old_time IS NOT NULL AND old_time>clock_timestamp()-interval '8 seconds'
 THEN RAISE EXCEPTION 'DISCOVERY_RATE_LIMIT'; END IF;
 INSERT INTO mawqifi_safety.parking_discovery_rate(user_id,last_lookup_at)
 VALUES(auth.uid(),clock_timestamp())
 ON CONFLICT(user_id) DO UPDATE SET last_lookup_at=excluded.last_lookup_at;
END $$;
REVOKE ALL ON FUNCTION mawqifi_safety.throttle_parking_discovery() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.nearby_parking_requests(
 p_place_id text,p_sub_place_id text,p_lat double precision,p_lng double precision,
 p_accuracy double precision,p_limit integer DEFAULT 20)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE results jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING errcode='42501'; END IF;
 PERFORM mawqifi_safety.assert_unrestricted();
 IF p_lat IS NULL OR p_lng IS NULL OR p_lat NOT BETWEEN -90 AND 90
  OR p_lng NOT BETWEEN -180 AND 180 OR p_accuracy IS NULL
  OR p_accuracy NOT BETWEEN 0 AND 100
 THEN RAISE EXCEPTION 'REQUEST_LOCATION_REQUIRED'; END IF;
 PERFORM mawqifi_safety.throttle_parking_discovery();
 PERFORM mawqifi_safety.expire_reverse_matches();
 WITH candidates AS (
   SELECT r.id,r.created_at,r.expires_at,
     6371000*2*asin(least(1,sqrt(
       power(sin(radians(c.latitude-p_lat)/2),2)
       +cos(radians(p_lat))*cos(radians(c.latitude))
        *power(sin(radians(c.longitude-p_lng)/2),2)
     ))) as meters
   FROM public.parking_requests r
   JOIN mawqifi_safety.parking_request_coordinates c ON c.request_id=r.id
   WHERE r.status='active' AND r.expires_at>clock_timestamp()
     AND r.requester_id<>auth.uid()
     AND r.place_id=p_place_id AND r.sub_place_id IS NOT DISTINCT FROM p_sub_place_id
     AND NOT mawqifi_safety.blocked_pair(r.requester_id,auth.uid())
 ),
 bands AS (
   SELECT id,created_at,expires_at,
     CASE WHEN meters<=150 THEN 'near'
          WHEN meters<=300 THEN 'medium'
          ELSE 'far' END AS distance_band,
     CASE WHEN meters<=150 THEN 1 WHEN meters<=300 THEN 2 ELSE 3 END AS band_rank
   FROM candidates WHERE meters<=500
 ),
 selected AS (
   SELECT id,created_at,expires_at,distance_band,band_rank FROM bands
   ORDER BY band_rank,created_at,id LIMIT least(greatest(coalesce(p_limit,20),1),20)
 )
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'created_at',created_at,
   'expires_at',expires_at,'distance_band',distance_band)
   ORDER BY band_rank,created_at,id),'[]'::jsonb) INTO results FROM selected;
 RETURN results;
END $$;
