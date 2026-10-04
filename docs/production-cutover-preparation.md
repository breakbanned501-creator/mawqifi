# Production cutover preparation — 2026-10-04

**Free-plan update:** Follow [the four-image private-copy cutover](free-plan-chat-image-cutover.md)
for image ownership, reference migration, cleanup and cache limitations. CDN purge is
not required or attempted. The rehearsal/build evidence below describes the earlier
baseline; the focused Free-plan patch does not rerun those large suites.

Prepared on `ios-release-hardening`, from baseline `8d56560eb3edd043662d6cb18dec6541b38b2e66`.
This document approves nothing: execution, secrets, deployment, submission and release
remain separate human decisions. No production write, purge, notification, deployment,
main merge or Codemagic run was performed during preparation.

## Prepared code/configuration

`codemagic.yaml` now has a separate **ios-app-store-production** workflow. The existing
staging workflow is preserved byte-for-byte. The production workflow uses
`mawqifi_app_store_production`, Apple Silicon, the existing **Mawqifi Codemagic**
integration, App Store distribution signing and `com.mawqifi.app`. It uses matching
distribution certificate/profile resolution rather than hard-coded certificate IDs.
Marketing version remains 1.0; build number is the greater of latest App Store Connect
build + 1 and `PROJECT_BUILD_NUMBER`. API failures abort numbering.

It has no triggers. Both submission flags are false, no beta groups, review submission,
release type or automatic release. `auth: integration` will upload the signed IPA only
when a human explicitly runs the workflow later. Production provisioning omits
`testFlightInternalTestingOnly`. This follows the current [Codemagic signing guide](https://docs.codemagic.io/yaml-code-signing/signing-ios/)
and [publishing guide](https://docs.codemagic.io/yaml-publishing/app-store-connect/).

`APPROVED_RELEASE_COMMIT` must be an exact 40-character SHA and
`APPROVED_RELEASE_TAG` must be an explicitly approved `mawqifi-production-*` tag.
There is no default. Checkout HEAD, tag target and approved SHA must match, on
`ios-release-hardening`, with the baseline as ancestor. This task does not create a tag.
The workflow fetches only that tag; stale or missing approval fails before building.
Production public configuration is checked locally, then its key is checked by a
read-only Auth settings request **only in a future approved CI run**.

`scripts/scan-production-archive.cjs` scans the expanded IPA `.app` and `out/`, not
compressed IPA bytes. Each root must contain the expected production public backend
configuration. It rejects the staging project/backend, cross-project anon JWTs,
service-role JWTs, Supabase secret keys, private PEMs, known credential configuration
and private environment values. The installed app must have local assets, `webDir=out`,
bundle `com.mawqifi.app`, no `server.url` and no native service-worker artifacts. An
unexpected symlink also aborts for review rather than bypassing inspection.

The prepared production deletion variant is
`supabase/production/functions/delete-account/index.ts`; it is intentionally outside
the normal function directory. `function-release.json` records its future packaging
contract. It must eventually be deployed under **delete-account**, not a new client
endpoint, with gateway `verify_jwt=false` and mandatory handler `auth.getUser()`.
Gateway JWT bypass is necessary for the tested public-key/auth setup; it never bypasses
handler authentication. No deployment was performed.

The variant changes only the exact project URL guard and web origin. It accepts only
`https://opsyvdsivxoqphkfdsbb.supabase.co`, approved web origin
`https://mawqifiapp.vercel.app` and `capacitor://localhost`. It preserves real Auth
verification, no client target ID, JWT-derived self-only SQL, server-only admin access,
old-JWT revocation, retained/tombstoned history, owned-object-only removal, narrowly
scoped fresh authenticated denial probes and Auth deletion last. Storage failures remain
retryable with the anonymous Auth identity retained. Both prepared handlers now support
Free-plan deletion without purge or a fixed CDN wait; neither was deployed in this patch.
The Next.js tsconfig excludes this Deno entrypoint, as it already excludes staging Edge
functions; endpoint tests transpile and execute both handlers with offline API mocks.

## Exact migration sequence and observed drift

`supabase/production/rehearsal/migration-order.json` contains the 14 explicitly approved
migrations, from `20261001031918_app_store_safety.sql` through
`20261003230230_account_deletion_storage_revocation.sql` in the approved order.
`migration-hashes.json` pins SHA-256 of each file with CRLF normalized to LF.
Canonical migrations were not edited. Never blindly run `supabase db push`.

The chain adds six public tables (`places`, `account_restrictions`, `content_reports`,
`user_blocks`, `parking_post_locations`, `parking_claims`) and three private safety tables
(`post_submission_times`, `handoff_settings`, `account_deletion_jobs`). Additive post
columns are `place_id`, `location_description`, `handoff`, `sub_place_id`; profile columns
are `auth_user_id` and `deleted_at`. KU fields become nullable only under the already
reviewed institution/GPS validation. Lifecycle enums/checks, helper functions/triggers,
indexes, restrictive policies and retained-history FK/grant changes are rehearsed as-is.

The observed production ledger uses some different historical timestamps than source
files. Existing foundational tables, feedback, localization, badge and push structures
must not be recreated. Do not replay the production contributor assignment, staging
bootstrap, or missing-looking historical migrations just to align names. Future
execution must reconcile the **live** ledger/DDL with the reviewed 14-file plan and
record successful versions explicitly through the approved migration mechanism.

`observed-schema.sql` is a metadata-only snapshot of the 11 application tables,
constraints, indexes, functions, policies, client/service grants and Realtime publication
membership reviewed on 2026-10-04. It contains no real identities/content/credentials.
It is **not** a production bootstrap or migration. `platform-mocks.sql` supplies only
the disposable Auth/Storage shapes, roles and `auth.uid()` session predicate.
Managed Storage triggers and unrelated managed Storage table grants are intentionally
excluded; do not copy those into application migrations.

Production-specific feedback policy names and redundant deny policies are preserved.
They are not replaced with staging policy names. Restrictive account/block/image guards
intersect existing permissive policies. All public application tables have RLS; the
private arrival-settings table has no client grants. Conversation clients may update
only read markers, not lifecycle fields. Auth deletion changes the Auth/profile FK to
SET NULL; post-to-conversation deletion is RESTRICT. No shared-history cascade is added.

The rehearsal seeds **synthetic** shape only: 975 profiles (968 anonymous), 23 verified
legacy KU posts (1 active), 16 open conversations (15 reference expired posts), 23
messages, 4 historical image metadata records, and 18 synthetic Web Push subscriptions.
All IDs, text, URLs, subscription values and image bytes are artificial. No production
user UUID, Storage object name, message or image was copied. Fixture notification/message
triggers are disabled only during fixture creation to reproduce the observed shape,
then re-enabled before migration/testing; application triggers are never disabled during
the migration chain.

## Disposable rehearsal evidence and limits

Run `node scripts/test-production-rehearsal.cjs <pglite-package-directory>`.
The harness has no remote client. `rehearsal/result.json` records the reviewed hashes,
synthetic shape and 71 passing assertions. Each migration is first applied with its
transaction rolled back, then applied normally. All 14 succeeded without dependency,
duplicate object, FK, trigger, function or policy failures. Rollback is transactional;
it is not a claim that committed schema can safely be dropped after clients begin use.

Legacy post content/status, conversations/messages and all image metadata survive.
Verified KU rows receive `kuwait_university` and proven college `education`; no
North/South side is guessed. They remain stored but excluded from the new side-scoped
feed until the user creates a newly scoped post. No GPS or claims are invented.

Functional checks on the migrated production shape cover North/South isolation, PAAET,
single-campus GUST, secure GPS transaction/invalid-path denial, coordinate privacy,
one claim/repeated-tap reuse/second-claim denial, immediate conversation, bilateral block
enforcement, report privacy, manual arrival idempotency, exact 15-minute server timer,
25m radius, timed-out writes denied and readable retained history.

The rehearsal directly observes PostgreSQL advisory locks in `pg_locks` during deletion
and their release on rollback. Handoff uses post/claim `FOR UPDATE`, unique claim keys
and the existing account/pair serialization guards. This local engine has **one session**:
it does not prove multi-session contention or production lock duration. Before final
execution approval, a disposable full PostgreSQL two-connection check should verify a
blocked second claim/deletion/write, release on rollback, and timeout behavior. Production
DDL/table rewrite lock time must be budgeted from current size, not these fixture timings.

Supplementary existing disposable suites cover safety SQL/RLS (89 + 16 helpers), handoff
(70), scopes (102), private images (21), account deletion (45), deletion endpoint variants
(31 staging / 32 production), and client/UI helpers (296). These use synthetic PostgreSQL
session identity or mocked Auth verification, **not fabricated JWTs sent to Supabase**.
No real production or staging Auth identity was created in this code-only phase. Real
staging physical-device/JWT validation of the baseline was completed previously by the
user; this rehearsal does not relabel mocks as live JWT/CDN/Apple verification.

Build validation: typecheck and lint passed; web/PWA build passed (public Cairo fetch
needed a network-permitted retry). The staging native static archive and iOS sync passed,
including local assets/no-service-worker/secret verification. A second disposable native
compile used the production public URL/origin with an **unusable publishable-key fixture**
and a preload guard blocking Supabase/Vercel backend requests. Its 211 local output/native
source files passed the production scanner without a staging reference or private material.
This was not a signed IPA or a production Auth test. Local native output was then restored
to staging. Codemagic schema, both workflows' Bash syntax, approval/configuration guards
and scanner negative cases passed 51 assertions against the current official schema.
No Apple CI, signing, uploading or submission was started.

Final executed automated assertion total: **824** (398 SQL/rehearsal assertions and
426 helper/client/endpoint/workflow assertions). Typecheck, lint, web/PWA build,
native static archive, standalone iOS sync and native/secret scans passed. Standalone
sync needed a retry outside the Windows sandbox after its user-info lookup failed;
the retry succeeded without changing code. The signed-IPA scanner itself remains a
future macOS signing step; the local 211-file scan is deliberately described separately.

## Legacy read-only cutover

The three `legacy_conversation_read_only_cutover_*` files are separate operator SQL,
outside canonical migrations. None was executed against a remote project.

Capture an approved UTC rollout cutoff **before** rollout. After the reviewed migrations,
the preview selects only conversations created before that cutoff, still open, with no
claim, and with demonstrable post inactivity at cutoff. Expiry <= cutoff proves inactivity;
otherwise non-active status must have an updated_at <= cutoff. A cancellation timestamp
obscured by an additive backfill is not guessed: it is excluded for separate review.
The previous production count of 15 is informational, not an expected live count.

Use one privileged psql connection with `ON_ERROR_STOP=1`. Supply `rollout_cutoff` to
the preview; export and approve **every candidate ID and the count**. The preview creates
only a session TEMP manifest, never an application table. Retain the manifest securely.
Supply `approved_count` to apply on that same connection; export its resulting audit
before closing the session. Do not reconnect with a newly generated unreviewed manifest.

Apply takes post locks followed by conversation locks in deterministic order. It uses
5-second lock timeout and 30-second statement timeout, checks all stored row versions,
status, expiry, cutoff and absence of a claim, and aborts the entire transaction on drift.
It only sets `closed=true`; it neither deletes content nor creates claims/arrival timestamps.
Expiry alone for a newly claimed handoff still follows its existing arrival timer design.

The disposable preview found exactly 15 synthetic candidates; a concurrent-state drift
simulation aborted without partial changes. Applying closed exactly those 15, kept the
active-post chat open, preserved all messages/images and enforced participant-only
readable history with inserts rejected. The reverse script restored the open state only
when exact audit versions remained unchanged. Reverse requires separate approval and
aborts if claims/new messages/lifecycle drift make reopening unsafe. It restores the
open flag, not the original updated_at. Do not use it to undo subsequent activity.

## Private-image transition and Free-plan cache limitation

The image migration changes `chat-images` to private and replaces public access with
participant policies and restrictive guards. That baseline migration alone does not
move/delete/rewrite objects or historical message locators. The separate Free-plan
supplement/helper now prepares fresh private copies with verified ownership and atomic
reference updates; follow the linked execution plan above. Rehearsal verified both participants read all four
historical image metadata records; unrelated and unauthenticated roles read none.
The actual upgraded `lib/chat-images.ts` parses an old public locator into the original
object path and downloads through authenticated SDK access with a unique cacheNonce and
`cache: no-store`. Offline blob retrieval was exercised, not a real hosted CDN rendering test.

Before a later approved cutover: release/refresh the upgraded web/PWA client in coordination
with the private-bucket change. Old cached clients using bearer-less public image URLs
will stop loading historical images after the private transition/cache expiry; do not temporarily
make the bucket public again to restore those clients. Shared history remains stored.

The approved Free-plan design backs up/hashes all four originals, creates fresh private
paths without overwrite, verifies participant reads and unrelated/anonymous denial,
stores authoritative original ownership, and changes message references transactionally.
Only after verification may the four originals be removed through the Storage API.
No old path/URL is reused. No purge endpoint or paid capability is required.

Fresh origin denial is distinct from revoking every previously cached public response.
**Unknown / cannot guarantee immediate revocation of previously cached copies.**
Current upload cache-control is not proof of the four old objects' TTL. Browser/device
copies cannot be remotely erased; old CDN copies may remain until their cache expiry.
Do not claim full revocation until the relevant cache window is established and passed.
No production copy, removal, cache test or purge was performed by this patch.

## Environment checklist (names/classification only)

Actual production environment values were not changed or retrieved during preparation.

| Scope | Variable/resource | Requirement |
| --- | --- | --- |
| Public web/native | NEXT_PUBLIC_SUPABASE_URL | Exact production project URL |
| Public web/native | NEXT_PUBLIC_SUPABASE_ANON_KEY | Same project's anon/publishable key only |
| Public native | NEXT_PUBLIC_SERVER_API_ORIGIN | Approved production HTTPS web origin; web APIs stay same-origin |
| Public browser Web Push | NEXT_PUBLIC_VAPID_PUBLIC_KEY | Matching production VAPID public key; native uses no Web Push |
| Server only | SUPABASE_SERVICE_ROLE_KEY | Production backend only, never NEXT_PUBLIC/native CI |
| Server only | VAPID_PRIVATE_KEY | Production browser-push sender only |
| Server config | VAPID_SUBJECT | Contact mailto/HTTPS subject, backend only |
| Edge platform/server | SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY | Same project; platform secrets, never bundle/admin key disclosure |
| Apple/Codemagic | Mawqifi Codemagic integration | Approved App Store Connect API integration |
| Apple/Codemagic | Distribution certificate + provisioning profile | Match com.mawqifi.app, production distribution |
| Apple/Codemagic | APP_STORE_APPLE_ID | Numeric existing app ID |
| Manual approval | APPROVED_RELEASE_COMMIT, APPROVED_RELEASE_TAG | Exact reviewed SHA/tag; no default |

Create/use the dedicated production group only after separate approval. Do not reuse the
staging group or store server/VAPID/APNs keys there. Native production guard rejects
server-only credentials, staging references and local `.env` overrides. Keep all signing
private material in Codemagic's signing/integration vault, not repo/env public assets.
Staging builds keep their existing staging group and project/backend unchanged.

## Native push finding

**Native remote APNs delivery is NOT implemented in this repository.**
`lib/native-push.ts`, AppDelegate callbacks and `/api/push/native-token` register/store
device tokens and handle OS callbacks. They do not send APNs. `lib/push-server.ts` sends
only Web Push to `push_subscriptions`; notification routes call that browser sender.
No APNs HTTP/2 sender, Apple push endpoint, APNs provider library or native-token
delivery consumer exists in the reviewed app/backend source/dependencies. No external
sender is verified by this repository audit. Registration success is not delivery proof.

No sender or secret was added and no notification was sent. If native remote alerts are
required for launch, that is a separate implementation/verification decision and must not
be advertised as working. Foreground/realtime chat and in-app notifications are separate.

## Recovery and final approval checkpoints

Before any eventual production write, approve the exact final SHA/tag, live metadata
drift check, migration hashes/order, refreshed candidate IDs/count, current image/cache
manifest, backup/restore checkpoint, maintenance window and production-only environment
verification. Approve the Free-plan four-image manifest/ownership checkpoints and cache
limitation, and resolve whether native remote
push absence is acceptable. Signed production IPA scanning remains a future Codemagic
step; no signed production artifact or submission was created here.

Take a restorable production backup under separate approval before DDL. Apply one reviewed
transaction at a time with fail-fast execution and bounded locks; log successful versions.
Do not disable triggers/RLS to bypass an error. If a migration transaction fails, roll it
back and stop. Once committed and used, prefer forward recovery preserving added fields,
private Storage, tombstones and shared history. Do not drop claims/GPS/deletion columns,
restore Auth cascades, republish the image bucket or recreate erased personal content.
An operational database restore requires separate approval, a write freeze and an explicit
lost-write reconciliation plan. The private-image transition has no permissive rollback.

The cutover reverse script is narrowly audited exception recovery, not a global schema
rollback. Keep the completed migration ledger, before/after manifests and copy/removal audit.
Production deployment, function packaging, image cutover, environment updates, CI run,
App Store submission and release remain unperformed and individually approval-gated.
