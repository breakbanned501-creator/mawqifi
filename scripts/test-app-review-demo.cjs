const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

function loadTypeScriptModule(relativePath) {
  const fileName = path.join(root, relativePath);
  const source = read(relativePath);
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    fileName,
  }).outputText;
  const loaded = new Module(fileName, module);
  loaded.filename = fileName;
  loaded.paths = Module._nodeModulePaths(path.dirname(fileName));
  loaded._compile(output, fileName);
  return loaded.exports;
}

const demo = loadTypeScriptModule('lib/review-demo.ts');
const page = read('app/review-demo/page.tsx');
const home = read('app/page.tsx');
const settings = read('app/settings/page.tsx');
const documentation = read('docs/app-review-demo.md');
const project = read('ios/App/App.xcodeproj/project.pbxproj');

const initial = demo.createReviewDemoState(false);
assert.equal(initial.selectedPlace, null);
assert.equal(initial.messages.length, 1);
assert.equal(initial.messages[0].sender, 'counterpart');

const unclaimed = demo.appendReviewDemoText(initial, 'hello');
assert.equal(unclaimed.messages.length, 1, 'Messages must remain locked before claim');

const claimed = { ...initial, claimed: true };
const withMessage = demo.appendReviewDemoText(claimed, '  hello  ');
assert.equal(withMessage.messages.length, 2);
assert.equal(withMessage.messages[1].text, 'hello');
assert.equal(demo.appendReviewDemoText({ ...claimed, blocked: true }, 'blocked').messages.length, 1);
assert.equal(demo.appendReviewDemoText({ ...claimed, closed: true }, 'closed').messages.length, 1);
assert.equal(demo.appendReviewDemoText({ ...claimed, accountDeleted: true }, 'deleted').messages.length, 1);

for (const requiredText of [
  'App Review Demo',
  'وضع مراجعة App Store',
  'This demonstration mode is provided for App Store Review and uses synthetic demo data.',
  'وضع تجريبي مخصص لمراجعة App Store ويستخدم بيانات تجريبية فقط.',
  'Open in Maps',
  "I've arrived",
  'Report demo user',
  'Block demo user',
  'Delete demo account',
  'Recreate demo account',
]) {
  assert.ok(page.includes(requiredText), `Missing required review copy: ${requiredText}`);
}

for (const forbiddenIntegration of [
  'getSupabase',
  'fetchMawqifiServerApi',
  "from '@/lib/supabase'",
  'PushNotifications',
  'navigator.geolocation',
  '/api/',
]) {
  assert.ok(!page.includes(forbiddenIntegration), `Demo route must not use ${forbiddenIntegration}`);
}

assert.ok(home.includes('href="/review-demo"'), 'Home must expose the demo entry');
assert.ok(settings.includes('href="/review-demo"'), 'Settings must expose the demo entry');
assert.ok(page.includes("setReportTarget('user')"), 'Demo must expose user reporting');
assert.ok(page.includes("setReportTarget('message')"), 'Demo must expose message reporting');
assert.ok(page.includes('blocked: !current.blocked'), 'Demo must expose reversible blocking');
assert.ok(page.includes('accountDeleted: true'), 'Demo must expose account deletion');
assert.ok(page.includes('openExternalUrl(REVIEW_DEMO_MAP_URL)'), 'Demo must expose the synthetic location to Maps');
assert.ok(page.includes('closed: true'), 'Demo must expose the retained read-only completion state');
assert.ok(documentation.includes('no Supabase, server API, Storage, Realtime, GPS'));
assert.ok(fs.existsSync(path.join(root, 'public', 'review-demo-parking.svg')));
assert.equal((project.match(/TARGETED_DEVICE_FAMILY = 1;/g) || []).length, 2);
assert.ok(!project.includes('TARGETED_DEVICE_FAMILY = "1,2"'));

console.log('[app-review-demo] Synthetic flow, isolation, entry points, documentation, and iPhone-only target passed.');
