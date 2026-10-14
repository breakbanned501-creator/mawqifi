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
check(screen.includes('hasGrantedLocationPermission'), 'existing location grant triggers automatic discovery');
check(screen.includes("english ? 'Allow location' : 'السماح بالموقع'"), 'missing location grant has a clear action');

const route = read('app/api/push/notify-match-offer/route.ts');
check(route.includes("offer.departing_user_id !== user.id"), 'offer sender authorization enforced');
check(route.includes("notificationType:'parking_match_offer'"), 'dedicated notification type used');
check(route.includes("recipientUserId:offer.requester_id"), 'push targets requester');
check(route.includes("parking_match_push_events"), 'idempotency event used');
check(route.includes("result.sentCount === 0"), 'failed delivery remains retryable');

const migrationNames = fs.readdirSync(path.join(root, 'supabase/migrations'))
  .filter(name => name.includes('reverse_matching'));
check(migrationNames.length === 11, 'eight staging prototype migrations plus three hardening migrations recorded');
check(read('supabase/migrations/20261013074503_harden_reverse_matching_discovery.sql')
  .includes('order by meters, created_at, id'), 'nearest-first server ordering');
check(read('supabase/migrations/20261013063644_reverse_matching_requests_offers_foundation.sql')
  .includes("interval '15 minutes'"), '15-minute request lifetime is database-owned');
check(read('supabase/migrations/20261013065943_reverse_matching_rpc_prototype.sql')
  .includes("interval '60 seconds'"), '60-second offer window is database-owned');
const lifecycle = read('supabase/migrations/20261014004500_reverse_matching_lifecycle_cleanup.sql');
check(lifecycle.includes('auto_created_post boolean not null default false'), 'automatic offer posts are explicitly marked');
check(lifecycle.includes('retire_reverse_offer_post'), 'terminal offers retire automatic posts');
check(lifecycle.includes("set status = 'cancelled'"), 'orphan posts become non-discoverable');
check(lifecycle.includes('delete from public.parking_post_locations'), 'unclaimed offer coordinates are deleted');
check(lifecycle.includes("'* * * * *'"), 'cleanup is scheduled independently of clients');
check(read('supabase/migrations/20261014010500_reverse_matching_offer_notification_idempotency.sql')
  .includes("'parking_match_offer:' || offer_row.id::text"), 'each offer has an independent notification key');

console.log('Reverse matching checks passed (' + assertions + ' assertions).');
