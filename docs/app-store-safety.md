# Mawqifi App Store safety

This implementation is on `ios-native-release`. Production has not been migrated
or deployed. Apply the migration to staging and complete device tests before rollout.

## Reporting

Parking cards offer Report; received chat messages offer a flag; the chat header
offers Report user. The Arabic/English modal captures a reason and optional details
(300 characters). Supabase anonymous Auth UUIDs work without revealing real names.
`public.content_reports` stores reporter, target type/UUID, reason, details,
timestamp and moderation status. RLS allows own inserts and own reads only;
clients cannot update status/delete reports. Targets never see their reporters.
Message targets are validated against the reporter's conversation membership.
One report per reporter/target is idempotent; five distinct reports per five
minutes is the limit. Server-set timestamps and transaction locks prevent bypasses.

## Blocking

Chat header → Block user asks for confirmation. Settings → Blocked users lists
only outgoing blocks and supports unblocking. `public.user_blocks` uses own-row
SELECT/INSERT/DELETE policies, no client UPDATE, and rejects self-blocks.
Both directions prevent new conversations and message inserts, even via direct
Supabase REST. Conversation participants/post cannot be reassigned. Existing
conversations/messages remain readable for records; sending is disabled.
Blocking and sending serialize on the same pair lock. The public relationship
RPC derives the caller from `auth.uid()` and returns only a boolean for that pair.
The feed suppresses blocked users' posts; posts linked to an existing conversation
remain accessible for history. Restrictive RLS hides blocked actors' in-app events;
the push server filters both directions of blocks. Already-delivered OS alerts
cannot be retracted.

## Filtering and limits

React renders messages as escaped text, never HTML. Arabic/Kuwaiti text, mixed
English, emoji, URLs and paragraphs remain supported. Empty/invisible-only text,
over 2,000 characters and 40 repeated identical characters are rejected. Database
triggers reject repeat text within 30 seconds and more than 20 messages/minute.
Image URLs must be HTTPS; explicit location coordinates must be valid. Post
descriptions are limited to 200 characters. A private submission ledger limits
posts to five/five minutes even if the user deletes posts. Client timestamps cannot
bypass limits. Existing content/identities are not rewritten or deleted.
This is basic submission filtering, not automated semantic or image moderation.

## Contact and trusted moderation

Settings → Report a problem or abuse opens `/feedback`. Terms prohibit fake posts,
harassment, abuse and spam. Privacy accurately identifies Supabase storage,
absence of E2EE/student verification, and current public image-link access.
Trusted staff use the Supabase dashboard or a server-only service-role workflow
to review reports and set `reviewing`, `resolved` or `dismissed`. No frontend
moderator UI is included. Staff may remove confirmed violating content.
`public.account_restrictions` is admin-only (RLS, no client grants): inserting
an offender UUID plus internal reason prevents new posts/conversations/messages
without deleting the account or data; removing the row lifts the restriction.

Private definer helpers live in `mawqifi_safety`, have empty search paths, qualified
tables and revoked client execution; they are not exposed RPC moderation APIs.
The narrow public relationship RPC requires `auth.uid()`. No client secrets added.

## App Review and release tests

1. Use two separate guest sessions A/B with different Supabase authenticated UUIDs.
2. A posts. B reports the post, A's user and a received message. Confirm three
   private rows as admin; A cannot read B's reports. Repeating a report leaves one
   row. Six distinct reports/five minutes rejects the sixth. Spoofed reporter fails.
3. B blocks A. Both-direction messages and new conversations must fail, including
   direct REST attempts. Existing history remains. B unblocks from Settings;
   messaging works again while the parking conversation is active.
4. Check empty/long/repeated/rapid messages and normal Arabic/English/URL/emoji/
   paragraph text; verify images and explicit location sharing. Test RTL/LTR and
   mobile/desktop, then open the support link.
5. Run `node scripts/test-safety.cjs <path-to-@electric-sql/pglite>` for disposable
   SQL/RLS checks. Run typecheck, lint, web build, `cap:ios:archive`, `cap sync ios`.
6. Before release apply/review migration in staging, run Supabase advisors, test
   real anonymous Auth JWTs and Realtime, and test on physical iOS. Assign staff
   ownership and a timely response process for reports; no response SLA is promised.

Disposable tests model the authenticated role/`auth.uid()`; they do not prove
production deployment, native device behavior or staff response. Do not submit
to Apple until these remaining operational and device checks are complete.
