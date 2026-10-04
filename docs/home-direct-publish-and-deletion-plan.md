# Home direct publishing and account-deletion decision

Branch: `ios-release-hardening`. Base: `800d6309a7dc3adca84468041bb0b4ef8bb15c3c`.
Only dedicated staging `jrmiwmsgnztqwbigumlw` was accessed. No production, main, Codemagic or App Store action.

## Implemented Home flow

Home's leaving action is now a button, not a `/create` link. Missing institution/required KU college + North/South or PAAET scope produces a three-second localized “Choose your location first” toast and focuses the existing selector. GUST needs no second selector.

Valid scope -> locating progress -> existing fresh high-accuracy foreground acquisition -> existing `publish_parking_handoff` RPC -> success toast and immediate owner post -> background canonical refresh. No navigation, confirmation page or typing. GPS/location creation and post creation remain one secure transaction. No coordinates enter the public optimistic post/cache.

Synchronous locks prevent rapid repeated publish taps and concurrent claim/publish actions. GPS timeout/accuracy/permission failures leave Home with a retry action and no post. Scope/account changes or leaving Home cancel pending acquisition and prevent a stale acquisition from publishing. The existing freshness/session/accuracy validator remains unchanged. RPC errors are localized and release the UI lock without optimistic success.

Canonical reads started before RPC success are invalidated; their replacement waits for an outstanding read instead of overlapping it. A publication generation prevents a late pre-publication read from erasing the optimistic owner card. The next fresh read is authoritative, including if a spot has already been claimed/cancelled and is no longer available. Optional notification dispatch remains outside the success critical path. Test preview suppresses notification delivery.

Bottom navigation's Publish tab still opens `/create`. That compatibility route retains its current GPS/confirmation UX; it was not deleted or altered. “I need a spot”, private location, claims, chat/images, arrival/timer/history and safety controls are unchanged.

## Account deletion: STOP condition found

The request explicitly requires a retention plan before destructive changes if the existing schema makes safe deletion ambiguous. A read-only query against staging verified:

- `users.id -> auth.users.id`: ON DELETE CASCADE.
- Post owner, conversation owner/requester and message sender -> profile: ON DELETE CASCADE.
- Conversation -> post: ON DELETE RESTRICT.
- Message -> conversation: ON DELETE CASCADE.
- Claims reference users/posts/conversations without cascade; these can additionally prevent deletion.

Calling Auth admin deletion directly is therefore not safe: it can fail on retained claim/post references or destroy another participant's history through profile cascades. No delete-account endpoint, button, destructive migration, Auth deletion or storage cleanup has been applied. No claim that deletion is available has been added to Privacy/Terms.

## Approved minimal retention plan

The user approved this plan on 2026-10-04. Its implementation, live staging tests, retention details and later production rollout requirements are recorded in [account-deletion-retention.md](account-deletion-retention.md). The original pre-approval inspection and Home verification below remain as historical context.

1. A discoverable destructive Settings action with Arabic/English permanent-deletion confirmation. Anonymous users use the same flow; no email linking requirement.
2. An exact-origin/Bearer-authenticated server API verifies the current user through Supabase Auth. It accepts no target user ID. Service credentials remain server-only. Native uses the configured staging API origin.
3. A reviewed migration decouples the retained profile record's identity from Auth deletion, allowing a non-login, anonymized tombstone for shared history. Add deletion state and protect it from client edits. Keep existing conversation/claim references intact rather than cascading them away; do not create a substitute Auth user.
4. Immediately disable the deleting account's database/storage access, including still-valid JWTs. Auth deletion alone does not invalidate all access tokens. Restrictive active-account checks and privileged RPC guards must cover sensitive reads, writes and Storage; tests must prove an old token cannot recreate its profile or regain access.
5. Cancel the user's available posts and active handoffs, close affected conversations read-only, remove their private parking GPS, remove push/device subscriptions, notifications/preferences, avatar/profile personal fields, badges and local identity/session cache. Unrelated users' posts/locations/tokens are untouched.
6. Retain anonymized conversation/post/claim shells and the **other participant's** messages/images solely to preserve their readable history. Recommended choice: replace the deleting user's text/images/shared coordinates with localized deletion placeholders and remove those image objects through the Storage API. Retaining both participants' messages instead is a separate retention decision requiring accurate policy disclosure.
7. Review reports/blocks/restrictions explicitly: remove the account's personal relationship data; determine whether minimal anonymized moderation evidence about abuse needs retention. Do not silently retain personal report details indefinitely. The final approved policy must state the purpose and retention rules.
8. Make deletion retryable across DB, Storage and Auth phases. Block access before cleanup, and only show completed deletion after credential removal succeeds. Supabase Storage ownership may prevent Auth deletion until owned objects are handled; test this against the staging API, not a database-only approximation.
9. Validate the migration and reverse/forward recovery approach in disposable PostgreSQL, then staging only. Test real A/B/C JWTs, old-token rejection, self-only deletion, anonymous deletion, push/GPS cleanup, closed retained history and unrelated-data preservation before claiming success.

The approved implementation updates Privacy/Terms to describe actual deletion/retention behavior. Production still requires a separately approved migration, server-only credential configuration and coordinated client/API rollout; none is authorized or applied here.

References: [Supabase deleteUser](https://supabase.com/docs/reference/javascript/auth-admin-deleteuser), [Supabase user management](https://supabase.com/docs/guides/auth/managing-user-data), [Apple account deletion requirement](https://developer.apple.com/support/offering-account-deletion-in-your-app).

## Previous Home verification, before deletion approval

The actual Home handler suite passes 35 controlled async assertions: scope gating, KU North/South and PAAET/GUST payloads, rapid taps, progress lock, success without waiting for canonical data, coordinate-free optimistic owner card, retryable GPS/RPC errors, scope cancellation and stale-read rejection. Fresh canonical data can remove an unavailable optimistic post immediately. Existing foreground GPS checks retain improving samples, <=25m accuracy, bounded acquisition, no cached fixes and foreground session validation.

| Validation | Result |
| --- | --- |
| Home handler regressions | 35 PASS |
| Existing safety / handoff / sub-place / private-image SQL/RLS suites | 89 / 70 / 102 / 21 PASS, plus 16 safety helper checks |
| Existing release / selector / publish timing / GPS / handoff UI / image-client suites | 65 / 57 / 22 / 41 / 30 / 13 PASS |
| Actual compiled Home + real staging Auth/RPC | KU Education North, KU Education South, PAAET Basic Education Ardiya, GUST each persisted exactly one correctly scoped post; Home never navigated to Publish |
| Controlled browser GPS | High accuracy, maximumAge 0 and 12s window requested; one watch/RPC despite rapid taps; denied GPS offered retry without RPC |
| Bilingual transient UI | Arabic and English locating/publishing/success states observed; missing scope toast observed; English 390×844 without horizontal overflow or typing fields |
| Real JWT location privacy | Owner reads four private location rows; unrelated anonymous observer reads zero |
| npm run typecheck / npm run lint | PASS |
| npm run build | PASS, web/PWA |
| npm run cap:ios:archive | PASS, packaged static native bundle; not a signed Xcode IPA |
| npx cap sync ios | PASS |
| Secret/native environment check | PASS; explicit staging Supabase and staging API, no server.url/native service worker/private credentials |
| Account-deletion tests/migration | NOT RUN/APPLIED; retention decision pending |

An initial parallel DB/build run exhausted host memory; all affected checks passed when rerun sequentially. Browser GPS was deliberately controlled test input, not a physical iPhone fix. Real Auth sessions/JWTs and publishing RPC requests were used, and optional push delivery was suppressed by the localhost preview. No APNs/Web Push credentials were used.

Staging owner `42f7a3da-abd1-475d-a585-dd3a8f6a0ab3`; unrelated observer `d09689af-b56f-4969-820d-ee22015f220e`. Test posts: `f22cda37-fd07-469a-b37a-98b424edad31` (KU North), `084ac929-415c-40b4-8e77-d6d31381ed36` (KU South), `21b1484d-a223-4eca-9379-7e39e2e752e1` (PAAET), `28b280c5-0ef0-4f64-b8bc-990cd682dc01` (GUST). All four were cancelled through their owner's normal JWT and no longer appear in active discovery; private location/profile/Auth fixtures remain staging-only. No shared history or images were deleted. Temporary session context and browser QA instrumentation are outside the repository and not committed.

A physical iPhone remains necessary to verify actual GPS timing/permission sheets. No schema, RLS or Auth deletion change was applied in this task. Existing untracked staging/temp files remain untouched. Generated worker and line-ending-only Capacitor build outputs are excluded from this UI change.

**Previous task conclusion: B. NOT READY — FIXES REQUIRED** — The retention decision was pending then; see the implementation report linked above for the current deletion status.
