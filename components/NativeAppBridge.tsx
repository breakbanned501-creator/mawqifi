'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getMawqifiInternalPath, isNativeCapacitor } from '@/lib/capacitor';
import { publishAppState } from '@/lib/publish-location';
import { getSupabase } from '@/lib/supabase';

type NativeListener = { remove: () => Promise<void> };

function getNotificationDestination(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const candidate = (data as Record<string, unknown>).url;
  return typeof candidate === 'string' ? candidate : null;
}

/**
 * Initializes native-only behavior once per Capacitor app runtime. It never
 * creates or resets a Supabase session; existing AuthProvider recovery remains
 * the only owner of anonymous-session creation.
 */
export default function NativeAppBridge() {
  const router = useRouter();

  useEffect(() => {
    if (!isNativeCapacitor()) return;

    let disposed = false;
    const listeners: NativeListener[] = [];

    document.documentElement.classList.add('capacitor-native');

    const navigate = (rawUrl: string | null | undefined) => {
      const path = getMawqifiInternalPath(rawUrl);
      if (path) router.push(path);
    };

    const reconnectRealtime = () => {
      try {
        const supabase = getSupabase();
        supabase.auth.startAutoRefresh();
        // This check is deliberately non-blocking. It can refresh a restored
        // session but it must never initiate anonymous sign-in on resume.
        void supabase.auth.getSession().catch(() => undefined);
        supabase.realtime.connect();
      } catch {
        // AuthProvider owns user-facing recovery. Do not interrupt navigation
        // or create a competing account from a lifecycle callback.
      }
    };

    // The splash must never depend on optional native-plugin setup. For
    // example, APNs capability setup happens later in Xcode and a listener
    // failure must not leave the whole app covered by a permanent splash.
    const hideSplash = async () => {
      try {
        const { SplashScreen } = await import('@capacitor/splash-screen');
        await SplashScreen.hide();
      } catch {
        // The app is still usable if the native splash plugin is unavailable.
      }
    };

    const bootstrap = async () => {
      try {
        const [
          { App },
          { Network },
          { Keyboard, KeyboardResize, KeyboardStyle },
          { StatusBar, Style },
          { PushNotifications },
        ] = await Promise.all([
          import('@capacitor/app'),
          import('@capacitor/network'),
          import('@capacitor/keyboard'),
          import('@capacitor/status-bar'),
          import('@capacitor/push-notifications'),
        ]);
        if (disposed) return;

        await Promise.allSettled([
          StatusBar.setStyle({ style: Style.Dark }),
          StatusBar.setOverlaysWebView({ overlay: false }),
          Keyboard.setResizeMode({ mode: KeyboardResize.Native }),
          Keyboard.setStyle({ style: KeyboardStyle.Dark }),
          Keyboard.setAccessoryBarVisible({ isVisible: true }),
        ]);

        const shown = await Keyboard.addListener('keyboardDidShow', () => {
          document.documentElement.classList.add('keyboard-open');
          document.activeElement?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        });
        const hidden = await Keyboard.addListener('keyboardDidHide', () => {
          document.documentElement.classList.remove('keyboard-open');
        });
        listeners.push(shown, hidden);
        const appStateListener = await App.addListener('appStateChange', ({ isActive }) => {
          publishAppState(isActive);
          try {
            const supabase = getSupabase();
            if (isActive) reconnectRealtime();
            else supabase.auth.stopAutoRefresh();
          } catch {
            // See reconnectRealtime: account recovery is intentionally isolated.
          }
        });
        listeners.push(appStateListener);

        const networkListener = await Network.addListener('networkStatusChange', ({ connected }) => {
          if (connected) reconnectRealtime();
        });
        listeners.push(networkListener);

        const urlListener = await App.addListener('appUrlOpen', ({ url }) => navigate(url));
        listeners.push(urlListener);

        const notificationListener = await PushNotifications.addListener(
          'pushNotificationActionPerformed',
          ({ notification }) => navigate(getNotificationDestination(notification.data)),
        );
        listeners.push(notificationListener);

        const launchUrl = await App.getLaunchUrl();
        if (launchUrl) navigate(launchUrl.url);

        reconnectRealtime();
      } catch (error) {
        // Safe lifecycle diagnostics only; never include URLs, tokens, payloads,
        // user IDs, or session data.
        console.info('[native] bridge initialization deferred', {
          errorName: error instanceof Error ? error.name : 'unknown',
        });
      } finally {
        await hideSplash();
      }
    };

    void bootstrap();

    return () => {
      disposed = true;
      document.documentElement.classList.remove('capacitor-native', 'keyboard-open');
      void Promise.all(listeners.map((listener) => listener.remove()));
    };
  }, [router]);

  return null;
}
