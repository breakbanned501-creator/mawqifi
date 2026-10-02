-- Cached owner Delete becomes cancellation; no historical migration is edited.
begin;
create function mawqifi_safety.cancel_cached_post_delete() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 -- Explicit trusted administration may remove disposable fixtures. The retained-chat FK still protects history.
 if auth.uid() is null then return old; end if;
 if old.user_id<>auth.uid() then raise exception 'Authentication required' using errcode='42501'; end if;
 update public.parking_posts set status='cancelled' where id=old.id;
 return null;
end; $$;
revoke all on function mawqifi_safety.cancel_cached_post_delete() from public,anon,authenticated;
create trigger handoff_cached_delete before delete on public.parking_posts for each row execute function mawqifi_safety.cancel_cached_post_delete();
grant delete on public.parking_posts to authenticated;
create or replace function mawqifi_safety.claim_post(pid uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p public.parking_posts%rowtype; c public.parking_claims%rowtype; cid uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 perform mawqifi_safety.assert_unrestricted();
 select * into p from public.parking_posts where id=pid for update;
 if not found or p.user_id=auth.uid() then raise exception 'HANDOFF_INVALID'; end if;
 perform mawqifi_safety.lock_pair(p.user_id,auth.uid());
 if mawqifi_safety.blocked_pair(p.user_id,auth.uid()) then raise exception 'SAFETY_BLOCKED'; end if;
 select * into c from public.parking_claims where post_id=pid;
 if found then
  if c.claimant_id=auth.uid() then return mawqifi_safety.handoff_state(c.conversation_id); end if;
  raise exception 'HANDOFF_ALREADY_CLAIMED';
 end if;
 if p.status<>'active' or p.expires_at<=clock_timestamp() then raise exception 'SAFETY_POST_EXPIRED'; end if;
 -- Reuse a pre-migration conversation for this same pair; don't rewrite other history.
 select id into cid from public.conversations where post_id=pid and requester_id=auth.uid();
 if cid is null then
  insert into public.conversations(post_id,owner_id,requester_id) values(pid,p.user_id,auth.uid()) returning id into cid;
 else
  if exists(select 1 from public.conversations where id=cid and closed) then raise exception 'HANDOFF_CHAT_CLOSED'; end if;
  insert into public.parking_claims(post_id,owner_id,claimant_id,conversation_id) values(pid,p.user_id,auth.uid(),cid);
  update public.parking_posts set status='claimed' where id=pid;
  update public.conversations set closed=false where id=cid;
 end if;
 return mawqifi_safety.handoff_state(cid);
end; $$;

create or replace function mawqifi_safety.guard_reserved_post() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.handoff<>old.handoff then raise exception 'HANDOFF_IMMUTABLE'; end if;
 if exists(select 1 from public.parking_claims where post_id=old.id) then
  if new.place_id is distinct from old.place_id or new.college is distinct from old.college or new.zone is distinct from old.zone or new.gate is distinct from old.gate or new.location_description is distinct from old.location_description or new.expires_at<>old.expires_at then raise exception 'HANDOFF_IMMUTABLE'; end if;
  if new.status in('active','expired') then raise exception 'HANDOFF_ALREADY_CLAIMED'; end if;
 end if;
 return new;
end; $$;
commit;
