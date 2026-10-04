-- Staging-first account deletion. No existing account/content is deleted by this
-- migration: cleanup occurs only after the account's own explicit request.
begin;
alter table public.users add column auth_user_id uuid unique references auth.users(id) on delete set null;
alter table public.users add column deleted_at timestamptz;
update public.users set auth_user_id=id;
alter table public.users drop constraint users_id_fkey;
revoke delete on public.users from anon,authenticated;

create table mawqifi_safety.account_deletion_jobs(
 user_id uuid primary key references public.users(id),
 objects jsonb not null default '[]',
 started_at timestamptz not null default clock_timestamp(),
 completed_at timestamptz
);
alter table mawqifi_safety.account_deletion_jobs enable row level security;
revoke all on mawqifi_safety.account_deletion_jobs from public,anon,authenticated;
-- No direct API or client policy exposes cleanup manifests.

create function mawqifi_safety.active_account() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.users where id=auth.uid() and auth_user_id=auth.uid() and deleted_at is null);
$$;
revoke all on function mawqifi_safety.active_account() from public,anon;
grant execute on function mawqifi_safety.active_account() to authenticated;

create function mawqifi_safety.require_active_account() returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'ACCOUNT_UNAVAILABLE' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('account:'||auth.uid()::text,0));
 if not mawqifi_safety.active_account() then raise exception 'ACCOUNT_UNAVAILABLE' using errcode='42501'; end if;
end; $$;
revoke all on function mawqifi_safety.require_active_account() from public,anon,authenticated;

-- Invoker trigger: ordinary clients cannot set deletion/Auth binding fields.
-- Auth signup's existing definer trigger automatically creates the binding.
create function mawqifi_safety.guard_profile_identity() returns trigger
language plpgsql set search_path='' as $$
begin
 if TG_OP='INSERT' then
  new.auth_user_id:=new.id;
  new.deleted_at:=null;
 elsif current_user not in ('postgres','service_role','supabase_auth_admin') and
  (old.deleted_at is not null or new.auth_user_id is distinct from old.auth_user_id or new.deleted_at is distinct from old.deleted_at or new.id<>old.id) then
  raise exception 'ACCOUNT_IDENTITY_IMMUTABLE' using errcode='42501';
 end if;
 return new;
end; $$;
revoke all on function mawqifi_safety.guard_profile_identity() from public,anon,authenticated;
create trigger account_profile_identity before insert or update on public.users
 for each row execute function mawqifi_safety.guard_profile_identity();

-- All existing permissive policies remain; this conjunct cannot be overridden by
-- another permissive policy. Applies to old cached clients and still-valid JWTs.
do $$ declare r record; begin
 for r in select tablename from pg_tables where schemaname='public' and rowsecurity loop
  execute format('create policy account_live_guard on public.%I as restrictive for all to authenticated using ((select mawqifi_safety.active_account())) with check ((select mawqifi_safety.active_account()))',r.tablename);
 end loop;
end; $$;

-- Serialize ordinary writes with deletion. Profile INSERT is excluded because
-- legacy/new Auth clients must be able to create their initial profile.
create function mawqifi_safety.guard_account_write() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if current_setting('role',true)='authenticated' then
  perform mawqifi_safety.require_active_account();
 end if;
 return coalesce(new,old);
end; $$;
revoke all on function mawqifi_safety.guard_account_write() from public,anon,authenticated;
do $$ declare r record; begin
 for r in select tablename from pg_tables where schemaname='public' and rowsecurity and tablename<>'users' loop
  execute format('create trigger account_write_guard before insert or update or delete on public.%I for each row execute function mawqifi_safety.guard_account_write()',r.tablename);
 end loop;
end; $$;
-- The profile signup path is valid without an existing profile. Its FK proves a
-- live Auth identity; a retained tombstone PK prevents recreating a deleted one.
drop policy account_live_guard on public.users;
create policy account_live_guard on public.users as restrictive for all to authenticated
 using((select mawqifi_safety.active_account()))
 with check(deleted_at is null and auth_user_id=(select auth.uid()) and id=(select auth.uid()));

-- SECURITY DEFINER paths bypass table RLS. Add the same live guard explicitly to
-- the reviewed client-callable helpers, preserving every existing function body.
-- Read-only helpers are STABLE and cannot take locks; they use a live predicate.
do $$ declare signature text; definition text; begin
 foreach signature in array array[
 'mawqifi_safety.assert_unrestricted()',
 'mawqifi_safety.handoff_state(uuid)',
 'public.is_user_blocked(uuid)',
 'mawqifi_safety.chat_image_access(text,boolean)'
 ] loop
  definition:=pg_get_functiondef(signature::regprocedure);
  if definition !~* E'\\mBEGIN\\M' then raise exception 'Unexpected helper format: %',signature; end if;
  definition:=regexp_replace(definition,E'\\mBEGIN\\M',E'begin\n if not mawqifi_safety.active_account() then raise exception ''ACCOUNT_UNAVAILABLE'' using errcode=''42501''; end if;\n','i');
  -- regexp_replace without g changes only the first, outer BEGIN.
  execute definition;
 end loop;
end; $$;
-- Write RPCs already call assert_unrestricted; add serialization there.
create or replace function mawqifi_safety.assert_unrestricted() returns void
language plpgsql security definer set search_path='' as $$
begin
 perform mawqifi_safety.require_active_account();
 if exists(select 1 from public.account_restrictions where user_id=auth.uid()) then
  raise exception 'SAFETY_RESTRICTED';
 end if;
end; $$;
-- Expiry is also invoked by privileged maintenance without a user JWT.
do $$ declare definition text; begin
 definition:=pg_get_functiondef('public.expire_old_parking_posts()'::regprocedure);
 execute regexp_replace(definition,E'\\mBEGIN\\M',E'begin\n if current_setting(''role'',true)=''authenticated'' then perform mawqifi_safety.require_active_account(); end if;\n','i');
end; $$;

-- Cleanup is authorized by a private job created in the same transaction.
-- No client flag, custom GUC, or supplied user ID can grant this exception.
do $$ declare signature text; definition text; begin
 foreach signature in array array['mawqifi_safety.guard_reserved_post()','mawqifi_safety.guard_post_place()'] loop
  definition:=pg_get_functiondef(signature::regprocedure);
  execute regexp_replace(definition,E'\\mBEGIN\\M',E'begin\n if TG_OP=''UPDATE'' and new.status=''cancelled'' and exists(select 1 from mawqifi_safety.account_deletion_jobs where user_id=new.user_id) then return new; end if;\n','i');
 end loop;
end; $$;

create function mawqifi_safety.retained_object(bucket text,object_name text) returns boolean
language sql stable security definer set search_path='' as $$
 select not exists(select 1 from mawqifi_safety.account_deletion_jobs j,
 jsonb_array_elements(j.objects) o where o->>'bucket_id'=bucket and o->>'name'=object_name);
$$;
revoke all on function mawqifi_safety.retained_object(text,text) from public,anon;
grant execute on function mawqifi_safety.retained_object(text,text) to authenticated;
create policy account_live_storage_guard on storage.objects as restrictive for all to authenticated
 using((select mawqifi_safety.active_account()) and mawqifi_safety.retained_object(bucket_id,name))
 with check((select mawqifi_safety.active_account()));

-- Server push APIs use service_role for token/preference writes. A verified
-- request already in flight must not recreate tokens after deletion starts.
create function mawqifi_safety.guard_personal_identity() returns trigger
language plpgsql security definer set search_path='' as $$
declare uid uuid:=(to_jsonb(new)->>'user_id')::uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended('account:'||uid::text,0));
 if not exists(select 1 from public.users where id=uid and deleted_at is null and auth_user_id=uid) then
  raise exception 'ACCOUNT_UNAVAILABLE' using errcode='42501';
 end if;
 return new;
end; $$;
revoke all on function mawqifi_safety.guard_personal_identity() from public,anon,authenticated;
create trigger account_token_live_guard before insert or update on public.native_push_tokens for each row execute function mawqifi_safety.guard_personal_identity();
create trigger account_subscription_live_guard before insert or update on public.push_subscriptions for each row execute function mawqifi_safety.guard_personal_identity();
create trigger account_preferences_live_guard before insert or update on public.user_notification_preferences for each row execute function mawqifi_safety.guard_personal_identity();

create function mawqifi_safety.begin_account_deletion() returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); manifest jsonb;
begin
 if uid is null then raise exception 'Authentication required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('account:'||uid::text,0));
 if not exists(select 1 from public.users where id=uid and auth_user_id=uid) then
  raise exception 'ACCOUNT_UNAVAILABLE' using errcode='42501';
 end if;
 select objects into manifest from mawqifi_safety.account_deletion_jobs where user_id=uid;
 if found then return jsonb_build_object('objects',manifest); end if;
 -- Storage ownership is authoritative. Never trust an arbitrary message URL to
 -- delete a peer's object. NULL historical ownership requires offline review.
 select coalesce(jsonb_agg(jsonb_build_object('bucket_id',o.bucket_id,'name',o.name)),'[]') into manifest
 from storage.objects o where to_jsonb(o)->>'owner_id'=uid::text or to_jsonb(o)->>'owner'=uid::text;
 insert into mawqifi_safety.account_deletion_jobs(user_id,objects) values(uid,manifest);
 update public.parking_posts set status='cancelled',car_desc=null,location_description=null
  where user_id=uid;
 update public.parking_claims set status='cancelled',completed_at=clock_timestamp()
  where (owner_id=uid or claimant_id=uid) and status in('claimed','arrived');
 update public.parking_posts p set status='cancelled' where status='claimed' and exists(
  select 1 from public.parking_claims c where c.post_id=p.id and c.claimant_id=uid and c.status='cancelled');
 update public.conversations set closed=true where uid in(owner_id,requester_id);
 delete from public.parking_post_locations where owner_id=uid;
 update public.messages set type='text',text='[deleted message]',image_url=null,latitude=null,longitude=null where sender_id=uid;
 update public.conversations c set last_message_text=(select case m.type when 'text' then m.text when 'image' then 'Image' else 'Location' end
  from public.messages m where m.conversation_id=c.id order by m.created_at desc,m.id desc limit 1)
  where uid in(c.owner_id,c.requester_id);
 delete from public.native_push_tokens where user_id=uid;
 delete from public.push_subscriptions where user_id=uid;
 delete from public.user_notification_preferences where user_id=uid;
 delete from public.app_notifications where user_id=uid;
 update public.app_notifications set actor_id=null,data='{}' where actor_id=uid;
 delete from public.push_notification_events where creator_id=uid or recipient_id=uid;
 delete from public.user_badges where user_id=uid;
 delete from public.user_blocks where blocker_id=uid or blocked_id=uid;
 delete from mawqifi_safety.post_submission_times where user_id=uid;
 update public.content_reports set details='' where reporter_id=uid or
  (target_type='user' and target_id=uid) or
  (target_type='post' and target_id in(select id from public.parking_posts where user_id=uid)) or
  (target_type='message' and target_id in(select id from public.messages where sender_id=uid));
 update public.account_restrictions set reason='deleted_account' where user_id=uid;
 update public.users set username='Deleted User',avatar_url=null,is_guest=true,deleted_at=clock_timestamp() where id=uid;
 return jsonb_build_object('objects',manifest);
end; $$;
revoke all on function mawqifi_safety.begin_account_deletion() from public,anon;
grant execute on function mawqifi_safety.begin_account_deletion() to authenticated;
create function public.begin_account_deletion() returns jsonb
language sql security invoker set search_path='' as $$select mawqifi_safety.begin_account_deletion()$$;
revoke all on function public.begin_account_deletion() from public,anon;
grant execute on function public.begin_account_deletion() to authenticated;

create function mawqifi_safety.finish_auth_deletion() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 update mawqifi_safety.account_deletion_jobs set completed_at=clock_timestamp(),objects='[]' where user_id=old.id;
 return old;
end; $$;
revoke all on function mawqifi_safety.finish_auth_deletion() from public,anon,authenticated;
create trigger mawqifi_account_deleted after delete on auth.users for each row execute function mawqifi_safety.finish_auth_deletion();
-- Safe acknowledgement for a lost final HTTP response. Only the caller's own
-- completion flag is available, never a target ID or any retained private data.
create function public.account_deletion_status() returns jsonb
language sql security definer set search_path='' as $$
 select jsonb_build_object('started',exists(select 1 from mawqifi_safety.account_deletion_jobs where user_id=auth.uid()),
 'completed',exists(select 1 from mawqifi_safety.account_deletion_jobs where user_id=auth.uid() and completed_at is not null));
$$;
revoke all on function public.account_deletion_status() from public,anon;
grant execute on function public.account_deletion_status() to authenticated;
notify pgrst,'reload schema';
commit;
