// Manual production workflow guard. This script performs no remote request.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const cp = require('node:child_process');
const REF = 'opsyvdsivxoqphkfdsbb';
const APPROVED_TAG_REF = 'refs/codemagic/approved-release-tag';
const APPROVED_CI_ONLY_FILES = ['codemagic.yaml', 'scripts/test-production-workflow.cjs', 'scripts/verify-production-build-env.cjs'];
function verify(env, git, names) {
  assert(/^[a-f0-9]{40}$/.test(env.APPROVED_RELEASE_COMMIT || ''), 'Final approved commit required');
  assert(/^mawqifi-production-[A-Za-z0-9._-]+$/.test(env.APPROVED_RELEASE_TAG || ''), 'Explicit approved production tag required');
  const allowedReleaseBranches = new Set(['ios-release-hardening', 'mawqifi-production-release-1.0.2']);
  const approvedSource = allowedReleaseBranches.has(env.CM_BRANCH) || env.CM_TAG === env.APPROVED_RELEASE_TAG;
  assert(approvedSource, 'Release branch or exact approved tag required');
  const head = git(['rev-parse', 'HEAD']);
  if (head !== env.APPROVED_RELEASE_COMMIT) {
    git(['merge-base', '--is-ancestor', env.APPROVED_RELEASE_COMMIT, 'HEAD']);
    const changed = git(['diff', '--name-only', env.APPROVED_RELEASE_COMMIT, 'HEAD']).split(/\r?\n/).filter(Boolean).sort();
    assert(changed.every(file => APPROVED_CI_ONLY_FILES.includes(file)), 'CI-only guard commit contains application changes');
    git(['diff', '--quiet', env.APPROVED_RELEASE_COMMIT, 'HEAD', '--', '.', ...APPROVED_CI_ONLY_FILES.map(file => `:(exclude)${file}`)]);
  }
  assert.equal(git(['rev-parse', APPROVED_TAG_REF + '^{commit}']), env.APPROVED_RELEASE_COMMIT, 'Approved tag does not resolve to approved commit');
  git(['merge-base', '--is-ancestor', '8d56560eb3edd043662d6cb18dec6541b38b2e66', 'HEAD']);
  assert.equal(env.NEXT_PUBLIC_SUPABASE_URL, 'https://' + REF + '.supabase.co', 'Production Supabase URL required');
  assert.equal(env.NEXT_PUBLIC_SERVER_API_ORIGIN, 'https://mawqifiapp.vercel.app', 'Approved production API origin required');
  assert.equal(env.NEXT_PUBLIC_REVERSE_MATCHING, '1', 'Mawqifi 2.0 reverse matching must be explicitly enabled');
  assert(/^[0-9]+$/.test(env.APP_STORE_APPLE_ID || ''), 'Numeric Apple app ID required');
  assert(!env.MAWQIFI_NATIVE_ENV_FILE && !env.NEXT_PUBLIC_PUBLISH_TIMING, 'No native overrides or development timing');
  for (const name of ['SUPABASE_SERVICE_ROLE_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT', 'APNS_PRIVATE_KEY', 'APNS_AUTH_KEY']) {
    assert(!env[name], name + ' must not be provided to the native build');
  }
  assert(!Object.values(env).some(v => typeof v === 'string' && (v.includes('jrmiwmsgnztqwbigumlw') || v.includes('mawqifi-testflight-staging.vercel.app'))), 'Staging reference in build environment');
  assert(!names.some(n => n !== '.env.example' && /^\.env(?:\.|$)/.test(n)), 'Local env override forbidden');
  // The project is encoded in legacy public JWTs. Publishable keys instead require
  // a separate read-only Auth validation in CI; never infer their project from prefix.
  const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (key.startsWith('eyJ')) {
    const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url'));
    assert.equal(payload.ref, REF, 'Public key belongs to another project');
    assert.equal(payload.role, 'anon', 'Only anon public JWT allowed');
  } else assert(/^sb_publishable_[A-Za-z0-9_-]+$/.test(key), 'Public anon/publishable key required');
}
module.exports = { verify };
if (require.main === module) {
  try {
    verify(process.env, args => cp.execFileSync('git', args, {encoding:'utf8', stdio:['ignore','pipe','pipe']}).trim(), fs.readdirSync('.'));
    console.log('Approved production commit/tag and public build configuration verified.');
  } catch (error) {
    // Guard errors contain assertion labels only; never print environment values.
    console.error('Production guard failed:', error && error.message ? error.message : 'validation failed');
    process.exitCode = 1;
  }
}
