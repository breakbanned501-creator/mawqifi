# iOS release hardening verification

Branch: ios-release-hardening. Base: origin/ios-native-release at 17e59d05baf670dedc31d25dbee52d136a72db80.

## Dependency changes

- Next.js and eslint-config-next: 14.2.3 -> 15.5.27.
- React / React DOM: 18.3.1 -> 19.2.8.
- React types: 19.2.18 / React DOM types: 19.2.7.
- lucide-react: 0.378.x -> 0.468.0 for React 19 peer compatibility.
- PostCSS: 8.5.28, including the nested Next.js dependency via a scoped override.
- Vulnerable transitive dependencies received compatible updates. No forced audit fix or unrelated major upgrade was used.

References: [Next.js 15 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-15), [React 19 upgrade guide](https://react.dev/blog/2024/04/25/react-19-upgrade-guide), [September 2026 security release](https://nextjs.org/blog/september-2026-security-release).

The official next-async-request-api codemod was run in dry-run mode: 17 files unmodified, zero errors. There are no server params/searchParams or cookies()/headers() call sites requiring migration. The static /post/view client screen uses useSearchParams inside Suspense. Existing Next Image configuration, React client boundaries, route handlers and web redirects compile in Next 15. The lint command now calls ESLint directly instead of deprecated next lint.

## Native API configuration

Web/PWA calls retain relative, same-origin URLs.

Native archives require NEXT_PUBLIC_SERVER_API_ORIGIN. lib/server-api-origin.js validates and canonicalizes an HTTPS origin without credentials, path, query or fragment. Both the native build script and client resolver use this validator. Missing or invalid configuration fails before API routes or output are moved. There is no production fallback.

Set the public staging/preview backend origin explicitly before npm run cap:ios:archive. For example, in PowerShell:

    $env:NEXT_PUBLIC_SERVER_API_ORIGIN = 'https://your-staging-backend.example'
    npm run cap:ios:archive

The build also requires the intended public Supabase URL and anon key. These are public configuration, not service-role credentials. MAWQIFI_NATIVE_ENV_FILE may contain those three public variables. Never commit actual keys or private backend credentials.

Existing public website/share-link constants remain unchanged; they do not select the native API backend. Only the four existing push server endpoints are resolved through server-api.ts. Native requests omit cookies and preserve Bearer authorization. CORS continues to allow only capacitor://localhost; foreign origins are rejected and authentication is not bypassed.

The ignored .capacitor-build/server-api-origin.txt records the expected public origin for archive verification. Native output remains out/, with local Capacitor assets, no server.url, no service worker or PWA runtime. Web Push and APNs/native registration remain separate.

## Verification on 2026-10-02

| Check | Result |
| --- | --- |
| Clean npm ci and npm ls dependency validation | PASS |
| npm run typecheck | PASS |
| npm run lint | PASS |
| npm run build (web/PWA) | PASS; 19 generated entries including four server APIs |
| npm run test:release-hardening | PASS; 37 assertions |
| Existing SQL/RLS suite | PASS; 89 assertions plus 16 safety helper checks |
| Real staging anonymous Auth/JWT/RLS regression | PASS; 151 assertions |
| npm run cap:ios:archive | PASS; explicit https://native-staging.invalid, staging public Supabase config |
| Separate npx cap sync ios | PASS; 11 native plugins |
| Native bundle/configuration/secret-marker scan | PASS |
| Interactive browser regression | INCOMPLETE; app loaded Arabic onboarding without reported browser errors, subsequent interaction permission declined |
| Xcode signed archive / iPhone device verification | NOT RUN; Windows environment |

Native packaging used a reserved invalid origin to prove configuration without contacting a remote API backend. A real staging backend URL and server-only staging push configuration are still required to test native push registration against that backend. No real Web Push/APNs notification was sent.

### Regression coverage and limits

| Area | Evidence |
| --- | --- |
| Anonymous auth/profile initialization | Real signInAnonymously and application ensureSession/ensureUserProfile passed |
| Session persistence | Existing persistSession/autoRefreshToken configuration inspected; on-device persistence not exercised |
| Parking feed/create/post view | Real create/read/RLS/expiry boundaries passed; home/create/post/view compiled for both modes |
| Conversations/chat | Real participant operations, text and blocking passed; realtime subscriptions inspected and compiled, live peer delivery not exercised |
| Images/location sharing | Existing SQL image/location message checks passed; Next Image/native unoptimized configuration compiled; camera/GPS/upload UI not exercised |
| Notification center | RLS/read/cleanup and compilation passed; subscription code inspected |
| Web Push/native push | API origin, Bearer forwarding, exact CORS, block-based recipient filtering and secret scans passed; push transport/device registration not exercised |
| Reports/block/unblock | Real staging database operations and privacy enforcement passed |
| Arabic/English | Both direction/translation paths compiled; real safety errors mapped to both languages |
| Settings/privacy/terms/WhatsApp CTA | Inspected and compiled in both modes; interactive flows remain unverified |

Staging project used: jrmiwmsgnztqwbigumlw. Disposable real anonymous identities:

- A: 23caf270-9ca8-4855-8ae6-059f9d5f97c1
- B: a35d0446-d1b4-4b40-bdc3-5d6d6c4bce74
- C: afe9ed53-6bec-4f68-97a8-be1b523d6ced

Test posts, conversations/messages (cascade), blocks, subscriptions, notifications, reports and notification ledger rows were cleaned up. Auth identities/profile rows and preferences may remain as staging-only fixtures; sessions were signed out. No production data or users were copied.

## Remaining audit findings

npm audit exits 1: eight affected package entries, five high and three moderate, zero critical. No advisory remains for Next.js, React, React DOM or PostCSS in the final tree.

- High: serialize-javascript (GHSA-5c6j-r48x-rmvq), propagated through rollup-plugin-terser, workbox-build, workbox-webpack-plugin and next-pwa.
- Moderate: uuid (GHSA-w5hq-g745-h8pq), propagated through xcode and @capacitor/cli.

These are existing PWA/native build-tool chains. npm proposes incompatible next-pwa and Capacitor CLI downgrades; they were not applied. Replacing/upgrading that tooling requires a separate compatibility change and verification. The dependency tree is not audit-clean.

No main merge, production deployment, production Supabase access, production migration or edits to the original dirty worktree occurred. Existing untracked supabase/staging files and verification artifacts are excluded from the hardening commit. Generated service-worker and Capacitor build changes are excluded too.

The follow-up [release audit triage](release-audit-triage.md) verifies compatible Workbox patch updates and 57 non-interactive hardening assertions, classifies the remaining findings as build-only/non-applicable to runtime, and records the current automated conclusion: A. RELEASE HARDENING PASSED. Visual, signing and device validation remain separate final Apple-device steps.
