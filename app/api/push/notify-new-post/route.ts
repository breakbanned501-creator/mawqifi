import { NextResponse } from 'next/server';
import {
  configureWebPush,
  deliverPushNotifications,
  PushConfigurationError,
} from '@/lib/push-server';
import { getRequestUser, getSupabaseServiceRole } from '@/lib/supabase-server';

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

    // Validate configuration before recording an idempotency event. That keeps a
    // post eligible for delivery once a missing production configuration is fixed.
    configureWebPush();

    const { error: eventError } = await supabase
      .from('push_notification_events')
      .insert({ post_id: post.id, creator_id: user.id });
    if (eventError?.code === '23505') {
      return NextResponse.json({ success: true, duplicate: true, sentCount: 0 });
    }
    if (eventError) throw eventError;

    const zoneLabel = post.zone === 'A' ? 'المنطقة A' : 'المنطقة B';
    const delivery = await deliverPushNotifications({
      excludeUserId: user.id,
      payload: {
        title: 'موقف جديد متاح 🚗',
        body: `تم نشر موقف جديد في ${post.college} — ${zoneLabel}${post.gate ? ` — ${post.gate}` : ''} (يغادر خلال ${post.departure_minutes} د)`,
        url: `/post/${post.id}`,
        postId: post.id,
        type: 'parking_post',
      },
    });
    return NextResponse.json({ success: true, sentCount: delivery.sentCount });
  } catch (error) {
    if (error instanceof PushConfigurationError) {
      console.error('Push notification configuration is incomplete.');
      return NextResponse.json({ success: false, warning: 'إعداد الإشعارات غير مكتمل.' }, { status: 503 });
    }
    console.error('Error sending new-post push notification.');
    return NextResponse.json({ error: 'تعذر إرسال إشعار الموقف الجديد.' }, { status: 500 });
  }
}
