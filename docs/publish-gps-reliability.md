# Foreground publish GPS reliability

Based on `76d890e0dc3c9a0b4a515cb1938a98d275e3cd81`, verified 2026-10-03. This changes only publish-location acquisition, lifecycle cleanup, error copy, and diagnostics. No database, RPC, arrival, or handoff architecture changes.

## Root cause and behavior

Previously, one high-accuracy `getCurrentPosition` result was immediately rejected if its reported accuracy exceeded 25 m. iOS may deliver an early coarse fix even when Precise Location is enabled; the old helper gave it no opportunity to improve.

The publish helper now uses a temporary `watchPosition` with high accuracy and `maximumAge: 0`. It keeps the best valid sample while waiting up to **12 seconds after permission resolves**, and stops at the first acceptable **≤25 m** fix. It never accepts an over-threshold sample at timeout. Both native and browser paths use the same validation. Foreground native permission resolution has a separate 30-second bound.

Each accepted sample must have valid finite coordinates/accuracy and a timestamp from this acquisition. A cached callback predating the watch is ignored. At confirmation, the existing ≤15-second age and current foreground epoch checks remain enforced; aged fixes reacquire GPS. No settled-position cache is used.

The loading text remains `جاري تحديد موقع موقفك…` / `Finding your parking location…`. Poor early samples keep this state active rather than showing an error. After the deadline, the retry message is:

- Arabic: `تعذر تحديد موقعك بدقة كافية حالياً. جرّب الوقوف في مكان مفتوح ثم أعد المحاولة.`
- English: `Your location could not be determined accurately enough. Try moving to an open area and retry.`
- Retry: `إعادة المحاولة` / `Try again`.

Actual denied/restricted/disabled-location errors retain the permission error path. Accuracy alone is not treated as proof that iOS Precise Location is disabled.

## Cleanup and concurrency

Success clears the watch before resolving the fix. Timeout, explicit Cancel, page unmount, scope changes, and backgrounding clear the acquisition's own watch. Existing chat/arrival watchers are untouched. Permission UI may temporarily inactivate iOS, but no GPS watch starts unless the app is foreground after permission resolves.

Pending acquisitions share one promise. Retry waits for the old watch to be cleared, including the race where a callback or timeout arrives before the native watch ID. Queued retries are invalidated by navigation/cancellation and have a bounded 12-second cleanup wait; no second watcher starts while cleanup is outstanding. If native cleanup fails, the gate stays closed and rejects retries rather than overlapping watchers. The JavaScript helper cannot clear a native watcher without its ID; a delayed ID is cleared as soon as supplied.

Publish remains one secure RPC, guarded by the existing synchronous lock. Navigation while reacquiring location also prevents a later publish call. Private coordinates, selected place/sub-place, atomic claims, immediate chat, 25 m arrival, server 15-minute timer, retained history, and blocking/reporting are unchanged.

## Diagnostics and validation

Development or explicit staging-only `NEXT_PUBLIC_PUBLISH_TIMING=1` records the latest `mawqifi-publish:gps-acquisition` Performance mark detail: first accuracy, best accuracy, sample count, elapsed time, time to acceptable fix, and outcome. No coordinates, JWTs, console logs, or normal UI diagnostics are recorded. Production defaults to disabled. Use a debug-enabled development/device build to inspect Performance marks.

Deterministic tests cover 80→18 m, 40→22 m, all-poor samples until timeout, permission denial, cancellation, backgrounding, stale fixes, native ID/cleanup races, bounded retry, browser refinement, and one publish call path. The mock 80→18 m sequence reaches 18 m at 3.4 seconds; this is a controlled test, not a physical iPhone measurement. Physical signal/permission behavior needs confirmation in the next manually started TestFlight build.

Validation passed: typecheck, lint, web build, native static archive verification/secret scan, and iOS sync. There were 41 GPS lifecycle assertions and 244 other performance, scope, handoff, release, and disposable SQL/RLS assertions (285 total).

The compiled mobile browser flow was also exercised with controlled samples and mocked publish/push HTTP calls: 80 m kept the loading state; 18 m cleared the watcher and enabled confirmation; double confirmation taps produced one publish call. A poor-only watch showed the exact Arabic retry error at approximately 12 seconds, cleared its watch, and a fresh retry succeeded. No test posts or notifications were created by this browser check. These results do not substitute for physical iPhone signal validation.

API reference: [Capacitor 8 Geolocation](https://capacitorjs.com/docs/apis/geolocation).
