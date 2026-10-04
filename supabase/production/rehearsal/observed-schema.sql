-- DISPOSABLE ONLY. Metadata-only snapshot reviewed 2026-10-04.
-- No production rows, identifiers, image bytes or secrets. Never run on a hosted project.
-- Managed auth/storage mocks live in the rehearsal harness; managed Storage triggers excluded.
create extension if not exists pgcrypto;
create table "public"."app_notifications" (
 "id" uuid default gen_random_uuid() not null,
 "user_id" uuid not null,
 "kind" text not null,
 "post_id" uuid,
 "conversation_id" uuid,
 "message_id" uuid,
 "actor_id" uuid,
 "data" jsonb default '{}'::jsonb not null,
 "read_at" timestamp with time zone,
 "created_at" timestamp with time zone default now() not null
);
create table "public"."conversations" (
 "id" uuid default gen_random_uuid() not null,
 "post_id" uuid not null,
 "owner_id" uuid not null,
 "requester_id" uuid not null,
 "closed" boolean default false not null,
 "owner_last_read_at" timestamp with time zone default now() not null,
 "requester_last_read_at" timestamp with time zone default now() not null,
 "last_message_text" text,
 "last_message_at" timestamp with time zone,
 "created_at" timestamp with time zone default now() not null,
 "updated_at" timestamp with time zone default now() not null
);
create table "public"."feedback" (
 "id" uuid default gen_random_uuid() not null,
 "name" text not null,
 "email" text,
 "message" text not null,
 "created_at" timestamp with time zone default now()
);
create table "public"."messages" (
 "id" uuid default gen_random_uuid() not null,
 "conversation_id" uuid not null,
 "sender_id" uuid not null,
 "type" text not null,
 "text" text,
 "image_url" text,
 "latitude" double precision,
 "longitude" double precision,
 "created_at" timestamp with time zone default now() not null
);
create table "public"."native_push_tokens" (
 "id" uuid default gen_random_uuid() not null,
 "user_id" uuid not null,
 "platform" text not null,
 "device_token" text not null,
 "created_at" timestamp with time zone default now() not null,
 "updated_at" timestamp with time zone default now() not null,
 "last_seen_at" timestamp with time zone default now() not null,
 "enabled" boolean default true not null
);
create table "public"."parking_posts" (
 "id" uuid default gen_random_uuid() not null,
 "user_id" uuid not null,
 "college" text not null,
 "zone" text not null,
 "gate" text not null,
 "car_desc" text,
 "departure_minutes" integer not null,
 "expires_at" timestamp with time zone not null,
 "status" text default 'active'::text not null,
 "created_at" timestamp with time zone default now() not null,
 "updated_at" timestamp with time zone default now() not null
);
create table "public"."push_notification_events" (
 "post_id" uuid,
 "creator_id" uuid not null,
 "created_at" timestamp with time zone default now() not null,
 "id" uuid default gen_random_uuid() not null,
 "message_id" uuid,
 "recipient_id" uuid
);
create table "public"."push_subscriptions" (
 "id" uuid default gen_random_uuid() not null,
 "user_id" uuid not null,
 "endpoint" text not null,
 "p256dh" text not null,
 "auth" text not null,
 "active" boolean default true not null,
 "created_at" timestamp with time zone default now() not null,
 "updated_at" timestamp with time zone default now() not null
);
create table "public"."user_badges" (
 "user_id" uuid not null,
 "badge_key" text not null,
 "awarded_at" timestamp with time zone default now() not null
);
create table "public"."user_notification_preferences" (
 "user_id" uuid not null,
 "locale" text default 'ar'::text not null,
 "parking_push_enabled" boolean default true not null,
 "chat_push_enabled" boolean default true not null,
 "in_app_enabled" boolean default true not null,
 "created_at" timestamp with time zone default now() not null,
 "updated_at" timestamp with time zone default now() not null
);
create table "public"."users" (
 "id" uuid not null,
 "username" text default 'طالب'::text not null,
 "avatar_url" text,
 "is_guest" boolean default false not null,
 "created_at" timestamp with time zone default now() not null,
 "updated_at" timestamp with time zone default now() not null
);
alter table "public"."app_notifications" add constraint "app_notifications_kind_check" CHECK ((kind = ANY (ARRAY['parking_post'::text, 'chat_message'::text, 'system'::text])));
alter table "public"."app_notifications" add constraint "app_notifications_pkey" PRIMARY KEY (id);
alter table "public"."app_notifications" add constraint "app_notifications_source_for_kind" CHECK ((((kind = 'parking_post'::text) AND (post_id IS NOT NULL) AND (conversation_id IS NULL) AND (message_id IS NULL)) OR ((kind = 'chat_message'::text) AND (post_id IS NOT NULL) AND (conversation_id IS NOT NULL) AND (message_id IS NOT NULL)) OR ((kind = 'system'::text) AND (post_id IS NULL) AND (conversation_id IS NULL) AND (message_id IS NULL))));
alter table "public"."conversations" add constraint "conversations_not_self" CHECK ((owner_id <> requester_id));
alter table "public"."conversations" add constraint "conversations_pkey" PRIMARY KEY (id);
alter table "public"."conversations" add constraint "conversations_post_requester_unique" UNIQUE (post_id, requester_id);
alter table "public"."feedback" add constraint "feedback_pkey" PRIMARY KEY (id);
alter table "public"."messages" add constraint "messages_location_coords" CHECK ((((type = 'location'::text) AND (latitude IS NOT NULL) AND (longitude IS NOT NULL)) OR (type <> 'location'::text)));
alter table "public"."messages" add constraint "messages_pkey" PRIMARY KEY (id);
alter table "public"."messages" add constraint "messages_type_check" CHECK ((type = ANY (ARRAY['text'::text, 'image'::text, 'location'::text])));
alter table "public"."native_push_tokens" add constraint "native_push_tokens_pkey" PRIMARY KEY (id);
alter table "public"."native_push_tokens" add constraint "native_push_tokens_platform_check" CHECK ((platform = 'ios'::text));
alter table "public"."native_push_tokens" add constraint "native_push_tokens_platform_device_token_key" UNIQUE (platform, device_token);
alter table "public"."parking_posts" add constraint "parking_posts_departure_minutes_check" CHECK (((departure_minutes > 0) AND (departure_minutes <= 180)));
alter table "public"."parking_posts" add constraint "parking_posts_pkey" PRIMARY KEY (id);
alter table "public"."parking_posts" add constraint "parking_posts_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'expired'::text, 'closed'::text])));
alter table "public"."parking_posts" add constraint "parking_posts_zone_check" CHECK ((zone = ANY (ARRAY['A'::text, 'B'::text])));
alter table "public"."push_notification_events" add constraint "push_notification_events_exactly_one_source" CHECK ((((post_id IS NOT NULL) AND (message_id IS NULL) AND (recipient_id IS NULL)) OR ((post_id IS NULL) AND (message_id IS NOT NULL) AND (recipient_id IS NOT NULL))));
alter table "public"."push_notification_events" add constraint "push_notification_events_pkey" PRIMARY KEY (id);
alter table "public"."push_subscriptions" add constraint "push_subscriptions_endpoint_key" UNIQUE (endpoint);
alter table "public"."push_subscriptions" add constraint "push_subscriptions_pkey" PRIMARY KEY (id);
alter table "public"."user_badges" add constraint "user_badges_badge_key_check" CHECK ((badge_key = 'top_parking_contributor'::text));
alter table "public"."user_badges" add constraint "user_badges_pkey" PRIMARY KEY (user_id, badge_key);
alter table "public"."user_notification_preferences" add constraint "user_notification_preferences_locale_check" CHECK ((locale = ANY (ARRAY['ar'::text, 'en'::text])));
alter table "public"."user_notification_preferences" add constraint "user_notification_preferences_pkey" PRIMARY KEY (user_id);
alter table "public"."users" add constraint "users_pkey" PRIMARY KEY (id);
alter table "public"."app_notifications" add constraint "app_notifications_actor_id_fkey" FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL;
alter table "public"."app_notifications" add constraint "app_notifications_conversation_id_fkey" FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE;
alter table "public"."app_notifications" add constraint "app_notifications_message_id_fkey" FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE;
alter table "public"."app_notifications" add constraint "app_notifications_post_id_fkey" FOREIGN KEY (post_id) REFERENCES parking_posts(id) ON DELETE CASCADE;
alter table "public"."app_notifications" add constraint "app_notifications_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
alter table "public"."conversations" add constraint "conversations_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE;
alter table "public"."conversations" add constraint "conversations_post_id_fkey" FOREIGN KEY (post_id) REFERENCES parking_posts(id) ON DELETE CASCADE;
alter table "public"."conversations" add constraint "conversations_requester_id_fkey" FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE;
alter table "public"."messages" add constraint "messages_conversation_id_fkey" FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE;
alter table "public"."messages" add constraint "messages_sender_id_fkey" FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE;
alter table "public"."native_push_tokens" add constraint "native_push_tokens_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
alter table "public"."parking_posts" add constraint "parking_posts_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
alter table "public"."push_notification_events" add constraint "push_notification_events_creator_id_fkey" FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE;
alter table "public"."push_notification_events" add constraint "push_notification_events_message_id_fkey" FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE;
alter table "public"."push_notification_events" add constraint "push_notification_events_post_id_fkey" FOREIGN KEY (post_id) REFERENCES parking_posts(id) ON DELETE CASCADE;
alter table "public"."push_notification_events" add constraint "push_notification_events_recipient_id_fkey" FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE;
alter table "public"."push_subscriptions" add constraint "push_subscriptions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
alter table "public"."user_badges" add constraint "user_badges_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
alter table "public"."user_notification_preferences" add constraint "user_notification_preferences_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
alter table "public"."users" add constraint "users_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE OR REPLACE FUNCTION public.create_user_notification_preferences()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  insert into public.user_notification_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$function$
;
revoke all on function "public"."create_user_notification_preferences"() from public, anon, authenticated, service_role;
grant execute on function "public"."create_user_notification_preferences"() to "postgres";
grant execute on function "public"."create_user_notification_preferences"() to "service_role";
CREATE OR REPLACE FUNCTION public.enqueue_chat_message_app_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
$function$
;
revoke all on function "public"."enqueue_chat_message_app_notification"() from public, anon, authenticated, service_role;
grant execute on function "public"."enqueue_chat_message_app_notification"() to "postgres";
grant execute on function "public"."enqueue_chat_message_app_notification"() to "service_role";
CREATE OR REPLACE FUNCTION public.enqueue_parking_post_app_notifications()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
$function$
;
revoke all on function "public"."enqueue_parking_post_app_notifications"() from public, anon, authenticated, service_role;
grant execute on function "public"."enqueue_parking_post_app_notifications"() to "postgres";
grant execute on function "public"."enqueue_parking_post_app_notifications"() to "service_role";
CREATE OR REPLACE FUNCTION public.expire_old_parking_posts()
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  update public.parking_posts
  set status = 'expired', updated_at = now()
  where status = 'active' and expires_at <= now();
$function$
;
revoke all on function "public"."expire_old_parking_posts"() from public, anon, authenticated, service_role;
grant execute on function "public"."expire_old_parking_posts"() to public;
grant execute on function "public"."expire_old_parking_posts"() to "postgres";
grant execute on function "public"."expire_old_parking_posts"() to "anon";
grant execute on function "public"."expire_old_parking_posts"() to "authenticated";
grant execute on function "public"."expire_old_parking_posts"() to "service_role";
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;
revoke all on function "public"."handle_new_user"() from public, anon, authenticated, service_role;
grant execute on function "public"."handle_new_user"() to public;
grant execute on function "public"."handle_new_user"() to "postgres";
grant execute on function "public"."handle_new_user"() to "anon";
grant execute on function "public"."handle_new_user"() to "authenticated";
grant execute on function "public"."handle_new_user"() to "service_role";
CREATE OR REPLACE FUNCTION public.on_message_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;
revoke all on function "public"."on_message_insert"() from public, anon, authenticated, service_role;
grant execute on function "public"."on_message_insert"() to public;
grant execute on function "public"."on_message_insert"() to "postgres";
grant execute on function "public"."on_message_insert"() to "anon";
grant execute on function "public"."on_message_insert"() to "authenticated";
grant execute on function "public"."on_message_insert"() to "service_role";
CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;
revoke all on function "public"."set_updated_at"() from public, anon, authenticated, service_role;
grant execute on function "public"."set_updated_at"() to public;
grant execute on function "public"."set_updated_at"() to "postgres";
grant execute on function "public"."set_updated_at"() to "anon";
grant execute on function "public"."set_updated_at"() to "authenticated";
grant execute on function "public"."set_updated_at"() to "service_role";
CREATE INDEX app_notifications_actor_id_idx ON public.app_notifications USING btree (actor_id) WHERE (actor_id IS NOT NULL);
CREATE INDEX app_notifications_conversation_id_idx ON public.app_notifications USING btree (conversation_id) WHERE (conversation_id IS NOT NULL);
CREATE INDEX app_notifications_message_id_idx ON public.app_notifications USING btree (message_id) WHERE (message_id IS NOT NULL);
CREATE INDEX app_notifications_post_id_idx ON public.app_notifications USING btree (post_id) WHERE (post_id IS NOT NULL);
CREATE INDEX app_notifications_user_created_idx ON public.app_notifications USING btree (user_id, created_at DESC);
CREATE UNIQUE INDEX app_notifications_user_message_unique ON public.app_notifications USING btree (user_id, message_id) WHERE ((kind = 'chat_message'::text) AND (message_id IS NOT NULL));
CREATE UNIQUE INDEX app_notifications_user_post_unique ON public.app_notifications USING btree (user_id, post_id) WHERE ((kind = 'parking_post'::text) AND (post_id IS NOT NULL));
CREATE UNIQUE INDEX app_notifications_user_system_event_unique ON public.app_notifications USING btree (user_id, ((data ->> 'event_key'::text))) WHERE ((kind = 'system'::text) AND (data ? 'event_key'::text));
CREATE INDEX app_notifications_user_unread_created_idx ON public.app_notifications USING btree (user_id, created_at DESC) WHERE (read_at IS NULL);
CREATE INDEX conversations_owner_idx ON public.conversations USING btree (owner_id);
CREATE INDEX conversations_post_idx ON public.conversations USING btree (post_id);
CREATE INDEX conversations_requester_idx ON public.conversations USING btree (requester_id);
CREATE INDEX idx_feedback_created_at ON public.feedback USING btree (created_at DESC);
CREATE INDEX messages_conversation_idx ON public.messages USING btree (conversation_id, created_at);
CREATE INDEX native_push_tokens_enabled_recipient_idx ON public.native_push_tokens USING btree (user_id, platform) WHERE enabled;
CREATE INDEX parking_posts_expires_at_idx ON public.parking_posts USING btree (expires_at DESC);
CREATE INDEX parking_posts_status_idx ON public.parking_posts USING btree (status);
CREATE UNIQUE INDEX push_notification_events_message_id_unique ON public.push_notification_events USING btree (message_id) WHERE (message_id IS NOT NULL);
CREATE UNIQUE INDEX push_notification_events_post_id_unique ON public.push_notification_events USING btree (post_id) WHERE (post_id IS NOT NULL);
CREATE INDEX push_subscriptions_active_idx ON public.push_subscriptions USING btree (active);
CREATE INDEX push_subscriptions_active_user_idx ON public.push_subscriptions USING btree (user_id) WHERE (active = true);
CREATE INDEX push_subscriptions_user_idx ON public.push_subscriptions USING btree (user_id);
alter table "public"."app_notifications" enable row level security;
alter table "public"."conversations" enable row level security;
alter table "public"."feedback" enable row level security;
alter table "public"."messages" enable row level security;
alter table "public"."native_push_tokens" enable row level security;
alter table "public"."parking_posts" enable row level security;
alter table "public"."push_notification_events" enable row level security;
alter table "public"."push_subscriptions" enable row level security;
alter table "public"."user_badges" enable row level security;
alter table "public"."user_notification_preferences" enable row level security;
alter table "public"."users" enable row level security;
create policy "app_notifications_delete_own" on "public"."app_notifications" as PERMISSIVE for DELETE to "authenticated" using ((( SELECT auth.uid() AS uid) = user_id));
create policy "app_notifications_select_own" on "public"."app_notifications" as PERMISSIVE for SELECT to "authenticated" using ((( SELECT auth.uid() AS uid) = user_id));
create policy "app_notifications_update_own" on "public"."app_notifications" as PERMISSIVE for UPDATE to "authenticated" using ((( SELECT auth.uid() AS uid) = user_id)) with check ((( SELECT auth.uid() AS uid) = user_id));
create policy "conversations_insert" on "public"."conversations" as PERMISSIVE for INSERT to "authenticated" with check ((auth.uid() = requester_id));
create policy "conversations_select" on "public"."conversations" as PERMISSIVE for SELECT to "authenticated" using (((auth.uid() = owner_id) OR (auth.uid() = requester_id)));
create policy "conversations_update" on "public"."conversations" as PERMISSIVE for UPDATE to "authenticated" using (((auth.uid() = owner_id) OR (auth.uid() = requester_id))) with check (((auth.uid() = owner_id) OR (auth.uid() = requester_id)));
create policy "Allow insert for all users" on "public"."feedback" as PERMISSIVE for INSERT to "anon","authenticated" with check (true);
create policy "Allow service role read" on "public"."feedback" as PERMISSIVE for SELECT to "service_role" using (true);
create policy "Prevent public delete" on "public"."feedback" as PERMISSIVE for DELETE to "anon","authenticated" using (false);
create policy "Prevent public read" on "public"."feedback" as PERMISSIVE for SELECT to "anon","authenticated" using (false);
create policy "Prevent public update" on "public"."feedback" as PERMISSIVE for UPDATE to "anon","authenticated" using (false);
create policy "messages_insert" on "public"."messages" as PERMISSIVE for INSERT to "authenticated" with check (((auth.uid() = sender_id) AND (EXISTS ( SELECT 1
   FROM conversations c
  WHERE ((c.id = messages.conversation_id) AND ((c.owner_id = auth.uid()) OR (c.requester_id = auth.uid())) AND (c.closed = false))))));
create policy "messages_select" on "public"."messages" as PERMISSIVE for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM conversations c
  WHERE ((c.id = messages.conversation_id) AND ((c.owner_id = auth.uid()) OR (c.requester_id = auth.uid()))))));
create policy "parking_posts_delete_own" on "public"."parking_posts" as PERMISSIVE for DELETE to "authenticated" using ((auth.uid() = user_id));
create policy "parking_posts_insert" on "public"."parking_posts" as PERMISSIVE for INSERT to "authenticated" with check ((auth.uid() = user_id));
create policy "parking_posts_select" on "public"."parking_posts" as PERMISSIVE for SELECT to "authenticated" using (true);
create policy "parking_posts_update_own" on "public"."parking_posts" as PERMISSIVE for UPDATE to "authenticated" using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));
create policy "push_subscriptions_delete_own" on "public"."push_subscriptions" as PERMISSIVE for DELETE to "authenticated" using ((auth.uid() = user_id));
create policy "push_subscriptions_insert_own" on "public"."push_subscriptions" as PERMISSIVE for INSERT to "authenticated" with check ((auth.uid() = user_id));
create policy "push_subscriptions_select_own" on "public"."push_subscriptions" as PERMISSIVE for SELECT to "authenticated" using ((auth.uid() = user_id));
create policy "push_subscriptions_update_own" on "public"."push_subscriptions" as PERMISSIVE for UPDATE to "authenticated" using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));
create policy "user_badges_select_authenticated" on "public"."user_badges" as PERMISSIVE for SELECT to "authenticated" using (true);
create policy "user_notification_preferences_insert_own" on "public"."user_notification_preferences" as PERMISSIVE for INSERT to "authenticated" with check ((( SELECT auth.uid() AS uid) = user_id));
create policy "user_notification_preferences_select_own" on "public"."user_notification_preferences" as PERMISSIVE for SELECT to "authenticated" using ((( SELECT auth.uid() AS uid) = user_id));
create policy "user_notification_preferences_update_own" on "public"."user_notification_preferences" as PERMISSIVE for UPDATE to "authenticated" using ((( SELECT auth.uid() AS uid) = user_id)) with check ((( SELECT auth.uid() AS uid) = user_id));
create policy "users_insert_own" on "public"."users" as PERMISSIVE for INSERT to "authenticated" with check ((auth.uid() = id));
create policy "users_select_all" on "public"."users" as PERMISSIVE for SELECT to "authenticated" using (true);
create policy "users_update_own" on "public"."users" as PERMISSIVE for UPDATE to "authenticated" using ((auth.uid() = id)) with check ((auth.uid() = id));
create policy "chat_images_authenticated_upload" on "storage"."objects" as PERMISSIVE for INSERT to "authenticated" with check (((bucket_id = 'chat-images'::text) AND ((storage.foldername(name))[1] = 'chat'::text)));
create policy "chat_images_public_read" on "storage"."objects" as PERMISSIVE for SELECT to public using ((bucket_id = 'chat-images'::text));
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();
CREATE TRIGGER conversations_updated_at BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER messages_after_insert AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION on_message_insert();
CREATE TRIGGER messages_after_insert_app_notification AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION enqueue_chat_message_app_notification();
CREATE TRIGGER native_push_tokens_updated_at BEFORE UPDATE ON public.native_push_tokens FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER parking_posts_after_insert_app_notification AFTER INSERT ON public.parking_posts FOR EACH ROW EXECUTE FUNCTION enqueue_parking_post_app_notifications();
CREATE TRIGGER parking_posts_updated_at BEFORE UPDATE ON public.parking_posts FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER push_subscriptions_updated_at BEFORE UPDATE ON public.push_subscriptions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER user_notification_preferences_updated_at BEFORE UPDATE ON public.user_notification_preferences FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER users_create_notification_preferences AFTER INSERT ON public.users FOR EACH ROW EXECUTE FUNCTION create_user_notification_preferences();
CREATE TRIGGER users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION set_updated_at();
grant DELETE on "public"."app_notifications" to "anon";
grant INSERT on "public"."app_notifications" to "anon";
grant REFERENCES on "public"."app_notifications" to "anon";
grant SELECT on "public"."app_notifications" to "anon";
grant TRIGGER on "public"."app_notifications" to "anon";
grant TRUNCATE on "public"."app_notifications" to "anon";
grant UPDATE on "public"."app_notifications" to "anon";
grant DELETE on "public"."app_notifications" to "authenticated";
grant INSERT on "public"."app_notifications" to "authenticated";
grant REFERENCES on "public"."app_notifications" to "authenticated";
grant SELECT on "public"."app_notifications" to "authenticated";
grant TRIGGER on "public"."app_notifications" to "authenticated";
grant TRUNCATE on "public"."app_notifications" to "authenticated";
grant UPDATE on "public"."app_notifications" to "authenticated";
grant DELETE on "public"."app_notifications" to "service_role";
grant INSERT on "public"."app_notifications" to "service_role";
grant REFERENCES on "public"."app_notifications" to "service_role";
grant SELECT on "public"."app_notifications" to "service_role";
grant TRIGGER on "public"."app_notifications" to "service_role";
grant TRUNCATE on "public"."app_notifications" to "service_role";
grant UPDATE on "public"."app_notifications" to "service_role";
grant DELETE on "public"."conversations" to "anon";
grant INSERT on "public"."conversations" to "anon";
grant REFERENCES on "public"."conversations" to "anon";
grant SELECT on "public"."conversations" to "anon";
grant TRIGGER on "public"."conversations" to "anon";
grant TRUNCATE on "public"."conversations" to "anon";
grant UPDATE on "public"."conversations" to "anon";
grant DELETE on "public"."conversations" to "authenticated";
grant INSERT on "public"."conversations" to "authenticated";
grant REFERENCES on "public"."conversations" to "authenticated";
grant SELECT on "public"."conversations" to "authenticated";
grant TRIGGER on "public"."conversations" to "authenticated";
grant TRUNCATE on "public"."conversations" to "authenticated";
grant UPDATE on "public"."conversations" to "authenticated";
grant DELETE on "public"."conversations" to "service_role";
grant INSERT on "public"."conversations" to "service_role";
grant REFERENCES on "public"."conversations" to "service_role";
grant SELECT on "public"."conversations" to "service_role";
grant TRIGGER on "public"."conversations" to "service_role";
grant TRUNCATE on "public"."conversations" to "service_role";
grant UPDATE on "public"."conversations" to "service_role";
grant DELETE on "public"."feedback" to "anon";
grant INSERT on "public"."feedback" to "anon";
grant REFERENCES on "public"."feedback" to "anon";
grant SELECT on "public"."feedback" to "anon";
grant TRIGGER on "public"."feedback" to "anon";
grant TRUNCATE on "public"."feedback" to "anon";
grant UPDATE on "public"."feedback" to "anon";
grant DELETE on "public"."feedback" to "authenticated";
grant INSERT on "public"."feedback" to "authenticated";
grant REFERENCES on "public"."feedback" to "authenticated";
grant SELECT on "public"."feedback" to "authenticated";
grant TRIGGER on "public"."feedback" to "authenticated";
grant TRUNCATE on "public"."feedback" to "authenticated";
grant UPDATE on "public"."feedback" to "authenticated";
grant DELETE on "public"."feedback" to "service_role";
grant INSERT on "public"."feedback" to "service_role";
grant REFERENCES on "public"."feedback" to "service_role";
grant SELECT on "public"."feedback" to "service_role";
grant TRIGGER on "public"."feedback" to "service_role";
grant TRUNCATE on "public"."feedback" to "service_role";
grant UPDATE on "public"."feedback" to "service_role";
grant DELETE on "public"."messages" to "anon";
grant INSERT on "public"."messages" to "anon";
grant REFERENCES on "public"."messages" to "anon";
grant SELECT on "public"."messages" to "anon";
grant TRIGGER on "public"."messages" to "anon";
grant TRUNCATE on "public"."messages" to "anon";
grant UPDATE on "public"."messages" to "anon";
grant DELETE on "public"."messages" to "authenticated";
grant INSERT on "public"."messages" to "authenticated";
grant REFERENCES on "public"."messages" to "authenticated";
grant SELECT on "public"."messages" to "authenticated";
grant TRIGGER on "public"."messages" to "authenticated";
grant TRUNCATE on "public"."messages" to "authenticated";
grant UPDATE on "public"."messages" to "authenticated";
grant DELETE on "public"."messages" to "service_role";
grant INSERT on "public"."messages" to "service_role";
grant REFERENCES on "public"."messages" to "service_role";
grant SELECT on "public"."messages" to "service_role";
grant TRIGGER on "public"."messages" to "service_role";
grant TRUNCATE on "public"."messages" to "service_role";
grant UPDATE on "public"."messages" to "service_role";
grant DELETE on "public"."native_push_tokens" to "service_role";
grant INSERT on "public"."native_push_tokens" to "service_role";
grant REFERENCES on "public"."native_push_tokens" to "service_role";
grant SELECT on "public"."native_push_tokens" to "service_role";
grant TRIGGER on "public"."native_push_tokens" to "service_role";
grant TRUNCATE on "public"."native_push_tokens" to "service_role";
grant UPDATE on "public"."native_push_tokens" to "service_role";
grant DELETE on "public"."parking_posts" to "anon";
grant INSERT on "public"."parking_posts" to "anon";
grant REFERENCES on "public"."parking_posts" to "anon";
grant SELECT on "public"."parking_posts" to "anon";
grant TRIGGER on "public"."parking_posts" to "anon";
grant TRUNCATE on "public"."parking_posts" to "anon";
grant UPDATE on "public"."parking_posts" to "anon";
grant DELETE on "public"."parking_posts" to "authenticated";
grant INSERT on "public"."parking_posts" to "authenticated";
grant REFERENCES on "public"."parking_posts" to "authenticated";
grant SELECT on "public"."parking_posts" to "authenticated";
grant TRIGGER on "public"."parking_posts" to "authenticated";
grant TRUNCATE on "public"."parking_posts" to "authenticated";
grant UPDATE on "public"."parking_posts" to "authenticated";
grant DELETE on "public"."parking_posts" to "service_role";
grant INSERT on "public"."parking_posts" to "service_role";
grant REFERENCES on "public"."parking_posts" to "service_role";
grant SELECT on "public"."parking_posts" to "service_role";
grant TRIGGER on "public"."parking_posts" to "service_role";
grant TRUNCATE on "public"."parking_posts" to "service_role";
grant UPDATE on "public"."parking_posts" to "service_role";
grant DELETE on "public"."push_notification_events" to "anon";
grant INSERT on "public"."push_notification_events" to "anon";
grant REFERENCES on "public"."push_notification_events" to "anon";
grant SELECT on "public"."push_notification_events" to "anon";
grant TRIGGER on "public"."push_notification_events" to "anon";
grant TRUNCATE on "public"."push_notification_events" to "anon";
grant UPDATE on "public"."push_notification_events" to "anon";
grant DELETE on "public"."push_notification_events" to "authenticated";
grant INSERT on "public"."push_notification_events" to "authenticated";
grant REFERENCES on "public"."push_notification_events" to "authenticated";
grant SELECT on "public"."push_notification_events" to "authenticated";
grant TRIGGER on "public"."push_notification_events" to "authenticated";
grant TRUNCATE on "public"."push_notification_events" to "authenticated";
grant UPDATE on "public"."push_notification_events" to "authenticated";
grant DELETE on "public"."push_notification_events" to "service_role";
grant INSERT on "public"."push_notification_events" to "service_role";
grant REFERENCES on "public"."push_notification_events" to "service_role";
grant SELECT on "public"."push_notification_events" to "service_role";
grant TRIGGER on "public"."push_notification_events" to "service_role";
grant TRUNCATE on "public"."push_notification_events" to "service_role";
grant UPDATE on "public"."push_notification_events" to "service_role";
grant DELETE on "public"."push_subscriptions" to "anon";
grant INSERT on "public"."push_subscriptions" to "anon";
grant REFERENCES on "public"."push_subscriptions" to "anon";
grant SELECT on "public"."push_subscriptions" to "anon";
grant TRIGGER on "public"."push_subscriptions" to "anon";
grant TRUNCATE on "public"."push_subscriptions" to "anon";
grant UPDATE on "public"."push_subscriptions" to "anon";
grant DELETE on "public"."push_subscriptions" to "authenticated";
grant INSERT on "public"."push_subscriptions" to "authenticated";
grant REFERENCES on "public"."push_subscriptions" to "authenticated";
grant SELECT on "public"."push_subscriptions" to "authenticated";
grant TRIGGER on "public"."push_subscriptions" to "authenticated";
grant TRUNCATE on "public"."push_subscriptions" to "authenticated";
grant UPDATE on "public"."push_subscriptions" to "authenticated";
grant DELETE on "public"."push_subscriptions" to "service_role";
grant INSERT on "public"."push_subscriptions" to "service_role";
grant REFERENCES on "public"."push_subscriptions" to "service_role";
grant SELECT on "public"."push_subscriptions" to "service_role";
grant TRIGGER on "public"."push_subscriptions" to "service_role";
grant TRUNCATE on "public"."push_subscriptions" to "service_role";
grant UPDATE on "public"."push_subscriptions" to "service_role";
grant SELECT on "public"."user_badges" to "authenticated";
grant DELETE on "public"."user_badges" to "service_role";
grant INSERT on "public"."user_badges" to "service_role";
grant REFERENCES on "public"."user_badges" to "service_role";
grant SELECT on "public"."user_badges" to "service_role";
grant TRIGGER on "public"."user_badges" to "service_role";
grant TRUNCATE on "public"."user_badges" to "service_role";
grant UPDATE on "public"."user_badges" to "service_role";
grant DELETE on "public"."user_notification_preferences" to "anon";
grant INSERT on "public"."user_notification_preferences" to "anon";
grant REFERENCES on "public"."user_notification_preferences" to "anon";
grant SELECT on "public"."user_notification_preferences" to "anon";
grant TRIGGER on "public"."user_notification_preferences" to "anon";
grant TRUNCATE on "public"."user_notification_preferences" to "anon";
grant UPDATE on "public"."user_notification_preferences" to "anon";
grant DELETE on "public"."user_notification_preferences" to "authenticated";
grant INSERT on "public"."user_notification_preferences" to "authenticated";
grant REFERENCES on "public"."user_notification_preferences" to "authenticated";
grant SELECT on "public"."user_notification_preferences" to "authenticated";
grant TRIGGER on "public"."user_notification_preferences" to "authenticated";
grant TRUNCATE on "public"."user_notification_preferences" to "authenticated";
grant UPDATE on "public"."user_notification_preferences" to "authenticated";
grant DELETE on "public"."user_notification_preferences" to "service_role";
grant INSERT on "public"."user_notification_preferences" to "service_role";
grant REFERENCES on "public"."user_notification_preferences" to "service_role";
grant SELECT on "public"."user_notification_preferences" to "service_role";
grant TRIGGER on "public"."user_notification_preferences" to "service_role";
grant TRUNCATE on "public"."user_notification_preferences" to "service_role";
grant UPDATE on "public"."user_notification_preferences" to "service_role";
grant DELETE on "public"."users" to "anon";
grant INSERT on "public"."users" to "anon";
grant REFERENCES on "public"."users" to "anon";
grant SELECT on "public"."users" to "anon";
grant TRIGGER on "public"."users" to "anon";
grant TRUNCATE on "public"."users" to "anon";
grant UPDATE on "public"."users" to "anon";
grant DELETE on "public"."users" to "authenticated";
grant INSERT on "public"."users" to "authenticated";
grant REFERENCES on "public"."users" to "authenticated";
grant SELECT on "public"."users" to "authenticated";
grant TRIGGER on "public"."users" to "authenticated";
grant TRUNCATE on "public"."users" to "authenticated";
grant UPDATE on "public"."users" to "authenticated";
grant DELETE on "public"."users" to "service_role";
grant INSERT on "public"."users" to "service_role";
grant REFERENCES on "public"."users" to "service_role";
grant SELECT on "public"."users" to "service_role";
grant TRIGGER on "public"."users" to "service_role";
grant TRUNCATE on "public"."users" to "service_role";
grant UPDATE on "public"."users" to "service_role";
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('chat-images','chat-images',true,5242880,array['image/jpeg','image/png','image/webp','image/gif']);
alter publication "supabase_realtime" add table "public"."parking_posts";
alter publication "supabase_realtime" add table "public"."conversations";
alter publication "supabase_realtime" add table "public"."messages";
alter publication "supabase_realtime" add table "public"."app_notifications";
