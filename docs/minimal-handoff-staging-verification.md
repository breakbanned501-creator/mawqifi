# Minimal GPS handoff UX — staging verification

Verified 2026-10-03 (Kuwait). Branch: ios-release-hardening.
Starting implementation: d571f4e8b72a0ba084623137a154ee88ad87a050.
Supabase target: jrmiwmsgnztqwbigumlw only.
Native API origin: https://mawqifi-testflight-staging.vercel.app.

## Minimal database change

Applied 20261002220823_gps_handoff_minimal_publish.sql to staging after disposable validation.

No new tables, data backfill, data rewrite, RLS policy changes, or replacement claim/chat architecture.

- Existing private-location FK becomes DEFERRABLE INITIALLY IMMEDIATE.
- Existing authenticated publish RPC generates the post UUID, validates coordinates/accuracy, and inserts the owner-bound private location first.
- It defers that FK only during the atomic publish transaction and checks it immediately before returning.
- Existing place guard permits missing college/zone/gate/location_description only on INSERT when handoff=true, the owner matches auth.uid(), all four metadata fields are NULL, and the matching private location row already exists.
- Explicit active place is still required. No blind KU default for GPS publication.
- Ordinary clients have no INSERT/UPDATE/DELETE privilege on private location rows. A handoff flag, header, or user-controlled setting alone cannot authorize the exception.
- Non-GPS inserts and metadata-bearing legacy publishes retain existing validation; verified cached KU payloads without place_id still resolve to Kuwait University.
- Existing note/rate/identity/restriction guards still run.
- Invalid RPC calls roll back both rows. No orphan private locations.

Rollback: supabase/rollback/revert_gps_minimal_publish.sql restores both original functions and the non-deferrable FK without deleting existing GPS posts/locations/history. Tested locally against retained data. Revert the simplified publishing UI first if rolling back. Rollback was NOT applied remotely.

Staging had zero parking posts/messages before and immediately after the migration. Authenticated private-location INSERT privilege remained false, FK initially-immediate behavior was verified, and the configured arrival radius remained 25m.

## UX changes

- Removed only the duplicate Home conversations shortcut. Dedicated bottom Chats navigation and conversations page remain.
- Leaving: selected place -> foreground GPS -> small confirmation -> existing publish RPC -> success toast/Home.
- No inputs, notes, vehicle details, college/zone/gate, or description controls.
- Unclaimed publication retains the previous default 10-minute expiry.
- Permission denial displays localized guidance and Retry/Cancel.
- Need: refresh selected-place availability; exclude one's own spots; zero -> concise empty state; one -> existing atomic claim and direct chat; multiple -> compact one-tap cards.
- Existing compact cards retain reporting and creator cancellation. No exact coordinates in discovery.
- Same conversation/location/Maps/arrival panel, 25m foreground arrival, confirmed manual fallback, server 15-minute deadline, and retained read-only history.
- Six bilingual convenience replies use the existing message sender; drafts/free text remain available. Saying "I've arrived" in a quick reply does not register arrival.
- Corrected the existing report dialog's card-contained stacking issue using a body portal and viewport-bounded scrolling. Reporting behavior and authorization remain unchanged.
- Guidance maps remain removed.

## Verification

| Check | Result |
|---|---|
| Disposable full-schema handoff SQL/RLS | PASS, 70 assertions |
| Existing safety SQL/RLS | PASS, 89 assertions |
| Existing safety helpers | PASS, 16 assertions |
| Existing place-scoping SQL/RLS | PASS, 32 assertions |
| Existing handoff bilingual UI/navigation helpers | PASS, 30 assertions |
| Release-hardening / bilingual safety / CORS / origin checks | PASS, 65 assertions |
| Real staging anonymous Auth/JWT setup | PASS, 29 assertions |
| Controlled server-deadline JWT verification | PASS, 5 assertions |
| Additional real cached KU insert without place_id | PASS |
| npm run typecheck | PASS |
| npm run lint | PASS, no warnings |
| npm run build | PASS, 19 routes; browser PWA compiled |
| npm run cap:ios:archive | PASS, 15 static routes; local archive bundle |
| npx cap sync ios | PASS, 12 plugins |
| Native bundle/configuration scan | PASS |

The local tests apply the complete validated baseline and chronological migrations. GPS-only publication works for KU/PAAET/GUST without invented metadata. Direct non-GPS missing-metadata inserts, invalid coordinates, missing/inactive/unknown places, forged private-location writes, and post/message safety boundaries remain protected. Rollback/reapplication preserves existing GPS data and chat history.

Live JWT tests verify private coordinates before/after claim, a real concurrent two-client claim with exactly one winner, immediate conversation/idempotent taps, blocking, reporting/privacy, arrival distance/manual fallback/idempotence, moderation/lifecycle field denial, exact 15-minute timestamps, rejected inserts after a controlled deadline, and readable undeleted history.

Browser verification used the actual local application with real staging anonymous Auth:
- Arabic RTL and English LTR, 390x844 and reduced 390x500 viewports.
- Home contains only the bottom Chats link, including after publishing.
- No selection -> zero posts.
- Selected-place zero/one/multiple behavior; direct chat after a sole spot or one card tap.
- GPS confirmation with zero input/select/textarea controls for all three places.
- Friendly permission-denial state; successful real RPC publication using a simulated foreground-GPS callback.
- Private location card, captured navigation URL, six quick replies, manual arrival confirmation, countdown, read-only closure with retained message and report controls.
- Composer and Done remain visible at the reduced viewport; Done blurs/restores the layout.
- Report dialog opens/dismisses above the page after the stacking correction.
- English empty state also verified directly from the built native static assets.

Development-only Next.js chrome was hidden for touch checks. First-run onboarding was dismissed through its normal Skip action. Foreground browser GPS was explicitly simulated; this is not a physical iPhone GPS/permission test. Actual native Maps, keyboard, safe-area behavior, and signed/device validation remain next-TestFlight checks.

No push delivery was performed. JWT suites never call push APIs; browser push routes were intercepted as no-ops before publishing/chatting. No production service-role, VAPID, or APNs keys were used.

## Preserved configuration and boundaries

- Local Capacitor assets, webDir=out, no server.url.
- Staging Supabase and explicit staging API origin present in the native bundle.
- No production Supabase reference or private credentials detected in the bundle.
- No native service worker/push-worker files.
- Existing native keyboard integration, location permissions/Info.plist, export-compliance flag, claim/arrival/message guard functions and retained-history semantics unchanged.
- No production access, production deployment, main modification/merge, or Codemagic run.

The security-advisor report contained existing baseline notices (intentional anonymous policies/deny-all server tables, set_updated_at search path and handle_new_user trigger-function privileges, leaked-password setting). This migration introduces no newly exposed private-data policy.

## Disposable identities and cleanup

Staging-only anonymous Auth/profile identities retained:
- A: 95ae5082-8b7e-475c-8787-78ef1d20655e
- B: 9df81e45-cbfe-4a27-83d3-55ffc554bcf3
- C: df0480cb-6557-4f8f-8a30-42b6da671a03
- Browser D: 7a84fbf6-9bd6-4056-85cb-be26d431c391
- Built-bundle browser E: fbdabc1d-513e-4f60-8eba-8a82ebb3d8b8

Removed seven isolated posts and their private locations, four claims/conversations, four messages, and one report after recording results. Exact-ID verification confirmed zero leftovers for those fixtures. Associated notification foreign keys cascade normally. Auth/profile identities and normal private rate-limit history are retained; no schema/migrations were deleted.

One cached-KU compatibility fixture was claimed by a staging participant outside the recorded test users:
- post: 4830701c-6bbf-4334-ba1c-595e97031d82
- conversation: a5b84384-2f77-4d78-aa45-ab6ffd2a30ba

It and its claim/history were preserved rather than deleting another participant's handoff. The initial cleanup transaction rolled back on the protecting FK; subsequent cleanup excluded this post. No unrelated staging records were altered. Temporary test JWT context was removed after verification.

## Files

Application:
app/page.tsx, app/create/page.tsx, components/ParkingCard.tsx,
components/PostChatScreen.tsx, components/ReportModal.tsx, lib/i18n/index.ts.

Migration/rollback:
supabase/migrations/20261002220823_gps_handoff_minimal_publish.sql,
supabase/rollback/revert_gps_minimal_publish.sql.

Tests/documentation:
scripts/test-parking-handoff.cjs, scripts/test-parking-handoff-staging.cjs,
scripts/test-release-hardening.cjs, docs/minimal-handoff-staging-verification.md.
