-- Private, per-user settings and durable in-app notifications.
-- These tables deliberately stay separate from public.users because profiles
-- are readable by all authenticated users for chat and parking display names.
begin;

create table if not exists public.user_notification_preferences (
  user_id uuid primary key references public.users (id) on delete cascade,
  locale text not null default 'ar' check (locale in ('ar', 'en')),
  parking_push_enabled boolean not null default true,
  chat_push_enabled boolean not null default true,
  in_app_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Create a default private preference row for every existing profile before
-- installing the trigger used by newly-created profiles.
insert into public.user_notification_preferences (user_id)
select id
from public.users
on conflict (user_id) do nothing;

create or replace function public.create_user_notification_preferences()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.user_notification_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

revoke execute on function public.create_user_notification_preferences() from public;

drop trigger if exists users_create_notification_preferences on public.users;
create trigger users_create_notification_preferences
  after insert on public.users
  for each row execute function public.create_user_notification_preferences();

drop trigger if exists user_notification_preferences_updated_at on public.user_notification_preferences;
create trigger user_notification_preferences_updated_at
  before update on public.user_notification_preferences
  for each row execute function public.set_updated_at();

alter table public.user_notification_preferences enable row level security;

grant select, insert, update on public.user_notification_preferences to authenticated;

drop policy if exists user_notification_preferences_select_own on public.user_notification_preferences;
create policy user_notification_preferences_select_own
  on public.user_notification_preferences
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists user_notification_preferences_insert_own on public.user_notification_preferences;
create policy user_notification_preferences_insert_own
  on public.user_notification_preferences
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists user_notification_preferences_update_own on public.user_notification_preferences;
create policy user_notification_preferences_update_own
  on public.user_notification_preferences
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create table if not exists public.app_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  kind text not null check (kind in ('parking_post', 'chat_message', 'system')),
  post_id uuid references public.parking_posts (id) on delete cascade,
  conversation_id uuid references public.conversations (id) on delete cascade,
  message_id uuid references public.messages (id) on delete cascade,
  actor_id uuid references public.users (id) on delete set null,
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint app_notifications_source_for_kind check (
    (
      kind = 'parking_post'
      and post_id is not null
      and conversation_id is null
      and message_id is null
    )
    or
    (
      kind = 'chat_message'
      and post_id is not null
      and conversation_id is not null
      and message_id is not null
    )
    or
    (
      kind = 'system'
      and post_id is null
      and conversation_id is null
      and message_id is null
    )
  )
);

create index if not exists app_notifications_user_created_idx
  on public.app_notifications (user_id, created_at desc);

create index if not exists app_notifications_user_unread_created_idx
  on public.app_notifications (user_id, created_at desc)
  where read_at is null;

-- One user gets at most one notification per source event. The notification
-- triggers can therefore remain safe if a database transaction is retried.
create unique index if not exists app_notifications_user_post_unique
  on public.app_notifications (user_id, post_id)
  where kind = 'parking_post' and post_id is not null;

create unique index if not exists app_notifications_user_message_unique
  on public.app_notifications (user_id, message_id)
  where kind = 'chat_message' and message_id is not null;

alter table public.app_notifications enable row level security;

-- There is deliberately no INSERT grant for authenticated clients: event
-- creation happens only inside the trusted database triggers below.
grant select, update, delete on public.app_notifications to authenticated;

drop policy if exists app_notifications_select_own on public.app_notifications;
create policy app_notifications_select_own
  on public.app_notifications
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists app_notifications_update_own on public.app_notifications;
create policy app_notifications_update_own
  on public.app_notifications
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists app_notifications_delete_own on public.app_notifications;
create policy app_notifications_delete_own
  on public.app_notifications
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- In-app events are database-side so they are created even when a user has not
-- granted browser notification permission or the server push delivery fails.
create or replace function public.enqueue_parking_post_app_notifications()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.app_notifications (
    user_id,
    kind,
    post_id,
    actor_id,
    data
  )
  select
    preferences.user_id,
    'parking_post',
    new.id,
    new.user_id,
    jsonb_build_object(
      'college', new.college,
      'zone', new.zone,
      'gate', new.gate,
      'departure_minutes', new.departure_minutes
    )
  from public.user_notification_preferences preferences
  where preferences.user_id <> new.user_id
    and preferences.in_app_enabled
    and preferences.parking_push_enabled
  on conflict do nothing;

  return new;
end;
$$;

create or replace function public.enqueue_chat_message_app_notification()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  recipient_id uuid;
  related_post_id uuid;
  sender_name text;
  message_preview text;
begin
  select
    conversation.post_id,
    case
      when conversation.owner_id = new.sender_id then conversation.requester_id
      when conversation.requester_id = new.sender_id then conversation.owner_id
      else null
    end
  into related_post_id, recipient_id
  from public.conversations conversation
  where conversation.id = new.conversation_id;

  -- Messages inserted outside a valid conversation never create a recipient
  -- notification. Normal client RLS already prevents this case.
  if recipient_id is null then
    return new;
  end if;

  select username
  into sender_name
  from public.users
  where id = new.sender_id;

  message_preview := case
    when new.type = 'text' then left(coalesce(new.text, ''), 180)
    else null
  end;

  insert into public.app_notifications (
    user_id,
    kind,
    post_id,
    conversation_id,
    message_id,
    actor_id,
    data
  )
  select
    recipient_id,
    'chat_message',
    related_post_id,
    new.conversation_id,
    new.id,
    new.sender_id,
    jsonb_strip_nulls(
      jsonb_build_object(
        'sender_name', sender_name,
        'message_type', new.type,
        'preview', message_preview
      )
    )
  where exists (
    select 1
    from public.user_notification_preferences preferences
    where preferences.user_id = recipient_id
      and preferences.in_app_enabled
      and preferences.chat_push_enabled
  )
  on conflict do nothing;

  return new;
end;
$$;

revoke execute on function public.enqueue_parking_post_app_notifications() from public;
revoke execute on function public.enqueue_chat_message_app_notification() from public;

-- Keep the existing messages_after_insert trigger for conversation previews;
-- this additional trigger only creates the durable recipient event.
drop trigger if exists parking_posts_after_insert_app_notification on public.parking_posts;
create trigger parking_posts_after_insert_app_notification
  after insert on public.parking_posts
  for each row execute function public.enqueue_parking_post_app_notifications();

drop trigger if exists messages_after_insert_app_notification on public.messages;
create trigger messages_after_insert_app_notification
  after insert on public.messages
  for each row execute function public.enqueue_chat_message_app_notification();

-- Realtime lets the open app update its bell and notification center without
-- polling. Check catalog membership first so repeatable local setup is safe.
do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_rel publication_relation
    join pg_publication publication
      on publication.oid = publication_relation.prpubid
    join pg_class relation
      on relation.oid = publication_relation.prrelid
    join pg_namespace namespace
      on namespace.oid = relation.relnamespace
    where publication.pubname = 'supabase_realtime'
      and namespace.nspname = 'public'
      and relation.relname = 'app_notifications'
  ) then
    alter publication supabase_realtime add table public.app_notifications;
  end if;
end;
$$;

commit;
