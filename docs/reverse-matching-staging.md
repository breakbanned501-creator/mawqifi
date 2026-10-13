# Mawqifi 2.0 reverse matching — staging

This branch changes the staging home experience from publishing a public available
spot first to a parking-request flow.

## Staging guard

The new screen renders only when both conditions are true:

- `NEXT_PUBLIC_REVERSE_MATCHING=1`
- `NEXT_PUBLIC_SUPABASE_URL` has the host `jrmiwmsgnztqwbigumlw.supabase.co`

Production and builds without the flag continue to render the existing handoff
home. The guard prevents the prototype from being enabled against another
Supabase project through the flag alone.

## User flow

1. The requester chooses a valid place scope and taps **I Need Parking / أبي موقف**.
2. A foreground, high-accuracy location fix is sent to the secure request RPC.
3. The database stores precise request coordinates in `mawqifi_safety` and keeps
   the request active for 15 minutes using database time.
4. Another user explicitly chooses **Show nearby**. The database sorts candidates
   by exact distance, but returns only a coarse distance band and no coordinates.
5. **Offer My Spot / عطه الموقف** uses the existing secure GPS publication inside
   the same transaction that creates the 60-second offer.
6. The requester receives an in-app event and a targeted push attempt. Accepting
   calls the existing atomic claim function, opens the existing private chat, and
   reveals the departing user's private parking location to the two participants.
7. Decline, timeout, cancellation, blocks, restrictions, or an already-won race
   prevent the match without leaving an orphan parking post.

## Schema provenance

Staging already contained migration versions `20261013063644` through
`20261013072109` before this branch was integrated. Their exact statements were
read from `supabase_migrations.schema_migrations` and recorded under
`supabase/migrations` with the same versions. They were not replayed.

Migration `20261013074503_harden_reverse_matching_discovery.sql` is the only new
migration applied by this branch. It adds the missing departing-user lookup
index, enables RLS on the discovery throttle table, and changes server-side
ordering from distance bands to exact nearest-first while continuing to return
only coarse bands.

## Test command

`node scripts/test-reverse-matching-staging.cjs` requires
`STAGING_SUPABASE_URL` and `STAGING_SUPABASE_KEY`. It creates disposable
anonymous staging identities, checks RLS/privacy and atomic offer concurrency,
accepts one offer, verifies participant-only handoff access, and reports the IDs
for cleanup. It must never be pointed at production.
