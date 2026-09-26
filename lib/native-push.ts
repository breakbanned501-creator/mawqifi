import type { PushActionResult, PushDeviceState, PushStage, PushUnsubscribeResult } from './push';
import { isNativeCapacitor, isNativeIOS } from './capacitor';
import { ensureSession } from './auth';
import { fetchMawqifiServerApi } from './server-api';
import { getSupabase } from './supabase';

const NATIVE_PUSH_DEVICE_PREFERENCE_KEY = 'mawqifi.native-push-device.v1';
const NATIVE_PUSH_TIMEOUT_MS = 15_000;

type NativePushDeviceRecord = {
  userId: string;
  token: string;
};

type NativePushResponse = {
  success?: unknown;
  enabled?: unknown;
  active?: unknown;
  error?: unknown;
};

type NativeAuth = {
  accessToken: string;
  userId: string;
};

class NativePushError extends Error {
  constructor(
    readonly stage: PushStage,
    message: string,
  ) {
    super(message);
    this.name = 'NativePushError';
  }
}

function nativePushState(
  kind: PushDeviceState['kind'],
  message: string,
  stage?: PushStage,
): PushDeviceState {
  return { kind, message, stage };
}

async function withNativePushTimeout<T>(stage: PushStage, operation: () => Promise<T>): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    return await new Promise<T>((resolve, reject) => {
      timeoutId = globalThis.setTimeout(
        () => reject(new NativePushError(stage, 'تعذر إكمال إعداد إشعارات هذا الجهاز. حاول مرة أخرى.')),
        NATIVE_PUSH_TIMEOUT_MS,
      );

      void operation().then(
        (value) => {
          if (timeoutId) globalThis.clearTimeout(timeoutId);
          timeoutId = undefined;
          resolve(value);
        },
        (error: unknown) => {
          if (timeoutId) globalThis.clearTimeout(timeoutId);
          timeoutId = undefined;
          reject(error);
        },
      );
    });
  } finally {
    if (timeoutId) globalThis.clearTimeout(timeoutId);
  }
}

function safeNativePushDiagnostic(phase: string, details: Record<string, boolean | number | string> = {}): void {
  // Deliberately omit tokens, device identifiers, users, and authorization data.
  console.info('[native-push]', { phase, ...details });
}

async function getNativeAuth(): Promise<NativeAuth> {
  const supabase = getSupabase();
  let result = await withNativePushTimeout('session', () => supabase.auth.getSession());

  if (!result.data.session?.access_token || !result.data.session.user) {
    await withNativePushTimeout('session', () => ensureSession());
    result = await withNativePushTimeout('session', () => supabase.auth.getSession());
  }

  const session = result.data.session;
  if (result.error || !session?.access_token || !session.user) {
    throw new NativePushError('session', 'تعذر التحقق من جلسة الحساب. أعد المحاولة.');
  }

  return { accessToken: session.access_token, userId: session.user.id };
}

async function readNativePushDevice(): Promise<NativePushDeviceRecord | null> {
  const { Preferences } = await import('@capacitor/preferences');
  const { value } = await Preferences.get({ key: NATIVE_PUSH_DEVICE_PREFERENCE_KEY });
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as Partial<NativePushDeviceRecord>;
    if (typeof parsed.userId !== 'string' || typeof parsed.token !== 'string') return null;
    if (!parsed.userId || !parsed.token) return null;
    return { userId: parsed.userId, token: parsed.token };
  } catch {
    return null;
  }
}

async function saveNativePushDevice(device: NativePushDeviceRecord): Promise<void> {
  const { Preferences } = await import('@capacitor/preferences');
  await Preferences.set({
    key: NATIVE_PUSH_DEVICE_PREFERENCE_KEY,
    value: JSON.stringify(device),
  });
}

async function removeNativePushDevice(): Promise<void> {
  const { Preferences } = await import('@capacitor/preferences');
  await Preferences.remove({ key: NATIVE_PUSH_DEVICE_PREFERENCE_KEY });
}

async function requestNativeToken(accessToken: string): Promise<string> {
  const { PushNotifications } = await import('@capacitor/push-notifications');
  let resolveToken: ((token: string) => void) | null = null;
  let rejectToken: ((error: unknown) => void) | null = null;
  let settled = false;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const tokenPromise = new Promise<string>((resolve, reject) => {
    resolveToken = resolve;
    rejectToken = reject;
  });

  const finish = (resolveWith?: string, rejectWith?: Error) => {
    if (settled) return;
    settled = true;
    if (timeoutId) globalThis.clearTimeout(timeoutId);
    timeoutId = undefined;
    if (resolveWith) resolveToken?.(resolveWith);
    else rejectToken?.(rejectWith ?? new NativePushError('subscription-create', 'تعذر تسجيل هذا الجهاز للإشعارات.'));
  };

  const registrationListener = await PushNotifications.addListener('registration', ({ value }) => {
    const token = value.trim();
    finish(token || undefined);
  });
  const errorListener = await PushNotifications.addListener('registrationError', () => {
    finish(undefined, new NativePushError('subscription-create', 'تعذر تسجيل هذا الجهاز للإشعارات.'));
  });

  try {
    timeoutId = globalThis.setTimeout(
      () => finish(undefined, new NativePushError('subscription-create', 'انتهت مهلة تسجيل هذا الجهاز للإشعارات. حاول مرة أخرى.')),
      NATIVE_PUSH_TIMEOUT_MS,
    );
    safeNativePushDiagnostic('registration.start', { hasAuthenticatedSession: Boolean(accessToken) });
    await PushNotifications.register();
    return await tokenPromise;
  } finally {
    if (timeoutId) globalThis.clearTimeout(timeoutId);
    await Promise.all([registrationListener.remove(), errorListener.remove()]);
  }
}

async function sendNativePushRequest(
  method: 'POST' | 'DELETE',
  accessToken: string,
  body: Record<string, unknown>,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), NATIVE_PUSH_TIMEOUT_MS);

  try {
    const response = await fetchMawqifiServerApi('/api/push/native-token', {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    safeNativePushDiagnostic('server.response', { status: response.status, method });
    return response;
  } catch (error) {
    throw new NativePushError(
      'server-save',
      controller.signal.aborted
        ? 'انتهت مهلة حفظ إشعارات هذا الجهاز. حاول مرة أخرى.'
        : 'تعذر حفظ إشعارات هذا الجهاز. حاول مرة أخرى.',
    );
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}

async function readError(response: Response, fallback: string): Promise<string> {
  const body = (await response.json().catch(() => null)) as NativePushResponse | null;
  return typeof body?.error === 'string' ? body.error : fallback;
}

async function nativePermission(): Promise<'granted' | 'denied' | 'prompt'> {
  const { PushNotifications } = await import('@capacitor/push-notifications');
  const status = await withNativePushTimeout('permission', () => PushNotifications.checkPermissions());
  if (status.receive === 'granted') return 'granted';
  if (status.receive === 'denied') return 'denied';
  return 'prompt';
}

export async function getNativePushDeviceState(): Promise<PushDeviceState> {
  if (!isNativeCapacitor() || !isNativeIOS()) {
    return nativePushState('unsupported', 'الإشعارات الأصلية متاحة داخل تطبيق موقفي على الآيفون فقط.');
  }

  try {
    const permission = await nativePermission();
    safeNativePushDiagnostic('permission.checked', { granted: permission === 'granted', denied: permission === 'denied' });
    if (permission === 'denied') {
      return nativePushState('permission-denied', 'تم رفض الإشعارات. فعّلها من إعدادات الآيفون ثم أعد المحاولة.');
    }
    if (permission !== 'granted') {
      return nativePushState('permission-default', 'فعّل الإشعارات لتصلك المواقف والرسائل الجديدة.');
    }

    const auth = await getNativeAuth();
    const storedDevice = await readNativePushDevice();
    if (!storedDevice || storedDevice.userId !== auth.userId) {
      return nativePushState('not-registered', 'تم السماح بالإشعارات، لكن لم يتم تسجيل هذا الجهاز بعد.');
    }

    const response = await sendNativePushRequest('POST', auth.accessToken, {
      action: 'status',
      platform: 'ios',
      token: storedDevice.token,
    });
    const body = (await response.json().catch(() => null)) as NativePushResponse | null;
    if (response.ok && body?.active === true) {
      return nativePushState('enabled', 'الإشعارات مفعلة ✓');
    }

    await removeNativePushDevice();
    return nativePushState('not-registered', 'تم السماح بالإشعارات، لكن لم يتم تسجيل هذا الجهاز بعد.');
  } catch (error) {
    safeNativePushDiagnostic('state.failed', { isNativePushError: error instanceof NativePushError });
    return nativePushState(
      'error',
      error instanceof NativePushError ? error.message : 'تعذر التحقق من إشعارات هذا الجهاز. حاول مرة أخرى.',
      error instanceof NativePushError ? error.stage : undefined,
    );
  }
}

export async function subscribeToNativePushNotifications(): Promise<PushActionResult> {
  if (!isNativeCapacitor() || !isNativeIOS()) {
    return { success: false, state: 'unsupported', message: 'الإشعارات الأصلية غير متاحة على هذا الجهاز.' };
  }

  let permission: 'granted' | 'denied' | 'prompt' = 'prompt';
  try {
    permission = await nativePermission();
    if (permission === 'prompt') {
      const { PushNotifications } = await import('@capacitor/push-notifications');
      const requested = await withNativePushTimeout('permission', () => PushNotifications.requestPermissions());
      permission = requested.receive === 'granted' ? 'granted' : requested.receive === 'denied' ? 'denied' : 'prompt';
    }

    if (permission === 'denied') {
      return {
        success: false,
        state: 'permission-denied',
        message: 'تم رفض الإشعارات. فعّلها من إعدادات الآيفون ثم أعد المحاولة.',
      };
    }
    if (permission !== 'granted') {
      return { success: false, state: 'permission-default', message: 'لم يتم منح إذن الإشعارات.' };
    }

    const auth = await getNativeAuth();
    const token = await requestNativeToken(auth.accessToken);
    const response = await sendNativePushRequest('POST', auth.accessToken, {
      platform: 'ios',
      token,
    });
    if (!response.ok) {
      throw new NativePushError('server-save', await readError(response, 'تعذر حفظ إشعارات هذا الجهاز. حاول مرة أخرى.'));
    }

    const body = (await response.json().catch(() => null)) as NativePushResponse | null;
    if (body?.success !== true || body.enabled !== true) {
      throw new NativePushError('server-save', 'تعذر حفظ إشعارات هذا الجهاز. حاول مرة أخرى.');
    }

    // Persist only after the authenticated server has accepted the token.
    await saveNativePushDevice({ userId: auth.userId, token });
    safeNativePushDiagnostic('subscription.saved', { saved: true });
    return { success: true, message: 'الإشعارات مفعلة ✓' };
  } catch (error) {
    safeNativePushDiagnostic('subscription.failed', { isNativePushError: error instanceof NativePushError });
    return {
      success: false,
      state: permission === 'granted' ? 'not-registered' : 'error',
      message:
        error instanceof NativePushError
          ? error.message
          : permission === 'granted'
            ? 'تم السماح بالإشعارات، لكن تعذر تسجيل هذا الجهاز. حاول مرة أخرى.'
            : 'تعذر إكمال إعداد الإشعارات. حاول مرة أخرى.',
      stage: error instanceof NativePushError ? error.stage : undefined,
    };
  }
}

export async function unsubscribeFromNativePushNotifications(): Promise<PushUnsubscribeResult> {
  if (!isNativeCapacitor() || !isNativeIOS()) {
    return {
      success: false,
      deviceUnsubscribed: false,
      state: 'unsupported',
      message: 'الإشعارات الأصلية غير متاحة على هذا الجهاز.',
    };
  }

  try {
    const auth = await getNativeAuth();
    const storedDevice = await readNativePushDevice();
    if (!storedDevice || storedDevice.userId !== auth.userId) {
      return { success: true, deviceUnsubscribed: true, state: 'disabled', message: 'الإشعارات غير مفعلة على هذا الجهاز.' };
    }

    const response = await sendNativePushRequest('DELETE', auth.accessToken, {
      platform: 'ios',
      token: storedDevice.token,
    });
    if (!response.ok) {
      return {
        success: false,
        deviceUnsubscribed: false,
        state: 'error',
        stage: 'server-save',
        message: await readError(response, 'تعذر إيقاف إشعارات هذا الجهاز. حاول مرة أخرى.'),
      };
    }

    const { PushNotifications } = await import('@capacitor/push-notifications');
    await withNativePushTimeout('subscription-remove', () => PushNotifications.unregister());
    await removeNativePushDevice();
    return { success: true, deviceUnsubscribed: true, state: 'disabled', message: 'تم إيقاف إشعارات هذا الجهاز.' };
  } catch (error) {
    return {
      success: false,
      deviceUnsubscribed: false,
      state: 'error',
      stage: error instanceof NativePushError ? error.stage : undefined,
      message: error instanceof NativePushError ? error.message : 'تعذر إيقاف إشعارات هذا الجهاز. حاول مرة أخرى.',
    };
  }
}
