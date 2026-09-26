import { isIOSDevice, isStandaloneMode } from './pwa';
import { ensureSession } from './auth';
import {
  ensureMawqifiServiceWorker,
  getMawqifiServiceWorkerRegistration,
  MawqifiServiceWorkerError,
} from './service-worker';
import { getSupabase } from './supabase';
import { fetchMawqifiServerApi, type MawqifiServerApiPath } from './server-api';
import type { Session } from '@supabase/supabase-js';

const UNSAVED_DEVICE_MESSAGE = 'تم السماح بالإشعارات، لكن تعذر تسجيل هذا الجهاز. حاول مرة أخرى.';
const SESSION_ERROR_MESSAGE = 'تعذر التحقق من جلسة الحساب. سجّل الدخول ثم أعد المحاولة.';
const SAVE_ERROR_MESSAGE = 'تعذر حفظ هذا الجهاز للإشعارات. أعد المحاولة.';

const PUSH_STAGE_TIMEOUTS = {
  permission: 30_000,
  'service-worker-registration': 15_000,
  'service-worker-activation': 15_000,
  'subscription-lookup': 12_000,
  'subscription-create': 30_000,
  'subscription-remove': 12_000,
  session: 15_000,
  'server-save': 15_000,
} as const;

export type PushStage = keyof typeof PUSH_STAGE_TIMEOUTS;

const PUSH_STAGE_MESSAGES: Record<PushStage, string> = {
  permission: 'تعذر إكمال طلب إذن الإشعارات. أغلق الرسالة النظامية ثم حاول مرة أخرى.',
  'service-worker-registration':
    'تعذر تسجيل خدمة الإشعارات على هذا الجهاز. أغلق موقفي ثم افتحه من الشاشة الرئيسية وأعد المحاولة.',
  'service-worker-activation':
    'تعذر تفعيل خدمة الإشعارات على هذا الجهاز. أغلق موقفي ثم افتحه من الشاشة الرئيسية وأعد المحاولة.',
  'subscription-lookup': 'تعذر التحقق من اشتراك الإشعارات لهذا الجهاز. حاول مرة أخرى.',
  'subscription-create':
    'توقفت العملية عند تسجيل اشتراك الإشعارات على هذا الجهاز. تأكد من فتح موقفي من الشاشة الرئيسية ثم حاول مرة أخرى.',
  'subscription-remove': 'تعذر تحديث اشتراك الإشعارات لهذا الجهاز. حاول مرة أخرى.',
  session: 'تعذر التحقق من جلسة الحساب. أغلق موقفي وافتحه مجدداً ثم حاول مرة أخرى.',
  'server-save': 'تم السماح بالإشعارات، لكن تعذر حفظ هذا الجهاز. حاول مرة أخرى.',
};

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
  stage?: PushStage;
};

export type PushActionResult = {
  success: boolean;
  message: string;
  state?: PushDeviceStateKind;
  stage?: PushStage;
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

type SessionReadResult = {
  data: { session: Session | null };
  error: Error | null;
};

class PushStageError extends Error {
  constructor(
    readonly stage: PushStage,
    message = PUSH_STAGE_MESSAGES[stage],
  ) {
    super(message);
    this.name = 'PushStageError';
  }
}

function pushState(kind: PushDeviceStateKind, message: string, stage?: PushStage): PushDeviceState {
  return { kind, message, stage };
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

function logPushDiagnostic(
  phase: string,
  details: Record<string, boolean | number | string | null | undefined>,
): void {
  // Keep these temporary production diagnostics intentionally metadata-only.
  // Do not add subscription keys, endpoints, tokens, or user identifiers here.
  console.info('[push] diagnostic', { phase, ...details });
}

function logPushFailure(phase: string, error: unknown): void {
  console.error('[push] operation failed', {
    phase,
    errorName: error instanceof Error ? error.name : 'unknown',
  });
}

async function withPushStageTimeout<T>(
  stage: PushStage,
  operation: () => Promise<T>,
): Promise<T> {
  const timeoutMs = PUSH_STAGE_TIMEOUTS[stage];
  let timeoutId: number | undefined;
  logPushDiagnostic('stage.start', { stage, timeoutMs });

  try {
    const result = await new Promise<T>((resolve, reject) => {
      timeoutId = window.setTimeout(() => {
        timeoutId = undefined;
        reject(new PushStageError(stage));
      }, timeoutMs);

      void operation().then(
        (value) => {
          if (timeoutId !== undefined) {
            window.clearTimeout(timeoutId);
            timeoutId = undefined;
          }
          resolve(value);
        },
        (error: unknown) => {
          if (timeoutId !== undefined) {
            window.clearTimeout(timeoutId);
            timeoutId = undefined;
          }
          reject(error);
        },
      );
    });

    logPushDiagnostic('stage.complete', { stage });
    return result;
  } catch (error) {
    if (error instanceof PushStageError) {
      logPushDiagnostic('stage.timeout', { stage, timeoutMs });
      throw error;
    }

    logPushFailure(`stage.${stage}`, error);
    throw new PushStageError(stage);
  } finally {
    if (timeoutId !== undefined) window.clearTimeout(timeoutId);
  }
}

async function fetchWithPushTimeout(input: MawqifiServerApiPath, init: RequestInit): Promise<Response> {
  const stage: PushStage = 'server-save';
  const timeoutMs = PUSH_STAGE_TIMEOUTS[stage];
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  logPushDiagnostic('stage.start', { stage, timeoutMs });

  try {
    const response = await fetchMawqifiServerApi(input, { ...init, signal: controller.signal });
    logPushDiagnostic('stage.complete', { stage, status: response.status });
    return response;
  } catch (error) {
    logPushDiagnostic(controller.signal.aborted ? 'stage.timeout' : 'stage.failed', {
      stage,
      timeoutMs,
    });
    if (!controller.signal.aborted) logPushFailure(`stage.${stage}`, error);
    throw new PushStageError(stage);
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function getReadyServiceWorkerRegistration(): Promise<ServiceWorkerRegistration> {
  try {
    const registration = await ensureMawqifiServiceWorker();
    logPushDiagnostic('service-worker.active', {
      hasActiveWorker: Boolean(registration.active),
      scope: registration.scope,
      hasController: Boolean(navigator.serviceWorker.controller),
    });
    return registration;
  } catch (error) {
    logPushFailure('service-worker.lifecycle', error);
    throw new PushStageError(
      error instanceof MawqifiServiceWorkerError && error.reason === 'activation'
        ? 'service-worker-activation'
        : 'service-worker-registration',
    );
  }
}

function getSubscriptionPayload(subscription: PushSubscription): SubscriptionPayload {
  const endpoint = subscription.endpoint.trim();
  const p256dh = arrayBufferToBase64(subscription.getKey('p256dh')).trim();
  const auth = arrayBufferToBase64(subscription.getKey('auth')).trim();

  if (!endpoint || !p256dh || !auth) {
    throw new PushStageError('subscription-lookup', 'تعذر قراءة بيانات اشتراك هذا الجهاز. أعد المحاولة.');
  }

  return { endpoint, p256dh, auth };
}

async function getAccessToken(refresh = false): Promise<string> {
  const supabase = getSupabase();
  const readSession = async (forceRefresh: boolean): Promise<SessionReadResult> => {
    if (!forceRefresh) return supabase.auth.getSession();

    const { data, error } = await supabase.auth.refreshSession();
    return { data: { session: data.session }, error };
  };
  let result = await withPushStageTimeout('session', () => readSession(refresh));

  // AuthProvider normally establishes this before the settings UI is rendered.
  // Keep the request path self-sufficient as well: a cleared client session
  // becomes one anonymous Supabase session, not a local-only guest identity.
  if (!refresh && !result.data.session?.access_token) {
    await withPushStageTimeout('session', () => ensureSession());
    result = await withPushStageTimeout('session', () => readSession(false));
  }

  logPushDiagnostic('session.read', {
    refresh,
    hasSession: Boolean(result.data.session),
    hasAccessToken: Boolean(result.data.session?.access_token),
    hasSessionUser: Boolean(result.data.session?.user),
    isAnonymousSession: result.data.session?.user.is_anonymous === true,
  });
  if (result.error || !result.data.session?.access_token) {
    throw new PushStageError('session', SESSION_ERROR_MESSAGE);
  }

  return result.data.session.access_token;
}

async function authenticatedPushRequest(
  method: 'POST' | 'DELETE',
  payload: Record<string, unknown>,
): Promise<Response> {
  const send = async (accessToken: string) =>
    fetchWithPushTimeout('/api/push/subscribe', {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });

  const accessToken = await getAccessToken();
  logPushDiagnostic('subscribe-request.dispatch', {
    method,
    credentials: 'same-origin',
    hasSession: true,
  });
  let response = await send(accessToken);
  logPushDiagnostic('subscribe-request.response', { method, status: response.status, retried: false });
  if (response.status === 401) {
    console.warn('[push] subscription request unauthorized; refreshing the session once', { method });
    logPushDiagnostic('subscribe-request.retry', { method, reason: 'unauthorized' });
    const refreshedAccessToken = await getAccessToken(true);
    response = await send(refreshedAccessToken);
    logPushDiagnostic('subscribe-request.response', { method, status: response.status, retried: true });
  }

  return response;
}

async function responseError(response: Response, fallback: string): Promise<string> {
  const body = (await withPushStageTimeout('server-save', () => response.json().catch(() => null))) as {
    error?: unknown;
  } | null;
  return typeof body?.error === 'string' ? body.error : fallback;
}

async function saveSubscription(payload: SubscriptionPayload): Promise<void> {
  const response = await authenticatedPushRequest('POST', payload);
  console.info('[push] subscription save completed', { status: response.status });

  if (!response.ok) {
    throw new PushStageError(
      response.status === 401 ? 'session' : 'server-save',
      await responseError(response, SAVE_ERROR_MESSAGE),
    );
  }

  const body = (await withPushStageTimeout('server-save', () => response.json().catch(() => null))) as PushSaveResponse | null;
  if (body?.success !== true || body.active !== true) {
    throw new PushStageError('server-save', SAVE_ERROR_MESSAGE);
  }
}

async function isSubscriptionActiveOnServer(endpoint: string): Promise<boolean> {
  const response = await authenticatedPushRequest('POST', { action: 'status', endpoint });
  console.info('[push] subscription status check completed', { status: response.status });

  if (!response.ok) {
    throw new PushStageError(
      response.status === 401 ? 'session' : 'server-save',
      await responseError(response, SESSION_ERROR_MESSAGE),
    );
  }

  const body = (await withPushStageTimeout('server-save', () => response.json().catch(() => null))) as PushStatusResponse | null;
  return body?.active === true;
}

async function getOrCreateSubscription(
  registration: ServiceWorkerRegistration,
): Promise<SubscriptionPayload> {
  let subscription = await withPushStageTimeout(
    'subscription-lookup',
    () => registration.pushManager.getSubscription(),
  );
  logPushDiagnostic('subscription.lookup', { exists: Boolean(subscription) });

  if (subscription) {
    const existingSubscription = subscription;
    try {
      return getSubscriptionPayload(existingSubscription);
    } catch {
      const removed = await withPushStageTimeout('subscription-remove', () => existingSubscription.unsubscribe());
      if (!removed) {
        throw new PushStageError('subscription-remove', 'تعذر إعادة إنشاء اشتراك الإشعارات لهذا الجهاز.');
      }
      subscription = null;
    }
  }

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) {
    throw new PushStageError('subscription-create', 'إعداد الإشعارات غير مكتمل حالياً. حاول لاحقاً.');
  }

  let applicationServerKey: Uint8Array;
  try {
    applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
  } catch (error) {
    logPushFailure('subscription.vapid-key', error);
    throw new PushStageError('subscription-create');
  }

  const createdSubscription = await withPushStageTimeout('subscription-create', () =>
    registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey as unknown as BufferSource,
    }),
  );
  logPushDiagnostic('subscription.created', { exists: true });

  return getSubscriptionPayload(createdSubscription);
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
    const subscription = await withPushStageTimeout(
      'subscription-lookup',
      () => registration.pushManager.getSubscription(),
    );
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
    return pushState(
      status.permission === 'granted' ? 'not-registered' : 'error',
      error instanceof PushStageError
        ? error.message
        : error instanceof Error
          ? error.message
          : SAVE_ERROR_MESSAGE,
      error instanceof PushStageError ? error.stage : undefined,
    );
  }
}

export async function subscribeToPushNotifications(): Promise<PushActionResult> {
  const status = checkPushSupport();
  logPushDiagnostic('subscribe.start', {
    supported: status.supported,
    permission: status.permission,
    isIOS: status.isIOS,
    isStandalone: status.isStandalone,
  });

  if (!status.supported) {
    const state = unsupportedPushState(status);
    return { success: false, message: state.message, state: state.kind };
  }

  let permission = status.permission;
  try {
    if (permission === 'default') {
      permission = await withPushStageTimeout('permission', () => Notification.requestPermission());
    }
    logPushDiagnostic('permission.result', { permission });

    if (permission === 'denied') {
      return {
        success: false,
        message: 'تم رفض الإشعارات. فعّلها من إعدادات المتصفح ثم أعد المحاولة.',
        state: 'permission-denied',
      };
    }

    if (permission !== 'granted') {
      return { success: false, message: 'لم يتم منح الإذن بتفعيل الإشعارات.', state: 'permission-default' };
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
      state: permission === 'granted' ? 'not-registered' : 'error',
      message: error instanceof PushStageError
        ? error.message
        : permission === 'granted'
          ? UNSAVED_DEVICE_MESSAGE
          : error instanceof Error
            ? error.message
            : SAVE_ERROR_MESSAGE,
      stage: error instanceof PushStageError ? error.stage : undefined,
    };
  }
}

export async function unsubscribeFromPushNotifications(): Promise<PushUnsubscribeResult> {
  const status = checkPushSupport();
  if (!status.supported) {
    const state = unsupportedPushState(status);
    return {
      success: false,
      deviceUnsubscribed: false,
      message: state.message,
      state: state.kind,
    };
  }

  try {
    const registration = await withPushStageTimeout(
      'service-worker-registration',
      () => getMawqifiServiceWorkerRegistration(),
    );
    if (!registration) {
      return {
        success: true,
        deviceUnsubscribed: true,
        message: 'الإشعارات غير مفعلة على هذا الجهاز.',
        state: 'disabled',
      };
    }

    const subscription = await withPushStageTimeout(
      'subscription-lookup',
      () => registration.pushManager.getSubscription(),
    );
    if (!subscription) {
      return {
        success: true,
        deviceUnsubscribed: true,
        message: 'الإشعارات غير مفعلة على هذا الجهاز.',
        state: 'disabled',
      };
    }

    const endpoint = subscription.endpoint;
    const deviceUnsubscribed = await withPushStageTimeout('subscription-remove', () => subscription.unsubscribe());
    if (!deviceUnsubscribed) {
      return {
        success: false,
        deviceUnsubscribed: false,
        message: 'تعذر إلغاء اشتراك هذا الجهاز. أعد المحاولة.',
        state: 'error',
        stage: 'subscription-remove',
      };
    }

    const response = await authenticatedPushRequest('DELETE', { endpoint });
    console.info('[push] subscription disable completed', { status: response.status });
    const body = (await withPushStageTimeout('server-save', () => response.json().catch(() => null))) as PushDisableResponse | null;
    if (!response.ok || body?.success !== true) {
      return {
        success: false,
        deviceUnsubscribed: true,
        message: 'تم إلغاء الاشتراك على هذا الجهاز، لكن تعذر مزامنة التغيير مع الخادم.',
        state: 'error',
        stage: 'server-save',
      };
    }

    return {
      success: true,
      deviceUnsubscribed: true,
      message: 'تم إلغاء تفعيل إشعارات هذا الجهاز.',
      state: 'disabled',
    };
  } catch (error) {
    logPushFailure('unsubscribe', error);
    return {
      success: false,
      deviceUnsubscribed: false,
      message: error instanceof Error ? error.message : 'تعذر إلغاء الإشعارات. أعد المحاولة.',
      state: 'error',
      stage: error instanceof PushStageError ? error.stage : undefined,
    };
  }
}
