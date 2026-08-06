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
