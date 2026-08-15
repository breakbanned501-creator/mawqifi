import { NextResponse } from 'next/server';
import { getRequestUser, getSupabaseServiceRole } from '@/lib/supabase-server';

type SubscriptionPayload = {
  endpoint?: unknown;
  p256dh?: unknown;
  auth?: unknown;
};

function isValidSubscription(payload: SubscriptionPayload): payload is Required<SubscriptionPayload> {
  if (typeof payload.endpoint !== 'string' || typeof payload.p256dh !== 'string' || typeof payload.auth !== 'string') {
    return false;
  }
  if (payload.endpoint.length > 4096 || payload.p256dh.length > 1024 || payload.auth.length > 1024) return false;
  try {
    return new URL(payload.endpoint).protocol === 'https:';
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  try {
    const user = await getRequestUser(request);
    if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول لتفعيل الإشعارات.' }, { status: 401 });

    const payload = (await request.json()) as SubscriptionPayload;
    if (!isValidSubscription(payload)) {
      return NextResponse.json({ error: 'بيانات اشتراك الإشعارات غير صالحة.' }, { status: 400 });
    }

    const supabase = getSupabaseServiceRole();
    const { data: existing, error: findError } = await supabase
      .from('push_subscriptions')
      .select('id, user_id')
      .eq('endpoint', payload.endpoint)
      .maybeSingle();
    if (findError) throw findError;

    if (existing && existing.user_id !== user.id) {
      return NextResponse.json({ error: 'هذا الجهاز مرتبط بحساب آخر.' }, { status: 409 });
    }

    const subscription = {
      user_id: user.id,
      endpoint: payload.endpoint,
      p256dh: payload.p256dh,
      auth: payload.auth,
      active: true,
      updated_at: new Date().toISOString(),
    };
    const { error } = existing
      ? await supabase.from('push_subscriptions').update(subscription).eq('id', existing.id)
      : await supabase.from('push_subscriptions').insert(subscription);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving push subscription:', error);
    return NextResponse.json({ error: 'تعذر حفظ اشتراك الإشعارات.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getRequestUser(request);
    if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول لإدارة الإشعارات.' }, { status: 401 });

    const { endpoint } = (await request.json()) as { endpoint?: unknown };
    if (typeof endpoint !== 'string' || endpoint.length > 4096) {
      return NextResponse.json({ error: 'بيانات اشتراك الإشعارات غير صالحة.' }, { status: 400 });
    }

    const { error } = await getSupabaseServiceRole()
      .from('push_subscriptions')
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('endpoint', endpoint);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error disabling push subscription:', error);
    return NextResponse.json({ error: 'تعذر إيقاف اشتراك الإشعارات.' }, { status: 500 });
  }
}
