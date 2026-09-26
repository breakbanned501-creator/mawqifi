-- Native iOS Push tokens are separate from browser VAPID subscriptions.
-- They are written exclusively by an authenticated server route using the
-- service role; no client role can read or write device tokens directly.
begin;

create table if not exists public.native_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  platform text not null check (platform in ('ios')),
  device_token text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  enabled boolean not null default true,
  constraint native_push_tokens_platform_device_token_key unique (platform, device_token)
);

-- This is the server-side recipient lookup used when APNs delivery is added.
create index if not exists native_push_tokens_enabled_recipient_idx
  on public.native_push_tokens (user_id, platform)
  where enabled;

alter table public.native_push_tokens enable row level security;

-- Do not expose device tokens through the Data API. The authenticated route
-- derives the user from the bearer token and writes with a server-only key.
revoke all on table public.native_push_tokens from public, anon, authenticated;

drop trigger if exists native_push_tokens_updated_at on public.native_push_tokens;
create trigger native_push_tokens_updated_at
  before update on public.native_push_tokens
  for each row execute function public.set_updated_at();

notify pgrst, 'reload schema';

commit;
