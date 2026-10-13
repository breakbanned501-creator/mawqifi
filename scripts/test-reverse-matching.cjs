const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
let assertions = 0;
const check = (condition, label) => {
  assert.ok(condition, label);
  assertions++;
};

const page = read('app/page.tsx');
check(page.includes("NEXT_PUBLIC_REVERSE_MATCHING !== '1'"), 'feature flag required');
check(page.includes('jrmiwmsgnztqwbigumlw.supabase.co'), 'feature is hard-guarded to staging');

const screen = read('components/ReverseParkingHome.tsx');
check(screen.includes("english ? 'I Need Parking' : 'أبي موقف'"), 'single primary request action');
check(!screen.includes("I'm leaving my spot") && !screen.includes('بطلع من موقفي'), 'direct leave action removed');
check(screen.includes("give_parking_to_request"), 'atomic give RPC used');
check(screen.includes("accept_parking_offer"), 'atomic accept RPC used');
check(screen.includes("Date.parse(myRequest.request.expires_at)"), 'request expiry uses server timestamp');
check(screen.includes("Date.parse(pendingOffer.expires_at)"), 'offer expiry uses server timestamp');
check(screen.includes("acquirePublishLocation"), 'foreground precise location acquisition reused');
check(screen.includes("cancelPublishLocation"), 'location acquisition cleanup retained');
check(!screen.includes('.latitude}') && !screen.includes('.longitude}'), 'coordinates are not rendered');
check(screen.includes("fetchMawqifiServerApi('/api/push/notify-match-offer'"), 'targeted push endpoint called');

const route = read('app/api/push/notify-match-offer/route.ts');
check(route.includes("offer.departing_user_id !== user.id"), 'offer sender authorization enforced');
check(route.includes("notificationType:'parking_match_offer'"), 'dedicated notification type used');
check(route.includes("recipientUserId:offer.requester_id"), 'push targets requester');
check(route.includes("parking_match_push_events"), 'idempotency event used');
check(route.includes("result.sentCount === 0"), 'failed delivery remains retryable');

const migrationNames = fs.readdirSync(path.join(root, 'supabase/migrations'))
  .filter(name => name.includes('reverse_matching'));
check(migrationNames.length === 9, 'eight staging prototype migrations plus one hardening migration recorded');
check(read('supabase/migrations/20261013074503_harden_reverse_matching_discovery.sql')
  .includes('order by meters, created_at, id'), 'nearest-first server ordering');
check(read('supabase/migrations/20261013063644_reverse_matching_requests_offers_foundation.sql')
  .includes("interval '15 minutes'"), '15-minute request lifetime is database-owned');
check(read('supabase/migrations/20261013065943_reverse_matching_rpc_prototype.sql')
  .includes("interval '60 seconds'"), '60-second offer window is database-owned');

console.log('Reverse matching checks passed (' + assertions + ' assertions).');
