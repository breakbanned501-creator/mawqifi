# KU parking sides — incremental staging verification

Branch: ios-release-hardening. Base: ef40acfd82f3284fc004cb2f28d983a780939fa6.

## Representation and UI

All 11 existing college labels/IDs remain unchanged. User-confirmed North Parking / المصفط الشمالي and South Parking / المصفط الجنوبي appear in a third compact dropdown after the college. General was removed. The bilingual summary shows institution, college and side. No typing, gate/car/notes input or guidance map.

Existing nullable parking_posts.sub_place_id stores the complete scope: education_north, education_south, arts_north, etc. Existing zone A/B is a legacy college contract, not a per-college side; it is not repurposed. No new table, column or index. The existing place_id/sub_place_id/status/expiry index and exact-equality app query cover the complete scope.

Secure GPS RPC is unchanged: selected composite ID is saved in the same transaction as private coordinates. Its proof of private location, grants, RLS and post validation remain intact. Claimed-post immutability already covers sub_place_id. No claim/chat/arrival/timer/history architecture change.

## Staging validation metadata

20261003120418_add_ku_parking_side_scopes.sql adds the 22 college/side IDs to the existing CHECK, preserving 11 legacy KU IDs and all 15 PAAET IDs. Applied only to jrmiwmsgnztqwbigumlw after disposable validation. No backfill or existing row updates. No production access. Before/after migration and test cleanup hashes match: posts 135344228a41e5b30295d55f5deb400f, messages 26ca4e63847c3c35619be2a41827aa0d (8 existing posts).

Legacy/cached publishing still accepts college-only or unscoped IDs. New KU discovery/publishing UI requires a valid side; old rows lacking a proven side do not appear in North/South feeds. No GPS/gate/zone inference or guessed backfill. Old-client college/gate validation remains unchanged.

Rollback: revert UI while retaining the additive CHECK and recorded side IDs. Do not narrow CHECK/delete/reclassify populated new IDs. Strict constraint downgrade is only safe if no side-scoped rows exist, and must validate transactionally.

## Persistence and isolation

The existing mawqifi_sub_places_v1 key stores the composite college/side value. Reload restores both. Switching to another KU college preserves North/South because both options are valid for every college. Clearing college also clears the side. A legacy college-only preference restores the college but requires explicit side selection. Top-level institution switching restores only that institution's compatible scope; KU side state is never active in PAAET/GUST.

The existing ready guard returns zero posts without KU college and side; exact composite filtering separates Education North, Education South and Arts North. Existing stale-result and claim-scope guards apply unchanged to the composite IDs.

## Results

- Disposable migration/GPS scope/data-preservation/legacy compatibility: 102 assertions; all 22 new scopes accepted, invalid/cross-institution scopes rejected.
- Bilingual compact selectors/persistence/catalogue: 57 assertions.
- Handoff SQL/RLS regression: 70 assertions.
- Safety: 89 SQL/RLS + 16 helpers; original place scoping: 32; handoff UI/navigation: 30; release hardening: 65.
- Real staging anonymous JWTs: 57 assertions, North/South/college isolation, no-selection and legacy-row exclusion, PAAET/GUST compatibility, private GPS publishing, concurrent single winner, immediate private conversation/reuse, reporting/blocking, 25m arrival and exact idempotent server 15 minutes.
- Controlled timer expiry of only the test claim: 3 real JWT assertions; inserts rejected and both participants retain their two messages.

## Cleanup

Removed only recorded fixtures: 9 posts/private locations, 1 claim/conversation, 2 messages and 1 report, guarded against unknown participants/history. Existing post/message hashes restored. No notification endpoint called. Temporary JWT session file deleted. Auth/profile staging identities retained:

- A: 06f71d7b-2782-447a-ba68-dfff9739d85d
- B: ef4873f1-ab30-4be1-b095-859ac32eabb8
- C: e931cadd-9a24-4cc7-a2d7-7847b621c09c

## Build and mobile UI checks

- npm run typecheck: PASS.
- npm run lint: PASS.
- npm run build: PASS; browser PWA retained, 19 pages.
- npm run cap:ios:archive: PASS; 15 local static pages, native service worker disabled.
- npx cap sync ios: PASS; 12 plugins.
- Native archive configuration and private-material scan: PASS; no server.url, no private credentials, explicit staging Supabase and staging API origin. Static archive preparation is not a signed IPA.
- Compiled Arabic 390px: three compact selects, Education North summary, no horizontal overflow (selector approximately 358px tall). College switch retains compatible South; PAAET/GUST have no KU side controls; selecting KU again restores Arts South.
- Browser verification creates only a staging Auth/profile identity: 0e133b6b-f8a7-40e9-b31f-d5e93a085b9e; no post or notification sent from the browser.
- Physical iPhone native picker/GPS/keyboard checks remain manual TestFlight checks. Existing foreground permissions and keyboard code are unchanged.

Main, production Supabase, production deployments and Codemagic were untouched. Existing untracked supabase/.temp and supabase/staging retained.

Final compiled English LTR at 320px: reload restores KU / Arts / South, summary reads Kuwait University · Arts · South Parking, no horizontal overflow and no browser JavaScript errors. Final missing-scope guidance explicitly asks for both college and parking side.

**A. READY FOR NEXT TESTFLIGHT BUILD**
