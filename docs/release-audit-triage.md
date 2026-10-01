# Release audit triage — 2026-10-02

This follow-up continues ios-release-hardening from 826b8be5e8c13e4dbc5f7fc7b450f6cbf725606f. Next.js remains 15.5.27 and React/React DOM remain 19.2.8. No restart of the framework upgrade occurred.

## Outcome

A. RELEASE HARDENING PASSED

The requested automated build/security checks pass. There is no identified runtime High/Critical vulnerability in the shipped web/PWA/native application from the remaining audit entries. npm audit still exits 1; its eight entries represent two underlying advisories propagated through build-tool dependency chains. They are retained and classified below, not suppressed.

This conclusion does not certify Xcode signing, Apple-device behavior or notification transport. Those are final Apple-device/TestFlight validation steps, not blockers for this automated hardening phase.

## Compatible changes

- Pinned next-pwa's workbox-webpack-plugin and workbox-window to 6.6.1, within its existing ^6.5.4 dependency ranges. workbox-build and the associated Workbox runtime packages follow at 6.6.1.
- Clean npm ci and npm ls succeeded. Existing packages whose versions changed received no major-version bump.
- Added non-interactive React 19 render coverage for actual report dialogs for post/message/user targets and report/block controls in Arabic and English, plus direction, Settings reachability and unblock-helper checks. The release hardening suite now has 57 passing assertions.
- No application UI, database schema, API authentication/CORS, native configuration or API-origin behavior was rewritten.

The Workbox patch is a compatible maintenance update; it does NOT fix GHSA-5c6j-r48x-rmvq. No remaining root advisory was eliminated. No safe patched version fits the two vulnerable leaf packages' current parent dependency ranges.

## Exact remaining audit entries

Classification: A = runtime security blocker; B = build/dev-only with no application runtime exposure; C = advisory conditions not applicable to the current call path; D = later upstream/integration fix needed.

| Installed package | Severity | Direct? | Dependency chain | Exposure and disposition |
| --- | --- | --- | --- | --- |
| next-pwa 5.6.0 | High, inherited | Yes, declared in dependencies | next-pwa -> workbox-webpack-plugin -> workbox-build -> rollup-plugin-terser -> serialize-javascript | B/D: PWA build configuration only; preserve current PWA pending separately tested tooling modernization |
| workbox-webpack-plugin 6.6.1 | High, inherited | No | next-pwa -> workbox-webpack-plugin | B/D: webpack service-worker generation; not the browser Workbox runtime |
| workbox-build 6.6.1 | High, inherited | No | next-pwa -> workbox-webpack-plugin -> workbox-build | B/D: Node service-worker build pipeline |
| rollup-plugin-terser 7.0.2 | High, inherited | No | next-pwa -> workbox-webpack-plugin -> workbox-build -> rollup-plugin-terser | B/D: build worker serializes trusted minifier options |
| serialize-javascript 4.0.0 | High, root advisory | No | next-pwa -> workbox-webpack-plugin -> workbox-build -> rollup-plugin-terser -> serialize-javascript | B/D: trusted build options only; no user content reaches serialize/eval |
| @capacitor/cli 8.5.2 | Moderate, inherited | Yes, devDependency | @capacitor/cli -> xcode -> uuid | B/C/D: native project tooling; not Capacitor runtime or iOS plugin code |
| xcode 3.0.1 | Moderate, inherited | No | @capacitor/cli -> xcode | B/C/D: Node Xcode-project manipulation, not Apple's Xcode application |
| uuid 7.0.3 | Moderate, root advisory | No | @capacitor/cli -> xcode -> uuid | B/C/D: Xcode helper uses v4() without buffer/offset; vulnerable v3/v5/v6 paths unused |

### High: serialize-javascript

[GHSA-5c6j-r48x-rmvq](https://github.com/advisories/GHSA-5c6j-r48x-rmvq) concerns attacker-controlled RegExp.flags or Date.toISOString values that inject code when serialized output is evaluated. The first patched release is 7.0.3.

Installed rollup-plugin-terser requires serialize-javascript ^4.0.0; there is no patched 4.x release in the registry. A 7.x override would cross multiple major versions outside the parent's declared compatibility. It was not forced.

The installed source shows:
- workbox-build/build/lib/bundle.js invokes terser with a repository-controlled option object and its own literal RegExp.
- rollup-plugin-terser/rollup-plugin-terser.js serializes normalized minifier options, not chat text, parking notes or fetched Supabase data.
- rollup-plugin-terser/transform.js evaluates that options string in a build worker.

This is a real vulnerable build dependency, not a false package match. Its exploit requires control over build-time objects; a contributor able to execute arbitrary JavaScript in build configuration already controls that build environment. Untrusted application users cannot supply those objects. Do not change this conclusion if future builds begin accepting untrusted executable configuration or user-controlled serializer input; reassess in that case.

next-pwa is imported by next.config.js. Its packages can remain installed on a Node host because it is declared in dependencies; absence from an application runtime trace is not a claim that all deployment filesystems omit it. The vulnerable invocation belongs to the webpack build pipeline, not request handling. Generated browser service workers contain Workbox runtime code, not the Node serializer/minifier implementation.

### Moderate: uuid

[GHSA-w5hq-g745-h8pq / CVE-2026-41907](https://github.com/advisories/GHSA-w5hq-g745-h8pq) concerns v3/v5/v6 methods with caller-supplied buffers/offsets. Patched versions include 11.1.1, 12.0.1 and 13.0.1.

Installed xcode 3.0.1 requires uuid ^7.0.3. Registry checks found no patched 7.x or newer compatible xcode release; Capacitor CLI 8.5.2 is already the latest stable 8.x checked. xcode/lib/pbxProject.js uses only uuid.v4() with no arguments to generate project identifiers. The affected methods and buffer/offset conditions are not used.

The CLI/xcode/uuid chain is dev/native-build tooling, absent from the application runtime dependency traces and not copied into the iOS local web assets. A cross-major UUID override, Capacitor major upgrade or CLI downgrade was not warranted for this non-applicable invocation.

### PWA maintenance assessment

The original next-pwa latest release remains 5.6.0, published in 2022; Workbox 6 packages and rollup-plugin-terser are deprecated. It is not the best maintained choice for a new Next.js integration. The @ducanh2912/next-pwa fork uses Workbox 7 and has different integration requirements; adopting a fork or Serwist requires separately testing service-worker/cache/update behavior.

For this existing release, a large replacement is not necessary to remove a runtime blocker: the remaining vulnerability is restricted to trusted build options. The minimal compatible Workbox patch preserves root worker registration, push-worker import, caching configuration, web behavior and native worker exclusion. Plan maintained PWA tooling migration separately; do not interpret the current release classification as an indefinite maintenance strategy.

npm audit's suggested next-pwa@2.0.2 and @capacitor/cli@8.4.3 changes are backwards/different dependency-tree choices, not suitable automatic forward fixes. Neither was applied. npm audit fix --force was never run.

## Validation

| Check | Result |
| --- | --- |
| npm ci / npm ls | PASS |
| npm run typecheck | PASS |
| npm run lint | PASS |
| npm run test:release-hardening | PASS, 57 assertions |
| npm run build | PASS, Next 15 web/PWA build; four authenticated server API routes retained |
| Web runtime dependency traces | 22 .nft.json files checked; none include any of the eight audited tooling packages |
| Compiled routes | 17 app-path manifest entries; home, post/view, conversations, Settings and blocked-user routes present |
| PWA worker checks | Generated sw.js and Workbox scripts parse; /push-worker.js imported; invalid app-build-manifest precache absent |
| Web client private-material marker scan | PASS |
| npm run cap:ios:archive | PASS with staging public Supabase configuration and https://native-staging.invalid |
| Separate npx cap sync ios | PASS, 11 native plugins |
| Native local bundle/configuration scan | PASS; webDir=out, no server.url, no native service worker/push-worker, explicit API origin present |
| Final npm audit | Exit 1; five High + three Moderate entries; zero Critical; all classified above |

The API-origin architecture and native exact-origin CORS/Bearer protections still pass their regression assertions. No production API fallback was introduced. Arabic RTL and English LTR safety controls render successfully without browser automation; actual visual interaction remains pending.

## Final Apple-device validation

On TestFlight/device: signed Xcode archive, launch and session persistence, visual RTL/LTR safety flows, report/block/unblock interaction, realtime peer delivery, image/camera/location behavior, PWA update behavior, and Web Push/APNs registration/delivery with the intended environment's credentials.

No browser automation approval was requested in this follow-up. No Supabase project was accessed or modified. Builds used only cached staging public configuration. No production private credentials were used, no notifications were sent, no production deployment or main merge occurred, and the original dirty workspace was untouched.

Generated PWA/Capacitor output is excluded from this follow-up commit. Existing untracked supabase/staging files remain preserved and excluded.
