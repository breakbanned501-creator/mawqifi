import { NextResponse } from 'next/server';
import { nativeApiOptions, withNativeApiCorsHandler } from '@/lib/native-api-cors';
import { configurePushDelivery, deliverPushNotifications, PushConfigurationError } from '@/lib/push-server';
import { getRequestUser, getSupabaseServiceRole } from '@/lib/supabase-server';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Offer = { id: string; requester_id: string; departing_user_id: string; status: string; expires_at: string; post_id: string; distance_meters: number | null };
type Claim = { conversation_id: string; status: string; chat_closes_at: string | null };
export async function OPTIONS(request: Request) { return nativeApiOptions(request); }
export async function POST(request: Request) {
  return withNativeApiCorsHandler(request, async () => {
    try {
      const user = await getRequestUser(request);
      if (!user) return NextResponse.json({error:'Unauthorized'},{status:401});
      const body = await request.json() as {offerId?: unknown};
      if (typeof body.offerId !== 'string' || !UUID.test(body.offerId))
        return NextResponse.json({error:'Invalid offer'},{status:400});
      const db = getSupabaseServiceRole();
      const {data, error} = await db.from('parking_match_offers')
        .select('id,requester_id,departing_user_id,status,expires_at,post_id,distance_meters')
        .eq('id',body.offerId).maybeSingle();
      if (error) throw error;
      const offer = data as Offer | null;
      if (!offer || offer.departing_user_id !== user.id)
        return NextResponse.json({error:'Not found'},{status:404});
      if (offer.status !== 'accepted')
        return NextResponse.json({error:'Offer expired'},{status:410});
      const {data:post,error:postError}=await db.from('parking_posts')
        .select('sub_place_id').eq('id',offer.post_id).single();
      if(postError) throw postError;
      const {data:claim,error:claimError}=await db.from('parking_claims')
        .select('conversation_id,status,chat_closes_at').eq('post_id',offer.post_id).single();
      if(claimError) throw claimError;
      const activeClaim=claim as Claim;
      if(activeClaim.status==='cancelled'||activeClaim.status==='completed'||
        activeClaim.chat_closes_at===null||Date.parse(activeClaim.chat_closes_at)<=Date.now())
        return NextResponse.json({error:'Match expired'},{status:410});
      const {data:conversation,error:conversationError}=await db.from('conversations')
        .select('closed').eq('id',activeClaim.conversation_id).single();
      if(conversationError) throw conversationError;
      if(conversation.closed) return NextResponse.json({error:'Match expired'},{status:410});
      const area=String(post?.sub_place_id??'').replaceAll('_',' ');
      const distance=offer.distance_meters==null?'':` · ${Math.round(offer.distance_meters)} m`;
      const url=`/post/${offer.post_id}?chat=${activeClaim.conversation_id}`;
      configurePushDelivery();
      const {error: eventError} = await db.from('parking_match_push_events').insert({offer_id:offer.id});
      if (eventError?.code === '23505') return NextResponse.json({success:true,duplicate:true});
      if (eventError) throw eventError;
      const result = await deliverPushNotifications({
        notificationType:'parking_match_offer', recipientUserId:offer.requester_id,
        excludeUserId:user.id,
        payloadForLocale:(locale)=>({
          title:locale==='ar'?'حصلنا لك موقف!':'We found you a parking spot!',
          body:locale==='ar'?`الموقع: ${area}${distance} — افتح المحادثة والموقع`:`Area: ${area}${distance} — open chat and location`,
          url,type:'parking_match_offer',postId:offer.post_id,chatId:activeClaim.conversation_id,
          lang:locale,dir:locale==='ar'?'rtl':'ltr',
        }),
      });
      if (result.sentCount === 0) {
        await db.from('parking_match_push_events').delete().eq('offer_id', offer.id);
      }
      return NextResponse.json({success:true,sentCount:result.sentCount});
    } catch (e) {
      if (e instanceof PushConfigurationError)
        return NextResponse.json({error:'Notifications unavailable'},{status:503});
      console.error('Targeted offer push failed', {errorName:e instanceof Error?e.name:'unknown'});
      return NextResponse.json({error:'Unable to send notification'},{status:500});
    }
  });
}
