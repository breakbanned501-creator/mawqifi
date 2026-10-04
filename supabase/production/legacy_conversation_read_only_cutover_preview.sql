-- PREPARATION ONLY. Future execution requires separate approval.
-- psql: -v rollout_cutoff='<approved UTC instant>' -f this-file
-- Run AFTER the 14 reviewed migrations, on the same connection as apply.
-- The cutoff is captured before rollout; never default it to execution time.
begin;
set local statement_timeout='30s';
select set_config('mawqifi.rollout_cutoff', :'rollout_cutoff', false);
create temp table legacy_cutover_candidates on commit preserve rows as
select c.id conversation_id,c.post_id,c.created_at conversation_created_at,
 c.updated_at conversation_updated_at,p.status post_status,p.expires_at post_expires_at,
 p.updated_at post_updated_at,current_setting('mawqifi.rollout_cutoff')::timestamptz rollout_cutoff
from public.conversations c join public.parking_posts p on p.id=c.post_id
where not c.closed
 and c.created_at<current_setting('mawqifi.rollout_cutoff')::timestamptz
 -- Expiry proves inactivity at cutoff even if additive backfills updated the row.
 -- Otherwise require a status timestamp predating cutoff; never infer an old cancellation.
 and (p.expires_at<=current_setting('mawqifi.rollout_cutoff')::timestamptz
  or (p.status<>'active' and p.updated_at<=current_setting('mawqifi.rollout_cutoff')::timestamptz))
 and not exists(select 1 from public.parking_claims pc where pc.conversation_id=c.id);
alter table legacy_cutover_candidates add primary key(conversation_id);
select * from legacy_cutover_candidates order by conversation_id;
select count(*) proposed_count from legacy_cutover_candidates;
commit;
-- Export this exact manifest for review. Do not assume the old count of 15.
