# Parking handoff — staging verification

Verified 2026-10-02 UTC / 2026-10-03 Kuwait. Branch: ios-release-hardening.
Starting commit: 6fee6ae05eef98e6cc3ed34244b28ddf061753ce.
Target: jrmiwmsgnztqwbigumlw only.
Native API origin: https://mawqifi-testflight-staging.vercel.app.

## Schema and privacy

Applied after disposable PostgreSQL validation:
- 20261002200925_parking_handoff.sql
- 20261002204010_handoff_cached_cancel.sql

New objects:
- public.parking_post_locations: post_id PK/FK, owner_id, latitude, longitude, accuracy_meters, created_at.
- public.parking_claims: UUID id, unique post_id, owner_id, claimant_id, unique conversation_id, status, claimed_at, arrived_at, chat_closes_at, completed_at.
- private mawqifi_safety.handoff_settings: administrator-controlled arrival radius, initially 25 meters.
- parking_posts.handoff: defaults false for historical/cached posts; new atomic publishing sets true.
- Post statuses retain active/expired/closed and add claimed/completed/cancelled.

Both new public tables have RLS and authenticated SELECT only. Anonymous sign-in sessions have the authenticated role. Browsers cannot insert/change claims or precise locations directly.
Locations are readable only by their owner or the matched claimant; a blocked or cancelled relationship cannot disclose location to the claimant. Claim history remains participant-readable.
No latitude/longitude columns exist on public.parking_posts.

Public invoker RPCs delegate to private, narrowly authorized functions with empty search_path:
publish_parking_handoff, claim_parking_post, get_parking_handoff, arrive_parking_handoff.
Privileged functions validate auth.uid(), participant identity, block relationships, and current state.
Publishing writes the post and private coordinates in one transaction; failure rolls back both.

## Atomic claim and compatibility

The post row is locked FOR UPDATE before reserving it. A unique post_id in parking_claims admits one lifetime claim; cancelled/completed posts cannot be recycled into a second handoff.
Own-post, blocked, expired, closed and already-claimed attempts are rejected.
A repeat by the same claimant returns the existing claim/conversation. An existing open conversation for that same pair is reused; a closed historical conversation is never reopened.
A conversation INSERT from a cached client also locks/reserves atomically through triggers, including the existing owner/requester validation.
Claiming changes the public post to claimed in the same transaction. Available discovery remains selected-place + active + future expiry. No selection returns no posts.

Verified old-style KU inserts still obtain the verified kuwait_university place without a blind default. Historical posts are not assigned coordinates or invented claimants.
Cached conversation INSERT retains the previous 30-second legacy grace. The new claim RPC and new precise-location handoffs reject expired posts immediately.
Cached owner DELETE is converted by a trigger into cancellation and returns success without deleting the post or chat. New clients explicitly update cancellation state.
Normal clients can update only conversation read markers; they cannot change participants, lifecycle or moderation fields. Claimed post location, expiry and handoff classification cannot be changed.

Legacy posts without a private location can still be claimed and discussed, but cannot display a precise parking-location card. New publishing requires an explicit voluntary location-share action.

## Arrival and read-only history

Automatic checking is opt-in and foreground-only; it stops in a hidden/inactive app and after errors. No Always permission or background tracking is requested.
The initial radius is 25 meters. Server haversine validation checks distance and requires reported accuracy no worse than that radius. GPS is not represented as determining a physical stall.
Manual arrival requires a confirmation dialog and only the claimant may register it.
The first successful event uses database time and sets chat_closes_at = arrived_at + 15 minutes. Repeated GPS/manual events return the same timestamps.
The UI estimates the countdown from server time plus elapsed monotonic time, and refreshes state every five seconds. Publication, claim and opening a chat do not start it.
A before-message database guard rejects writes after the deadline or cancellation even before the expiry RPC runs.
Cancellation becomes a visible handoff state and disables navigation/arrival and sending.

No existing history was deleted or backfilled into fabricated handoffs.
Audit findings: no cron extension/jobs on this staging project; expire_old_parking_posts previously only marked posts expired. The destructive path was owner DELETE cascading through conversations/messages. It is now cancellation, with a RESTRICT FK protecting retained conversations.
on_message_insert no longer closes a conversation because its post expires. It only updates the preview.
expire_old_parking_posts completes due claims and marks conversations read-only without deleting messages.
Message/image/location history remains readable by both participants and reports remain usable after closure.
User/account deletion is a separate pre-existing retention/privacy behavior; this change addresses post and handoff lifecycle.

## UI and iOS

Home has prominent Arabic/English need/leave actions. Publish keeps the place selector; KU retains verified college/zone/gate fields, PAAET/GUST retain useful free-text descriptions.
Guidance galleries/cards, their now-unused components and two images were removed. /map is retained as a harmless saved-link route directing users to private conversations. Source provenance documentation remains.
Private parking navigation delegates to AppLauncher/Apple Maps on iOS and system Google Maps navigation on web.
Reporting/blocking and existing image/location/text chat remain.

Keyboard:
- Capacitor uses Native WebView resizing instead of Body resizing that conflicted with 100vh.
- Focused inputs scroll into view; multiline text uses a text keyboard.
- A fixed localized Done/تم control dismisses focus and calls Keyboard.hide in native.
- The native accessory bar is enabled.
- Bottom navigation is hidden while editing; the composer clears the Done control.
- Safe-area padding is not supplemented with a second keyboard-height inset; layout restores after dismissal.
- Read-only zone fields do not enter the tab order.

Info.plist adds ITSAppUsesNonExemptEncryption=false.
When In Use copy describes voluntary parking sharing and foreground arrival checks.
The installed @capacitor/geolocation documentation requires NSLocationAlwaysAndWhenInUseUsageDescription because its underlying dependency contains that capability. A truthful description was supplied; the plugin actually requests .whenInUse and no UIBackgroundModes location entry was added.
Official reference: https://capacitorjs.com/docs/apis/geolocation
Privacy and Terms disclose matched precise-location sharing, foreground checks and retained read-only history.

## Validation

| Check | Result |
|---|---|
| Disposable complete bootstrap + place migrations + both handoff migrations | PASS, 49 SQL/RLS assertions |
| Arabic/English state render, localized errors, 24m/26m radius and system-map helpers | PASS, 30 assertions |
| Real staging anonymous Auth/JWT | PASS, 30 assertions |
| Existing safety suite | PASS, 89 SQL/RLS + 16 helper assertions |
| Existing release-hardening suite | PASS, 57 assertions |
| npm run typecheck | PASS |
| npm run lint | PASS, no warnings |
| npm run build | PASS, 19 web pages/routes including authenticated push APIs |
| npm run cap:ios:archive | PASS, 15 static routes and local native asset verification |
| npx cap sync ios | PASS, 12 native plugins including AppLauncher/Keyboard/Geolocation |
| Native archive credential/configuration scan | PASS |
| Staging Supabase/API origin and native SW exclusion scan | PASS |

Real requests proved A/B/C preclaim location isolation; private access after B claims; C denial; actual concurrent race with one winner; repeat claim reuse; chat/block/report behavior; GPS/manual arrival; clock-write denial; controlled expiry denying new messages while both participants retained history. An additional real-JWT cached KU publish/Delete check passed.
Synthetic GPS coordinates were disposable test fixtures, not a claim of physical iPhone GPS accuracy.
Controlled database expiry changed only recorded test claims; Auth/JWTs were always real returned sessions, never fabricated.
No push-delivery APIs were invoked by the tests.

Browser verification used the actual staging-configured local app at 390x844 and a reduced 390x500 viewport. Verified no selection, persistence, KU/PAAET/GUST forms, RTL/LTR, prominent actions, immediate claim/chat, private-location controls, confirmed arrival, countdown, read-only retained history/reporting, focused multiline input, visible Done and chat composer. No browser errors were observed.
Physical iPhone keyboard behavior, system Maps launch, GPS/approximate-location behavior and signed-device execution remain next-TestFlight validation steps. No signed IPA or device execution is claimed by the static archive command.

## Cleanup and retained test identities

Only four recorded disposable posts, their three conversations/claims, three messages and one report were removed after results were recorded. Related in-app notification rows cascaded with those fixtures.
Remote verification returned zero remaining fixture posts, claims, conversations, messages and reports.
Anonymous Auth/profile identities remain staging-only:

- User A: 26e6d324-5543-4ee9-8210-6e72726dae0c
- User B: 7f9d6a73-f066-47a9-863f-fd5125dcc702
- User C: c8c61214-7529-4423-8f31-52558cc91913
- Browser-only claimant: 0fa74461-b0b4-45e2-b9bf-286917a2d164

No production Supabase project was accessed, no production deployment/alias was changed, main was untouched, and Codemagic was not started. Its existing workflow still has no automatic triggering section.
Existing untracked supabase/.temp/ and supabase/staging/ were preserved.

## Rollback / emergency pause

supabase/rollback/disable_new_parking_handoffs.sql is a reviewed, unapplied emergency pause.
It disables new publishing/claiming and legacy INSERT paths while retaining tables, locations, conversations, messages, arrival for existing claims, reporting and server-side closure.
Do not drop columns/tables or restore cascade deletion after users have handoff history. Re-enabling requires an explicit reviewed grant change.
No rollback was applied to staging or production.

## Existing advisor findings

No new unexpected private-location/claim exposure was found. Supabase flags authenticated anonymous access intentionally used by Mawqifi, deny-all moderation/token/event tables, the authorized expiry/block helpers, and pre-existing search-path/trigger-function/password-protection notices.
Advisor reference: https://supabase.com/docs/guides/database/database-linter
The pre-existing chat image bucket remains public-by-URL; this task did not change media-storage ACLs or erase stored media. Exact parking coordinate records and message rows are protected by RLS.
