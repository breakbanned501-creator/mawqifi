const assert = require('node:assert/strict');
const { createClient } = require('@supabase/supabase-js');

const url = process.env.STAGING_SUPABASE_URL;
const key = process.env.STAGING_SUPABASE_KEY;
assert.equal(new URL(url).hostname, 'jrmiwmsgnztqwbigumlw.supabase.co');
assert.ok(key);

const client = () => createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

async function createUser(label) {
  const db = client();
  const { data, error } = await db.auth.signInAnonymously();
  assert.ifError(error);
  assert.ok(data.user && data.session, label + ' anonymous session');
  const { data: profile, error: readError } = await db.from('users')
    .select('id').eq('id', data.user.id).maybeSingle();
  assert.ifError(readError);
  if (!profile) {
    const { error: insertError } = await db.from('users').insert({
      id: data.user.id, username: 'Direct match test ' + label, is_guest: true,
    });
    assert.ifError(insertError);
  }
  return { label, id: data.user.id, db };
}
async function rpc(actor, name, args = {}) {
  const { data, error } = await actor.db.rpc(name, args);
  if (error) throw Object.assign(new Error(error.message), { code: error.code });
  return data;
}
async function denied(fn, label) {
  await assert.rejects(fn, undefined, label);
}
async function main() {
  const [requester, giverA, giverB, outsider, legacy] = await Promise.all(
    ['requester','giver-a','giver-b','outsider','legacy'].map(createUser),
  );
  const lat = 29.323;
  const lng = 48.083;

  const legacyRequest = await rpc(legacy, 'create_parking_request', {
    p_place_id:'gust', p_sub_place_id:null, p_lat:lat, p_lng:lng,
    p_accuracy:8, p_auto_match:false,
  });
  const hiddenLegacy = await rpc(outsider, 'nearby_parking_requests', {
    p_place_id:'gust', p_sub_place_id:null, p_lat:lat, p_lng:lng,
    p_accuracy:8, p_limit:20,
  });
  assert.ok(!hiddenLegacy.some(item => item.id === legacyRequest.id),
    'requests without auto-match opt-in stay undiscoverable');
  await rpc(legacy, 'cancel_parking_request', { p_request_id:legacyRequest.id });

  const request = await rpc(requester, 'create_parking_request', {
    p_place_id:'gust', p_sub_place_id:null, p_lat:lat, p_lng:lng,
    p_accuracy:8, p_auto_match:true,
  });
  assert.equal(request.auto_match, true);
  const nearby = await rpc(giverA, 'nearby_parking_requests', {
    p_place_id:'gust', p_sub_place_id:null, p_lat:lat + 0.0001, p_lng:lng,
    p_accuracy:8, p_limit:20,
  });
  const visibleRequest = nearby.find(item => item.id === request.id);
  assert.ok(visibleRequest, 'opted-in request is discoverable');
  assert.equal(Object.hasOwn(visibleRequest, 'latitude'), false);
  assert.equal(Object.hasOwn(visibleRequest, 'longitude'), false);

  const args = {
    p_request_id:request.id, p_place_id:'gust', p_sub_place_id:null,
    p_lat:lat + 0.0001, p_lng:lng, p_accuracy:8,
  };
  const race = await Promise.allSettled([
    rpc(giverA, 'give_parking_to_request', args),
    rpc(giverB, 'give_parking_to_request', {...args, p_lat:lat + 0.0002}),
  ]);
  const wins = race.filter(result => result.status === 'fulfilled');
  assert.equal(wins.length, 1, 'exactly one concurrent giver wins: ' + race.map(result =>
    result.status === 'rejected' ? result.reason.message : 'success').join(', '));
  const handoff = wins[0].value;
  assert.ok(handoff.post_id && handoff.conversation_id && handoff.offer_id);
  const winner = race[0].status === 'fulfilled' ? giverA : giverB;

  const mine = await rpc(requester, 'my_parking_request');
  assert.equal(mine.request.status, 'matched');
  assert.equal(mine.offer.status, 'accepted');
  assert.equal(mine.offer.conversation_id, handoff.conversation_id);

  const requesterState = await rpc(requester, 'get_parking_handoff', {
    conversation_id:handoff.conversation_id,
  });
  const ownerState = await rpc(winner, 'get_parking_handoff', {
    conversation_id:handoff.conversation_id,
  });
  assert.equal(requesterState.claim.claimant_id, requester.id);
  assert.equal(ownerState.claim.owner_id, winner.id);
  assert.equal(requesterState.reverse_match, true);
  assert.equal(requesterState.claim.reverse_match, true);
  assert.equal(requesterState.claim.arrived_at, null);
  assert.equal(
    Date.parse(requesterState.claim.chat_closes_at) - Date.parse(requesterState.claim.claimed_at),
    60 * 60 * 1000,
    'reverse-match chat closes 60 minutes after the server claim time',
  );
  await denied(
    () => rpc(requester, 'arrive_parking_handoff', {
      conversation_id:handoff.conversation_id, manual:true,
    }),
    'reverse match has no manual arrival transition',
  );
  assert.ok(Number.isFinite(requesterState.location.latitude));
  await denied(
    () => rpc(outsider, 'get_parking_handoff', {conversation_id:handoff.conversation_id}),
    'unrelated user cannot read private handoff',
  );
  const { data: leaked, error: leakError } = await outsider.db
    .from('parking_post_locations').select('post_id').eq('post_id',handoff.post_id);
  assert.ifError(leakError);
  assert.deepEqual(leaked, []);

  assert.equal(await rpc(requester, 'cancel_reverse_match', {
    p_conversation_id:handoff.conversation_id,
  }), true);
  const closed = await rpc(requester, 'get_parking_handoff', {
    conversation_id:handoff.conversation_id,
  });
  assert.equal(closed.claim.status, 'cancelled');
  const { data: conversation, error: conversationError } = await requester.db
    .from('conversations').select('id,closed').eq('id',handoff.conversation_id).single();
  assert.ifError(conversationError);
  assert.equal(conversation.closed, true, 'cancel keeps the conversation as read-only history');

  console.log(JSON.stringify({
    pass:true, assertions:23, conversation_id:handoff.conversation_id,
    test_user_count:5,
  }));
}
main().catch(error => {
  console.error(JSON.stringify({pass:false,message:error.message,code:error.code ?? null}));
  process.exitCode = 1;
});
