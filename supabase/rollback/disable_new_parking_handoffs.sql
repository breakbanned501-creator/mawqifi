-- Emergency pause only; NOT applied. Review and target staging explicitly before execution.
-- Retains existing claims/arrival/timers and all history. No schema/data deletion.
begin;
revoke insert on public.parking_posts,public.conversations from authenticated;
revoke execute on function public.publish_parking_handoff(jsonb,double precision,double precision,double precision) from authenticated;
revoke execute on function public.claim_parking_post(uuid) from authenticated;
revoke execute on function mawqifi_safety.publish_handoff(jsonb,double precision,double precision,double precision) from authenticated;
revoke execute on function mawqifi_safety.claim_post(uuid) from authenticated;
commit;
