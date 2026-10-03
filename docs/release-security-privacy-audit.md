# Final security/privacy and App Store readiness audit

Audit completed 2026-10-04 on `ios-release-hardening`, based on `7b66870ffa8dfad402dfa0c5b1fff582fba7c54f`.
Only Supabase staging `jrmiwmsgnztqwbigumlw` was accessed. No main merge, production access/deployment, App Store submission, Codemagic run, or real push delivery occurred.

## Release blockers

1. The actual native App Store icon is still the default Capacitor artwork: `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png` (1024×1024). The three `Splash.imageset/splash-2732x2732*.png` files are also default Capacitor artwork, referenced by `Base.lproj/LaunchScreen.storyboard`. Replace with approved Mawqifi artwork; no replacement logo was invented. Bundle identifier `com.mawqifi.app`, marketing version 1.0, English Mawqifi and Arabic موقفي are consistent.
2. No in-app account-deletion initiation exists. Contacting support in the policy is not a substitute. Mawqifi creates anonymous accounts automatically and also exposes email signup. Apple's [account deletion requirement](https://developer.apple.com/support/offering-account-deletion-in-your-app) explicitly includes automatically generated/guest accounts. Implement and verify authenticated deletion, retention exceptions, and associated data/storage cleanup in a separately reviewed change before App Store submission.

Physical/signed-device validation and App Store metadata completion are listed separately below; the two findings above are the reason this audit concludes NOT READY.

## Chat image privacy and staging migration

Applied `20261003181232_secure_chat_image_storage.sql` to staging only; remote migration history matches this version/name. No new tables or message-format changes.

- `chat-images` changed from public to private. Previous policies allowed public reads and broad authenticated uploads under `chat/`.
- New object policy helper `mawqifi_safety.chat_image_access(text,boolean)` has an empty search path, is unavailable to unauthenticated users, validates the conversation UUID/path, and requires owner/requester membership.
- Authenticated participant SELECT and active-chat INSERT policies replace those broad policies. Restrictive membership and unauthenticated guards prevent cross-conversation grants from another permissive policy. There are no permissive object UPDATE/DELETE policies.
- Uploads additionally enforce account restrictions, blocking, conversation closure, completed/cancelled claims, and database chat-close time. Historical reads remain available after blocking or closure.
- Internal `handle_new_user()` execution was revoked from client roles; auth triggers still work. `set_updated_at()` now has an empty search path. Their previous advisor findings are gone.
- Existing objects and messages were neither rewritten nor deleted. Four existing text messages were present before this audit, and remained after migration. There were no pre-existing staging image objects/messages to migrate.

New message records store a credential-free authenticated HTTPS storage locator in the existing `image_url` field. The renderer accepts both historical public locators and new authenticated locators **only for the configured project and current conversation**. It extracts the canonical object path, then uses the normal user's authenticated SDK download. A locator is not a public access grant. No signed URL is persisted or used; images are memory-only Blob URLs, revoked on component cleanup. Identity changes remount the renderer and hide another user's enlargement state. Loading/retry/upload failures use bilingual clean UI.

Supabase documents [private bucket authorization](https://supabase.com/docs/guides/storage/security/access-control) and [authenticated downloads](https://supabase.com/docs/guides/storage/serving/downloads). The API/JWT tests confirmed guessed public URLs and unauthenticated authenticated-endpoint requests fail.

## Cache and web safety

Supabase runtime requests now use Workbox NetworkOnly; SDK HTTP requests use `cache: no-store`. Worker activation removes former `supabase-api` and `static-images` caches that could contain previously public/private responses. Static application assets retain their existing browser caching. Regenerated worker/Workbox assets are included because their security behavior changed.

Web headers add CSP, frame-ancestor denial/X-Frame-Options DENY, MIME sniffing protection, strict-origin referrer policy, and camera/geolocation self permissions with microphone disabled. Production script/style `unsafe-inline` remains for the current App Router hydration/style implementation; production `unsafe-eval` is absent. Development adds its required evaluation/local WebSocket allowances. Image origins are self, Blob/data and Supabase; network origins are self and Supabase HTTPS/WSS. Framing/object embedding is disabled. These headers are omitted from the local native static export.

## Foreground location, privacy manifest and encryption

The installed Capacitor geolocation plugin requests `.whenInUse`; pinned ion-ios-geolocation 2.1.0 contains both request types, but Mawqifi does not select `.always`. No background-location mode or Always runtime request was added. Current high-accuracy foreground acquisition, 25m arrival, active-session monitoring and manual fallback are preserved.

`NSLocationAlwaysAndWhenInUseUsageDescription` remains because the dependency contains that capability and Capacitor's [geolocation documentation](https://capacitorjs.com/docs/apis/geolocation) requires the string even though its plugin does not directly support background geolocation. Removing it would contradict the supported plugin configuration. English/Arabic purpose strings now explain voluntary parking/chat location sharing and foreground arrival checks, explicitly avoiding a background-tracking claim. Camera/photos remain explicit user actions.

The project previously lacked an app privacy manifest. Added `ios/App/App/PrivacyInfo.xcprivacy` to the Xcode Resources phase: no tracking/domains, and UserDefaults reason **CA92.1**. Installed Capacitor Preferences actually uses UserDefaults for app preferences, matching the [Preferences documentation](https://capacitorjs.com/docs/apis/preferences). No speculative required-reason APIs or collected-data entries were added. Core/Cordova dependency manifests were inspected. Verify the combined manifest in a signed Xcode archive; this Windows run cannot produce that archive. Store privacy-label declarations remain a separate, accurate disclosure obligation.

`ITSAppUsesNonExemptEncryption = NO` remains. Client inspection found HTTPS/platform encryption and UUID/random identifiers, not custom encryption or an end-to-end protocol. Web Push encryption belongs to the server-only delivery library, not the packaged native client. This is consistent with Apple's [export-compliance guidance](https://developer.apple.com/help/app-store-connect/manage-app-information/overview-of-export-compliance) for exempt/platform encryption; revisit if custom crypto is added.

## Push and authorization

Existing Bearer validation, caller/post/message ownership checks, exact Capacitor origin CORS, participant checks, and block-based recipient filtering remain intact. Native token rows are not client-readable; registration/disable uses the authenticated caller's identity, rather than an arbitrary client-supplied owner. Web subscriptions are scoped to their owner. No private service credentials enter client code.

Concrete preview privacy fixes: chat notifications no longer include typed message text; they use generic localized text/image/location notices. New-post previews omit free-text location details and use the existing institution/verified college title. Exact GPS is not included. Notification deep links resolve to an internal route; loading that route still requires conversation RLS. No APNs or Web Push notification was sent. Live delivery/token registration on a physical device remains pending.

SQL and real anonymous JWT checks verify owner/self-claim rejection, single claimant, private GPS before/after claim, participant-only history, blocked messages/uploads, reporting privacy, server timer close enforcement, idempotent arrival, and retained text/image history. The unchanged handoff suite also covers blocked claims and creator cancellation. Expiry does not delete chat history.

## Anonymous identity and legal copy

Anonymous Auth is a real Supabase session persisted locally by the SDK. Deleting app/browser storage, losing that local session, signing out, or changing devices can lose access to the anonymous identity and its server-retained history. Platform backup/restoration behavior is not guaranteed. Existing email accounts can sign in across devices, but signup creates a separate identity: no working guest-account linking/transfer is implemented.

Corrected misleading guest benefits/onboarding wording and added a guest warning in Settings in Arabic/English. Account linking/recovery is a post-launch improvement with this risk explicitly disclosed; in-app deletion remains the release blocker above. No authentication architecture was replaced.

Privacy chat/image wording now matches authenticated participant access, retained history, HTTPS rather than end-to-end encryption, and authorized administration/moderation access. Current Privacy/Terms/Important Notice describe community parking coordination across institutions, no official affiliation/reservation, and voluntary foreground location. No background or KU-only claim was introduced.

Store copy/screenshots must describe the same multi-institution handoff functionality (KU/PAAET/GUST), reporting/blocking, guest limitations and privacy model. App Store Connect metadata, screenshots, privacy labels, support/policy links and review notes have not been published or verified in the dashboard.

## Environment, secrets and dependency findings

Build configuration uses staging Supabase `https://jrmiwmsgnztqwbigumlw.supabase.co` and native server API `https://mawqifi-testflight-staging.vercel.app`. Public Supabase credentials are build configuration, not service-role credentials. Private APNs/VAPID/service-role variables were absent from the build environment.

Secret scan passed: 347 tracked/staged text files and 84 generated native files checked; no private PEM, service-role token, signing credential or production Supabase reference in the native bundle. New source/scripts use environment variables, never embedded credentials. Two native matches for `https://mawqifiapp.vercel.app` were inspected: the existing `lib/capacitor.ts` URL parsing base/deep-link allowlist converts links into local routes; it is not a network backend fallback. It was preserved for link compatibility. Server API origin remains explicit HTTPS configuration, with no silent production fallback.

Native uses `webDir=out`, packaged assets, no `server.url`, no native service worker/PWA runtime. Web/PWA worker builds normally. Existing system browser/maps handoff and deep-link validation are unchanged.

Latest npm audit: **16 affected package entries: 13 High, 3 Moderate, 0 Critical**. Next.js 15.5.27, React 19.2.8 and PostCSS have no reported advisory. The additional findings relative to the previous audit arise from [braces GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), reviewed October 2: installed/latest 3.0.3 is affected and the advisory lists no patch.

| Root advisory | Affected chain/package entries | Exposure/classification |
| --- | --- | --- |
| braces <=3.0.3, High | braces, micromatch, chokidar, fast-glob, globby, tailwindcss, @next/eslint-plugin-next, eslint-config-next; also next-pwa/Workbox inherited findings | Build/lint/file-glob tooling; app users do not supply executable glob patterns. No patched braces version available. B/D: build-only, upstream fix needed. |
| serialize-javascript <=7.0.2, High | serialize-javascript, rollup-plugin-terser, workbox-build, workbox-webpack-plugin, next-pwa | Workbox build/minification of trusted options, not parking/chat request handling. Compatible 4.x patch unavailable. B/D; detailed source analysis in `release-audit-triage.md`. |
| uuid <11.1.1, Moderate | uuid, xcode, @capacitor/cli | Native project tooling only; xcode invokes argument-free v4(), not vulnerable v3/v5/v6 buffer calls. B/C/D; no compatible parent fix verified. |

All 16 entries are enumerated above (overlapping propagated findings count once). No forced fixes, framework upgrade or unsafe downgrade was performed. They are real installed tooling findings, not a claim of an audit-clean tree; maintain a future PWA/tooling upgrade plan. No vulnerable user-driven path was found in shipped application code.

Staging advisors: the mutable-search-path and exposed auth-trigger findings were fixed. Intentional deny-by-default RLS without client policies remains for native tokens, restrictions, push ledger and submission times. Anonymous authenticated sessions intentionally have UID-scoped policies. `expire_old_parking_posts` and `is_user_blocked` are intentional authenticated helper RPCs. Leaked-password protection remains disabled: review/enable it through supported staging Auth settings before relying on email-password accounts; no unrelated Auth settings were changed. See [password security](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) and [database advisor interpretation](https://supabase.com/docs/guides/database/database-linter).

## Verification evidence

| Check | Result |
| --- | --- |
| Disposable foundation + chronological migrations | PASS; storage migration applies without rewriting historical message/image records |
| Safety SQL/RLS | 89 assertions + 16 helper assertions PASS |
| Parking handoff SQL/RLS | 70 PASS |
| Sub-place SQL/RLS | 102 PASS |
| New storage SQL/RLS | 21 PASS; guards also resist deliberately broad policy in disposable DB |
| Release hardening / compact UI / publish performance / GPS / handoff UI regressions | 65 / 57 / 22 / 41 / 30 PASS (215 total) |
| New private image/client/header/cache checks | 13 PASS |
| Real staging storage/Auth/JWT | 24 active + 5 resumed reporting/privacy + 7 closed/history assertions PASS; initial test-harness reporting call/target corrected, existing fixtures reused |
| Real staging expanded PAAET scope/GPS regression | 39 PASS; no branch -> zero posts, correct scope isolation, wrong-institution scope rejected |
| Compiled actual private chat, real participant session | Arabic RTL and English LTR PASS; loaded authenticated Blob image, enlargement, retained text, no closed-chat composer, no console errors; English 390×844 no horizontal overflow |
| Header safe-area regression | Existing preceding header check: 20 Arabic/English width/inset/badge cases; implementation unchanged here |
| npm run typecheck | PASS |
| npm run lint | PASS |
| npm run build | PASS, web/PWA/server routes |
| npm run cap:ios:archive | PASS, repository's native static archive-safe build/config verifier; **not a signed Xcode IPA** |
| npx cap sync ios | PASS |
| Secret/native environment scans | PASS, with reviewed non-network production deep-link constants noted above |
| npm audit | Nonzero advisory status; tooling exposure classified above |

The fresh real scope suite specifically covers expanded PAAET and cross-institution rejection; KU North/South, GUST and cached-client validation are covered by the disposable/current regression suites, not claimed as newly exercised physical flows.

Physical iPhone still needs foreground permission prompt/accuracy/denial, keyboard Done and composer visibility, Dynamic Island/notch on actual devices, camera/photo picker, system maps, warm/cold publish, realtime peer delivery, foreground arrival/countdown, push registration/delivery, and persistence/reinstall behavior. Signed Xcode IPA, aggregated manifest validation and distribution signing require macOS/Apple tooling. No Codemagic build was started.

## Test fixtures and change control

Private-image staging users: A `ed3af7be-aefb-4321-bde0-3b0f79329459`, B `8233925f-c35d-406c-881b-07dcb653f311`, C `369a11ee-e4cd-420d-bedf-32d64b33cb41`.
Scope regression users: `278501d8-c834-4e15-b33d-d61cc5e7d070`, `ad7570a1-793a-4f9f-9711-c99b6597ea79`, `1f5b9c26-222b-40ea-9ac0-baa09999a499`.

Private fixture post `454eb46a-9af6-4631-a27e-d5b179f0f640`, conversation `44b8990a-d141-4e56-a1fc-f7b2d0d67187`, one private PNG, two messages and report remain for retained-history validation; its timer was moved into the past using exact staging fixture IDs for the controlled closure test. Temporary block was removed. Twelve short-lived PAAET test posts/Auth identities remain staging-only. No historical objects/messages were deleted and no production users/data were copied. Session/JWT context is temporary local-only and excluded from Git; no tokens are in this document.

Future production action requires separate approval: coordinate this client release with the reviewed `20261003181232_secure_chat_image_storage.sql` migration/private bucket conversion and deploy the generic push previews/cache eviction/web headers. Old cached clients cannot render private images until updated. Verify production legacy path compatibility before any rollout. **Nothing was applied/deployed to production.**

Rollback: SQL runs transactionally; a failed apply rolls back its changes without altering records/objects. If reverting client code, retain private storage and participant policies, or temporarily disable image upload. Reopening the bucket publicly is not an acceptable security rollback. No destructive reverse migration was applied. Existing untracked staging and CLI temporary files were preserved and excluded from the commit.

**B. NOT READY — FIXES REQUIRED**
