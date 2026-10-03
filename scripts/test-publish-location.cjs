// Deterministic foreground GPS samples and lifecycle races; no network/device GPS.
const fs = require('fs');
const assert = require('node:assert/strict');
const ts = require('typescript');
let checks = 0;
const check = (name, value) => { assert(value, name); checks++; console.log('PASS ' + name); };
function load(file, modules) {
  const exports = {};
  new Function('require', 'exports', ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText)(name => { if (name in modules) return modules[name]; throw Error(name); }, exports);
  return exports;
}
const tick = () => new Promise(resolve => setImmediate(resolve));
const original = { now: Date.now, set: global.setTimeout, clear: global.clearTimeout };
const originalNavigator = Object.getOwnPropertyDescriptor(global, 'navigator');
let clock = 1700000000000, timerId = 0;
const timers = new Map();
Date.now = () => clock;
global.setTimeout = (callback, ms) => { timers.set(++timerId, { callback, deadline: clock + ms }); return timerId; };
global.clearTimeout = id => timers.delete(id);
async function advance(ms) {
  clock += ms;
  for (const [id, timer] of [...timers]) if (timer.deadline <= clock) { timers.delete(id); timer.callback(); }
  await tick();
}
let nextId = 0, calls = 0, clears = 0, maximumActive = 0, permission = 'granted';
let delayedId = null, delayedClear = null, earlySample = null;
const watches = new Map(), diagnostics = [];
const fix = (accuracy, timestamp = clock) => ({ timestamp, coords: { latitude: 29.3, longitude: 47.9, accuracy } });
const api = {
  checkPermissions: async () => ({ location: permission }),
  requestPermissions: async () => ({ location: permission }),
  watchPosition: (options, callback) => {
    check('High accuracy, zero cache, 12-second bound', options.enableHighAccuracy && options.maximumAge === 0 && options.timeout === 12000);
    calls++;
    const id = String(++nextId);
    watches.set(id, callback);
    maximumActive = Math.max(maximumActive, watches.size);
    if (earlySample) { callback(earlySample); earlySample = null; }
    return delayedId ? new Promise(resolve => { delayedId.resolve = () => resolve(id); }) : Promise.resolve(id);
  },
  clearWatch: async ({ id }) => {
    clears++;
    if (delayedClear) await new Promise(resolve => { delayedClear.resolve = resolve; });
    watches.delete(id);
  },
};
const gps = load('lib/publish-location.ts', {
  './capacitor': { isNativeCapacitor: () => true },
  './publish-timing': { publishTiming: () => {}, publishGpsDiagnostics: detail => diagnostics.push(detail) },
  '@capacitor/geolocation': { Geolocation: api },
});
const sample = accuracy => { const callback = [...watches.values()][0]; assert(callback); callback(fix(accuracy)); };
(async () => {
  const first = gps.acquirePublishLocation(), duplicate = gps.acquirePublishLocation();
  check('Concurrent acquisition shares one promise', first === duplicate);
  let settled = false; first.then(() => { settled = true; });
  await tick(); sample(80); await tick();
  check('80m first fix keeps acquiring', !settled && watches.size === 1);
  await advance(3400); sample(18); const accepted = await first;
  check('80m then 18m succeeds', accepted.accuracy_meters === 18);
  check('Watch cleared before confirmation', watches.size === 0 && clears === 1);
  check('Diagnostics contain first/best/time/count only', diagnostics[0].firstAccuracyMeters === 80 && diagnostics[0].bestAccuracyMeters === 18 && diagnostics[0].timeToAcceptableMs === 3400 && diagnostics[0].sampleCount === 2 && !('latitude' in diagnostics[0]));
  const second = gps.acquirePublishLocation(); await tick(); sample(40); await advance(1000); sample(22);
  check('40m then 22m succeeds', (await second).accuracy_meters === 22);
  check('Warm acquisition starts new watch, no cache', calls === 2);
  check('Old fix ages out at confirmation', !gps.usablePublishLocation({ ...accepted, capturedAt: clock - 15001 }));
  const inaccurate = gps.acquirePublishLocation(); const inaccurateRejected = assert.rejects(inaccurate, /PUBLISH_LOCATION_INACCURATE/);
  await tick(); sample(90); await advance(4000); sample(40); await advance(7999);
  check('Poor accuracy gets full window', watches.size === 1);
  await advance(1); await inaccurateRejected;
  check('Timeout clears watch and preserves best accuracy', watches.size === 0 && diagnostics.at(-1).bestAccuracyMeters === 40);
  permission = 'denied'; const beforeDenied = calls;
  await assert.rejects(gps.acquirePublishLocation(), /HANDOFF_LOCATION_REQUIRED/);
  check('Denied permission never starts watch', calls === beforeDenied); permission = 'granted';
  const cancelled = gps.acquirePublishLocation(); const cancelledRejected = assert.rejects(cancelled, /PUBLISH_LOCATION_CANCELLED/);
  await tick(); gps.cancelPublishLocation(); await cancelledRejected; await tick();
  check('Cancel/navigation clears watch', watches.size === 0);
  const retry = gps.acquirePublishLocation(); await tick(); sample(10); await retry;
  check('Retry is fresh and never overlaps watchers', maximumActive === 1 && watches.size === 0);
  const background = gps.acquirePublishLocation(); const backgroundRejected = assert.rejects(background, /PUBLISH_LOCATION_CANCELLED/);
  await tick(); gps.publishAppState(false); await backgroundRejected; await tick();
  check('Backgrounding clears watch and invalidates fix', watches.size === 0 && !gps.usablePublishLocation(accepted));
  await assert.rejects(gps.acquirePublishLocation(), /HANDOFF_LOCATION_REQUIRED/); gps.publishAppState(true);
  const stale = gps.acquirePublishLocation(); await tick(); [...watches.values()][0](fix(5, clock - 1)); await tick();
  check('Accurate cached sample before acquisition rejected', watches.size === 1); sample(16); await stale;
  delayedId = {}; const late = gps.acquirePublishLocation(); const lateRejected = assert.rejects(late, /PUBLISH_LOCATION_TIMEOUT/);
  await tick(); await advance(12000); await lateRejected;
  const lateRetry = gps.acquirePublishLocation(); await tick();
  check('Late native watch ID gates retry', watches.size === 1);
  delayedId.resolve(); delayedId = null; await tick();
  check('Late ID cleared before retry starts', maximumActive === 1 && watches.size === 1); sample(12); await lateRetry;
  earlySample = fix(14); const early = gps.acquirePublishLocation(); await early;
  check('Acceptable callback before native ID still clears watch', watches.size === 0);
  delayedClear = {}; const cleaning = gps.acquirePublishLocation(); await tick(); sample(13); await tick();
  const afterCleanup = gps.acquirePublishLocation(); await tick();
  check('Retry waits for asynchronous clearWatch', watches.size === 1 && maximumActive === 1);
  delayedClear.resolve(); delayedClear = null; await cleaning; await tick(); sample(11); await afterCleanup;
  check('Successful cleanup leaves no timers/watches', watches.size === 0 && timers.size === 0);
  delayedId = {}; const abandoned = gps.acquirePublishLocation();
  const abandonedRejected = assert.rejects(abandoned, /PUBLISH_LOCATION_CANCELLED/);
  await tick(); gps.cancelPublishLocation(); await abandonedRejected;
  const queued = gps.acquirePublishLocation(); const queuedRejected = assert.rejects(queued, /PUBLISH_LOCATION_CANCELLED/);
  gps.cancelPublishLocation(); delayedId.resolve(); delayedId = null; await queuedRejected; await tick();
  check('Navigation cancels queued retry before new watcher starts', watches.size === 0);
  delayedId = {}; const stalled = gps.acquirePublishLocation(); const stalledRejected = assert.rejects(stalled, /PUBLISH_LOCATION_TIMEOUT/);
  await tick(); await advance(12000); await stalledRejected;
  const stalledRetry = gps.acquirePublishLocation(); const stalledRetryRejected = assert.rejects(stalledRetry, /PUBLISH_LOCATION_TIMEOUT/);
  await advance(12000); await stalledRetryRejected;
  check('Delayed cleanup retry also has a bounded wait', watches.size === 1 && maximumActive === 1);
  delayedId.resolve(); delayedId = null; await tick();
  check('Delayed native ID is eventually cleared', watches.size === 0);
  // Exercise the browser watch and clear path with the same bounded accuracy rules.
  let browserCallback, browserClears = 0;
  Object.defineProperty(global, 'navigator', { configurable: true, value: { geolocation: {
    watchPosition: callback => { browserCallback = callback; return 7; },
    clearWatch: id => { assert.equal(id, 7); browserClears++; },
  } } });
  const web = load('lib/publish-location.ts', { './capacitor': { isNativeCapacitor: () => false }, './publish-timing': { publishTiming: () => {}, publishGpsDiagnostics: () => {} } });
  const browserFix = web.acquirePublishLocation(); await tick(); browserCallback(fix(80)); browserCallback(fix(18)); await browserFix;
  check('Browser watch also refines and clears', browserClears === 1);
  const create = fs.readFileSync('app/create/page.tsx', 'utf8');
  check('Unmount cleanup cancels acquisition', create.includes('request.current++; cancelPublishLocation();'));
  check('Navigation during reacquisition prevents RPC', create.indexOf('version !== request.current') < create.indexOf("rpc('publish_parking_handoff'"));
  check('One secure RPC path and synchronous publish lock', (create.match(/rpc\('publish_parking_handoff'/g) || []).length === 1 && create.includes('if (publishLock.current'));
  console.log('Foreground GPS reliability assertions: ' + checks);
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => {
  Date.now = original.now; global.setTimeout = original.set; global.clearTimeout = original.clear;
  if (originalNavigator) Object.defineProperty(global, 'navigator', originalNavigator); else delete global.navigator;
});
