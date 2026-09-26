import type { CapacitorConfig } from '@capacitor/cli';
import { KeyboardResize } from '@capacitor/keyboard';
import {
  MAWQIFI_CAPACITOR_HOSTNAME,
  MAWQIFI_CAPACITOR_IOS_SCHEME,
} from './lib/capacitor-origin';

/**
 * Archive-safe Capacitor configuration. Release builds load the locally copied
 * `out` bundle; server-authoritative calls are resolved explicitly by
 * `lib/server-api.ts`, not by a remote WebView URL. Live reload is opt-in via
 * the Capacitor CLI and is never stored in this production configuration.
 */
const config: CapacitorConfig = {
  appId: 'com.mawqifi.app',
  appName: 'Mawqifi',
  webDir: 'out',
  backgroundColor: '#0a1128',
  loggingBehavior: 'production',
  ios: {
    contentInset: 'never',
    preferredContentMode: 'mobile',
    webContentsDebuggingEnabled: false,
  },
  server: {
    // Explicit defaults make the local iOS CORS origin deterministic. There
    // must never be a production `server.url` here.
    hostname: MAWQIFI_CAPACITOR_HOSTNAME,
    iosScheme: MAWQIFI_CAPACITOR_IOS_SCHEME,
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
