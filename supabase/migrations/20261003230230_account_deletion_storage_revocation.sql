-- Live staging verification found cached authorized image responses. This
-- service-only scope supports revoking those caches before Auth deletion success.
-- Read-only path lookup: peer images are never scheduled for removal. The Edge
-- Function's Storage remove() accepts ONLY the original owned-object manifest.
-- These paths are used solely by /storage/v1/cdn/<bucket>/<object> cache purge
-- and old-token GET checks; no whole-bucket purge or peer-content delete occurs.
begin;
create function public.account_deletion_cache_probes(account_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if not exists(select 1 from mawqifi_safety.account_deletion_jobs where user_id=account_id) then
  raise exception 'DELETION_NOT_STARTED';
 end if;
 select coalesce(jsonb_agg(x.object),'[]') into result from (
  select o as object from mawqifi_safety.account_deletion_jobs j,jsonb_array_elements(j.objects) o where j.user_id=account_id
  union
  select jsonb_build_object('bucket_id',o.bucket_id,'name',o.name) from storage.objects o
  where o.bucket_id='chat-images' and exists(select 1 from public.conversations c
   where account_id in(c.owner_id,c.requester_id) and split_part(o.name,'/',1)='chat' and split_part(o.name,'/',2)=c.id::text)
 ) x;
 return result;
end; $$;
revoke all on function public.account_deletion_cache_probes(uuid) from public,anon,authenticated;
grant execute on function public.account_deletion_cache_probes(uuid) to service_role;
commit;
