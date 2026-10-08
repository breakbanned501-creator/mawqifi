import { NextResponse } from 'next/server';
import { nativeApiOptions, withNativeApiCorsHandler } from '@/lib/native-api-cors';
import { getRequestAuthentication, getSupabaseServiceRole } from '@/lib/supabase-server';

const NATIVE_PLATFORM = 'ios';

type NativeTokenPayload = {
  action?: unknown;
  platform?: unknown;
  token?: unknown;
  previousToken?: unknown;
};

type StoredNativeToken = {
  id: string;
  user_id: string;
};

function errorCode(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
    ? error.code
    : undefined;
}

function isValidToken(token: unknown): token is string {
  return typeof token === 'string' && token.trim().length > 0 && token.length <= 4096;
}

function isValidPlatform(platform: unknown): boolean {
  return platform === NATIVE_PLATFORM;
}

async function findNativeToken(token: string): Promise<{ data: StoredNativeToken | null; error: unknown }> {
  const { data, error } = await getSupabaseServiceRole()
    .from('native_push_tokens')
    .select('id, user_id')
    .eq('platform', NATIVE_PLATFORM)
    .eq('device_token', token)
    .maybeSingle();

  return { data: data as StoredNativeToken | null, error };
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
    if (!user) {
      console.warn('[native-push] token request rejected', {
        phase,
        authentication: authentication.state,
        errorCode: authentication.errorCode,
      });
      return NextResponse.json({ error: 'يجب تسجيل الدخول لإعداد إشعارات هذا الجهاز.' }, { status: 401 });
    }

    phase = 'parse';
    const payload = (await request.json()) as NativeTokenPayload;
    if (!isValidPlatform(payload.platform) || !isValidToken(payload.token)) {
      return NextResponse.json({ error: 'بيانات إشعارات الجهاز غير صالحة.' }, { status: 400 });
    }
    const token = payload.token.trim();

    if (payload.action === 'status') {
      phase = 'status';
      const { data, error } = await getSupabaseServiceRole()
        .from('native_push_tokens')
        .select('id')
        .eq('user_id', user.id)
        .eq('platform', NATIVE_PLATFORM)
        .eq('device_token', token)
        .eq('enabled', true)
        .maybeSingle();
      if (error) throw error;
      return NextResponse.json({ active: Boolean(data) });
    }

    phase = 'find';
    let { data: existing, error: findError } = await findNativeToken(token);
    if (findError) throw findError;
    if (existing && existing.user_id !== user.id) {
      console.warn('[native-push] token request rejected', { phase, reason: 'token_owned_by_another_user' });
      return NextResponse.json({ error: 'هذا الجهاز مرتبط بحساب آخر.' }, { status: 409 });
    }

    const now = new Date().toISOString();
    const tokenRecord = {
      user_id: user.id,
      platform: NATIVE_PLATFORM,
      device_token: token,
      enabled: true,
      last_seen_at: now,
      updated_at: now,
    };

    phase = existing ? 'update' : 'insert';
    let writeError = existing
      ? (await getSupabaseServiceRole().from('native_push_tokens').update(tokenRecord).eq('id', existing.id)).error
      : (await getSupabaseServiceRole().from('native_push_tokens').insert(tokenRecord)).error;

    // A unique index keeps concurrent device registrations idempotent without
    // ever reassigning another student's native token.
    if (writeError?.code === '23505' && !existing) {
      phase = 'retry-after-conflict';
      const retry = await findNativeToken(token);
      if (retry.error) throw retry.error;
      existing = retry.data;
      if (!existing) throw writeError;
      if (existing.user_id !== user.id) {
        console.warn('[native-push] token request rejected', { phase, reason: 'token_owned_by_another_user' });
        return NextResponse.json({ error: 'هذا الجهاز مرتبط بحساب آخر.' }, { status: 409 });
      }
      writeError = (await getSupabaseServiceRole().from('native_push_tokens').update(tokenRecord).eq('id', existing.id)).error;
    }
    if (writeError) throw writeError;

    const previousToken = isValidToken(payload.previousToken) ? payload.previousToken.trim() : null;
    if (previousToken && previousToken !== token) {
      const { error: disablePreviousError } = await getSupabaseServiceRole()
        .from('native_push_tokens')
        .update({ enabled: false, updated_at: now })
        .eq('user_id', user.id)
        .eq('platform', NATIVE_PLATFORM)
        .eq('device_token', previousToken);
      if (disablePreviousError) throw disablePreviousError;
    }

    console.info('[native-push] token saved', { action: existing ? 'updated' : 'created' });
    return NextResponse.json({ success: true, enabled: true });
  } catch (error) {
    console.error('[native-push] token request failed', { phase, code: errorCode(error) });
    return NextResponse.json({ error: 'تعذر حفظ إشعارات هذا الجهاز.' }, { status: 500 });
  }
  });
}

export async function DELETE(request: Request) {
  return withNativeApiCorsHandler(request, async () => {
  let phase = 'authenticate';

  try {
    const authentication = await getRequestAuthentication(request);
    const user = authentication.user;
    if (!user) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول لإدارة إشعارات هذا الجهاز.' }, { status: 401 });
    }

    phase = 'parse';
    const payload = (await request.json()) as NativeTokenPayload;
    if (!isValidPlatform(payload.platform) || !isValidToken(payload.token)) {
      return NextResponse.json({ error: 'بيانات إشعارات الجهاز غير صالحة.' }, { status: 400 });
    }

    phase = 'disable';
    const { error } = await getSupabaseServiceRole()
      .from('native_push_tokens')
      .update({ enabled: false, updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('platform', NATIVE_PLATFORM)
      .eq('device_token', payload.token.trim());
    if (error) throw error;

    console.info('[native-push] token disabled');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[native-push] token disable failed', { phase, code: errorCode(error) });
    return NextResponse.json({ error: 'تعذر إيقاف إشعارات هذا الجهاز.' }, { status: 500 });
  }
  });
}
