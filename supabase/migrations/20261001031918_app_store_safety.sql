begin;
create schema if not exists mawqifi_safety;
revoke all on schema mawqifi_safety from public, anon, authenticated;
create table mawqifi_safety.post_submission_times (
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index post_submission_times_user_idx on mawqifi_safety.post_submission_times(user_id,created_at);
alter table mawqifi_safety.post_submission_times enable row level security;
revoke all on mawqifi_safety.post_submission_times from public, anon, authenticated;
-- Trusted moderators can restrict posting/chat without deleting accounts or data.
create table public.account_restrictions (
  user_id uuid primary key references public.users(id) on delete cascade,
  reason text not null,
  created_at timestamptz not null default now()
);
alter table public.account_restrictions enable row level security;
revoke all on public.account_restrictions from public, anon, authenticated;
grant all on public.account_restrictions to service_role;
create function mawqifi_safety.assert_unrestricted() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if exists(select 1 from public.account_restrictions where user_id=auth.uid()) then raise exception 'SAFETY_RESTRICTED' using errcode='42501'; end if;
end; $$;
revoke all on function mawqifi_safety.assert_unrestricted() from public, anon, authenticated;

create table public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.users(id) on delete cascade,
  target_type text not null check (target_type in ('post','message','user')),
  target_id uuid not null,
  reason text not null check (reason in ('inappropriate','abuse','harassment','fake','spam','other')),
  details text not null default '' check (length(details) <= 300),
  created_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending','reviewing','resolved','dismissed')),
  unique(reporter_id, target_type, target_id)
);
create index content_reports_queue_idx on public.content_reports(status, created_at);
create index content_reports_reporter_time_idx on public.content_reports(reporter_id, created_at);
alter table public.content_reports enable row level security;
revoke all on public.content_reports from public, anon, authenticated;
grant select, insert on public.content_reports to authenticated;
grant all on public.content_reports to service_role;
create policy reports_own_read on public.content_reports for select to authenticated using (reporter_id = (select auth.uid()));
create policy reports_own_insert on public.content_reports for insert to authenticated
  with check (reporter_id = (select auth.uid()) and status = 'pending');

create table public.user_blocks (
  blocker_id uuid not null references public.users(id) on delete cascade,
  blocked_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(blocker_id, blocked_id), check(blocker_id <> blocked_id)
);
create index user_blocks_reverse_idx on public.user_blocks(blocked_id, blocker_id);
alter table public.user_blocks enable row level security;
revoke all on public.user_blocks from public, anon, authenticated;
grant select, insert, delete on public.user_blocks to authenticated;
grant all on public.user_blocks to service_role;
create policy blocks_own_read on public.user_blocks for select to authenticated using (blocker_id = (select auth.uid()));
create policy blocks_own_insert on public.user_blocks for insert to authenticated with check (blocker_id = (select auth.uid()));
create policy blocks_own_delete on public.user_blocks for delete to authenticated using (blocker_id = (select auth.uid()));

-- Private helper sees both directions without exposing another user's block list.
create function mawqifi_safety.blocked_pair(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.user_blocks where (blocker_id=a and blocked_id=b) or (blocker_id=b and blocked_id=a));
$$;
revoke all on function mawqifi_safety.blocked_pair(uuid,uuid) from public, anon, authenticated;
-- Narrow public RPC: a caller can only ask about their own relationship.
create function public.is_user_blocked(target_user uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  return mawqifi_safety.blocked_pair(auth.uid(), target_user);
end; $$;
revoke all on function public.is_user_blocked(uuid) from public, anon;
grant execute on function public.is_user_blocked(uuid) to authenticated;

-- Restrictive policies intersect existing permissions instead of replacing them.
create policy safety_hide_blocked_posts on public.parking_posts as restrictive for select to authenticated
  using (not public.is_user_blocked(user_id) or user_id = (select auth.uid())
    or exists(select 1 from public.conversations c where c.post_id=parking_posts.id and (c.owner_id=auth.uid() or c.requester_id=auth.uid())));

create function mawqifi_safety.validate_report() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or new.reporter_id <> auth.uid() then raise exception 'Authentication required' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('report:' || auth.uid()::text,0));
  if exists(select 1 from public.content_reports where reporter_id=auth.uid() and target_type=new.target_type and target_id=new.target_id) then
    raise exception 'Duplicate report' using errcode='23505';
  end if;
  if (select count(*) from public.content_reports where reporter_id=auth.uid() and created_at > now()-interval '5 minutes') >= 5 then
    raise exception 'SAFETY_RATE_LIMIT';
  end if;
  if new.target_type='post' and not exists(select 1 from public.parking_posts where id=new.target_id and user_id<>auth.uid()) then raise exception 'Invalid report target'; end if;
  if new.target_type='user' and not exists(select 1 from public.users where id=new.target_id and id<>auth.uid()) then raise exception 'Invalid report target'; end if;
  if new.target_type='message' and not exists(select 1 from public.messages m join public.conversations c on c.id=m.conversation_id where m.id=new.target_id and m.sender_id<>auth.uid() and auth.uid() in (c.owner_id,c.requester_id)) then raise exception 'Invalid report target'; end if;
  if new.reason='other' and btrim(new.details)='' then raise exception 'Details required'; end if;
  new.created_at := now(); new.status := 'pending';
  return new;
end; $$;
revoke all on function mawqifi_safety.validate_report() from public, anon, authenticated;
create trigger safety_report_guard before insert on public.content_reports for each row execute function mawqifi_safety.validate_report();

-- Both sending and blocking serialize on the same user pair, so a concurrent
-- message cannot pass the block check after the block has committed.
create function mawqifi_safety.lock_pair(a uuid,b uuid) returns void
language sql set search_path = '' as $$
  select pg_advisory_xact_lock(hashtextextended(least(a::text,b::text)||':'||greatest(a::text,b::text),0));
$$;
revoke all on function mawqifi_safety.lock_pair(uuid,uuid) from public, anon, authenticated;
create function mawqifi_safety.guard_block() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or new.blocker_id<>auth.uid() then raise exception 'Authentication required' using errcode='42501'; end if;
  perform mawqifi_safety.lock_pair(new.blocker_id,new.blocked_id);
  new.created_at:=now(); return new;
end; $$;
revoke all on function mawqifi_safety.guard_block() from public, anon, authenticated;
create trigger safety_block_guard before insert on public.user_blocks for each row execute function mawqifi_safety.guard_block();

create function mawqifi_safety.guard_conversation() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if TG_OP='UPDATE' then
    if new.owner_id<>old.owner_id or new.requester_id<>old.requester_id or new.post_id<>old.post_id then raise exception 'Participants are immutable'; end if;
    return new;
  end if;
  if auth.uid() is null or new.requester_id<>auth.uid() then raise exception 'Authentication required' using errcode='42501'; end if;
  perform mawqifi_safety.assert_unrestricted();
  if not exists(select 1 from public.parking_posts p where p.id=new.post_id and p.user_id=new.owner_id) then raise exception 'Invalid post'; end if;
  -- Cover a fetch/insert network race, including the expiry RPC changing status.
  -- Explicitly closed posts and posts expired longer than 30 seconds stay closed.
  if not exists(select 1 from public.parking_posts p where p.id=new.post_id and p.status in ('active','expired') and p.expires_at>clock_timestamp()-interval '30 seconds') then raise exception 'SAFETY_POST_EXPIRED'; end if;
  perform mawqifi_safety.lock_pair(new.owner_id,new.requester_id);
  if mawqifi_safety.blocked_pair(new.owner_id,new.requester_id) then raise exception 'SAFETY_BLOCKED'; end if;
  return new;
end; $$;
revoke all on function mawqifi_safety.guard_conversation() from public, anon, authenticated;
create trigger safety_conversation_guard before insert or update on public.conversations for each row execute function mawqifi_safety.guard_conversation();

create index safety_messages_sender_time_idx on public.messages(sender_id,created_at);
create index safety_posts_user_time_idx on public.parking_posts(user_id,created_at);
create function mawqifi_safety.guard_message() returns trigger
language plpgsql security definer set search_path = '' as $$
declare c public.conversations%rowtype;
begin
  if auth.uid() is null or new.sender_id<>auth.uid() then raise exception 'Authentication required' using errcode='42501'; end if;
  perform mawqifi_safety.assert_unrestricted();
  select * into c from public.conversations where id=new.conversation_id;
  if not found or auth.uid() not in (c.owner_id,c.requester_id) or c.closed then raise exception 'Conversation unavailable' using errcode='42501'; end if;
  perform mawqifi_safety.lock_pair(c.owner_id,c.requester_id);
  if mawqifi_safety.blocked_pair(c.owner_id,c.requester_id) then raise exception 'SAFETY_BLOCKED'; end if;
  perform pg_advisory_xact_lock(hashtextextended('message:'||auth.uid()::text,0));
  -- Main has no message maxLength: do not invent a smaller storage contract.
  if new.type='text' and (btrim(regexp_replace(coalesce(new.text,''),'[[:space:]​‌‍‎‏]+','','g'))='' or new.text ~ '(.)\1{39,}') then raise exception 'SAFETY_INVALID_TEXT'; end if;
  if new.type='image' and (new.image_url is null or new.image_url !~ '^https://') then raise exception 'Invalid image URL'; end if;
  if new.type='location' and (new.latitude is null or new.longitude is null or new.latitude not between -90 and 90 or new.longitude not between -180 and 180) then raise exception 'Invalid location'; end if;
  if (select count(*) from public.messages where sender_id=auth.uid() and created_at>now()-interval '1 minute')>=20 then raise exception 'SAFETY_RATE_LIMIT'; end if;
  if new.type='text' and exists(select 1 from public.messages where sender_id=auth.uid() and conversation_id=new.conversation_id and type='text' and btrim(text)=btrim(new.text) and created_at>now()-interval '30 seconds') then raise exception 'SAFETY_DUPLICATE'; end if;
  new.created_at:=now(); return new;
end; $$;
revoke all on function mawqifi_safety.guard_message() from public, anon, authenticated;
create trigger safety_message_guard before insert on public.messages for each row execute function mawqifi_safety.guard_message();
-- No message mutation through an alternate direct API path.
revoke update, delete on public.messages from anon, authenticated;

create function mawqifi_safety.guard_post() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- Cached clients already support 500 characters. Status-only legacy updates
  -- must not revalidate unchanged content (e.g. the existing expiry RPC).
  if (TG_OP='INSERT' or new.car_desc is distinct from old.car_desc) and length(coalesce(new.car_desc,''))>500 then raise exception 'SAFETY_INVALID_TEXT'; end if;
  if TG_OP='UPDATE' and (new.user_id<>old.user_id or new.created_at<>old.created_at) then raise exception 'Post identity is immutable'; end if;
  if TG_OP='INSERT' then
    if auth.uid() is null or new.user_id<>auth.uid() then raise exception 'Authentication required' using errcode='42501'; end if;
    perform mawqifi_safety.assert_unrestricted();
    perform pg_advisory_xact_lock(hashtextextended('post:'||auth.uid()::text,0));
    if (select count(*) from mawqifi_safety.post_submission_times where user_id=auth.uid() and created_at>now()-interval '5 minutes')>=5 then raise exception 'SAFETY_RATE_LIMIT'; end if;
    insert into mawqifi_safety.post_submission_times(user_id) values(auth.uid());
    delete from mawqifi_safety.post_submission_times where user_id=auth.uid() and created_at<now()-interval '5 minutes';
    new.created_at:=now();
  end if;
  return new;
end; $$;
revoke all on function mawqifi_safety.guard_post() from public, anon, authenticated;
create trigger safety_post_guard before insert or update on public.parking_posts for each row execute function mawqifi_safety.guard_post();
create policy safety_hide_blocked_notifications on public.app_notifications as restrictive for select to authenticated
  using (actor_id is null or not public.is_user_blocked(actor_id));
commit;
