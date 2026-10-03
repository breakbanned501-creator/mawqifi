# Compact place selector — staging verification

Branch: ios-release-hardening. Base: 38e261063af77a2533b597a0126cbb0e9fd83552.

## UI and compatibility

Institution dropdown; KU college dropdown and General area summary; PAAET college/institute dropdown, followed by a branch dropdown only for multiple sites. A single documented site is selected automatically. GUST has no second selector. No text input, restored guidance map or expanded grid. The bilingual summary shows the current complete scope.

The existing PlaceProvider, versioned local-storage keys, valid leaf IDs, discovery query, private GPS transaction and claim/chat system are reused. Changing a parent immediately clears an incompatible leaf. A branch is required before discovery/publication for multi-site entities. Institution switching restores its own compatible remembered selection.

## Minimal staging schema extension

20261003113052_expand_verified_paaet_scopes.sql only replaces parking_posts_valid_sub_place with the additive official PAAET allowlist. It adds no tables, columns, defaults or data updates, and changes no RPC, trigger, grant, RLS, index or timer. Existing KU and PAAET IDs remain accepted; invented and cross-institution IDs remain rejected. Secure GPS validation and private coordinate policies are unchanged.

Applied only to jrmiwmsgnztqwbigumlw after disposable PostgreSQL validation. Before/after migration: 8 existing posts; post hash 135344228a41e5b30295d55f5deb400f; message hash 26ca4e63847c3c35619be2a41827aa0d. Both unchanged after fixture cleanup. Rows backfilled: 0.

Rollback: reverting the UI/catalogue is data-preserving while retaining the additive CHECK. Do not narrow the CHECK once new IDs are stored. A strict SQL downgrade may restore the old CHECK in a transaction only after confirming no new-scope rows exist; otherwise validation must fail/roll back rather than deleting or reclassifying data. Historical migration files are unchanged.

## Validation

- Disposable PostgreSQL: 55 assertions, every new scope accepted by the secure GPS RPC, private row atomicity, data preservation, cached KU compatibility, invalid scope rejection and history-preserving compatibility rollback.
- Existing handoff SQL/RLS: 70 assertions, atomic claims/private coordinates/blocking/reporting/25m arrival/15-minute timer/read-only retained history.
- Bilingual UI/persistence: 47 assertions; at most three compact selects, no text keyboard controls, stable IDs and institution-compatible reload persistence.
- Release hardening: 65 assertions.
- Real anonymous staging JWTs: 39 assertions across all 12 added scope IDs, actual app feed isolation, private GPS isolation, no-selection gating and cross-institution rejection. First harness attempt omitted the existing place-aware compatibility header; corrected to match normal application requests.

Test fixture posts/locations removed: 13 (12 successful catalogue tests plus 1 from the first harness attempt). Cleanup refuses any fixture that acquired a claim/conversation. Existing posts/messages restored to identical hashes. No notifications called or sent. Auth/profile test identities retained, no access tokens stored:

- c675099e-bfb9-43c6-a192-5af13211b373
- 155a5aad-8e99-4f60-98cb-4c34c7b46ec5
- cc56157d-db48-49c8-9b64-47c8090e3e90
- 10f2aba1-dd21-4d9f-8703-17651c0f00d7
- cd36c3ec-8c4d-4bfa-bafb-e64f02a41754
- a5095dd1-2740-47a0-adfe-5d77d0249f35

## Final build / browser results

- npm run typecheck: PASS.
- npm run lint: PASS.
- npm run build: PASS, 19 pages and browser PWA retained.
- npm run cap:ios:archive: PASS, 15 static pages, service worker excluded.
- npx cap sync ios: PASS, 12 plugins.
- Native archive/config/secret scan: PASS, local assets, no server.url, staging Supabase/API origin and no private credentials. This is static archive preparation, not a signed IPA.
- Safety SQL/RLS: 89 + 16 helper assertions; legacy place scoping: 32; handoff UI/navigation: 30.
- Compiled mobile browser: Arabic RTL at 390/320px and English LTR at 390px, no horizontal overflow. KU selector height 294px; multi-site PAAET approximately 358px at 390px. Institution/college persistence survives reload; PAAET multi-site parent changes clear previous branch; single-site selection resolves automatically; GUST has one control.
- Physical iPhone native picker, permission and keyboard checks remain manual TestFlight checks; native keyboard/arrival/navigation code is unchanged.
- Browser-only staging Auth/profile identity retained: 4e5c0b38-dc36-4288-b6dc-a5cfbd68f720; no application posts were published from this browser.

Main, production Supabase, production deployments and Codemagic were untouched. Existing untracked staging directories retained.
