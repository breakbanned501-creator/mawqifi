import { NextResponse } from 'next/server';
import { nativeApiOptions, withNativeApiCorsHandler } from '@/lib/native-api-cors';
import {
  configureWebPush,
  deliverPushNotifications,
  PushConfigurationError,
} from '@/lib/push-server';
import { getRequestUser, getSupabaseServiceRole } from '@/lib/supabase-server';
import { formatGate, formatZone, getCollegeName } from '@/lib/university';

type StoredParkingPost = {
  id: string;
  user_id: string;
  college: string;
  zone: 'A' | 'B';
  gate: string;
  departure_minutes: number;
  status: string;
};

export async function OPTIONS(request: Request) {
  return nativeApiOptions(request);
}

export async function POST(request: Request) {
  return withNativeApiCorsHandler(request, async () => {
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

    const storedPost = post as StoredParkingPost;
    const delivery = await deliverPushNotifications({
      excludeUserId: user.id,
      notificationType: 'parking_post',
      payloadForLocale: (locale) => {
        const location = [
          getCollegeName(storedPost.college, locale),
          formatZone(storedPost.zone, locale),
          storedPost.gate ? formatGate(storedPost.gate, locale) : '',
        ]
          .filter(Boolean)
          .join(' — ');
        const departure = locale === 'ar'
          ? `يغادر خلال ${storedPost.departure_minutes} د`
          : `leaving in ${storedPost.departure_minutes} min`;

        return {
          title: locale === 'ar' ? 'موقف جديد متاح 🚗' : 'New parking spot available 🚗',
          body: locale === 'ar'
            ? `تم نشر موقف جديد في ${location} (${departure})`
            : `A new parking spot was posted at ${location} (${departure})`,
          url: `/post/${storedPost.id}`,
          postId: storedPost.id,
          type: 'parking_post',
          lang: locale,
          dir: locale === 'ar' ? 'rtl' : 'ltr',
        };
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
  });
}
