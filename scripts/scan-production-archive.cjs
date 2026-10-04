// Scan expanded IPA app directory AND out/. Never scan compressed IPA bytes alone.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
function inspectText(text, env = {}) {
  assert(!/jrmiwmsgnztqwbigumlw|mawqifi-testflight-staging\.vercel\.app/i.test(text), 'Staging backend in production assets');
  assert(!/-----BEGIN (?:RSA |EC |ENCRYPTED )?PRIVATE KEY-----|sb_secret_[A-Za-z0-9_-]{20,}/.test(text), 'Private key material in archive');
  assert(!/SUPABASE_SERVICE_ROLE_KEY|VAPID_PRIVATE_KEY|APNS_PRIVATE_KEY|APNS_AUTH_KEY/.test(text), 'Private credential configuration in archive');
  for (const match of text.matchAll(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)) {
    let payload; try { payload = JSON.parse(Buffer.from(match[0].split('.')[1], 'base64url')); } catch { continue; }
    assert(payload.role !== 'service_role', 'Service-role JWT bundled');
    if (payload.role === 'anon') assert.equal(payload.ref, 'opsyvdsivxoqphkfdsbb', 'Cross-project public JWT');
  }
  for (const [name,value] of Object.entries(env)) {
    if (/(?:PRIVATE_KEY|AUTH_KEY|SERVICE_ROLE|SECRET|PASSWORD)/i.test(name) && typeof value === 'string' && value.length >= 16) {
      assert(!text.includes(value), 'Private environment credential bundled');
    }
  }
}
function scan(roots, env = process.env) {
  let files=0, configs=0;
  for (const root of roots) {
    assert(fs.existsSync(root), 'Missing archive/output root');
    let backend=false, api=false, rootConfigs=0;
    const walk = dir => {
      for (const e of fs.readdirSync(dir,{withFileTypes:true})) {
        const file=path.join(dir,e.name);
        assert(!e.isSymbolicLink(), 'Unexpected symlink in expanded app/output');
        if(e.isDirectory()) {walk(file); continue;}
        const text=fs.readFileSync(file).toString('utf8'); inspectText(text,env); files++;
        backend ||= text.includes('https://opsyvdsivxoqphkfdsbb.supabase.co');
        api ||= text.includes('https://mawqifiapp.vercel.app');
        assert(!/^(?:sw|push-worker|workbox.*)\.js$/.test(e.name), 'Native service worker asset present');
        if(e.name==='capacitor.config.json') {
          const config=JSON.parse(text);assert.equal(config.appId,'com.mawqifi.app');assert.equal(config.webDir,'out');assert(!config.server?.url,'Remote Capacitor server.url');configs++;rootConfigs++;
        }
      }
    };walk(root);
    assert(backend && api, 'Production public configuration missing from scanned root');
    if(root===roots[0])assert(rootConfigs>0,'Expanded app configuration missing');
  }
  assert(files>0, 'Empty production assets');
  assert(configs>0,'Expanded native app configuration missing');
  return files;
}
module.exports={inspectText,scan};
if(require.main===module) {
  try { console.log('Production archive scan passed: '+scan(process.argv.slice(2))+' files.'); }
  catch { console.error('Production archive scan failed; cross-project configuration, private material or native asset violation.');process.exitCode=1; }
}
