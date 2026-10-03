# Sub-place scoping — staging verification

Date: 2026-10-03. Branch: ios-release-hardening. Base: 22876ded07546a2d1596a1cf3d77751675f811b5.
Target: **jrmiwmsgnztqwbigumlw only**. No production access, deployment, main merge, or Codemagic run.

## Migration and compatibility

Applied `supabase/migrations/20261003004823_add_parking_sub_place_scope.sql` via the explicitly targeted Supabase migration tool. Staging ledger: `20261003101426_add_parking_sub_place_scope` (tool-assigned remote timestamp). Do not blindly run CLI db push against this staging bootstrap ledger.

- Added nullable `public.parking_posts.sub_place_id text`, without a default or new tables.
- Database CHECK validates every non-null ID against its place. GUST and future unstructured destinations keep NULL.
- The private helper maps only the existing 11 KU labels to stable IDs. Its execute privilege is revoked from normal/anonymous users.
- GPS publishing saves scope inside the existing transaction that creates private coordinates. Auth, restriction checks, coordinate bounds, deferred FK validation and rollback remain intact.
- Ordinary non-GPS inserts still require the original verified KU tuple or useful non-KU description. Supplying a scope or handoff flag does not authorize the no-typing exception.
- Claimed-post immutability now includes scope. No claim, chat, arrival, timer, history or RLS architecture was replaced.
- Added `(place_id, sub_place_id, status, expires_at)` discovery index.
- Backfilled exactly **1** existing KU post using the valid legacy college/zone/gate contract. The other **4** existing posts remain NULL. No GPS inference or PAAET/GUST classification was attempted.
- Hash comparison excluding routine updated_at confirms every original post field is unchanged; existing location/claim/conversation/message counts were preserved.
- Cached valid KU inserts may omit scope and are assigned the proven college. Earlier GPS clients may still omit scope; their unclassified KU/PAAET posts are excluded from updated scoped discovery.

Rollback: `supabase/rollback/revert_parking_sub_place_scope.sql` is a locally tested compatibility rollback. Revert the selector UI first. It restores previous RPC/guards while retaining the nullable column, validated scope data and index; it does not delete posts, coordinates or history. It was not applied remotely.

## Exact selector catalogue

KU labels are reused from `lib/university.ts`, with no changes to its legacy metadata:

| Stable ID | Existing college label |
|---|---|
| education | Education / كلية التربية |
| arts | Arts / كلية الآداب |
| science | Science / كلية العلوم |
| administrative_sciences | Administrative Sciences / كلية العلوم الإدارية |
| life_sciences | Life Sciences / كلية العلوم الحياتية |
| engineering_petroleum | Engineering & Petroleum / كلية الهندسة والبترول |
| law | Law / كلية الحقوق |
| sharia | Sharia / كلية الشريعة |
| social_sciences | Social Sciences / كلية العلوم الاجتماعية |
| medicine | Medicine / كلية الطب |
| pharmacy | Pharmacy / كلية الصيدلة |

PAAET uses only the previously documented official-directory subset:

| Stable ID | Location |
|---|---|
| basic_education_ardiya | Basic Education — Ardiya / كلية التربية الأساسية — العارضية |
| basic_education_jahra | Basic Education — Jahra / كلية التربية الأساسية — الجهراء |
| nursing_shuwaikh | Nursing — Shuwaikh Educational / كلية التمريض — الشويخ التعليمية |

Source: https://www.paaet.edu.kw/ar/call/; precise directions URLs and source limitations remain in `docs/location-map-sources.md`. Coverage is incomplete. No additional locations, gates, zones or maps were invented.

GUST remains the documented single Mishref campus, without a second selector.

## UI / discovery

- Required, tap-only KU/PAAET choices on Home and Publish; no keyboard or mandatory text fields.
- Compatible last selections persist per institution in `mawqifi_sub_places_v1`; top-level place continues using its existing key. Invalid/corrupt/unavailable storage is handled safely.
- Changing institutions activates only that institution's compatible saved scope. GUST has no active sub-place.
- KU/PAAET discovery requires valid scope and queries both place and scope; missing selection returns zero without a post request. Unscoped legacy rows are excluded.
- Scope changes immediately filter old cards, invalidate stale fetch results and refresh the feed. Claim taps check the current scope before reusing the existing atomic claim RPC.
- Scoping is a discovery choice, not institutional-membership authorization. Exact location remains protected independently by existing RLS.
- No-typing publishing remains foreground GPS → confirmation → existing RPC → success. Duplicate Home chats and guidance maps were not restored.

## Results

| Validation | Result |
|---|---|
| Disposable migration/scope/data-preservation/rollback | PASS — 30 assertions |
| Full handoff SQL/RLS regression | PASS — 70 assertions |
| Safety SQL/RLS and helpers | PASS — 89 SQL/RLS + 16 helpers |
| Legacy place SQL/RLS regression | PASS — 32 assertions |
| Handoff bilingual UI/navigation helpers | PASS — 30 assertions |
| Sub-place bilingual rendering/persistence/catalogue | PASS — 39 assertions |
| Release hardening regression | PASS — 65 assertions |
| Real staging anonymous JWT scope/privacy/handoff | PASS — 51 assertions |
| Real JWT controlled chat-deadline/history | PASS — 3 assertions |
| npm run typecheck | PASS |
| npm run lint | PASS — no warnings |
| npm run build | PASS — browser PWA; 19 generated pages |
| npm run cap:ios:archive | PASS — archive-safe local static assets; 15 generated pages |
| npx cap sync ios | PASS — 12 plugins |
| Native config / private-material / staging scan | PASS — 83 text artifacts scanned; no production Supabase ref, server.url or native SW |

The native archive command creates local assets, not a signed Xcode archive/IPA. Signing/device checks remain the next manual TestFlight step.

Real JWT tests used normal anonymous sign-in and profile operations, never service-role impersonation. They tested both KU colleges, all three PAAET branches, GUST, missing selection, unscoped legacy GPS, cached KU publishing, invalid institution/ID pairs, arbitrary non-GPS denial, racing claims, conversation reuse, coordinate isolation, reporting privacy, blocking, exact server-controlled 15 minutes and idempotent arrival. A controlled timer update affected only the disposable test claim; after the deadline inserts were rejected and both participants retained their two messages.

Browser: 390×844 Arabic RTL and English LTR; selectors, institution switching, reload persistence, GUST without a second selector, no typing controls, friendly permission error, private chat/navigation/arrival controls and immediate single-Arts-spot claim passed. Screenshot review caught a selected-label interpolation issue; it was fixed and regression-tested. The final compiled assets load with no JavaScript errors and only staging Supabase requests. Initial development hot-reload/chunk startup errors did not recur in the compiled build.

The foreground GPS callback was simulated for browser publishing; the real JWT/RPC stored the selected PAAET Jahra scope. Push endpoints were intercepted; no notification delivery was tested or sent. Physical iPhone permission prompts, GPS accuracy, native map handoff and keyboard behavior still need manual device verification. Existing keyboard handling was unchanged.

## Cleanup and retained identities

Staging-only anonymous identities retained (Auth deletion not required):

- A: b4c3c338-3d9d-4dc4-b1cd-dd21af9c2ac3
- B: 03b72a6d-8312-40e6-b645-49c6e7a2edbe
- C: b47a549b-018a-4737-9fa4-bb8ab5f9003b
- Browser D: ac34b9cb-09d1-4ffe-b56a-f5fe945f5d98
- Compiled-preview E: 9f6dd3f8-5689-49a9-9ed0-f79dcd40ac7e

Removed only the 9 recorded fixture posts and their private coordinates, 2 test claims/conversations, test messages and 1 report. Cleanup guarded against unknown participants and verified zero fixture rows remain. Existing unrelated staging history remains: 5 posts, 1 claim, 1 conversation, 4 messages. Test Auth/profile identities and ordinary anti-abuse timestamps remain; no schema was removed. Temporary JWT session file was removed after verification. Existing untracked supabase/.temp and supabase/staging were retained.

## Existing advisor notices

No new exposed tables or scope functions were introduced. All relevant RLS remains enabled. Existing server-only deny-all tables/anonymous access notices remain intentional. Existing advisor warnings for [set_updated_at search_path](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable) and [public trigger-function execution](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable) were recorded without unrelated schema changes. Existing authenticated expiry/block helper notices and password-protection configuration are unchanged.

**A. READY FOR NEXT TESTFLIGHT BUILD**
