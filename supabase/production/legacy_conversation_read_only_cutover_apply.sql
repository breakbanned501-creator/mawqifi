-- NOT A MIGRATION. Run ONLY after final approval of the preview's exact IDs.
-- Same psql session: -v approved_count='<reviewed count>'; archive manifest first.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
select set_config('mawqifi.approved_count', :'approved_count', true);
-- Match handoff lock order: post first, then conversation; deterministic IDs.
select p.id from public.parking_posts p join legacy_cutover_candidates x on x.post_id=p.id order by p.id for update of p;
select c.id from public.conversations c join legacy_cutover_candidates x on x.conversation_id=c.id order by c.id for update of c;
do $$ begin
 if (select count(*) from legacy_cutover_candidates)<>current_setting('mawqifi.approved_count')::integer then
  raise exception 'CUTOVER_MANIFEST_COUNT_MISMATCH';
 end if;
 if exists(select 1 from legacy_cutover_candidates x
  left join public.conversations c on c.id=x.conversation_id
  left join public.parking_posts p on p.id=x.post_id
  where c.id is null or p.id is null or c.closed or c.post_id<>x.post_id
   or c.created_at<>x.conversation_created_at or c.updated_at<>x.conversation_updated_at
   or p.status<>x.post_status or p.expires_at<>x.post_expires_at or p.updated_at<>x.post_updated_at
   or c.created_at>=x.rollout_cutoff
   or not (p.expires_at<=x.rollout_cutoff or (p.status<>'active' and p.updated_at<=x.rollout_cutoff))
   or exists(select 1 from public.parking_claims pc where pc.conversation_id=c.id)) then
  raise exception 'CUTOVER_MANIFEST_CHANGED_REVIEW_AGAIN';
 end if;
end $$;
create temp table legacy_cutover_applied on commit preserve rows as
with changed as (
 update public.conversations c set closed=true from legacy_cutover_candidates x
 where c.id=x.conversation_id
 returning c.id conversation_id,c.updated_at applied_updated_at
)
select x.*,z.applied_updated_at from changed z join legacy_cutover_candidates x using(conversation_id);
select * from legacy_cutover_applied order by conversation_id;
commit;
-- Export legacy_cutover_applied before closing the session; retain both manifests.
-- No messages/images/claims/arrival timestamps are changed.
