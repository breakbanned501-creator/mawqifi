const assert = require('node:assert/strict');
const fs = require('node:fs');
const nodeModule = require('node:module');
const path = require('node:path');
let ts = null;
try {
  ts = require('typescript');
} catch {
  // Node 22.13+ and Node 24 can strip TypeScript syntax for this isolated
  // harness if npm dependencies are unavailable in a constrained workspace.
}

const root = path.resolve(__dirname, '..');
let assertions = 0;

function check(condition, label) {
  assert.ok(condition, label);
  assertions += 1;
}

function loadTypeScriptModule(relativePath, stubs, exports, fallbackImports) {
  const source = fs.readFileSync(path.join(root, relativePath), 'utf8');
  let output;
  if (ts) {
    output = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }).outputText;
  } else {
    const withoutImports = source.replace(/^\s*import\s+[^;]+;\s*$/gm, '');
    output = nodeModule.stripTypeScriptTypes(withoutImports, { mode: 'strip' })
      .replace(/\bexport\s+(?=(?:async\s+)?function|class)\s*/g, '');
    output += `\nmodule.exports = { ${exports.join(', ')} };`;
    output = `${fallbackImports}\n${output}`;
  }
  const moduleRecord = { exports: {} };
  const requireStub = (name) => {
    if (!(name in stubs)) throw new Error(`Unexpected import in focused test: ${name}`);
    return stubs[name];
  };
  new Function('require', 'module', 'exports', output)(requireStub, moduleRecord, moduleRecord.exports);
  return moduleRecord.exports;
}

function createTokenDatabase(initialRows = []) {
  const rows = initialRows.map((row) => ({ ...row }));

  function matches(row, filters) {
    return filters.every(([column, value]) => row[column] === value);
  }

  class Query {
    constructor(table) {
      this.table = table;
      this.filters = [];
      this.action = 'select';
      this.values = null;
      this.returning = false;
    }

    select() {
      if (this.action === 'update') this.returning = true;
      return this;
    }

    eq(column, value) {
      this.filters.push([column, value]);
      return this;
    }

    update(values) {
      this.action = 'update';
      this.values = values;
      return this;
    }

    insert(values) {
      this.action = 'insert';
      this.values = values;
      return this;
    }

    maybeSingle() {
      return Promise.resolve(this.execute()).then(({ data, error }) => ({
        data: Array.isArray(data) ? data[0] ?? null : data,
        error,
      }));
    }

    execute() {
      const tableRows = this.table === 'native_push_tokens' ? rows : [];
      if (this.action === 'insert') {
        const duplicate = tableRows.some((row) =>
          row.platform === this.values.platform && row.device_token === this.values.device_token,
        );
        if (duplicate) return { data: null, error: { code: '23505' } };
        tableRows.push({ id: `token-${tableRows.length + 1}`, ...this.values });
        return { data: null, error: null };
      }

      const found = tableRows.filter((row) => matches(row, this.filters));
      if (this.action === 'update') {
        for (const row of found) Object.assign(row, this.values);
        return { data: this.returning ? found.map((row) => ({ ...row })) : null, error: null };
      }
      return { data: found.map((row) => ({ ...row })), error: null };
    }

    then(resolve, reject) {
      return Promise.resolve().then(() => this.execute()).then(resolve, reject);
    }
  }

  return {
    rows,
    client: { from(table) { return new Query(table); } },
  };
}

function request(method, userId, body) {
  return new Request('https://mawqifi.test/api/push/native-token', {
    method,
    headers: { 'content-type': 'application/json', 'x-test-user-id': userId },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

function loadTokenRoute(database) {
  const stubs = {
    'next/server': {
      NextResponse: {
        json(payload, options = {}) {
          return new Response(JSON.stringify(payload), { status: options.status ?? 200 });
        },
      },
    },
    '@/lib/native-api-cors': {
      nativeApiOptions: async () => new Response(null, { status: 204 }),
      withNativeApiCorsHandler: async (_request, handler) => handler(),
    },
    '@/lib/supabase-server': {
      getRequestAuthentication: async (req) => ({ user: { id: req.headers.get('x-test-user-id') } }),
      getSupabaseServiceRole: () => database.client,
    },
  };
  return loadTypeScriptModule(
    'app/api/push/native-token/route.ts',
    stubs,
    ['OPTIONS', 'POST', 'DELETE'],
    "const { NextResponse } = require('next/server');\nconst { nativeApiOptions, withNativeApiCorsHandler } = require('@/lib/native-api-cors');\nconst { getRequestAuthentication, getSupabaseServiceRole } = require('@/lib/supabase-server');",
  );
}

async function post(route, userId, token, previousToken) {
  const response = await route.POST(request('POST', userId, {
    platform: 'ios',
    token,
    ...(previousToken ? { previousToken } : {}),
  }));
  return { status: response.status, body: await response.json() };
}

async function deleteToken(route, userId, token) {
  const response = await route.DELETE(request('DELETE', userId, { platform: 'ios', token }));
  return { status: response.status, body: await response.json() };
}

async function testTokenRegistrationAndAccountSwitch() {
  const database = createTokenDatabase();
  const route = loadTokenRoute(database);

  const first = await post(route, 'user-a', 'device-token-a');
  check(first.status === 200 && first.body.success === true, 'first APNs token registration succeeds');
  check(database.rows.length === 1 && database.rows[0].enabled, 'first registration creates one enabled row');
  check(typeof database.rows[0].last_seen_at === 'string', 'registration records last_seen_at');

  const refreshed = await post(route, 'user-a', 'device-token-a');
  check(refreshed.status === 200 && database.rows.length === 1, 'same-account token refresh is idempotent');

  const concurrentAccount = await post(route, 'user-b', 'device-token-a');
  check(concurrentAccount.status === 409 && database.rows[0].user_id === 'user-a', 'an enabled token cannot be claimed by a second account');

  const disabled = await deleteToken(route, 'user-a', 'device-token-a');
  check(disabled.status === 200 && database.rows[0].enabled === false, 'sign-out endpoint disables only the current owner token');

  const transferred = await post(route, 'user-b', 'device-token-a');
  check(transferred.status === 200, 'a different account can register after prior-owner disable');
  check(database.rows.length === 1 && database.rows[0].user_id === 'user-b' && database.rows[0].enabled, 'conditional transfer preserves one enabled owner row');

  const renewed = await post(route, 'user-b', 'device-token-a-renewed', 'device-token-a');
  check(renewed.status === 200, 'a renewed APNs token is registered for the same account');
  check(database.rows.find((row) => row.device_token === 'device-token-a-renewed')?.enabled === true, 'the renewed token is enabled');
  check(database.rows.find((row) => row.device_token === 'device-token-a')?.enabled === false, 'the previous token is disabled after renewal');

  const raceDatabase = createTokenDatabase();
  const raceRoute = loadTokenRoute(raceDatabase);
  await post(raceRoute, 'user-a', 'device-token-race');
  await deleteToken(raceRoute, 'user-a', 'device-token-race');
  const raceResults = await Promise.all([
    post(raceRoute, 'user-b', 'device-token-race'),
    post(raceRoute, 'user-c', 'device-token-race'),
  ]);
  check(raceResults.filter((result) => result.status === 200).length === 1, 'concurrent account transfers have exactly one winner');
  check(raceResults.filter((result) => result.status === 409).length === 1, 'the losing concurrent transfer fails closed');
  check(raceDatabase.rows.length === 1 && raceDatabase.rows[0].enabled, 'concurrent transfer leaves a single enabled token owner');

  database.rows.push({ id: 'token-other', user_id: 'user-a', platform: 'ios', device_token: 'device-token-other', enabled: true });
  const forgedPrevious = await post(route, 'user-b', 'device-token-new', 'device-token-other');
  check(forgedPrevious.status === 409, 'a caller cannot disable another user’s previous token');
  check(database.rows.find((row) => row.device_token === 'device-token-other').enabled, 'rejected previous-token claim leaves the other owner unchanged');
}

function loadPushServer(stubs) {
  return loadTypeScriptModule(
    'lib/push-server.ts',
    stubs,
    ['configurePushDelivery', 'deliverPushNotifications'],
    "const webPush = require('web-push').default;\nconst { getSupabaseServiceRole } = require('@/lib/supabase-server');\nconst { blockedRecipientIds } = require('@/lib/push-safety');\nconst { getApnsConfiguration, sendApnsNotification } = require('@/lib/apns-server');",
  );
}

async function testWebPushSurvivesApnsFailures() {
  async function runScenario(scenario) {
  let webSent = 0;
  const webPush = {
    setVapidDetails() {},
    async sendNotification() { webSent += 1; },
  };
  const tableRows = {
    push_subscriptions: [{ id: 'sub-1', user_id: 'recipient', endpoint: 'https://push.invalid', p256dh: 'fixture', auth: 'fixture', active: true }],
    native_push_tokens: scenario === 'delivery'
      ? [{ id: 'native-1', user_id: 'recipient', device_token: 'opaque-test-token', platform: 'ios', enabled: true }]
      : [],
    user_blocks: [],
    user_notification_preferences: [{ user_id: 'recipient', locale: 'ar', parking_push_enabled: true, chat_push_enabled: true }],
  };
  const supabase = {
    from(table) {
      const query = {
        filters: [],
        select() { return this; },
        eq(column, value) { this.filters.push([column, value]); return this; },
        neq(column, value) { this.filters.push([column, { not: value }]); return this; },
        in(column, value) { this.filters.push([column, { in: value }]); return this; },
        or() { return this; },
        update() { return this; },
        then(resolve, reject) {
          const rows = (tableRows[table] ?? []).filter((row) => this.filters.every(([key, expected]) => {
            if (expected && typeof expected === 'object' && 'not' in expected) return row[key] !== expected.not;
            if (expected && typeof expected === 'object' && 'in' in expected) return expected.in.includes(row[key]);
            return row[key] === expected;
          }));
          return Promise.resolve({ data: rows, error: null }).then(resolve, reject);
        },
      };
      return query;
    },
  };
  const pushModule = loadPushServer({
    'server-only': {},
    'web-push': { __esModule: true, default: webPush },
    '@/lib/supabase-server': { getSupabaseServiceRole: () => supabase },
    '@/lib/push-safety': { blockedRecipientIds: () => new Set() },
    '@/lib/apns-server': {
      getApnsConfiguration: () => {
        if (scenario === 'configuration') throw new Error('invalid APNs configuration fixture');
        return {};
      },
      sendApnsNotification: async () => { throw new Error('APNs transport failure fixture'); },
    },
  });
  const priorEnvironment = {
    publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    privateKey: process.env.VAPID_PRIVATE_KEY,
    subject: process.env.VAPID_SUBJECT,
  };
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'test-public-key';
  process.env.VAPID_PRIVATE_KEY = 'test-private-fixture';
  process.env.VAPID_SUBJECT = 'mailto:test@example.invalid';

  try {
    const result = await pushModule.deliverPushNotifications({
      recipientUserId: 'recipient',
      notificationType: 'chat_message',
      payloadForLocale: () => ({ title: 'test', body: 'test', url: '/', lang: 'ar', dir: 'rtl', type: 'chat_message' }),
    });
    check(webSent === 1 && result.sentCount === 1, `Web Push is delivered despite APNs ${scenario} failure`);
    check(result.nativeSentCount === 0, `APNs ${scenario} failure remains separate from Web Push delivery count`);
  } finally {
    for (const [name, value] of [
      ['NEXT_PUBLIC_VAPID_PUBLIC_KEY', priorEnvironment.publicKey],
      ['VAPID_PRIVATE_KEY', priorEnvironment.privateKey],
      ['VAPID_SUBJECT', priorEnvironment.subject],
    ]) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
  }

  await runScenario('configuration');
  await runScenario('delivery');
}

function sourceRegressionChecks() {
  const native = fs.readFileSync(path.join(root, 'lib/native-push.ts'), 'utf8');
  const bridge = fs.readFileSync(path.join(root, 'components/NativeAppBridge.tsx'), 'utf8');
  const auth = fs.readFileSync(path.join(root, 'lib/auth.ts'), 'utf8');
  const tokenRoute = fs.readFileSync(path.join(root, 'app/api/push/native-token/route.ts'), 'utf8');
  const pushServer = fs.readFileSync(path.join(root, 'lib/push-server.ts'), 'utf8');
  const chatRoute = fs.readFileSync(path.join(root, 'app/api/push/notify-chat-message/route.ts'), 'utf8');
  const postRoute = fs.readFileSync(path.join(root, 'app/api/push/notify-new-post/route.ts'), 'utf8');
  const tokenMigration = fs.readFileSync(path.join(root, 'supabase/migrations/20260926090000_add_native_push_tokens.sql'), 'utf8');

  check(native.includes("if (storedDevice.userId !== auth.userId) return false"), 'foreground refresh refuses a locally cached token belonging to another account');
  check(bridge.includes('void refreshNativePushRegistration()') && bridge.includes("App.addListener('appStateChange'"), 'launch and foreground use the existing safe token refresh path');
  check(!native.includes('/api/push/test-native') && !bridge.includes('/api/push/test-native'), 'foreground refresh does not send a test push');
  check(auth.indexOf('unsubscribeFromNativePushNotifications') < auth.indexOf('supabase.auth.signOut()'), 'sign-out disables the current server token before changing Auth identity');
  check(tokenRoute.includes(".eq('enabled', false)") && tokenRoute.includes(".eq('user_id', existing.user_id)"), 'cross-account transfer is guarded by an atomic disabled-owner predicate');
  check(tokenRoute.includes("previous_token_owner_mismatch") && tokenRoute.includes(".eq('user_id', user.id)"), 'previous-token ownership is checked and cleanup remains owner-scoped');
  check(tokenMigration.includes('unique (platform, device_token)'), 'the existing database uniqueness constraint prevents two rows for one device');
  check(pushServer.includes('APNs configuration unavailable; continuing with Web Push.'), 'APNs configuration failures are isolated after Web Push sending');
  check(chatRoute.includes('push_notification_events') && chatRoute.includes('duplicate: true'), 'existing chat notifications retain their idempotency ledger');
  check(chatRoute.includes("notificationType: 'chat_message'"), 'existing chat route still uses the chat notification path');
  check(postRoute.includes('push_notification_events') && postRoute.includes('duplicate: true'), 'existing parking-post notifications retain their idempotency ledger');
  check(postRoute.includes("notificationType: 'parking_post'"), 'existing parking-post route still uses the parking notification path');
}

(async () => {
  sourceRegressionChecks();
  await testTokenRegistrationAndAccountSwitch();
  await testWebPushSurvivesApnsFailures();
  console.log(`iOS push hardening tests passed (${assertions} assertions).`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
