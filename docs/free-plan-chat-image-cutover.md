# Free-plan chat-image privacy cutover

Prepared only. No production request, SQL, copy, removal, deployment or purge has been
performed. Keep Supabase Free. This supersedes the paid CDN-purge procedure in the
original production preparation notes. Execution requires a separate human approval.

## Ownership and access

Apply the reviewed 14-migration chain first, followed by the separately reviewed
`supabase/production/free_plan_chat_image_ownership.sql` supplement. Do not blindly
push historical migrations. The supplement stores authoritative original ownership
in `mawqifi_safety.legacy_chat_image_copies`: message sender, conversation, old/new paths,
references and SHA-256. No client or service-role direct table writes are granted;
only guarded, service-role-only definer RPCs can inventory/commit the mapping.

Inventory must match exactly four existing objects to four image messages, verified
Storage owners and conversation participants. Any mismatch requires review, not a
guessed owner. Service-role Storage copies can have no owner. We therefore store the
original owner explicitly in the private application mapping and extend the existing
account-deletion ownership predicate to include these copies. Do not directly edit
Supabase's managed Storage tables. Copies/deletions use its supported Storage API.
Participant read authorization continues using the existing conversation/path RLS.

The commit RPC rechecks originals, ownership, message references and source timestamps.
It uses the same account advisory locks as deletion, followed by message/Storage row
locks. All four reference changes and mappings commit together; message IDs, senders,
timestamps and history are untouched. A lost-response retry is idempotent.

## Future approved execution order

1. Approve the exact release SHA, live migration drift review and maintenance window.
   Pause image uploads and account deletion; take a restorable database backup.
   Apply the reviewed migrations and ownership supplement with fail-fast transactions.
2. Coordinate the authenticated-image client/deletion-handler release. Keep
   `chat-images` private using the reviewed Storage configuration; never restore public
   access to accommodate old cached clients.
3. In a trusted server/operator environment set `SUPABASE_URL` to the exact production
   project URL, `SUPABASE_ANON_KEY` to its public key and `SUPABASE_SERVICE_ROLE_KEY`
   to its server-only credential. Never put secrets in public variables or this repo.
   Set `MAWQIFI_IMAGE_CUTOVER_APPROVED=opsyvdsivxoqphkfdsbb` and
   `MAWQIFI_IMAGE_WRITES_PAUSED=yes` only after approval. These guards alone are not
   authorization. Use an access-restricted backup directory outside the repository
   (on Windows enforce appropriate ACLs; POSIX mode flags alone do not establish them).
4. Run `prepare` below: save the original bytes, SHA-256, source metadata and reviewed
   four-object manifest. Every destination is a fresh random
   `chat/<conversation-id>/<random-uuid>.<extension>` path. Backups/manifest are
   exclusive-create, never overwritten. Review the manifest before continuing.
5. Run `copy`: verify backup and original hashes, copy without overwrite, then verify
   destination byte equality. Retries use the same manifest and validate existing
   destinations; never regenerate paths. Keep originals intact at this checkpoint.
6. Obtain actual existing participant sessions through normal Auth, plus an unrelated
   real session, securely outside the repo. Do not invent JWTs or impersonate users
   with service-role credentials. Run `verify`: both participants must read matching
   bytes; unrelated and unauthenticated clients must be denied for every new path.
   If sessions cannot safely be obtained, stop before reference changes/deletion.
7. Run `commit`: repeat access verification, then atomically store ownership and update
   only the four message image references to authenticated private locators. Confirm
   participant rendering through the upgraded client; retain the audit and backups.
8. Only after that checkpoint is approved, run `delete-old`: reverify access and exact
   committed mappings, remove only the four old paths, and verify fresh authenticated
   origin requests deny access. Never reuse or republish old URLs/paths. Audit results,
   resume writes/deletion and retain protected backups under an approved retention plan.

Commands, **for later approval only**, from the reviewed repository checkout:

```text
node scripts/legacy-chat-image-cutover.cjs prepare <protected-backup-directory>
node scripts/legacy-chat-image-cutover.cjs copy <protected-backup-directory>
node scripts/legacy-chat-image-cutover.cjs verify <protected-backup-directory> <private-real-session-file>
node scripts/legacy-chat-image-cutover.cjs commit <protected-backup-directory> <private-real-session-file>
node scripts/legacy-chat-image-cutover.cjs delete-old <protected-backup-directory> <private-real-session-file>
```

The private session file has `participants` (user-ID-to-real-access-token mapping) and
`unrelated` (real access token). It is not part of the manifest or version control.
The helper logs no credential values. Its importable core performs no remote activity
until invoked; focused tests supply disposable/mock clients only.

## Rollback checkpoints

Before commit, originals/references remain unchanged: stop, retain backups and private
copies, investigate. A failed SQL commit rolls back all four mappings/reference changes.
After commit, retry the same manifest if a response was lost; keep verified private
references and fix forward. Before old-object removal, take explicit approval of the
verified rendering/audit checkpoint. After removal, recover bytes from protected backups
to another fresh private path if necessary, with a separately reviewed reference update.
Never roll back to a public bucket, old public references or reused original paths.
Do not drop the ownership mapping while copies remain; it is required for account cleanup.

## Account deletion and cache limitation

Both deletion handlers now remove owned objects normally, verify denial using fresh
nonce/no-store authenticated requests with the original caller token, and delete Auth
last. Peer-owned images/history remain. A failed removal or unexpectedly readable fresh
request remains retryable; unavailable paid purge capability cannot block deletion.
There is no purge call, plan dependency or fixed CDN wait.

Current upload code (`lib/chat.ts`) requests `cacheControl: '0'`. The authenticated
image client uses unique `cacheNonce` and `cache: no-store`. These settings do **not**
prove the headers/TTL of the four previously uploaded public objects. Their exact
cache-control/CDN expiry is not recorded in the local schema snapshot, and no production
metadata or external cache test was requested in this patch.

**Unknown / cannot guarantee immediate revocation of previously cached copies.**

Origin objects and new private paths are access-controlled after verified cutover, but
old public CDN responses can remain until cache expiry. Copies already saved in a user's
browser/device cannot be remotely revoked. Do not claim full revocation of old URLs
until the relevant cache window has actually been established and passed. No paid purge
or immediate global-cache revocation is promised.

References: [Storage copy/move](https://supabase.com/docs/guides/storage/management/copy-move-objects),
[Storage schema](https://supabase.com/docs/guides/storage/schema/design),
[ownership](https://supabase.com/docs/guides/storage/security/ownership),
[CDN fundamentals](https://supabase.com/docs/guides/storage/cdn/fundamentals).
