import { NextResponse } from 'next/server';
import { nativeApiOptions, withNativeApiCorsHandler } from '@/lib/native-api-cors';
import { configurePushDelivery, deliverPushNotifications, PushConfigurationError } from '@/lib/push-server';
import { getRequestUser, getSupabaseServiceRole } from '@/lib/supabase-server';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Offer = {
  id: string;
  request_id: string;
  requester_id: string;
  departing_user_id: string;
  status: string;
  post_id: string;
  distance_meters: number | null;
};
type ParkingRequest = { id: string; requester_id: string; status: string };
type ParkingPost = { id: string; user_id: string; sub_place_id: string | null };
type Claim = {
  conversation_id: string;
  owner_id: string;
  claimant_id: string;
  status: string;
  chat_closes_at: string | null;
};
type Conversation = {
  id: string;
  post_id: string;
  owner_id: string;
  requester_id: string;
  closed: boolean;
};

export async function OPTIONS(request: Request) {
  return nativeApiOptions(request);
}

export async function POST(request: Request) {
  return withNativeApiCorsHandler(request, async () => {
    let failureStage = 'authorization';
    try {
      const user = await getRequestUser(request);
      if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

      const body = await request.json() as { offerId?: unknown };
      if (typeof body.offerId !== 'string' || !UUID.test(body.offerId)) {
        return NextResponse.json({ error: 'Invalid offer' }, { status: 400 });
      }

      const db = getSupabaseServiceRole();
      const { data: offerData, error: offerError } = await db.from('parking_match_offers')
        .select('id,request_id,requester_id,departing_user_id,status,post_id,distance_meters')
        .eq('id', body.offerId)
        .maybeSingle();
      if (offerError) throw offerError;

      const offer = offerData as Offer | null;
      if (!offer || offer.departing_user_id !== user.id) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
      if (offer.status !== 'accepted') {
        return NextResponse.json({ error: 'Offer expired' }, { status: 410 });
      }

      const { data: requestData, error: requestError } = await db.from('parking_requests')
        .select('id,requester_id,status')
        .eq('id', offer.request_id)
        .maybeSingle();
      if (requestError) throw requestError;
      const parkingRequest = requestData as ParkingRequest | null;
      if (!parkingRequest || parkingRequest.requester_id !== offer.requester_id || parkingRequest.status !== 'matched') {
        return NextResponse.json({ error: 'Offer relationship is invalid' }, { status: 409 });
      }

      const { data: postData, error: postError } = await db.from('parking_posts')
        .select('id,user_id,sub_place_id')
        .eq('id', offer.post_id)
        .maybeSingle();
      if (postError) throw postError;
      const parkingPost = postData as ParkingPost | null;
      if (!parkingPost || parkingPost.user_id !== offer.departing_user_id || parkingPost.user_id === parkingRequest.requester_id) {
        return NextResponse.json({ error: 'Offer relationship is invalid' }, { status: 409 });
      }

      const { data: claimData, error: claimError } = await db.from('parking_claims')
        .select('conversation_id,owner_id,claimant_id,status,chat_closes_at')
        .eq('post_id', parkingPost.id)
        .maybeSingle();
      if (claimError) throw claimError;
      const claim = claimData as Claim | null;
      if (!claim || claim.owner_id !== parkingPost.user_id || claim.claimant_id !== parkingRequest.requester_id) {
        return NextResponse.json({ error: 'Offer relationship is invalid' }, { status: 409 });
      }
      if (claim.status === 'cancelled' || claim.status === 'completed' ||
        claim.chat_closes_at === null || Date.parse(claim.chat_closes_at) <= Date.now()) {
        return NextResponse.json({ error: 'Match expired' }, { status: 410 });
      }

      const { data: conversationData, error: conversationError } = await db.from('conversations')
        .select('id,post_id,owner_id,requester_id,closed')
        .eq('id', claim.conversation_id)
        .maybeSingle();
      if (conversationError) throw conversationError;
      const conversation = conversationData as Conversation | null;
      if (!conversation || conversation.post_id !== parkingPost.id ||
        conversation.owner_id !== parkingPost.user_id || conversation.requester_id !== parkingRequest.requester_id) {
        return NextResponse.json({ error: 'Offer relationship is invalid' }, { status: 409 });
      }
      if (conversation.closed) return NextResponse.json({ error: 'Match expired' }, { status: 410 });

      // Validate delivery configuration before claiming this idempotency key.
      failureStage = 'push_configuration';
      configurePushDelivery();
      failureStage = 'event_deduplication';
      const { error: eventError } = await db.from('push_notification_events').insert({
        request_id: parkingRequest.id,
        creator_id: user.id,
        recipient_id: parkingPost.user_id,
      });
      if (eventError?.code === '23505') {
        console.info('Targeted offer push skipped.', {
          notificationType: 'parking_match_offer',
          reason: 'event_already_recorded',
        });
        return NextResponse.json({
          success: false,
          duplicate: true,
          deliveryStatus: 'already_recorded',
          sentCount: 0,
        }, { status: 409 });
      }
      if (eventError) throw eventError;

      const area = String(parkingPost.sub_place_id ?? '').replaceAll('_', ' ');
      const distance = offer.distance_meters == null ? '' : ` · ${Math.round(offer.distance_meters)} m`;
      const url = `/post/${encodeURIComponent(parkingPost.id)}?chat=${encodeURIComponent(conversation.id)}`;
      failureStage = 'push_delivery';
      const result = await deliverPushNotifications({
        notificationType: 'parking_match_offer',
        recipientUserId: parkingPost.user_id,
        payloadForLocale: (locale) => ({
          title: locale === 'ar' ? 'تم ربط موقفك بطلب' : 'Your spot was matched',
          body: locale === 'ar'
            ? `طلب موقفك في ${area}${distance}. افتح المحادثة لمتابعة التسليم.`
            : `Your spot was matched in ${area}${distance}. Open the chat to continue the handoff.`,
          url,
          type: 'parking_match_offer',
          postId: parkingPost.id,
          chatId: conversation.id,
          lang: locale,
          dir: locale === 'ar' ? 'rtl' : 'ltr',
        }),
      });

      if (result.failedCount > 0) {
        const deliveryStatus = result.sentCount > 0 ? 'partial' : 'failed';
        console.error('Targeted offer push delivery incomplete.', {
          notificationType: 'parking_match_offer',
          deliveryStatus,
          attemptedCount: result.attemptedCount,
          sentCount: result.sentCount,
          failedCount: result.failedCount,
        });
        return NextResponse.json({
          success: false,
          deliveryStatus,
          sentCount: result.sentCount,
          failedCount: result.failedCount,
        }, { status: 502 });
      }

      if (result.eligibleCount === 0) {
        console.warn('Targeted offer push had no eligible devices.', {
          notificationType: 'parking_match_offer',
        });
        return NextResponse.json({
          success: false,
          deliveryStatus: 'no_eligible_devices',
          sentCount: 0,
          failedCount: 0,
        }, { status: 503 });
      }

      return NextResponse.json({
        success: true,
        deliveryStatus: 'sent',
        sentCount: result.sentCount,
        failedCount: 0,
      });
    } catch (error) {
      if (error instanceof PushConfigurationError) {
        console.error('Targeted offer push failed.', {
          notificationType: 'parking_match_offer',
          failureStage,
          errorName: error.name,
        });
        return NextResponse.json({ error: 'Notifications unavailable' }, { status: 503 });
      }
      console.error('Targeted offer push failed.', {
        notificationType: 'parking_match_offer',
        failureStage,
        errorName: error instanceof Error ? error.name : 'unknown',
      });
      return NextResponse.json({ error: 'Unable to send notification' }, { status: 500 });
    }
  });
}
