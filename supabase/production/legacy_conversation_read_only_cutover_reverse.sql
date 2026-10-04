-- Emergency reversal ONLY with separate approval, while the reviewed audit is loaded.
-- Same session as apply, or restore its exported audit to a TEMP table first.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
select p.id from public.parking_posts p join legacy_cutover_applied x on x.post_id=p.id order by p.id for update of p;
select c.id from public.conversations c join legacy_cutover_applied x on x.conversation_id=c.id order by c.id for update of c;
do $$ begin
 if exists(select 1 from legacy_cutover_applied x
  left join public.conversations c on c.id=x.conversation_id
  left join public.parking_posts p on p.id=x.post_id
  where c.id is null or not c.closed or c.updated_at<>x.applied_updated_at
   or c.post_id<>x.post_id
   or p.id is null or p.status<>x.post_status or p.expires_at<>x.post_expires_at or p.updated_at<>x.post_updated_at
   or exists(select 1 from public.parking_claims pc where pc.conversation_id=c.id)
   or exists(select 1 from public.messages m where m.conversation_id=c.id and m.created_at>x.applied_updated_at)) then
  raise exception 'CUTOVER_REVERSE_DRIFT_REQUIRES_MANUAL_REVIEW';
 end if;
end $$;
update public.conversations c set closed=false
from legacy_cutover_applied x where c.id=x.conversation_id;
commit;
