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
 INSERT INTO public.app_notifications(user_id,kind,actor_id,data)
 SELECT r.requester_id,'system',p.user_id,
 jsonb_build_object('event_key','parking_match_offer','offer_id',offer.id,'post_id',p.id,
     'title','في شخص قريب يبي يعطيك موقف',
     'body','افتح موقفي خلال دقيقة للموافقة أو الرفض','href','/')
 FROM public.user_notification_preferences pref
 WHERE pref.user_id=r.requester_id AND pref.in_app_enabled;
 RETURN jsonb_build_object('offer_id',offer.id,'requester_id',r.requester_id,
   'expires_at',offer.expires_at);
END $$;