import { isIOSDevice, isStandaloneMode } from './pwa';
import { getSupabase } from './supabase';

export type PushSupportStatus = {
  supported: boolean;
  permission: NotificationPermission | 'unsupported';
  isIOS: boolean;
  isStandalone: boolean;
  requiresHomeScreen: boolean;
  errorMessage?: string;
};

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function arrayBufferToBase64(buffer: ArrayBuffer | null): string {
  if (!buffer) return '';
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
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
  const isSecure = window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

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
        'لتفعيل إشعارات موقفي على الآيفون:\n1. اضغط مشاركة\n2. اختر إضافة إلى الشاشة الرئيسية\n3. افتح موقفي من الشاشة الرئيسية\n4. اضغط تفعيل الإشعارات',
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

export async function subscribeToPushNotifications(): Promise<{ success: boolean; message: string }> {
  const status = checkPushSupport();

  if (status.requiresHomeScreen) {
    return {
      success: false,
      message: status.errorMessage || 'يلزم إضافة التطبيق إلى الشاشة الرئيسية أولاً.',
    };
  }

  if (!status.supported) {
    return {
      success: false,
      message: status.errorMessage || 'الإشعارات غير مدعومة على هذا الجهاز أو المتصفح.',
    };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'denied') {
      return {
        success: false,
        message: 'تم رفض الإشعارات من المتصفح. يمكنك تفعيلها من إعدادات المتصفح.',
      };
    }

    if (permission !== 'granted') {
      return {
        success: false,
        message: 'لم يتم منح الإذن بتفعيل الإشعارات.',
      };
    }

    // Register service worker if needed
    let registration = await navigator.serviceWorker.getRegistration();
    if (!registration) {
      registration = await navigator.serviceWorker.register('/sw.js');
    }

    await navigator.serviceWorker.ready;

    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) {
      return {
        success: false,
        message: 'إعداد الإشعارات غير مكتمل حالياً. حاول لاحقاً.',
      };
    }

    // Create or get push subscription
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      const subscribeOptions: PushSubscriptionOptionsInit = {
        userVisibleOnly: true,
      };

      subscribeOptions.applicationServerKey = urlBase64ToUint8Array(vapidPublicKey) as unknown as BufferSource;

      subscription = await registration.pushManager.subscribe(subscribeOptions);
    }

    const p256dhKey = subscription.getKey ? subscription.getKey('p256dh') : null;
    const authKey = subscription.getKey ? subscription.getKey('auth') : null;

    const p256dh = arrayBufferToBase64(p256dhKey);
    const auth = arrayBufferToBase64(authKey);

    // Save subscription to server
    const { data: sessionData } = await getSupabase().auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) throw new Error('تعذر التحقق من جلسة المستخدم. حاول مرة أخرى.');

    const response = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        endpoint: subscription.endpoint,
        p256dh,
        auth,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'تعذر حفظ بيانات الاشتراك في الإشعارات');
    }

    return {
      success: true,
      message: 'الإشعارات مفعلة ✓',
    };
  } catch (err) {
    console.error('Failed to subscribe to push notifications:', err);
    return {
      success: false,
      message: err instanceof Error ? err.message : 'حدث خطأ أثناء تفعيل الإشعارات',
    };
  }
}

export async function unsubscribeFromPushNotifications(): Promise<boolean> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return false;

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return false;

    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();

      const { data: sessionData } = await getSupabase().auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) return false;

      await fetch('/api/push/subscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ endpoint }),
      }).catch(() => {});
    }
    return true;
  } catch (err) {
    console.error('Failed to unsubscribe from push notifications:', err);
    return false;
  }
}
