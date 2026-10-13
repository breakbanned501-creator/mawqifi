import { NextResponse } from 'next/server';
import { nativeApiOptions, withNativeApiCorsHandler } from '@/lib/native-api-cors';
import { configurePushDelivery, deliverPushNotifications, PushConfigurationError } from '@/lib/push-server';
import { getRequestUser, getSupabaseServiceRole } from '@/lib/supabase-server';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Offer = { id: string; requester_id: string; departing_user_id: string; status: string; expires_at: string };
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
        .select('id,requester_id,departing_user_id,status,expires_at')
        .eq('id',body.offerId).maybeSingle();
      if (error) throw error;
      const offer = data as Offer | null;
      if (!offer || offer.departing_user_id !== user.id)
        return NextResponse.json({error:'Not found'},{status:404});
      if (offer.status !== 'pending' || Date.parse(offer.expires_at) <= Date.now())
        return NextResponse.json({error:'Offer expired'},{status:410});
      configurePushDelivery();
      const {error: eventError} = await db.from('parking_match_push_events').insert({offer_id:offer.id});
      if (eventError?.code === '23505') return NextResponse.json({success:true,duplicate:true});
      if (eventError) throw eventError;
      const result = await deliverPushNotifications({
        notificationType:'parking_match_offer', recipientUserId:offer.requester_id,
        payloadForLocale:(locale)=>({
          title:locale==='ar'?'شخص قريب يبي يعطيك موقف 🚗':'Someone nearby offers you a spot 🚗',
          body:locale==='ar'?'افتح موقفي خلال دقيقة وقرر إذا يناسبك':'Open Mawqifi within a minute to accept or decline',
          url:'/',type:'parking_match_offer',lang:locale,dir:locale==='ar'?'rtl':'ltr',
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
