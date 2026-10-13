
CREATE OR REPLACE FUNCTION public.enqueue_parking_post_app_notifications()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 -- Targeted reverse-matching publication: suppress legacy broadcast only inside this transaction.
 if current_setting('mawqifi.reverse_matching',true) = 'yes' then return NEW; end if;
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
end; $function$;
CREATE OR REPLACE FUNCTION public.give_parking_to_request(
  p_request_id uuid, p_place_id text, p_sub_place_id text,
  p_lat double precision,p_lng double precision,p_accuracy double precision)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE new_post uuid; response jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING errcode='42501'; END IF;
 PERFORM mawqifi_safety.assert_unrestricted();
 IF p_lat IS NULL OR p_lng IS NULL OR p_lat NOT BETWEEN -90 AND 90 OR p_lng NOT BETWEEN -180 AND 180
 OR p_accuracy IS NULL OR p_accuracy NOT BETWEEN 0 AND 100 THEN
   RAISE EXCEPTION 'OFFER_LOCATION_REQUIRED'; END IF;
 -- Publication and offer share one atomic transaction; an offer failure rolls back the post.
 PERFORM pg_catalog.set_config('mawqifi.reverse_matching','yes',true);
 new_post := mawqifi_safety.publish_handoff(
   jsonb_build_object('place_id',p_place_id,'sub_place_id',p_sub_place_id,'departure_minutes',10),
   p_lat,p_lng,p_accuracy);
 response := public.offer_parking_to_request(p_request_id,new_post);
 RETURN response || jsonb_build_object('post_id',new_post);
END $$;
REVOKE ALL ON FUNCTION public.give_parking_to_request(uuid,text,text,double precision,double precision,double precision) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.give_parking_to_request(uuid,text,text,double precision,double precision,double precision) TO authenticated;
CREATE TABLE IF NOT EXISTS public.parking_match_push_events(
  offer_id uuid PRIMARY KEY REFERENCES public.parking_match_offers(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.parking_match_push_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.parking_match_push_events FROM anon,authenticated;
