
create table if not exists public.parking_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.users(id) on delete cascade,
  place_id text not null references public.places(id),
  sub_place_id text,
  status text not null default 'active'
    check (status in ('active','offered','matched','cancelled','expired')),
  created_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null default (clock_timestamp() + interval '15 minutes'),
  matched_at timestamptz,
  constraint parking_requests_expiry_valid check (expires_at > created_at),
  constraint parking_requests_subplace_valid check (
    sub_place_id is null or (length(sub_place_id) between 1 and 100 and sub_place_id ~ '^[a-z0-9_]+$')
  )
);
create unique index if not exists parking_requests_one_open_per_requester
  on public.parking_requests(requester_id)
  where status in ('active','offered');
create index if not exists parking_requests_discovery_idx
  on public.parking_requests(place_id,sub_place_id,status,expires_at);
create table if not exists mawqifi_safety.parking_request_coordinates (
  request_id uuid primary key references public.parking_requests(id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  accuracy_meters double precision not null check (accuracy_meters between 0 and 100),
  captured_at timestamptz not null default clock_timestamp()
);
create table if not exists public.parking_match_offers (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.parking_requests(id) on delete cascade,
  post_id uuid not null references public.parking_posts(id) on delete cascade,
  departing_user_id uuid not null references public.users(id) on delete cascade,
  requester_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending','accepted','declined','expired','cancelled')),
  created_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null default (clock_timestamp() + interval '60 seconds'),
  accepted_at timestamptz,
  constraint parking_offer_users_different check (departing_user_id <> requester_id),
  constraint parking_offer_expiry_valid check (expires_at > created_at)
);
create unique index if not exists parking_offers_one_pending_per_request
  on public.parking_match_offers(request_id) where status = 'pending';
create unique index if not exists parking_offers_one_pending_per_post
  on public.parking_match_offers(post_id) where status = 'pending';
create index if not exists parking_offers_request_lookup
  on public.parking_match_offers(requester_id,status,expires_at);
alter table public.parking_requests enable row level security;
alter table public.parking_match_offers enable row level security;
alter table mawqifi_safety.parking_request_coordinates enable row level security;
revoke all on public.parking_requests from anon,authenticated;
revoke all on public.parking_match_offers from anon,authenticated;
revoke all on mawqifi_safety.parking_request_coordinates from anon,authenticated;
grant select on public.parking_requests to authenticated;
grant select on public.parking_match_offers to authenticated;
create policy parking_requests_owner_read on public.parking_requests
  for select to authenticated using (requester_id = (select auth.uid()));
create policy parking_offers_participants_read on public.parking_match_offers
  for select to authenticated using (
    requester_id = (select auth.uid()) or departing_user_id = (select auth.uid())
  );
comment on table public.parking_requests is
  'Reverse-matching parking demand: 15-minute seeker requests, no public precise coordinates.';
comment on table public.parking_match_offers is
  '60-second tentative offers: acceptance must atomically revalidate and reuse existing handoff claim.';
comment on table mawqifi_safety.parking_request_coordinates is
  'Sensitive seeker coordinates; server-owned only, never directly selectable by app roles.';
