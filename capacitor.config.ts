import type { CapacitorConfig } from '@capacitor/cli';
import { KeyboardResize } from '@capacitor/keyboard';

/**
 * Mawqifi remains a server-backed Next.js application. The native bridge loads
 * the existing HTTPS origin so the same Vercel route handlers, Supabase
 * realtime connections, and authenticated relative API calls are retained.
 *
 * Capacitor documents `server.url` as a live-reload setting, so this is an
 * integration foundation rather than an App Store release configuration. Do
 * not point it at an untrusted or cleartext origin, and do not ship a release
 * until the versioned native-web delivery strategy is approved.
 */
const config: CapacitorConfig = {
  appId: 'com.mawqifi.app',
  appName: 'Mawqifi',
  webDir: 'capacitor-shell',
  backgroundColor: '#0a1128',
  // Keep native and JavaScript logs out of release builds.
  loggingBehavior: 'debug',
  ios: {
    contentInset: 'never',
    preferredContentMode: 'mobile',
    webContentsDebuggingEnabled: false,
  },
  server: {
    // This is intentionally the one production origin used by the web app.
    // Never substitute a development, preview, or non-HTTPS URL here.
    url: 'https://mawqifiapp.vercel.app',
    cleartext: false,
  },
  plugins: {
    Keyboard: {
      resize: KeyboardResize.Body,
    },
    SplashScreen: {
      launchAutoHide: false,
      launchShowDuration: 0,
      backgroundColor: '#0a1128',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0a1128',
      overlaysWebView: false,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'banner', 'list'],
    },
  },
};

export default config;
