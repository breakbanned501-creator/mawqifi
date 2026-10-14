const assert = require('node:assert/strict');
const { createClient } = require('@supabase/supabase-js');

const url = process.env.STAGING_SUPABASE_URL;
const key = process.env.STAGING_SUPABASE_KEY;
const previewUrl = process.env.STAGING_PREVIEW_URL;
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
  const { data: profile, error: profileReadError } = await db.from('users')
    .select('id').eq('id', data.user.id).maybeSingle();
  assert.ifError(profileReadError);
  if (!profile) {
    const { error: profileError } = await db.from('users').insert({
      id: data.user.id,
      username: 'Reverse test ' + label,
      is_guest: true,
    });
    assert.ifError(profileError);
  }
  return { label, id: data.user.id, accessToken: data.session.access_token, db };
}

async function rpc(actor, name, args = {}) {
  const { data, error } = await actor.db.rpc(name, args);
  if (error) throw Object.assign(new Error(error.message), { code: error.code });
  return data;
}

async function main() {
  const [requester, giverA, giverB, outsider] = await Promise.all(
    ['requester', 'giver-a', 'giver-b', 'outsider'].map(createUser),
  );
  const users = [requester, giverA, giverB, outsider];
  const lat = 29.323;
  const lng = 48.083;

  const request = await rpc(requester, 'create_parking_request', {
    p_place_id: 'gust', p_sub_place_id: null,
    p_lat: lat, p_lng: lng, p_accuracy: 8,
  });
  assert.equal(request.status, 'active');
  assert.ok(Date.parse(request.expires_at) - Date.parse(request.created_at) >= 899000);

  const { data: hiddenRequests, error: hiddenError } = await outsider.db
    .from('parking_requests').select('id').eq('id', request.id);
  assert.ifError(hiddenError);
  assert.deepEqual(hiddenRequests, []);

  const { error: coordinateError } = await outsider.db
    .schema('mawqifi_safety').from('parking_request_coordinates').select('*').eq('request_id', request.id);
  assert.ok(coordinateError, 'private request coordinates are not exposed');

  const list = await rpc(giverA, 'nearby_parking_requests', {
    p_place_id: 'gust', p_sub_place_id: null,
    p_lat: lat + 0.00015, p_lng: lng, p_accuracy: 8, p_limit: 20,
  });
  assert.equal(list[0]?.id, request.id);
  assert.equal(Object.hasOwn(list[0], 'latitude'), false);
  assert.equal(Object.hasOwn(list[0], 'longitude'), false);

  const offerArgsA = {
    p_request_id: request.id, p_place_id: 'gust', p_sub_place_id: null,
    p_lat: lat + 0.0001, p_lng: lng, p_accuracy: 8,
  };
  const offerArgsB = { ...offerArgsA, p_lat: lat + 0.0002 };
  const race = await Promise.allSettled([
    rpc(giverA, 'give_parking_to_request', offerArgsA),
    rpc(giverB, 'give_parking_to_request', offerArgsB),
  ]);
  const fulfilled = race.filter(item => item.status === 'fulfilled');
  const rejected = race.filter(item => item.status === 'rejected');
  assert.equal(fulfilled.length, 1, 'one atomic offer wins');
  assert.equal(rejected.length, 1, 'one racing offer is rejected');

  const winner = race[0].status === 'fulfilled' ? giverA : giverB;
  const loser = winner === giverA ? giverB : giverA;
  const offer = fulfilled[0].value;
  const mine = await rpc(requester, 'my_parking_request');
  assert.equal(mine.offer.id, offer.offer_id);
  assert.equal(mine.offer.status, 'pending');
  assert.ok(Date.parse(mine.offer.expires_at) - Date.parse(mine.server_now) <= 60000);

  await assert.rejects(
    () => rpc(outsider, 'accept_parking_offer', { p_offer_id: offer.offer_id }),
    /OFFER_NOT_ALLOWED/,
  );

  const accepted = await rpc(requester, 'accept_parking_offer', { p_offer_id: offer.offer_id });
  assert.equal(accepted.claim.claimant_id, requester.id);
  assert.equal(accepted.claim.owner_id, winner.id);
  assert.ok(accepted.claim.conversation_id);
  assert.ok(accepted.location && Number.isFinite(accepted.location.latitude));

  const repeated = await rpc(requester, 'accept_parking_offer', { p_offer_id: offer.offer_id });
  assert.equal(repeated.claim.conversation_id, accepted.claim.conversation_id);

  await assert.rejects(
    () => rpc(outsider, 'get_parking_handoff', { conversation_id: accepted.claim.conversation_id }),
  );
  const winnerState = await rpc(winner, 'get_parking_handoff', {
    conversation_id: accepted.claim.conversation_id,
  });
  assert.ok(winnerState.location && winnerState.claim.conversation_id === accepted.claim.conversation_id);

  const { data: loserPost } = await loser.db.from('parking_posts')
    .select('id').eq('user_id', loser.id);
  assert.equal(loserPost?.length ?? 0, 0, 'losing atomic transaction creates no post');

  const declineRequest = await rpc(outsider, 'create_parking_request', {
    p_place_id: 'gust', p_sub_place_id: null,
    p_lat: lat, p_lng: lng, p_accuracy: 8,
  });
  assert.equal(declineRequest.status, 'active');
  const declineOffer = await rpc(loser, 'give_parking_to_request', {
    p_request_id: declineRequest.id, p_place_id: 'gust', p_sub_place_id: null,
    p_lat: lat + 0.0001, p_lng: lng, p_accuracy: 8,
  });
  const { data: markedOffer, error: markedOfferError } = await loser.db.from('parking_match_offers')
    .select('auto_created_post').eq('id', declineOffer.offer_id).single();
  assert.ifError(markedOfferError);
  assert.equal(markedOffer.auto_created_post, true, 'GPS offer post is marked automatic');
  if (previewUrl) {
    const response = await fetch(new URL('/api/push/notify-match-offer', previewUrl), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + loser.accessToken },
      body: JSON.stringify({ offerId: declineOffer.offer_id }),
    });
    const result = await response.json();
    assert.equal(response.status, 200, 'targeted staging notification endpoint accepts authorized offer');
    assert.equal(result.success, true, 'targeted staging notification path completes');
  }
  assert.equal(await rpc(outsider, 'decline_parking_offer', { p_offer_id: declineOffer.offer_id }), true);
  const reopened = await rpc(outsider, 'my_parking_request');
  assert.equal(reopened.request.status, 'active');
  const { data: declinedPost, error: declinedPostError } = await loser.db.from('parking_posts')
    .select('id').eq('id', declineOffer.post_id);
  assert.ifError(declinedPostError);
  assert.equal(declinedPost.length, 0, 'declined automatic post leaves authenticated discovery');
  const { data: declinedLocation, error: declinedLocationError } = await loser.db.from('parking_post_locations')
    .select('post_id').eq('post_id', declineOffer.post_id);
  assert.ifError(declinedLocationError);
  assert.equal(declinedLocation.length, 0, 'declined automatic post coordinate is deleted');

  const cancelledOffer = await rpc(loser, 'give_parking_to_request', {
    p_request_id: declineRequest.id, p_place_id: 'gust', p_sub_place_id: null,
    p_lat: lat + 0.0001, p_lng: lng, p_accuracy: 8,
  });
  assert.equal(await rpc(outsider, 'cancel_parking_request', { p_request_id: declineRequest.id }), true);
  const { data: cancelledPost, error: cancelledPostError } = await loser.db.from('parking_posts')
    .select('id').eq('id', cancelledOffer.post_id);
  assert.ifError(cancelledPostError);
  assert.equal(cancelledPost.length, 0, 'cancelled automatic post leaves authenticated discovery');
  const { data: cancelledLocation, error: cancelledLocationError } = await loser.db.from('parking_post_locations')
    .select('post_id').eq('post_id', cancelledOffer.post_id);
  assert.ifError(cancelledLocationError);
  assert.equal(cancelledLocation.length, 0, 'cancelled automatic post coordinate is deleted');
  const { data: offerNotifications, error: notificationError } = await outsider.db.from('app_notifications')
    .select('data').eq('kind', 'system');
  assert.ifError(notificationError);
  const matchingNotifications = offerNotifications.filter(item =>
    String(item.data?.event_key ?? '').startsWith('parking_match_offer:'),
  );
  assert.ok(matchingNotifications.length >= 2, 'repeated legitimate offers each persist a notification');
  assert.equal(new Set(matchingNotifications.map(item => item.data.event_key)).size,
    matchingNotifications.length, 'offer notification keys are unique');

  console.log(JSON.stringify({
    pass: true,
    user_ids: users.map(user => user.id),
    request_id: request.id,
    offer_id: offer.offer_id,
    conversation_id: accepted.claim.conversation_id,
    winner: winner.label,
    assertions: previewUrl ? 32 : 30,
  }));
}

main().catch(error => {
  console.error(JSON.stringify({ pass: false, message: error.message, code: error.code ?? null }));
  process.exitCode = 1;
});
