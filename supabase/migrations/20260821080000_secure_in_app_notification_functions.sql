-- Keep trigger helpers private to the database and index the new foreign keys.
-- Trigger execution remains available because these functions are invoked by
-- trusted table triggers, not exposed as PostgREST RPC endpoints.
begin;

revoke execute on function public.create_user_notification_preferences()
  from public, anon, authenticated;
revoke execute on function public.enqueue_parking_post_app_notifications()
  from public, anon, authenticated;
revoke execute on function public.enqueue_chat_message_app_notification()
  from public, anon, authenticated;

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

commit;
