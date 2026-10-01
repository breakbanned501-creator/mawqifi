# Safety compatibility and coordinated release

No production execution is performed by this branch or its test suite.
Reference web contract: main `30a0a56816ea16d87df766720da3a483dba4e277`.
The original safety migration has not been applied, so it is corrected in place.
If a different environment already applied the original, stop: use a separately
reviewed forward correction rather than rewriting its recorded history.

## Contracts and limits

- Parking notes: 500 characters, unchanged frontend limit. INSERT and content
  UPDATE reject 501+. A status-only UPDATE does not revalidate unchanged legacy
  content, preserving the expiry RPC. Post ownership/creation timestamp stay immutable.
- Main's chat textarea and send helper have no length cap. Neither database nor
  safety client imposes a new 2,000-character limit. Tests cover 1,999/2,000/2,001/
  10,000 characters. This is not a claim that arbitrarily large requests bypass
  hosting/PostgREST/database resource limits. Future length limits require an
  explicitly coordinated product/client contract change, not a silent DB cut.
- Empty/invisible-only messages and runs of 40 identical characters are rejected.
  Normal escaped Arabic/English/emoji/URL/paragraph content remains supported.
- Messages: 20 successful inserts per sender per rolling minute, across chats
  and message types. Same trimmed text in the same chat within 30 seconds rejects.
- Posts: 5 successful inserts per user per rolling 5 minutes. Deleting posts does
  not erase the private rate ledger. Pre-migration posts do not fill this ledger.
- Reports: 5 distinct targets per reporter per rolling 5 minutes; at most one
  report per reporter/type/target. Duplicate retries are idempotent. Details 300 max.
- All timestamps are server-owned; per-user/pair advisory locks serialize checks.
  Failed transactions do not save messages/posts or dispatch their notifications.
- New conversations: real post owner, active/expired status, expires_at later than
  database wall-clock minus 30 seconds. Explicitly closed posts always reject.
  No arbitrary client timestamp or claimed "opened before expiry" is trusted.
  The safety client uses the same window as a UX precheck; database time remains
  authoritative. This window covers a fetched-active post expiring during the subsequent INSERT,
  including the expiry RPC changing its status. It does not extend parking lifetime
  or change UI countdown/closed-history rules. Older expired posts cannot start chats.

## Cached-client interval

From A to B below, old web/PWA clients keep their normal submission/storage shapes:
500-character notes, long text, images/locations, profile bootstrap, read timestamps,
history, realtime and browser subscriptions. No new safety row is required for login.
There is no time-dependent rollout toggle that later invalidates these contracts.

Intentional spam/rate limits, an expired post outside the grace window, a real block
or an admin restriction can still reject a request. Old clients show their existing
generic error; safety clients map the database markers to Arabic/English feedback.
This applies to cached clients even after B and cannot be fixed by deploying JS alone.
It is controlled abuse/expiry rejection, not data corruption or a normal-flow outage.
Normal clients must not be forced to update solely to create a post or send text.

Old server code does not suppress parking push across blocks. Do not enable the
block UI, manually populate blocks/restrictions, or release native safety until B
is verified. Coordinate A/B closely; old cached client code can then dispatch to
the new server, which filters both directions. In-flight/already-delivered pushes
cannot be recalled. No push keys, subscriptions, or native/web separation change.

## Release order (requires separate approval)

A. Validate the corrected SQL against production-equivalent staging, capture schema
   and grants/backup, confirm version absent and object names unoccupied. Apply
   `20261001031918_app_store_safety.sql` once with migration tracking. It is atomic,
   not raw-SQL rerunnable. Ordinary indexes/DDL may temporarily lock writes; use a
   low-traffic controlled window and a deployment-runner lock timeout. Inspect
   advisors and smoke-test the OLD client against the corrected schema.
B. Deploy coordinated web safety UI/server changes from the reviewed branch only
   after a separately approved merge. The new feed and push sender require tables
   from A; deploying B first is not supported. Verify production READY before use.
C. Verify with two existing anonymous accounts: profile/identity preserved, notes
   at 500, chats/read state/realtime, reports privacy, both block directions/unblock,
   non-blocked push and blocked-recipient exclusion, using real authenticated JWTs.
D. Release native later after staging/device/Xcode verification and operational
   moderation readiness. This commit does not submit anything to Apple.

## Exact rollback order

1. Stop native safety release and further moderation/block activation. Record/export
   moderation data and current grants. Explicitly acknowledge that rolling back
   enforcement restores communication across retained blocks/restrictions.
2. Roll web/server back to the pre-safety release FIRST. Keep the database objects
   available so cached safety JS does not encounter missing tables/RPCs.
3. Manually run `supabase/rollback/20261001031918_app_store_safety.sql` only after
   approval. Never put it in `supabase/migrations` or apply via an automatic db push.
   It removes the three app-table guards and two restrictive read policies; restores
   prior messages UPDATE/DELETE grants to anon/authenticated. Original messages RLS
   still provides no edit/delete policies; these grants alone do not expose writes.
4. Keep reports/blocks/restrictions/ledger, their RLS/grants, reporting and block-table
   guards, helper functions, indexes and moderation status/history. No auth/user/data
   reset or identity remap. Cached safety UI may continue indicating retained blocks;
   backend enforcement is deliberately off after rollback, so this is an emergency
   rollback, not a normal state in which to operate the safety release.
5. Smoke-test old flows and privacy. Retain migration history. Re-enabling requires a
   reviewed forward migration recreating enforcement, not replaying unconditional
   CREATE statements from the initial migration. The reverse script is repeatable.

## Verification scope

The disposable PGlite PostgreSQL suite uses anonymous UUID users under authenticated
roles, the repository's actual expiry/preview functions, boundary/atomic rejection
tests, blocking/history/RLS, the actual push relationship helper, and reverse twice.
It does not write to production or prove real-device delivery, PostgREST/Realtime
integration, App Store approval or moderation response. Complete staging/advisors
and physical-device verification before rollout. No service-role/token values enter
test fixtures, source control, or native bundles.
