import { isNativeCapacitor, MAWQIFI_PRODUCTION_ORIGIN } from './capacitor';

const SERVER_API_PATHS = [
  '/api/push/subscribe',
  '/api/push/native-token',
  '/api/push/notify-new-post',
  '/api/push/notify-chat-message',
] as const;

export type MawqifiServerApiPath = (typeof SERVER_API_PATHS)[number];

function isServerApiPath(path: string): path is MawqifiServerApiPath {
  return (SERVER_API_PATHS as readonly string[]).includes(path);
}

/**
 * Resolves only the small set of server-authoritative endpoints that native
 * Mawqifi needs. Browser/PWA calls stay same-origin; Capacitor calls the
 * existing HTTPS Vercel backend with the same bearer-token authorization.
 */
export function getMawqifiServerApiUrl(path: MawqifiServerApiPath): string {
  if (!isServerApiPath(path)) {
    throw new Error('Unsupported Mawqifi server API path.');
  }

  return isNativeCapacitor() ? new URL(path, MAWQIFI_PRODUCTION_ORIGIN).href : path;
}

/**
 * Native requests deliberately omit cookies. The authenticated Supabase bearer
 * token remains mandatory, so an installed app never relies on cross-origin
 * cookie behavior or forwards unrelated browser cookies to Vercel.
 */
export function fetchMawqifiServerApi(
  path: MawqifiServerApiPath,
  init: RequestInit,
): Promise<Response> {
  return fetch(getMawqifiServerApiUrl(path), {
    ...init,
    credentials: isNativeCapacitor() ? 'omit' : init.credentials ?? 'same-origin',
  });
}
