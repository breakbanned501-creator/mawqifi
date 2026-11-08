const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
let assertions = 0;
const check = (condition, label) => { assert.ok(condition, label); assertions += 1; };

function loadPushServer(stubs) {
  const source = fs.readFileSync(path.join(root, 'lib/push-server.ts'), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  new Function('require', 'exports', output)((name) => {
    if (!(name in stubs)) throw new Error(`Unexpected import: ${name}`);
    return stubs[name];
  }, exports);
  return exports;
}

async function webDeliverySurvivesApnsFailure() {
  let webSent = 0;
  const webPush = { setVapidDetails() {}, async sendNotification() { webSent += 1; } };
  const tableRows = {
    push_subscriptions: [{ id: 'sub-1', user_id: 'recipient', endpoint: 'https://push.example', p256dh: 'p', auth: 'a' }],
    native_push_tokens: [],
    user_blocks: [],
    user_notification_preferences: [{ user_id: 'recipient', locale: 'ar', parking_push_enabled: true, chat_push_enabled: true }],
  };
  const supabase = { from(table) {
    const query = {
      select() { return this; }, eq() { return this; }, neq() { return this; }, in() { return this; }, or() { return this; },
      update() { return this; }, then(resolve, reject) { return Promise.resolve({ data: tableRows[table] ?? [], error: null }).then(resolve, reject); },
    };
    return query;
  } };
  const pushModule = loadPushServer({
    'server-only': {}, 'web-push': { default: webPush },
    '@/lib/supabase-server': { getSupabaseServiceRole: () => supabase },
    '@/lib/push-safety': { blockedRecipientIds: () => new Set() },
    '@/lib/apns-server': { getApnsConfiguration: () => { throw new Error('invalid APNs config'); }, sendApnsNotification: async () => ({ accepted: false, stale: false, status: 0 }) },
  });
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'public';
  process.env.VAPID_PRIVATE_KEY = 'private-fixture';
  process.env.VAPID_SUBJECT = 'mailto:test@example.invalid';
  pushModule.configurePushDelivery();
  const result = await pushModule.deliverPushNotifications({
    recipientUserId: 'recipient', notificationType: 'chat_message',
    payloadForLocale: () => ({ title: 'x', body: 'y', url: '/', type: 'chat_message', lang: 'ar', dir: 'rtl' }),
  });
  check(webSent === 1 && result.sentCount === 1, 'Web Push completes when APNs configuration throws');
  check(result.nativeSentCount === 0, 'APNs failure is reported independently');
}

function sourceRegressionChecks() {
  const native = fs.readFileSync(path.join(root, 'lib/native-push.ts'), 'utf8');
  const auth = fs.readFileSync(path.join(root, 'lib/auth.ts'), 'utf8');
  const tokenRoute = fs.readFileSync(path.join(root, 'app/api/push/native-token/route.ts'), 'utf8');
  const pushServer = fs.readFileSync(path.join(root, 'lib/push-server.ts'), 'utf8');
  const chatRoute = fs.readFileSync(path.join(root, 'app/api/push/notify-chat-message/route.ts'), 'utf8');
  const postRoute = fs.readFileSync(path.join(root, 'app/api/push/notify-new-post/route.ts'), 'utf8');
  check(native.includes('await requestNativeToken()') && tokenRoute.includes('last_seen_at: now'), 'APNs token is refreshed and last-seen is persisted');
  check(native.includes('storedDevice.userId !== auth.userId) return false'), 'foreground refresh refuses cross-account token transfer');
  check(auth.includes('unsubscribeFromNativePushNotifications') && auth.indexOf('unsubscribeFromNativePushNotifications') < auth.indexOf('supabase.auth.signOut()'), 'sign-out disables the current owner token before changing identity');
  check(tokenRoute.includes("writeError?.code === '23505'") && tokenRoute.includes(".eq('user_id', user.id)"), 'registration handles duplicate token races and scopes updates to owner');
  check(tokenRoute.includes("existing.user_id !== user.id") && tokenRoute.includes('409'), 'another account cannot claim a registered token');
  check(tokenRoute.includes(".eq('enabled', false)") && tokenRoute.includes(".eq('user_id', existing.user_id)") && tokenRoute.includes("action: 'transferred'"), 'account switch transfers a token only after the previous owner disabled it');
  check(pushServer.includes('getApnsConfiguration()') && pushServer.includes('catch (error)'), 'APNs configuration errors are isolated from Web Push');
  check(pushServer.includes('result.stale ? token.id : null') && pushServer.includes(".update({ enabled: false })"), 'invalid or expired APNs tokens are disabled');
  check(chatRoute.includes('push_notification_events') && chatRoute.includes('duplicate: true'), 'chat notification delivery remains idempotent');
  check(postRoute.includes('push_notification_events') && postRoute.includes('duplicate: true'), 'new-post notification delivery remains idempotent');
  check(chatRoute.includes('chatId: conversation.id') && chatRoute.includes('url: `/post/'), 'chat notification contains the existing conversation route');
  check(postRoute.includes('url: `/post/${storedPost.id}`'), 'parking-post notification opens its post');
  check(!fs.existsSync(path.join(root, 'supabase/migrations/20261106090000_push_place_watch_and_request_notifications.sql')), 'Reverse Matching request migration is excluded');
}

(async () => {
  sourceRegressionChecks();
  await webDeliverySurvivesApnsFailure();
  console.log(`iOS push hardening checks passed (${assertions} assertions).`);
})().catch((error) => { console.error(error); process.exitCode = 1; });
