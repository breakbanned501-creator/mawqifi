import { createClient } from 'npm:@supabase/supabase-js@2.106.1';

// Production variant prepared for review; deployment needs separate approval.
// No cross-project fallback. Staging keeps its separately guarded function.
const url = Deno.env.get('SUPABASE_URL') ?? '';
const publicKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const serverKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const allowedOrigins = new Set(['capacitor://localhost', 'https://mawqifiapp.vercel.app']);

Deno.serve(async (request: Request) => {
  const origin = request.headers.get('origin');
  const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Vary': 'Origin' };
  if (origin && allowedOrigins.has(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Headers'] = 'authorization, apikey, content-type, x-client-info, x-mawqifi-place-aware';
    headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
  }
  const reply = (status: number, code: string) => new Response(JSON.stringify({ code }), { status, headers });
  if (origin && !allowedOrigins.has(origin)) return reply(403, 'ORIGIN_DENIED');
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return reply(405, 'METHOD_NOT_ALLOWED');
  if (url !== 'https://opsyvdsivxoqphkfdsbb.supabase.co' || !publicKey || !serverKey) return reply(503, 'CONFIGURATION_REQUIRED');
  const token = request.headers.get('authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) return reply(401, 'AUTH_REQUIRED');
  // Custom verified Auth is mandatory even when gateway JWT validation is off.
  const client = createClient(url, publicKey, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return reply(401, 'AUTH_REQUIRED');
  try {
    const body = await request.text();
    if (body && (body.length > 1024 || typeof JSON.parse(body) !== 'object' || JSON.parse(body) === null || Array.isArray(JSON.parse(body)) || Object.keys(JSON.parse(body)).length)) return reply(400, 'NO_TARGET_ALLOWED');
  } catch { return reply(400, 'INVALID_REQUEST'); }
  // No user ID is accepted: SQL independently derives auth.uid() from this JWT.
  const { data: cleanup, error: cleanupError } = await client.rpc('begin_account_deletion');
  if (cleanupError) return reply(409, 'DELETION_RETRY_REQUIRED');
  const admin = createClient(url, serverKey, { auth: { persistSession: false, autoRefreshToken: false } });
  // These paths are read-only revocation probes, NEVER the removal manifest.
  const { data: accessibleObjects, error: scopeError } = await admin.rpc('account_deletion_cache_probes', { account_id: data.user.id });
  if (scopeError || !Array.isArray(accessibleObjects)) return reply(503, 'DELETION_RETRY_REQUIRED');
  const objects = cleanup?.objects as { bucket_id: string; name: string }[];
  if (!Array.isArray(objects)) return reply(503, 'DELETION_RETRY_REQUIRED');
  const buckets = new Map<string, string[]>();
  for (const object of objects) {
    if (typeof object.bucket_id !== 'string' || typeof object.name !== 'string') return reply(503, 'DELETION_RETRY_REQUIRED');
    buckets.set(object.bucket_id, [...(buckets.get(object.bucket_id) ?? []), object.name]);
  }
  // Storage API removes object bytes as well as metadata. Removing an already
  // absent object is safe on retry; SQL never deletes storage.objects rows.
  for (const [bucket, names] of buckets) {
    for (let i = 0; i < names.length; i += 100) {
      const { error: storageError } = await admin.storage.from(bucket).remove(names.slice(i, i + 100));
      if (storageError) return reply(503, 'DELETION_RETRY_REQUIRED');
    }
  }
  // Private Storage CDN responses can outlive an RLS change. Purge only each
  // known object's cached responses (NEVER peer objects or an entire bucket). Hosted
  // purge propagation can take 60s; never announce Auth deletion before it ends.
  for (const object of accessibleObjects) {
    const path = object.name.split('/').map(encodeURIComponent).join('/');
    const purge = await fetch(`${url}/storage/v1/cdn/${encodeURIComponent(object.bucket_id)}/${path}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${serverKey}`, apikey: serverKey },
    });
    if (!purge.ok) return reply(503, 'STORAGE_REVOCATION_REQUIRED');
  }
  if (accessibleObjects.length) {
    await new Promise(resolve => setTimeout(resolve, 65000));
    for (const object of accessibleObjects) {
      // Probe the old canonical URL, not a nonce: it must no longer serve the
      // deleting account, including images still owned by the other participant.
      const path = object.name.split('/').map(encodeURIComponent).join('/');
      const probe = await fetch(`${url}/storage/v1/object/${encodeURIComponent(object.bucket_id)}/${path}`, {
        headers: { Authorization: `Bearer ${token}`, apikey: publicKey }, cache: 'no-store',
      });
      if (probe.ok || probe.status >= 500) return reply(503, 'STORAGE_REVOCATION_REQUIRED');
      await probe.body?.cancel();
    }
  }
  // Auth deletion removes the user's refresh sessions. Do not revoke refresh
  // sessions before this succeeds: a transient admin failure must stay retryable
  // for an anonymous user without another login method.
  const { error: deleteError } = await admin.auth.admin.deleteUser(data.user.id);
  if (deleteError) return reply(503, 'DELETION_RETRY_REQUIRED');
  return reply(200, 'ACCOUNT_DELETED');
});
