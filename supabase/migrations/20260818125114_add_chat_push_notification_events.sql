-- Extend the existing server-only delivery ledger for chat messages.
-- Existing parking events remain valid and retain post-level idempotency.
begin;

alter table public.push_notification_events
  add column id uuid,
  add column message_id uuid references public.messages (id) on delete cascade,
  add column recipient_id uuid references public.users (id) on delete cascade;

-- The table already contains parking events in production. Give each one a
-- stable surrogate key before replacing the historical post_id primary key.
update public.push_notification_events
set id = gen_random_uuid()
where id is null;

alter table public.push_notification_events
  alter column id set default gen_random_uuid(),
  alter column id set not null,
  drop constraint push_notification_events_pkey,
  alter column post_id drop not null,
  add constraint push_notification_events_pkey primary key (id);

-- Preserve one parking delivery event per post and add one chat event per
-- stored message, even if a request is retried or two instances race.
create unique index push_notification_events_post_id_unique
  on public.push_notification_events (post_id)
  where post_id is not null;

create unique index push_notification_events_message_id_unique
  on public.push_notification_events (message_id)
  where message_id is not null;

alter table public.push_notification_events
  add constraint push_notification_events_exactly_one_source check (
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
  );

-- Chat delivery looks up all active devices for one recipient.
create index push_subscriptions_active_user_idx
  on public.push_subscriptions (user_id)
  where active = true;

commit;
