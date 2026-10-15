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
check(!screen.includes("accept_parking_offer") && !screen.includes("decline_parking_offer"), 'extra accept/decline step removed');
check(screen.includes("Date.parse(myRequest.request.expires_at)"), 'request expiry uses server timestamp');
check(screen.includes("p_auto_match: true"), 'requester explicitly opts into automatic matching');
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
check(route.includes("activeClaim.chat_closes_at===null") && route.includes("status:410"), 'expired matches cannot dispatch delayed push');
check(route.includes("chatId:activeClaim.conversation_id"), 'native match payload carries the direct conversation route');
const chatRoute = read('app/api/push/notify-chat-message/route.ts');
check(chatRoute.includes('recipientId === user.id'), 'chat push rejects self-notification');
check(chatRoute.includes("claim.status === 'cancelled'") && chatRoute.includes("status: 410"), 'closed or expired chats cannot dispatch delayed push');
check(chatRoute.includes('chatId: conversation.id'), 'native chat payload carries the direct conversation route');

const migrationNames = fs.readdirSync(path.join(root, 'supabase/migrations'))
  .filter(name => name.includes('reverse_matching'));
check(migrationNames.length === 12, 'direct automatic-match migration recorded after prototype hardening');
check(read('supabase/migrations/20261013074503_harden_reverse_matching_discovery.sql')
  .includes('order by meters, created_at, id'), 'nearest-first server ordering');
check(read('supabase/migrations/20261013063644_reverse_matching_requests_offers_foundation.sql')
  .includes("interval '15 minutes'"), '15-minute request lifetime is database-owned');
const direct = read('supabase/migrations/20261015034200_reverse_matching_direct_auto_match.sql');
check(direct.includes('auto_match boolean not null default false'), 'automatic matching requires stored opt-in');
check(direct.includes("status = 'matched'"), 'request becomes matched in the give transaction');
check(direct.includes('insert into public.conversations'), 'private conversation is created atomically');
check(direct.includes('cancel_reverse_match'), 'participants have a server-side unmatch action');
const directChat = read('supabase/migrations/20261015043000_reverse_match_sixty_minute_chat.sql');
check(directChat.includes("claimed_at + interval '60 minutes'"), 'direct match chat receives a server-owned 60-minute deadline');
check(directChat.includes("claim.status = 'claimed'"), 'scheduled closure does not complete the handoff claim');
check(directChat.includes('HANDOFF_ARRIVAL_NOT_REQUIRED'), 'reverse matches reject legacy arrival transitions');
const lifecycle = read('supabase/migrations/20261014004500_reverse_matching_lifecycle_cleanup.sql');
check(lifecycle.includes('auto_created_post boolean not null default false'), 'automatic offer posts are explicitly marked');
check(lifecycle.includes('retire_reverse_offer_post'), 'terminal offers retire automatic posts');
check(lifecycle.includes("set status = 'cancelled'"), 'orphan posts become non-discoverable');
check(lifecycle.includes('delete from public.parking_post_locations'), 'unclaimed offer coordinates are deleted');
check(lifecycle.includes("'* * * * *'"), 'cleanup is scheduled independently of clients');
check(read('supabase/migrations/20261014010500_reverse_matching_offer_notification_idempotency.sql')
  .includes("'parking_match_offer:' || offer_row.id::text"), 'each offer has an independent notification key');

console.log('Reverse matching checks passed (' + assertions + ' assertions).');
