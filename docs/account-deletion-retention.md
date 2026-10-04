# Account deletion — approved retention implementation

Verified on 2026-10-04 (Asia/Kuwait), only on `ios-release-hardening` and dedicated staging `jrmiwmsgnztqwbigumlw`. No production, main, Codemagic or App Store Connect action.

## Self-only server operation

Settings exposes Delete Account to registered **and anonymous** accounts. The accessible modal names the permanent action, defaults focus to Cancel, and requires a second explicit destructive tap. AuthProvider owns a synchronous request lock and replaces every authenticated screen/provider with a localized progress/retry screen. Navigating back cannot mount private screens. A local pending marker resumes interrupted deletion after reload. Only completed server deletion clears the session and returns to `/` with a new guest/onboarding state.

The client calls the `delete-account` Supabase Edge Function on its configured Supabase project, using the real current Auth session. This is a deliberate server endpoint on the same staging Supabase project rather than a new Vercel route. It works with the static Capacitor bundle and does not require a client service credential. The staging function accepts only an empty body, verifies Bearer using `auth.getUser(token)`, and accepts **no target user ID**. Its normal public-key/JWT client calls `begin_account_deletion()`; SQL independently derives `auth.uid()`. The admin client can target only that verified user.

The deployed function currently has a hard guard for `https://jrmiwmsgnztqwbigumlw.supabase.co`; it has no production fallback. Allowed browser origins are exactly `capacitor://localhost` and `https://mawqifi-testflight-staging.vercel.app`. OPTIONS does not grant authentication. Gateway JWT verification is disabled **because custom Auth verification is implemented and tested in the function**; missing/rejected Bearers get 401. SDK client timeout is 120 seconds. Function responses contain only safe status codes, never tokens, database errors or keys. Server credentials use Supabase's server-only function environment, never `NEXT_PUBLIC_*`.

## Migration and access revocation

Canonical migration files:

- `20261003224300_account_deletion_retention.sql` (staging Management API version `20261003225723`).
- `20261003230230_account_deletion_storage_revocation.sql` (staging Management API version `20261003230514`).

The Management API generates application timestamps; these version differences are recorded deliberately, as with the earlier staging bootstrap migrations. Use the reviewed migration contents and coordinate the target migration ledger; do not blindly run all historical migrations against production.

`users.id` remains the stable shared-history reference. Its Auth cascade FK is replaced by nullable unique `auth_user_id -> auth.users(id) ON DELETE SET NULL`, initially backfilled from every existing profile's valid Auth ID. `deleted_at` is added. The migration itself does not delete accounts, posts, messages or images. Signup/profile triggers populate the binding and forbid normal clients from changing it, deletion state or an existing tombstone. Profile DELETE is revoked. No replacement Auth identity is fabricated.

An empty-search-path, security-definer `active_account()` checks a live binding and null deletion timestamp. Restrictive policies add that condition to every existing RLS-enabled public table and Storage objects; existing ownership/membership policies still apply. A valid but deleted JWT cannot read data, insert messages/posts, upload images, recreate a profile or use handoff/block/expiry RPCs. Client-callable privileged helpers explicitly check the same condition because they bypass table RLS. Normal writes and deletion use an account advisory transaction lock. Token/subscription/preferences triggers also guard server-role writes, preventing an in-flight server request from recreating deleted-user tokens. The Next server authentication helper checks live profile state too, before its privileged APIs run.

The private, RLS-enabled `mawqifi_safety.account_deletion_jobs` table stores an owned-object manifest and progress timestamps. It has no client grants/policies. Its absence of policies is intentional deny-by-default. `begin_account_deletion()` is self-only, bypasses restrictions **only to let a user delete their own restricted account**, and resumes the same manifest on retry. No client-set flag/GUC authorizes cleanup.

## Data handling

| Data | After deletion | Reason |
| --- | --- | --- |
| Auth user, login metadata and refresh sessions | Deleted server-side | Removes login identity; live DB checks also deny still-valid access JWTs |
| Profile | Non-login tombstone: `Deleted User`, null avatar/Auth binding, deletion timestamp | Preserves shared FK references without cascades; UI displays `مستخدم محذوف` / `Deleted User` |
| Owned posts | Cancelled, car description/location free text cleared | Removes availability and personal text; structural institution/college/side metadata and IDs remain for shared history |
| Active claims involving account | Cancelled and completed timestamp recorded; associated claimed posts cancelled and conversations closed | No orphaned discoverable handoff; other participant retains history |
| Owned private parking GPS | Deleted | No legitimate active handoff remains |
| Authored text/image/location messages | Original rows/IDs/timestamps remain, contents replaced by localized deletion placeholder, image URL/coordinates cleared | Keeps conversation order/report references while erasing personal content |
| Peer messages and images | Unchanged, readable only under existing participant policies | Preserves the other participant's history; chat is read-only |
| Owned Storage objects | Removed through Storage API, **not SQL metadata deletion** | Deletes actual bytes and metadata; authoritative Storage ownership determines removal |
| Push tokens/subscriptions, notification preferences, own notifications, badges, post submission counters | Deleted | Removes device and account state |
| Peer notification referencing deleted actor | Actor cleared; payload minimized | Removes copied personal notification details without deleting the peer's history |
| Blocks involving account | Deleted | No active relationship remains |
| Moderation reports | Minimal reporter/target tombstone IDs, type, reason, status and timestamps retained; relevant free-text details cleared | Moderation integrity, abuse prevention, retained message/report links |
| Restrictions | Retained if present, reason minimized to `deleted_account` | Safety audit without personal explanation; deletion itself is not blocked |
| Cleanup job | Only tombstone ID/start/completion timestamps remain after Auth deletion; object manifest cleared | Retry/audit and lost-response acknowledgement |
| Separately submitted feedback/support | Not guessed from unlinked contact fields | No account ownership column exists; policy directs contact-data deletion requests to support |

Retained identifiers are pseudonymous linkage, not a claim of mathematically irreversible anonymization. Moderation evidence is minimized, access-restricted and subject to necessity/legal review; no automated retention expiry is claimed. Before a later production rollout, audit any historic objects with NULL ownership. Do not infer ownership from arbitrary message URLs or delete a peer's object. Legacy assets without provable ownership need an explicit reviewed remediation; current staging deletion fixtures have authoritative ownership.

## Private Storage and CDN finding

The live test caught an important difference from database-only tests: an already authorized private image URL could return CDN HIT even after its RLS row became inaccessible. A fresh nonce correctly hit RLS and denied access. `cacheControl: 0` alone does **not** revoke CDN authorization.

New app downloads therefore add a unique `cacheNonce` and use `cache: no-store`, retaining JWT-backed private blobs and no signed/public URLs. Realtime UPDATE redaction replaces message bubbles and clears enlarged-image state; PrivateChatImage cleanup revokes its blob URL.

Deletion uses a **service-only, read-only** `account_deletion_cache_probes(account_id)` lookup of objects that the verified deleting user could previously access. These paths are NOT the removal manifest. Storage `.remove()` receives only the original owned-object manifest. Known canonical cached paths are invalidated individually via `DELETE /storage/v1/cdn/<bucket>/<object>`; no whole-bucket purge, peer-object deletion or peer record mutation occurs. The function waits 65 seconds for documented CDN propagation, then probes canonical URLs with the old user token. Any continuing success or server error stops completion. Auth deletion is last, so a cleanup failure keeps real anonymous Auth usable for a retry while its database access remains disabled. Already downloaded copies cannot be recalled from another device.

Automatic approval review initially rejected the broad bucket-cache proposal. It was replaced with the narrower object-specific, cache-only operation; 26 endpoint assertions prove the owned-only removal boundary, and the revised staging migration/function were approved and applied. No rejected broad operation was executed.

See [Supabase Auth deletion](https://supabase.com/docs/guides/auth/managing-user-data#deleting-users), [Storage Smart CDN](https://supabase.com/docs/guides/storage/cdn/smart-cdn), and [CDN cache purge](https://supabase.com/docs/guides/storage/cdn/purge-cdn-cache). CDN purge requires a supported hosted plan; if unavailable, the function returns `STORAGE_REVOCATION_REQUIRED` rather than claiming successful deletion.

## Retry and local cleanup

DB cancellation/redaction happens in one transaction, before access is disabled. An interrupted Storage/Auth phase cannot restart handoffs, extend timers or duplicate tombstones. The retained manifest permits repeated owned-object removal. Auth deletion sets the job completion flag through a trigger; a lost final HTTP response can be acknowledged by `account_deletion_status()`, which exposes only the caller's own non-sensitive completion flags, no target-ID parameter or private records. Repeated deletion after Auth removal safely returns 401; the client completion acknowledgement handles that case.

On success the client unmounts private screens, removes realtime channels, signs out locally, clears Supabase/local account keys and session storage, evicts PWA CacheStorage and reloads into guest/onboarding. Capacitor Preferences' native token/user binding is cleared, OS push registration is removed, and delivered notifications are cleared. Web Push is unsubscribed locally without a deleted-user server request. Locale may remain; place/sub-place, tutorial and account caches are cleared. Neither APNs nor Web Push delivery is invoked.

If an interrupted anonymous cleanup cannot refresh its legitimate session after a prolonged outage, support must resume the **existing private job** server-side with verified ownership; do not fabricate JWTs or reactivate the tombstone. Large accounts may require operational continuation within hosted Edge execution limits. User-initiated retries remain safe; a server/storage failure never announces success.

## Rollback / later production rollout

Disposable validation applies the first migration with ROLLBACK and verifies all profiles/messages remain intact, then reapplies and runs deletion assertions. Before any actual deletion, a transaction rollback can safely undo DDL. After real deletion, do not restore the old Auth cascade FK or undo tombstones: Auth identities, authored content and images are irreversibly removed by the approved action. Recover forward by preserving restrictive guards, private jobs and shells, fixing/redeploying the endpoint and retrying cleanup. Rolling back a client must not roll back live-account protections.

Production requires a separate explicit approval: review the current production schema/constraints and historical ownership, backup, apply both reviewed migrations in order with a coordinated ledger, configure a separately reviewed production function guard/exact origins and server-only credentials, verify its hosted CDN purge support, deploy updated server authentication and clients together, then repeat real privacy/security tests. Do not point this staging function at production or copy production data to staging. None of that rollout has been performed.

## Validation record

Validated on 2026-10-04 against staging `jrmiwmsgnztqwbigumlw` only. The `delete-account` Edge Function is ACTIVE, version 4, using SDK 2.106.1. Both migrations above were applied after disposable PostgreSQL validation.

| Check | Result |
| --- | --- |
| New deletion SQL/RLS suite | PASS: 45 assertions, including migration rollback/data preservation, stale JWT denial and service-only cache scope |
| Endpoint unit suite | PASS: 26 assertions; self-only verified Auth, owned-only removal, exact CORS, retry failures and cache propagation |
| Client/UI suite | PASS: 33 assertions; bilingual dialogs, duplicate lock, progress/retry, lost-response recovery, web/native local cleanup |
| Existing SQL/RLS regressions | PASS: safety 89, handoff 70, sub-place 102, chat images 21 |
| Existing helper/UI regressions | PASS: 263 assertions across home, release, sub-place, publish performance, GPS, handoff and chat images; safety helpers 16 |
| Real anonymous JWT/Storage/API checks | PASS: 51 assertions across preparation (13), deletion/privacy (34), token API (4) |
| Compiled mobile-width UI | PASS: Arabic RTL and English LTR confirmation, Cancel initially focused, 358px dialog within 390px viewport, cancellation preserves identity |
| Real deletion through compiled UI | PASS: C deleted, authenticated navigation unmounted, fresh guest onboarding, only locale and new Auth storage remain |
| Typecheck / lint / web build | PASS; web/PWA build generates 19 pages and server API routes |
| Native static archive / standalone iOS sync | PASS; local `out` assets, no `server.url`, native service worker excluded |
| Physical iPhone / signed Xcode IPA | Pending device/TestFlight validation; Windows static archive is not a signed IPA |

The browser QA used the final compiled static bundle with a temporary localhost transport forwarding only deletion requests to the guarded staging endpoint using the real caller JWT. It did not emulate Auth or introduce a client service credential. Exact `capacitor://localhost` CORS was additionally tested directly against staging. Native OS unregister/Preferences cleanup was verified with executable mocks and compilation; real device behavior remains a TestFlight check.

Disposable identities:

- A: `88e9fc01-39bf-40f0-b0a7-c4644421b146`
- B: `86c992a5-f76d-401b-88b2-f1d46165459d`
- C: `bc77a063-f4e3-4475-b4db-df7ddb9c6e45`
- Fresh onboarding QA guest: `94817a90-ce0f-417d-8318-ea881ec5bf6e`

All four were cleaned using their own real Auth sessions and the staging endpoint. Final database audit: Auth identities 0; detached tombstones 4; native tokens 0; Web Push subscriptions 0; private GPS 0; owned Storage images 0; active posts 0; completed jobs with cleared manifests 4. Conversation `928fe32d-cb92-42e1-9765-2734160d5a68` retains all five original message rows. B's authored text and image remained intact after A's deletion; they were redacted/removed only when B subsequently deleted its own account. C's unrelated post/Auth remained unchanged until C's deliberate UI deletion. Minimal report/history shells remain by design.

Only invalid fixture device tokens and `example.invalid` Web Push endpoints were registered. No APNs, Web Push or notification delivery endpoint was invoked. The temporary real-session file was removed after verification. No production project, main branch or Codemagic operation was accessed.
