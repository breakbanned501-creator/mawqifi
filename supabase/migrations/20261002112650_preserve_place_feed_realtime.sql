begin;
-- Realtime's WAL/RLS evaluator sets JWT claims, not PostgREST request.headers.
-- Old REST requests still carry headers and omit the place-aware marker.
-- This is presentation compatibility only; ownership/blocking RLS still applies.
alter policy place_legacy_client_read on public.parking_posts using (
 place_id='kuwait_university'
 or nullif(current_setting('request.headers',true),'') is null
 or coalesce(nullif(current_setting('request.headers',true),'')::jsonb,'{}'::jsonb)->>'x-mawqifi-place-aware'='1'
);
notify pgrst, 'reload schema';
commit;
