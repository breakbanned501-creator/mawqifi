
CREATE OR REPLACE FUNCTION mawqifi_safety.expire_reverse_matches()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
 UPDATE public.parking_match_offers
 SET status='expired'
 WHERE status='pending' AND expires_at <= clock_timestamp();
 UPDATE public.parking_requests r
 SET status='active'
 WHERE status='offered' AND expires_at > clock_timestamp()
   AND NOT EXISTS (
     SELECT 1 FROM public.parking_match_offers o
     WHERE o.request_id=r.id AND o.status='pending' AND o.expires_at>clock_timestamp()
   );
 UPDATE public.parking_requests SET status='expired'
 WHERE status IN ('active','offered') AND expires_at <= clock_timestamp();
 DELETE FROM mawqifi_safety.parking_request_coordinates c
 USING public.parking_requests r
 WHERE c.request_id=r.id AND r.status NOT IN ('active','offered');
END $$;
REVOKE ALL ON FUNCTION mawqifi_safety.expire_reverse_matches() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.create_parking_request(
 p_place_id text, p_sub_place_id text,
 p_lat double precision, p_lng double precision, p_accuracy double precision)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
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
 INSERT INTO public.parking_requests(requester_id,place_id,sub_place_id)
 VALUES(auth.uid(),p_place_id,p_sub_place_id) RETURNING * INTO result;
 INSERT INTO mawqifi_safety.parking_request_coordinates
 (request_id,latitude,longitude,accuracy_meters)
 VALUES(result.id,p_lat,p_lng,p_accuracy);
 RETURN jsonb_build_object('id',result.id,'status',result.status,
   'created_at',result.created_at,'expires_at',result.expires_at,
   'place_id',result.place_id,'sub_place_id',result.sub_place_id);
END $$;

CREATE OR REPLACE FUNCTION public.my_parking_request()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE r public.parking_requests%ROWTYPE; offer public.parking_match_offers%ROWTYPE; details jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING errcode='42501'; END IF;
 PERFORM mawqifi_safety.assert_unrestricted();
 PERFORM mawqifi_safety.expire_reverse_matches();
 SELECT * INTO r FROM public.parking_requests
 WHERE requester_id=auth.uid() ORDER BY created_at DESC LIMIT 1;
 IF NOT FOUND OR r.status NOT IN ('active','offered','matched') THEN
   RETURN jsonb_build_object('request',null,'offer',null,'server_now',clock_timestamp());
 END IF;
 SELECT * INTO offer FROM public.parking_match_offers
 WHERE request_id=r.id AND status IN ('pending','accepted') ORDER BY created_at DESC LIMIT 1;
 details:=null;
 IF FOUND THEN
   SELECT jsonb_build_object('id',offer.id,'status',offer.status,'expires_at',offer.expires_at,
       'post_id',offer.post_id,
       'conversation_id',(SELECT c.conversation_id FROM public.parking_claims c
                          WHERE c.post_id=offer.post_id AND c.claimant_id=auth.uid()
                          LIMIT 1))
   INTO details;
 END IF;
 RETURN jsonb_build_object('request',jsonb_build_object(
   'id',r.id,'status',r.status,'expires_at',r.expires_at,
   'place_id',r.place_id,'sub_place_id',r.sub_place_id),
   'offer',details,'server_now',clock_timestamp());
END $$;

CREATE OR REPLACE FUNCTION public.cancel_parking_request(p_request_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE r public.parking_requests%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING errcode='42501'; END IF;
 PERFORM mawqifi_safety.assert_unrestricted();
 SELECT * INTO r FROM public.parking_requests WHERE id=p_request_id FOR UPDATE;
 IF NOT FOUND OR r.requester_id<>auth.uid() THEN RAISE EXCEPTION 'REQUEST_UNAVAILABLE' USING errcode='42501'; END IF;
 IF r.status NOT IN ('active','offered') THEN RETURN false; END IF;
 UPDATE public.parking_match_offers SET status='cancelled'
 WHERE request_id=r.id AND status='pending';
 UPDATE public.parking_requests SET status='cancelled' WHERE id=r.id;
 DELETE FROM mawqifi_safety.parking_request_coordinates WHERE request_id=r.id;
 RETURN true;
END $$;

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
   SELECT id,created_at,expires_at,distance_band FROM bands
   ORDER BY band_rank,created_at,id LIMIT least(greatest(coalesce(p_limit,20),1),20)
 )
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'created_at',created_at,
   'expires_at',expires_at,'distance_band',distance_band)
   ORDER BY created_at,id),'[]'::jsonb) INTO results FROM selected;
 RETURN results;
END $$;

CREATE OR REPLACE FUNCTION public.offer_parking_to_request(p_request_id uuid,p_post_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE r public.parking_requests%ROWTYPE; p public.parking_posts%ROWTYPE;
 loc public.parking_post_locations%ROWTYPE; rc mawqifi_safety.parking_request_coordinates%ROWTYPE;
 meters double precision; until_at timestamptz; offer public.parking_match_offers%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING errcode='42501'; END IF;
 PERFORM mawqifi_safety.assert_unrestricted();
 PERFORM mawqifi_safety.expire_reverse_matches();
 SELECT * INTO p FROM public.parking_posts WHERE id=p_post_id FOR UPDATE;
 IF NOT FOUND OR p.user_id<>auth.uid() OR p.status<>'active' OR NOT p.handoff
 OR p.expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'OFFER_SPOT_UNAVAILABLE'; END IF;
 SELECT * INTO r FROM public.parking_requests WHERE id=p_request_id FOR UPDATE;
 IF NOT FOUND OR r.status<>'active' OR r.expires_at<=clock_timestamp()
  OR r.requester_id=auth.uid() THEN RAISE EXCEPTION 'OFFER_REQUEST_UNAVAILABLE'; END IF;
 IF r.place_id<>p.place_id OR r.sub_place_id IS DISTINCT FROM p.sub_place_id
 OR mawqifi_safety.blocked_pair(r.requester_id,auth.uid())
 THEN RAISE EXCEPTION 'OFFER_SCOPE_MISMATCH'; END IF;
 SELECT * INTO loc FROM public.parking_post_locations WHERE post_id=p.id;
 SELECT * INTO rc FROM mawqifi_safety.parking_request_coordinates WHERE request_id=r.id;
 IF NOT FOUND OR loc.post_id IS NULL THEN RAISE EXCEPTION 'OFFER_LOCATION_MISSING'; END IF;
 meters := 6371000*2*asin(least(1,sqrt(
     power(sin(radians(rc.latitude-loc.latitude)/2),2)
    +cos(radians(loc.latitude))*cos(radians(rc.latitude))
     *power(sin(radians(rc.longitude-loc.longitude)/2),2))));
 IF meters IS NULL OR meters>500 THEN RAISE EXCEPTION 'OFFER_TOO_FAR'; END IF;
 until_at := least(clock_timestamp()+interval '60 seconds',r.expires_at,p.expires_at);
 IF until_at<=clock_timestamp() THEN RAISE EXCEPTION 'OFFER_EXPIRED'; END IF;
 INSERT INTO public.parking_match_offers(request_id,post_id,departing_user_id,requester_id,expires_at)
 VALUES(r.id,p.id,p.user_id,r.requester_id,until_at) RETURNING * INTO offer;
 UPDATE public.parking_requests SET status='offered' WHERE id=r.id;
 INSERT INTO public.app_notifications(user_id,kind,post_id,actor_id,data)
 SELECT r.requester_id,'system',p.id,p.user_id,
 jsonb_build_object('event_key','parking_match_offer','offer_id',offer.id,
     'title','في شخص قريب يبي يعطيك موقف 🚗',
     'body','افتح موقفي خلال دقيقة للموافقة أو الرفض','href','/')
 FROM public.user_notification_preferences pref
 WHERE pref.user_id=r.requester_id AND pref.in_app_enabled;
 RETURN jsonb_build_object('offer_id',offer.id,'requester_id',r.requester_id,
   'expires_at',offer.expires_at);
END $$;

CREATE OR REPLACE FUNCTION public.decline_parking_offer(p_offer_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE o public.parking_match_offers%ROWTYPE; r public.parking_requests%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING errcode='42501'; END IF;
 PERFORM mawqifi_safety.assert_unrestricted();
 SELECT * INTO o FROM public.parking_match_offers WHERE id=p_offer_id FOR UPDATE;
 IF NOT FOUND OR o.requester_id<>auth.uid() THEN
   RAISE EXCEPTION 'OFFER_NOT_ALLOWED' USING errcode='42501'; END IF;
 IF o.status<>'pending' THEN RETURN false; END IF;
 SELECT * INTO r FROM public.parking_requests WHERE id=o.request_id FOR UPDATE;
 UPDATE public.parking_match_offers SET status='declined' WHERE id=o.id;
 IF r.status='offered' AND r.expires_at>clock_timestamp() THEN
   UPDATE public.parking_requests SET status='active' WHERE id=r.id;
 END IF;
 RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.accept_parking_offer(p_offer_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE o public.parking_match_offers%ROWTYPE;
 p public.parking_posts%ROWTYPE;r public.parking_requests%ROWTYPE;handoff jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING errcode='42501'; END IF;
 PERFORM mawqifi_safety.assert_unrestricted();
 SELECT * INTO o FROM public.parking_match_offers WHERE id=p_offer_id;
 IF NOT FOUND OR o.requester_id<>auth.uid() THEN RAISE EXCEPTION 'OFFER_NOT_ALLOWED' USING errcode='42501'; END IF;
 SELECT * INTO p FROM public.parking_posts WHERE id=o.post_id FOR UPDATE;
 SELECT * INTO r FROM public.parking_requests WHERE id=o.request_id FOR UPDATE;
 SELECT * INTO o FROM public.parking_match_offers WHERE id=p_offer_id FOR UPDATE;
 IF o.status='accepted' THEN
  RETURN mawqifi_safety.handoff_state(
   (SELECT c.conversation_id FROM public.parking_claims c WHERE c.post_id=o.post_id AND c.claimant_id=auth.uid() LIMIT 1));
 END IF;
 IF o.status<>'pending' OR o.expires_at<=clock_timestamp()
 OR r.status<>'offered' OR r.expires_at<=clock_timestamp()
 OR p.status<>'active' OR p.expires_at<=clock_timestamp()
 THEN RAISE EXCEPTION 'OFFER_EXPIRED'; END IF;
 IF mawqifi_safety.blocked_pair(r.requester_id,p.user_id) THEN
   RAISE EXCEPTION 'SAFETY_BLOCKED';
 END IF;
 handoff := mawqifi_safety.claim_post(p.id);
 UPDATE public.parking_match_offers SET status='accepted',accepted_at=clock_timestamp() WHERE id=o.id;
 UPDATE public.parking_requests SET status='matched',matched_at=clock_timestamp() WHERE id=r.id;
 DELETE FROM mawqifi_safety.parking_request_coordinates WHERE request_id=r.id;
 RETURN handoff;
END $$;
REVOKE ALL ON FUNCTION public.create_parking_request(text,text,double precision,double precision,double precision) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.my_parking_request() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.cancel_parking_request(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.nearby_parking_requests(text,text,double precision,double precision,double precision,integer) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.offer_parking_to_request(uuid,uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.decline_parking_offer(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.accept_parking_offer(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_parking_request(text,text,double precision,double precision,double precision) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_parking_request() TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_parking_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.nearby_parking_requests(text,text,double precision,double precision,double precision,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.offer_parking_to_request(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decline_parking_offer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_parking_offer(uuid) TO authenticated;
