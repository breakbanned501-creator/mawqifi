# Place scoping - staging verification

Date: 2026-10-02. Branch: ios-release-hardening.
Starting commit: 6b3d7363473b5e26713aed73d7c5127b3e922bef.
Only remote database used: jrmiwmsgnztqwbigumlw.

## Schema and compatibility

- An extensible places catalogue contains kuwait_university, paaet and gust.
  Normal anon/authenticated roles can only read active places.
- Parking posts have a nullable place FK and location_description; no blind
  default. Existing college/zone/gate columns are nullable for non-KU places.
- Exact tuples from the existing kuColleges contract identify cached KU
  inserts and verified legacy backfill. Other rows remain unclassified.
  Status-only expiry updates on unclassified legacy rows still work.
- Staging contained zero posts before migration: zero existing rows backfilled.
  A disposable database separately verified both known and unknown legacy rows.
- KU requires its existing structured tuple; other destinations require a useful
  location description (3 visible characters minimum, 500 maximum) and do not
  accept KU-specific fields. Future catalogue entries use this descriptive mode.
- New REST clients advertise x-mawqifi-place-aware: 1. Old REST feeds remain
  KU-only, preventing nullable non-KU rows from reaching cached KU renderers.
  Realtime evaluates authenticated JWTs without REST headers and retains normal
  post visibility. This marker is presentation compatibility, not authorization:
  existing ownership, blocking and conversation RLS still applies.
- No selection returns an empty feed without a parking-post HTTP query.
  Selection is locally persisted and publish requires an explicit place.
- Added an active-post index on (place_id, expires_at DESC). Existing safety,
  reporting, blocking, expiry and rate-limit contracts remain.
- Notification snapshots and web push formatting support descriptive places.
  No notification delivery was invoked in these tests.

## Applied SQL, in order

1. 20261002094805_add_extensible_places.sql
2. 20261002100839_repair_place_catalogue_unicode.sql
3. 20261002102714_make_place_location_filter_transport_safe.sql
4. 20261002112650_preserve_place_feed_realtime.sql

The first staging SQL transfer incorrectly encoded Arabic/invisible characters.
Local source was correct. No staging posts existed or were misclassified.
Additive repairs restored exact Arabic tuples/names and used ASCII Unicode
escapes in location validation. Applied history was never rewritten.
The fourth migration preserves Realtime alongside cached REST compatibility.

Supabase's apply_migration tooling records execution-time versions, which differ
from repository creation timestamps. Staging already uses an aggregate
staging_bootstrap_17e59d05 baseline, not the historical individual migration
ledger. Do not blindly run db push or repair migration history on another
environment; review that environment's ledger separately.

## Verification

| Check | Result |
|---|---|
| Disposable full current staging bootstrap + all new migrations | PASS: 32 assertions |
| Simulated corrupted transport followed by additive repairs | PASS |
| Existing safety suite | PASS: 89 SQL/RLS + 16 helper assertions |
| Existing release hardening suite | PASS: 57 assertions |
| Real anonymous Auth/JWT staging suite | PASS: 25 assertions |
| KU/PAAET/GUST scoped discovery and no selection | PASS |
| Cached KU insert/read compatibility and new explicit inserts | PASS |
| Invisible/missing/invalid location and spoofed author rejection | PASS |
| Authenticated PAAET Realtime INSERT event | PASS |
| New-place chat, reports/privacy, block/unblock, expiry RPC | PASS |
| RLS/catalogue write protection and retained safety trigger | PASS |
| Typecheck / lint / web PWA build | PASS |
| Native static archive / iOS sync / native verification | PASS |
| Arabic RTL and English LTR mobile browser checks | PASS |
| 390px/320px layouts, persistence, clear-selection and form gating | PASS |
| KU map enlargement and non-KU guidance links | PASS |

Local validation uses the existing untouched supabase/staging/bootstrap_bundle.sql
as its full baseline and the disposable PGlite PostgreSQL engine. It does not
contact a remote database. The real test script uses normal anonymous sessions,
the staging public key, and authenticated SDK requests, never service-role
impersonation or fabricated JWTs. Its realtime subscription explicitly binds
the real returned JWT before testing events.

The native bundle contains staging Supabase and the explicit staging API origin,
no production Supabase ref, no private server credentials, no native service
worker, and no Capacitor server.url. Existing public deep-link origins are not
backend credentials. Codemagic configuration was unchanged and is manual-only.

## Maps

See location-map-sources.md for exact official URLs, retrieval date, locations,
licensing decisions and provenance limitations. No new institution map imagery
was downloaded or embedded. The existing KU gallery is retained unchanged.
PAAET is explicitly multiple locations; its optional directions choices are a
verified subset, not published structured parking metadata. GUST uses general
campus/accessibility guidance and a free-text location, without invented zones.

## Cleanup and remaining manual work

All posts, cascading chats/messages/notifications, test blocks, and test reports
were removed. Anonymous Auth/profile identities remain staging-only; no users
were copied from production.

Final successful run:
- A: bf57cb5c-88b5-4570-be72-4ba0e5c1b93b
- B: 2c2de436-ccce-42b3-a4ab-caaec40e9602
- C: 9a550f7b-925e-4e55-9eb7-66b332bb1a25

Additional anonymous identities from earlier verification attempts/mobile
browser checks also remain; these tests never use or print private credentials.

No signed IPA, physical-device/APNs delivery or TestFlight upload was performed
on this Windows host. Those remain manual Apple-device validation steps.
No Vercel deployment or alias change was initiated by this task. Coordinate
the updated staging server API formatting with the next staging release.

Existing Supabase advisor notices concerning historical mutable-search-path
and trigger/RPC execution grants are baseline findings, not introduced by places.
New guard functions have an empty search_path and revoked normal-role execution.

Production Supabase, main, production deployments and the original dirty
workspace were untouched. Existing untracked supabase/staging files were
neither deleted nor overwritten.