import { NextResponse } from 'next/server';
import { nativeApiOptions, withNativeApiCorsHandler } from '@/lib/native-api-cors';
import { getRequestAuthentication, getSupabaseServiceRole } from '@/lib/supabase-server';

type SubscriptionPayload = {
  action?: unknown;
  endpoint?: unknown;
  p256dh?: unknown;
  auth?: unknown;
};

type ValidSubscriptionPayload = {
  action?: unknown;
  endpoint: string;
  p256dh: string;
  auth: string;
};

type StoredSubscription = {
  id: string;
  user_id: string;
};

function databaseErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) return undefined;
  return typeof error.code === 'string' ? error.code : undefined;
}

function isValidEndpoint(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== 'string') return false;
  const normalized = endpoint.trim();
  if (!normalized || normalized.length > 4096) return false;

  try {
    return new URL(normalized).protocol === 'https:';
  } catch {
    return false;
  }
}

function isValidSubscription(payload: SubscriptionPayload): payload is ValidSubscriptionPayload {
  if (!isValidEndpoint(payload.endpoint) || typeof payload.p256dh !== 'string' || typeof payload.auth !== 'string') {
    return false;
  }

  return (
    payload.p256dh.trim().length > 0 &&
    payload.auth.trim().length > 0 &&
    payload.p256dh.length <= 1024 &&
    payload.auth.length <= 1024
  );
}

async function findSubscriptionByEndpoint(
  endpoint: string,
): Promise<{ data: StoredSubscription | null; error: unknown }> {
  const { data, error } = await getSupabaseServiceRole()
    .from('push_subscriptions')
    .select('id, user_id')
    .eq('endpoint', endpoint)
    .maybeSingle();

  return { data: data as StoredSubscription | null, error };
}

export async function OPTIONS(request: Request) {
  return nativeApiOptions(request);
}

export async function POST(request: Request) {
  return withNativeApiCorsHandler(request, async () => {
  let phase = 'authenticate';

  try {
    const authentication = await getRequestAuthentication(request);
    const user = authentication.user;
    const hasCookie = request.headers.has('cookie');
    if (!user) {
      console.warn('[push] subscription request rejected', {
        phase,
        authentication: authentication.state,
        authErrorCode: authentication.errorCode,
        hasCookie,
      });
      return NextResponse.json({ error: 'يجب تسجيل الدخول لتفعيل الإشعارات.' }, { status: 401 });
    }

    console.info('[push] subscription request authenticated', {
      authentication: authentication.state,
      hasCookie,
    });

    phase = 'parse';
    const payload = (await request.json()) as SubscriptionPayload;
    const endpoint = typeof payload.endpoint === 'string' ? payload.endpoint.trim() : '';

    if (payload.action === 'status') {
      if (!isValidEndpoint(payload.endpoint)) {
        return NextResponse.json({ error: 'بيانات اشتراك الإشعارات غير صالحة.' }, { status: 400 });
      }

      phase = 'status';
      const { data, error } = await getSupabaseServiceRole()
        .from('push_subscriptions')
        .select('id')
        .eq('user_id', user.id)
        .eq('endpoint', endpoint)
        .eq('active', true)
        .maybeSingle();
      if (error) throw error;

      return NextResponse.json({ active: Boolean(data) });
    }

    if (!isValidSubscription(payload)) {
      return NextResponse.json({ error: 'بيانات اشتراك الإشعارات غير صالحة.' }, { status: 400 });
    }

    const subscription = {
      user_id: user.id,
      endpoint,
      p256dh: payload.p256dh.trim(),
      auth: payload.auth.trim(),
      active: true,
      updated_at: new Date().toISOString(),
    };

    phase = 'find';
    let { data: existing, error: findError } = await findSubscriptionByEndpoint(endpoint);
    if (findError) throw findError;

    if (existing && existing.user_id !== user.id) {
      console.warn('[push] subscription request rejected', { phase, reason: 'endpoint_owned_by_another_user' });
      return NextResponse.json({ error: 'هذا الجهاز مرتبط بحساب آخر.' }, { status: 409 });
    }

    phase = existing ? 'update' : 'insert';
    let writeError = existing
      ? (
          await getSupabaseServiceRole()
            .from('push_subscriptions')
            .update(subscription)
            .eq('id', existing.id)
        ).error
      : (await getSupabaseServiceRole().from('push_subscriptions').insert(subscription)).error;

    if (writeError?.code === '23505' && !existing) {
      phase = 'retry-after-conflict';
      const retry = await findSubscriptionByEndpoint(endpoint);
      if (retry.error) throw retry.error;
      existing = retry.data;

      if (!existing) throw writeError;
      if (existing.user_id !== user.id) {
        console.warn('[push] subscription request rejected', { phase, reason: 'endpoint_owned_by_another_user' });
        return NextResponse.json({ error: 'هذا الجهاز مرتبط بحساب آخر.' }, { status: 409 });
      }

      writeError = (
        await getSupabaseServiceRole()
          .from('push_subscriptions')
          .update(subscription)
          .eq('id', existing.id)
      ).error;
    }

    if (writeError) throw writeError;

    console.info('[push] subscription saved', { action: existing ? 'updated' : 'created' });
    return NextResponse.json({ success: true, active: true });
  } catch (error) {
    console.error('[push] subscription request failed', {
      phase,
      code: databaseErrorCode(error),
    });
    return NextResponse.json({ error: 'تعذر حفظ اشتراك الإشعارات.' }, { status: 500 });
  }
  });
}

export async function DELETE(request: Request) {
  return withNativeApiCorsHandler(request, async () => {
  let phase = 'authenticate';

  try {
    const authentication = await getRequestAuthentication(request);
    const user = authentication.user;
    const hasCookie = request.headers.has('cookie');
    if (!user) {
      console.warn('[push] subscription disable rejected', {
        phase,
        authentication: authentication.state,
        authErrorCode: authentication.errorCode,
        hasCookie,
      });
      return NextResponse.json({ error: 'يجب تسجيل الدخول لإدارة الإشعارات.' }, { status: 401 });
    }

    console.info('[push] subscription disable authenticated', {
      authentication: authentication.state,
      hasCookie,
    });

    phase = 'parse';
    const { endpoint } = (await request.json()) as { endpoint?: unknown };
    if (!isValidEndpoint(endpoint)) {
      return NextResponse.json({ error: 'بيانات اشتراك الإشعارات غير صالحة.' }, { status: 400 });
    }

    phase = 'disable';
    const { error } = await getSupabaseServiceRole()
      .from('push_subscriptions')
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('endpoint', endpoint.trim());
    if (error) throw error;

    console.info('[push] subscription disabled');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[push] subscription disable failed', {
      phase,
      code: databaseErrorCode(error),
    });
    return NextResponse.json({ error: 'تعذر إيقاف اشتراك الإشعارات.' }, { status: 500 });
  }
  });
}
