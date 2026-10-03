# GPS publish performance verification

The performance measurements below describe the original optimization. The later single-sample GPS acquisition was replaced by the bounded foreground watch documented in [publish-gps-reliability.md](publish-gps-reliability.md); the RPC, immediate success UI, and background-feed optimizations remain intact.

Verified 2026-10-03 on `ios-release-hardening`, based on `06efa8025923abfc612b5a0b9c4c93f2eb174b3f`. No schema/RPC changes, production access, deployment, or Codemagic run.

## Findings and changes

The original success state already preceded feed refresh, but returning Home had a fixed **900 ms** delay. Home then discarded its feed and waited for canonical data. Feed discovery also read posts and private block records sequentially.

Success now commits immediately after the same atomic `publish_parking_handoff` RPC. Navigation runs on the next animation frame. An in-memory, owner/place/sub-place-matched public post snapshot renders on Home while canonical data refreshes in the background. The snapshot contains no coordinates, lasts at most 30 seconds, and is replaced by server data; it never authorizes claims or changes server timers. Optional notification work cannot turn a committed publish into a retryable error.

Posts and block records are read concurrently; a failed block read still fails discovery. Same-scope overlapping feed requests share one promise. Pending GPS acquisitions share one promise, and the synchronous publish lock rejects repeated confirmation taps.

## Measurements

Real anonymous Auth and authenticated requests used only `jrmiwmsgnztqwbigumlw`. These are small samples, not device benchmarks.

| Stage | Before, first / warm | After, first / warm |
|---|---|---|
| Physical iPhone permission and GPS | Not measured | Not measured; configuration retained |
| Secure publish RPC | 452 / 347 ms | 473 / 383 ms |
| RPC success → React success UI commit | Fixed 900 ms **navigation** delay after success | 2.1 / 1.9 ms; navigation on next frame |
| Success UI → canonical feed ready | Home initially emptied its feed | 420 / 404 ms, in background |

The before RPC sample was a direct authenticated staging request; the after sample was the compiled static UI with real staging Auth/RPC and **controlled GPS**, whose callback was scheduled at 120 ms. Warm tap → GPS-ready measured 132 ms including navigation; this is not physical GPS performance. Browser permission did not expose a separate granted event, so permission → GPS is unknown. Confirmation think time is excluded from RPC duration. React commit marks do not measure physical screen paint.

A separate simplified read comparison measured sequential reads at 686 / 685 ms and parallel reads at 1025 / 361 ms. The first parallel sample was slower: network variability prevents a universal latency claim. The structural improvement removes serial dependencies, without promising a fixed network saving.

The compiled warm test deliberately clicked confirmation twice: exactly one additional fresh GPS request and one additional RPC occurred. Success remained visible on Home before canonical refresh. Initial local-preview RSC routing failures were corrected in the disposable preview server, without application changes; those navigation samples are excluded.

## GPS and diagnostics

There is **no settled-position cache**. Each publish visit requests fresh foreground GPS with `enableHighAccuracy: true`, `timeout: 15000`, `maximumAge: 0`. Confirmation accepts only finite valid coordinates, known accuracy ≤25 m, age ≤15 seconds, and the current foreground epoch. An aged confirmation reacquires GPS. Backgrounding invalidates the epoch. The existing chat arrival behavior is unchanged.

Permission operations have 30-second bounds. The native overall watchdog is 46 seconds, including permission UI and GPS; browser watchdog is 16 seconds. Timeout/denied/inaccurate fixes produce localized retry states and create no post. If a native operation outlives the watchdog, retries cannot start an overlapping native acquisition until it settles.

Performance marks are enabled in development or by `NEXT_PUBLIC_PUBLISH_TIMING=1` **only with the exact staging Supabase URL**. Production builds default to disabled. Marks contain stage names and timestamps only, never GPS, JWTs, debug UI, console logging, or telemetry. For a debug-enabled development iPhone build, collect `mawqifi-publish:*` Performance marks from Safari Web Inspector; first-launch permission/GPS remains a device validation step.

## Validation and cleanup

- Publish performance/safety regression suite: 40 checks.
- Existing release-hardening: 65 checks; sub-place UI/persistence: 57; handoff SQL/RLS: 70; handoff UI/helpers: 30.
- Typecheck, lint, web build, native static archive verification, and iOS sync pass.
- Arabic progress/confirmation/success verified in the compiled 390×844 browser; English translations covered by assertions. Physical keyboard/GPS/Apple signing were not exercised.
- Notification HTTP calls were intercepted locally; no APNs/Web Push delivered.
- Five exact disposable test posts and their private locations were removed only after verifying no claims/conversations existed. No history/schema/migrations were deleted.
- Anonymous staging identities retained: `e9f1355b-c601-43c2-8388-6306ae5c5bae` and `ee9a7738-d265-4ead-92ab-b99f08c65d80`.

Private location RLS, atomic claims, selected KU college/side and PAAET/GUST scope, blocking/reporting, chat, foreground 25 m arrival, server 15-minute close, and retained history remain unchanged.
