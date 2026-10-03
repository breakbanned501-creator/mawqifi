# Supabase setup for Mawqifi

## 1. Run the SQL schema

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project.
2. Go to **SQL Editor** (left sidebar).
3. Click **New query**.
4. Paste the full contents of `supabase/schema.sql` from this repo.
5. Click **Run** (or Ctrl+Enter).

If you see errors about tables already existing, that is normal on a re-run; fix any remaining policy errors manually.

## 2. Enable guest (anonymous) sign-in

1. **Authentication** → **Providers**.
2. Enable **Anonymous sign-ins**.

Guests can publish posts and chat without email. Email signup is optional.

## 3. Environment variables (Vercel)

In Vercel → Project → **Settings** → **Environment Variables**, add:

| Name | Value |
|------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL from Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `anon` `public` key from the same page |

Apply to **Production**, **Preview**, and **Development**, then **Redeploy**.

For browser push notifications, also add these Vercel variables:

| Name | Value |
|------|-------|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase `service_role` key; server-side only |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Public key from the VAPID key pair |
| `VAPID_PRIVATE_KEY` | Private VAPID key; server-side only |
| `VAPID_SUBJECT` | Contact URI, e.g. `mailto:admin@mawqifi.com` |

Never expose `SUPABASE_SERVICE_ROLE_KEY` or `VAPID_PRIVATE_KEY` in browser code or commits. Generate the VAPID pair locally with `npx web-push generate-vapid-keys`.

If the main schema is already installed, run `supabase/migrations/20260813_create_push_subscriptions.sql` once in the Supabase SQL Editor. New projects can run the complete `supabase/schema.sql` instead. The migration supports multiple devices per user and records one delivery event per parking post to prevent duplicates.

## 4. Realtime

The schema adds `parking_posts`, `messages`, and `conversations` to the realtime publication. Confirm under **Database** → **Publications** → `supabase_realtime` if messages do not appear live.

## 5. Storage

The historical foundation creates `chat-images`; `20261003181232_secure_chat_image_storage.sql` converts it to private with conversation-membership RLS. Uploads remain under `chat/{conversationId}/...`. Apply this reviewed migration to staging first; production requires separate approval. Existing message URLs are not rewritten: the client resolves legacy locators and downloads using the participant JWT. New records store authenticated locators, never public/signed URLs. Closed conversations retain image reads but reject uploads.
