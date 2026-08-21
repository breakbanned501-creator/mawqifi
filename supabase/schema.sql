-- Mawqifi — Supabase schema
-- Run in: Supabase Dashboard → SQL Editor → New query → Paste → Run

-- Extensions
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Users (profiles linked to auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null default 'طالب',
  avatar_url text,
  is_guest boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Parking posts
-- ---------------------------------------------------------------------------
create table if not exists public.parking_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  college text not null,
  zone text not null check (zone in ('A', 'B')),
  gate text not null,
  car_desc text,
  departure_minutes integer not null check (departure_minutes > 0 and departure_minutes <= 180),
  expires_at timestamptz not null,
  status text not null default 'active' check (status in ('active', 'expired', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists parking_posts_expires_at_idx on public.parking_posts (expires_at desc);
create index if not exists parking_posts_status_idx on public.parking_posts (status);

-- ---------------------------------------------------------------------------
-- Conversations (one per post + requester)
-- ---------------------------------------------------------------------------
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.parking_posts (id) on delete cascade,
  owner_id uuid not null references public.users (id) on delete cascade,
  requester_id uuid not null references public.users (id) on delete cascade,
  closed boolean not null default false,
  owner_last_read_at timestamptz not null default now(),
  requester_last_read_at timestamptz not null default now(),
  last_message_text text,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint conversations_post_requester_unique unique (post_id, requester_id),
  constraint conversations_not_self check (owner_id <> requester_id)
);

create index if not exists conversations_owner_idx on public.conversations (owner_id);
create index if not exists conversations_requester_idx on public.conversations (requester_id);
create index if not exists conversations_post_idx on public.conversations (post_id);

-- ---------------------------------------------------------------------------
-- Messages
-- ---------------------------------------------------------------------------
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.users (id) on delete cascade,
  type text not null check (type in ('text', 'image', 'location')),
  text text,
  image_url text,
  latitude double precision,
  longitude double precision,
  created_at timestamptz not null default now(),
  constraint messages_location_coords check (
    (type = 'location' and latitude is not null and longitude is not null)
    or (type <> 'location')
  )
);

create index if not exists messages_conversation_idx on public.messages (conversation_id, created_at);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists users_updated_at on public.users;
create trigger users_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

drop trigger if exists parking_posts_updated_at on public.parking_posts;
create trigger parking_posts_updated_at
  before update on public.parking_posts
  for each row execute function public.set_updated_at();

drop trigger if exists conversations_updated_at on public.conversations;
create trigger conversations_updated_at
  before update on public.conversations
  for each row execute function public.set_updated_at();

-- Create profile on signup (email or anonymous)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, username, is_guest)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username', 'طالب'),
    coalesce(new.is_anonymous, false)
  )
  on conflict (id) do update
    set username = excluded.username,
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Update conversation preview on new message
create or replace function public.on_message_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  preview text;
begin
  preview := case
    when new.type = 'text' then new.text
    when new.type = 'image' then 'صورة'
    when new.type = 'location' then 'موقع'
    else null
  end;

  update public.conversations
  set
    last_message_text = preview,
    last_message_at = new.created_at,
    updated_at = now(),
    closed = (
      select (pp.expires_at <= now() or pp.status <> 'active')
      from public.parking_posts pp
      where pp.id = conversations.post_id
    )
  where id = new.conversation_id;

  return new;
end;
$$;

drop trigger if exists messages_after_insert on public.messages;
create trigger messages_after_insert
  after insert on public.messages
  for each row execute function public.on_message_insert();

-- Mark expired posts
create or replace function public.expire_old_parking_posts()
returns void
language sql
security definer
set search_path = public
as $$
  update public.parking_posts
  set status = 'expired', updated_at = now()
  where status = 'active' and expires_at <= now();
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.users enable row level security;
alter table public.parking_posts enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

-- Users: read all profiles (display names), update own row
drop policy if exists users_select_all on public.users;
create policy users_select_all on public.users
  for select to authenticated
  using (true);

drop policy if exists users_update_own on public.users;
create policy users_update_own on public.users
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists users_insert_own on public.users;
create policy users_insert_own on public.users
  for insert to authenticated
  with check (auth.uid() = id);

-- Parking posts: anyone signed in can read; owner can insert/delete/update own
drop policy if exists parking_posts_select on public.parking_posts;
create policy parking_posts_select on public.parking_posts
  for select to authenticated
  using (true);

drop policy if exists parking_posts_insert on public.parking_posts;
create policy parking_posts_insert on public.parking_posts
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists parking_posts_update_own on public.parking_posts;
create policy parking_posts_update_own on public.parking_posts
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists parking_posts_delete_own on public.parking_posts;
create policy parking_posts_delete_own on public.parking_posts
  for delete to authenticated
  using (auth.uid() = user_id);

-- Conversations: participants only
drop policy if exists conversations_select on public.conversations;
create policy conversations_select on public.conversations
  for select to authenticated
  using (auth.uid() = owner_id or auth.uid() = requester_id);

drop policy if exists conversations_insert on public.conversations;
create policy conversations_insert on public.conversations
  for insert to authenticated
  with check (auth.uid() = requester_id);

drop policy if exists conversations_update on public.conversations;
create policy conversations_update on public.conversations
  for update to authenticated
  using (auth.uid() = owner_id or auth.uid() = requester_id)
  with check (auth.uid() = owner_id or auth.uid() = requester_id);

-- Messages: participants of parent conversation
drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages
  for select to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (c.owner_id = auth.uid() or c.requester_id = auth.uid())
    )
  );

drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages
  for insert to authenticated
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (c.owner_id = auth.uid() or c.requester_id = auth.uid())
        and c.closed = false
    )
  );

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.parking_posts;
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.conversations;

-- ---------------------------------------------------------------------------
-- Storage bucket for chat images
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-images',
  'chat-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

drop policy if exists chat_images_public_read on storage.objects;
create policy chat_images_public_read on storage.objects
  for select
  using (bucket_id = 'chat-images');

drop policy if exists chat_images_authenticated_upload on storage.objects;
create policy chat_images_authenticated_upload on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'chat-images'
    and (storage.foldername(name))[1] = 'chat'
  );

grant execute on function public.expire_old_parking_posts() to authenticated;

-- ---------------------------------------------------------------------------
-- Push Subscriptions (Web Push Notifications)
-- ---------------------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint push_subscriptions_endpoint_key unique (endpoint)
);

create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);
create index if not exists push_subscriptions_active_idx on public.push_subscriptions (active);
create index if not exists push_subscriptions_active_user_idx
  on public.push_subscriptions (user_id)
  where active = true;

alter table public.push_subscriptions enable row level security;

drop policy if exists push_subscriptions_select_own on public.push_subscriptions;
create policy push_subscriptions_select_own on public.push_subscriptions
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists push_subscriptions_insert_own on public.push_subscriptions;
create policy push_subscriptions_insert_own on public.push_subscriptions
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists push_subscriptions_update_own on public.push_subscriptions;
create policy push_subscriptions_update_own on public.push_subscriptions
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists push_subscriptions_delete_own on public.push_subscriptions;
create policy push_subscriptions_delete_own on public.push_subscriptions
  for delete to authenticated
  using (auth.uid() = user_id);

drop trigger if exists push_subscriptions_updated_at on public.push_subscriptions;
create trigger push_subscriptions_updated_at
  before update on public.push_subscriptions
  for each row execute function public.set_updated_at();

-- Delivery events make parking and chat notifications idempotent across server
-- instances. This table has no client policies: only the server-side service
-- role may write it.
create table if not exists public.push_notification_events (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.parking_posts (id) on delete cascade,
  message_id uuid references public.messages (id) on delete cascade,
  creator_id uuid not null references public.users (id) on delete cascade,
  recipient_id uuid references public.users (id) on delete cascade,
  constraint push_notification_events_exactly_one_source check (
    (
      post_id is not null
      and message_id is null
      and recipient_id is null
    )
    or
    (
      post_id is null
      and message_id is not null
      and recipient_id is not null
    )
  ),
  created_at timestamptz not null default now()
);

create unique index if not exists push_notification_events_post_id_unique
  on public.push_notification_events (post_id)
  where post_id is not null;

create unique index if not exists push_notification_events_message_id_unique
  on public.push_notification_events (message_id)
  where message_id is not null;

alter table public.push_notification_events enable row level security;

-- ---------------------------------------------------------------------------
-- Private localization and notification preferences
-- ---------------------------------------------------------------------------
-- Keep these settings outside public.users: profile rows are intentionally
-- visible to signed-in users for display names in chat and parking posts.
create table if not exists public.user_notification_preferences (
  user_id uuid primary key references public.users (id) on delete cascade,
  locale text not null default 'ar' check (locale in ('ar', 'en')),
  parking_push_enabled boolean not null default true,
  chat_push_enabled boolean not null default true,
  in_app_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

revoke execute on function public.create_user_notification_preferences() from public, anon, authenticated;

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

-- ---------------------------------------------------------------------------
-- Durable in-app notification center
-- ---------------------------------------------------------------------------
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

-- These indexes keep foreign-key cascades and notification navigation fast
-- without changing the user-facing event query path above.
create index if not exists app_notifications_post_id_idx
  on public.app_notifications (post_id)
  where post_id is not null;

create index if not exists app_notifications_conversation_id_idx
  on public.app_notifications (conversation_id)
  where conversation_id is not null;

create index if not exists app_notifications_message_id_idx
  on public.app_notifications (message_id)
  where message_id is not null;

create index if not exists app_notifications_actor_id_idx
  on public.app_notifications (actor_id)
  where actor_id is not null;

create unique index if not exists app_notifications_user_post_unique
  on public.app_notifications (user_id, post_id)
  where kind = 'parking_post' and post_id is not null;

create unique index if not exists app_notifications_user_message_unique
  on public.app_notifications (user_id, message_id)
  where kind = 'chat_message' and message_id is not null;

alter table public.app_notifications enable row level security;

-- Clients can read, mark, and clear only their own events. Database triggers
-- create events, so authenticated clients intentionally receive no INSERT grant.
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

-- Notification records are created atomically at the same time as a parking
-- post or chat message. This does not depend on browser push permission.
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

revoke execute on function public.enqueue_parking_post_app_notifications() from public, anon, authenticated;
revoke execute on function public.enqueue_chat_message_app_notification() from public, anon, authenticated;

drop trigger if exists parking_posts_after_insert_app_notification on public.parking_posts;
create trigger parking_posts_after_insert_app_notification
  after insert on public.parking_posts
  for each row execute function public.enqueue_parking_post_app_notifications();

-- Keep messages_after_insert, which updates the conversation preview. This
-- separate trigger creates the recipient's private notification event.
drop trigger if exists messages_after_insert_app_notification on public.messages;
create trigger messages_after_insert_app_notification
  after insert on public.messages
  for each row execute function public.enqueue_chat_message_app_notification();

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
