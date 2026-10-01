-- MANUAL reverse migration. Never place this in the forward migrations queue.
-- First roll back safety web/server code and stop native safety releases.
-- This restores pre-safety write/read behavior; block enforcement is removed.
-- Reports, blocks, restrictions, private ledger and their secure RLS remain.
begin;
set local lock_timeout = '5s';
drop trigger if exists safety_post_guard on public.parking_posts;
drop trigger if exists safety_conversation_guard on public.conversations;
drop trigger if exists safety_message_guard on public.messages;
drop policy if exists safety_hide_blocked_posts on public.parking_posts;
drop policy if exists safety_hide_blocked_notifications on public.app_notifications;
-- These grants existed in the production catalog audited before this migration.
-- Original messages RLS is untouched (no client edit/delete policies are added).
grant update, delete on public.messages to anon, authenticated;
-- Keep report/block guards, RPC, and RLS: stored moderation data stays private.
-- No DROP TABLE, DELETE, CASCADE, auth changes, or migration-history rewriting.
commit;
