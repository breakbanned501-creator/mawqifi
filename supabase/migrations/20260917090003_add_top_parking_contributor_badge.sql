-- Trusted recognition for the existing top parking contributor.
-- This migration deliberately grants clients read-only access to the badge
-- relation; the award and its companion system notification are admin-side.
begin;

create table if not exists public.user_badges (
  user_id uuid not null references public.users (id) on delete cascade,
  badge_key text not null check (badge_key in ('top_parking_contributor')),
  awarded_at timestamptz not null default now(),
  primary key (user_id, badge_key)
);

alter table public.user_badges enable row level security;

revoke all on table public.user_badges from public, anon, authenticated;
grant select on table public.user_badges to authenticated;

drop policy if exists user_badges_select_authenticated on public.user_badges;
create policy user_badges_select_authenticated on public.user_badges
  for select to authenticated
  using (true);

-- A semantic event key gives the thank-you notification a durable, localized
-- presentation and makes the one-time award idempotent across deployments.
create unique index if not exists app_notifications_user_system_event_unique
  on public.app_notifications (user_id, (data ->> 'event_key'))
  where kind = 'system' and data ? 'event_key';

insert into public.user_badges (user_id, badge_key)
values ('316c5406-be8a-4950-a0ce-d2c929c01c8d', 'top_parking_contributor')
on conflict do nothing;

insert into public.app_notifications (user_id, kind, data)
values (
  '316c5406-be8a-4950-a0ce-d2c929c01c8d',
  'system',
  jsonb_build_object(
    'event_key', 'top_parking_contributor_award',
    'badge_key', 'top_parking_contributor'
  )
)
on conflict do nothing;

notify pgrst, 'reload schema';

commit;
