import { NextResponse } from 'next/server';
import webPush from 'web-push';
import { getRequestUser, getSupabaseServiceRole } from '@/lib/supabase-server';

type Subscription = { id: string; endpoint: string; p256dh: string; auth: string };

export async function POST(request: Request) {
  try {
    const user = await getRequestUser(request);
    if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول لنشر الموقف.' }, { status: 401 });

    const { postId } = (await request.json()) as { postId?: unknown };
    if (typeof postId !== 'string' || !/^[0-9a-f-]{36}$/i.test(postId)) {
      return NextResponse.json({ error: 'معرّف الموقف غير صالح.' }, { status: 400 });
    }

    const supabase = getSupabaseServiceRole();
    const { data: post, error: postError } = await supabase
      .from('parking_posts')
      .select('id, user_id, college, zone, gate, departure_minutes, status')
      .eq('id', postId)
      .maybeSingle();
    if (postError) throw postError;
    if (!post) return NextResponse.json({ error: 'الموقف غير موجود.' }, { status: 404 });
    if (post.user_id !== user.id) return NextResponse.json({ error: 'غير مصرح بإرسال هذا التنبيه.' }, { status: 403 });
    if (post.status !== 'active') return NextResponse.json({ error: 'الموقف غير نشط.' }, { status: 400 });

    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
    const vapidSubject = process.env.VAPID_SUBJECT;
    if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
      console.error('VAPID environment variables are incomplete.');
      return NextResponse.json({ success: false, warning: 'إعداد الإشعارات غير مكتمل.' }, { status: 503 });
    }

    const { error: eventError } = await supabase
      .from('push_notification_events')
      .insert({ post_id: post.id, creator_id: user.id });
    if (eventError?.code === '23505') {
      return NextResponse.json({ success: true, duplicate: true, sentCount: 0 });
    }
    if (eventError) throw eventError;

    webPush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

    const { data: subscriptions, error: subscriptionsError } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('active', true)
      .neq('user_id', user.id);
    if (subscriptionsError) throw subscriptionsError;

    const zoneLabel = post.zone === 'A' ? 'المنطقة A' : 'المنطقة B';
    const payload = JSON.stringify({
      title: 'موقف جديد متاح 🚗',
      body: `تم نشر موقف جديد في ${post.college} — ${zoneLabel}${post.gate ? ` — ${post.gate}` : ''} (يغادر خلال ${post.departure_minutes} د)`,
      url: `/post/${post.id}`,
      postId: post.id,
    });
    const staleSubscriptionIds: string[] = [];
    let sentCount = 0;

    await Promise.all(
      ((subscriptions ?? []) as Subscription[]).map(async (subscription) => {
        try {
          await webPush.sendNotification(
            { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
            payload,
          );
          sentCount += 1;
        } catch (error) {
          const statusCode = (error as { statusCode?: number }).statusCode;
          if (statusCode === 404 || statusCode === 410) staleSubscriptionIds.push(subscription.id);
          console.error('Push delivery failed:', statusCode ?? 'unknown');
        }
      }),
    );

    if (staleSubscriptionIds.length) {
      await supabase.from('push_subscriptions').update({ active: false }).in('id', staleSubscriptionIds);
    }

    return NextResponse.json({ success: true, sentCount });
  } catch (error) {
    console.error('Error sending new-post push notification:', error);
    return NextResponse.json({ error: 'تعذر إرسال إشعار الموقف الجديد.' }, { status: 500 });
  }
}
