import { isIOSDevice, isStandaloneMode } from './pwa';
import { getSupabase } from './supabase';

const UNSAVED_DEVICE_MESSAGE = 'الإشعارات مسموحة، لكن لم يتم تسجيل هذا الجهاز بعد';
const SESSION_ERROR_MESSAGE = 'تعذر التحقق من جلسة الحساب. سجّل الدخول ثم أعد المحاولة.';
const SAVE_ERROR_MESSAGE = 'تعذر حفظ هذا الجهاز للإشعارات. أعد المحاولة.';

export type PushSupportStatus = {
  supported: boolean;
  permission: NotificationPermission | 'unsupported';
  isIOS: boolean;
  isStandalone: boolean;
  requiresHomeScreen: boolean;
  errorMessage?: string;
};

export type PushDeviceStateKind =
  | 'enabled'
  | 'permission-default'
  | 'permission-denied'
  | 'not-registered'
  | 'requires-home-screen'
  | 'unsupported'
  | 'error'
  | 'disabled';

export type PushDeviceState = {
  kind: PushDeviceStateKind;
  message: string;
};

export type PushActionResult = {
  success: boolean;
  message: string;
};

export type PushUnsubscribeResult = PushActionResult & {
  deviceUnsubscribed: boolean;
};

type SubscriptionPayload = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

type PushStatusResponse = {
  active?: unknown;
};

type PushSaveResponse = {
  success?: unknown;
  active?: unknown;
};

type PushDisableResponse = {
  success?: unknown;
};

function pushState(kind: PushDeviceStateKind, message: string): PushDeviceState {
  return { kind, message };
}

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function arrayBufferToBase64(buffer: ArrayBuffer | null): string {
  if (!buffer) return '';
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function checkPushSupport(): PushSupportStatus {
  if (typeof window === 'undefined') {
    return {
      supported: false,
      permission: 'unsupported',
      isIOS: false,
      isStandalone: false,
      requiresHomeScreen: false,
      errorMessage: 'الإشعارات غير مدعومة في بيئة الخادم.',
    };
  }

  const isIOS = isIOSDevice();
  const isStandalone = isStandaloneMode();
  const isSecure =
    window.location.protocol === 'https:' ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1';

  if (!isSecure) {
    return {
      supported: false,
      permission: 'unsupported',
      isIOS,
      isStandalone,
      requiresHomeScreen: false,
      errorMessage: 'تتطلب الإشعارات اتصالاً آمناً (HTTPS).',
    };
  }

  const hasNotification = 'Notification' in window;
  const hasServiceWorker = 'serviceWorker' in navigator;
  const hasPushManager = 'PushManager' in window;

  if (isIOS && !isStandalone) {
    return {
      supported: false,
      permission: hasNotification ? Notification.permission : 'default',
      isIOS: true,
      isStandalone: false,
      requiresHomeScreen: true,
      errorMessage:
        'لتفعيل إشعارات موقفي على الآيفون أو الآيباد:\n1. اضغط مشاركة\n2. اختر إضافة إلى الشاشة الرئيسية\n3. افتح موقفي من الشاشة الرئيسية\n4. اضغط تفعيل الإشعارات',
    };
  }

  if (!hasNotification || !hasServiceWorker || !hasPushManager) {
    return {
      supported: false,
      permission: 'unsupported',
      isIOS,
      isStandalone,
      requiresHomeScreen: false,
      errorMessage: 'الإشعارات غير مدعومة على هذا الجهاز أو المتصفح.',
    };
  }

  return {
    supported: true,
    permission: Notification.permission,
    isIOS,
    isStandalone,
    requiresHomeScreen: false,
  };
}

function unsupportedPushState(status: PushSupportStatus): PushDeviceState {
  if (status.requiresHomeScreen) {
    return pushState(
      'requires-home-screen',
      status.errorMessage || 'يلزم إضافة التطبيق إلى الشاشة الرئيسية أولاً.',
    );
  }

  return pushState(
    'unsupported',
    status.errorMessage || 'الإشعارات غير مدعومة على هذا الجهاز أو المتصفح.',
  );
}

function logPushFailure(phase: string, error: unknown): void {
  console.error('[push] operation failed', {
    phase,
    message: error instanceof Error ? error.message : 'unknown',
  });
}

async function getReadyServiceWorkerRegistration(): Promise<ServiceWorkerRegistration> {
  let registration = await navigator.serviceWorker.getRegistration();
  if (!registration) {
    registration = await navigator.serviceWorker.register('/sw.js');
  }

  return navigator.serviceWorker.ready;
}

function getSubscriptionPayload(subscription: PushSubscription): SubscriptionPayload {
  const endpoint = subscription.endpoint.trim();
  const p256dh = arrayBufferToBase64(subscription.getKey('p256dh')).trim();
  const auth = arrayBufferToBase64(subscription.getKey('auth')).trim();

  if (!endpoint || !p256dh || !auth) {
    throw new Error('تعذر قراءة بيانات اشتراك هذا الجهاز. أعد المحاولة.');
  }

  return { endpoint, p256dh, auth };
}

async function getAccessToken(refresh = false): Promise<string> {
  const supabase = getSupabase();
  const result = refresh ? await supabase.auth.refreshSession() : await supabase.auth.getSession();
  if (result.error || !result.data.session?.access_token) {
    throw new Error(SESSION_ERROR_MESSAGE);
  }

  return result.data.session.access_token;
}

async function authenticatedPushRequest(
  method: 'POST' | 'DELETE',
  payload: Record<string, unknown>,
): Promise<Response> {
  const send = async (accessToken: string) =>
    fetch('/api/push/subscribe', {
      method,
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });

  let response = await send(await getAccessToken());
  if (response.status === 401) {
    console.warn('[push] subscription request unauthorized; refreshing the session once', { method });
    response = await send(await getAccessToken(true));
  }

  return response;
}

async function responseError(response: Response, fallback: string): Promise<string> {
  const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
  return typeof body?.error === 'string' ? body.error : fallback;
}

async function saveSubscription(payload: SubscriptionPayload): Promise<void> {
  const response = await authenticatedPushRequest('POST', payload);
  console.info('[push] subscription save completed', { status: response.status });

  if (!response.ok) {
    throw new Error(await responseError(response, SAVE_ERROR_MESSAGE));
  }

  const body = (await response.json().catch(() => null)) as PushSaveResponse | null;
  if (body?.success !== true || body.active !== true) {
    throw new Error(SAVE_ERROR_MESSAGE);
  }
}

async function isSubscriptionActiveOnServer(endpoint: string): Promise<boolean> {
  const response = await authenticatedPushRequest('POST', { action: 'status', endpoint });
  console.info('[push] subscription status check completed', { status: response.status });

  if (!response.ok) {
    throw new Error(await responseError(response, SESSION_ERROR_MESSAGE));
  }

  const body = (await response.json().catch(() => null)) as PushStatusResponse | null;
  return body?.active === true;
}

async function getOrCreateSubscription(
  registration: ServiceWorkerRegistration,
): Promise<SubscriptionPayload> {
  let subscription = await registration.pushManager.getSubscription();

  if (subscription) {
    try {
      return getSubscriptionPayload(subscription);
    } catch {
      const removed = await subscription.unsubscribe();
      if (!removed) {
        throw new Error('تعذر إعادة إنشاء اشتراك الإشعارات لهذا الجهاز.');
      }
      subscription = null;
    }
  }

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) {
    throw new Error('إعداد الإشعارات غير مكتمل حالياً. حاول لاحقاً.');
  }

  subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as unknown as BufferSource,
  });

  return getSubscriptionPayload(subscription);
}

export async function getPushDeviceState(): Promise<PushDeviceState> {
  const status = checkPushSupport();
  if (!status.supported) return unsupportedPushState(status);

  if (status.permission === 'denied') {
    return pushState(
      'permission-denied',
      'تم رفض الإشعارات. فعّلها من إعدادات المتصفح ثم أعد المحاولة.',
    );
  }

  if (status.permission !== 'granted') {
    return pushState('permission-default', 'فعّل الإشعارات لتصلك المواقف الجديدة فوراً.');
  }

  try {
    const registration = await getReadyServiceWorkerRegistration();
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return pushState('not-registered', UNSAVED_DEVICE_MESSAGE);

    const payload = getSubscriptionPayload(subscription);
    const active = await isSubscriptionActiveOnServer(payload.endpoint);
    console.info('[push] device state checked', {
      permission: status.permission,
      hasSubscription: true,
      active,
      scope: registration.scope,
    });

    return active
      ? pushState('enabled', 'الإشعارات مفعلة ✓')
      : pushState('not-registered', UNSAVED_DEVICE_MESSAGE);
  } catch (error) {
    logPushFailure('inspect', error);
    return pushState('error', error instanceof Error ? error.message : SAVE_ERROR_MESSAGE);
  }
}

export async function subscribeToPushNotifications(): Promise<PushActionResult> {
  const status = checkPushSupport();

  if (!status.supported) {
    return { success: false, message: unsupportedPushState(status).message };
  }

  try {
    let permission = status.permission;
    if (permission === 'default') {
      permission = await Notification.requestPermission();
    }

    if (permission === 'denied') {
      return {
        success: false,
        message: 'تم رفض الإشعارات. فعّلها من إعدادات المتصفح ثم أعد المحاولة.',
      };
    }

    if (permission !== 'granted') {
      return { success: false, message: 'لم يتم منح الإذن بتفعيل الإشعارات.' };
    }

    const registration = await getReadyServiceWorkerRegistration();
    const payload = await getOrCreateSubscription(registration);
    await saveSubscription(payload);

    console.info('[push] subscription enabled', {
      permission,
      scope: registration.scope,
    });

    return { success: true, message: 'الإشعارات مفعلة ✓' };
  } catch (error) {
    logPushFailure('subscribe', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : SAVE_ERROR_MESSAGE,
    };
  }
}

export async function unsubscribeFromPushNotifications(): Promise<PushUnsubscribeResult> {
  const status = checkPushSupport();
  if (!status.supported) {
    return { success: false, deviceUnsubscribed: false, message: unsupportedPushState(status).message };
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) {
      return {
        success: true,
        deviceUnsubscribed: true,
        message: 'الإشعارات غير مفعلة على هذا الجهاز.',
      };
    }

    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      return {
        success: true,
        deviceUnsubscribed: true,
        message: 'الإشعارات غير مفعلة على هذا الجهاز.',
      };
    }

    const endpoint = subscription.endpoint;
    const deviceUnsubscribed = await subscription.unsubscribe();
    if (!deviceUnsubscribed) {
      return {
        success: false,
        deviceUnsubscribed: false,
        message: 'تعذر إلغاء اشتراك هذا الجهاز. أعد المحاولة.',
      };
    }

    const response = await authenticatedPushRequest('DELETE', { endpoint });
    console.info('[push] subscription disable completed', { status: response.status });
    const body = (await response.json().catch(() => null)) as PushDisableResponse | null;
    if (!response.ok || body?.success !== true) {
      return {
        success: false,
        deviceUnsubscribed: true,
        message: 'تم إلغاء الاشتراك على هذا الجهاز، لكن تعذر مزامنة التغيير مع الخادم.',
      };
    }

    return {
      success: true,
      deviceUnsubscribed: true,
      message: 'تم إلغاء تفعيل إشعارات هذا الجهاز.',
    };
  } catch (error) {
    logPushFailure('unsubscribe', error);
    return {
      success: false,
      deviceUnsubscribed: false,
      message: error instanceof Error ? error.message : 'تعذر إلغاء الإشعارات. أعد المحاولة.',
    };
  }
}
