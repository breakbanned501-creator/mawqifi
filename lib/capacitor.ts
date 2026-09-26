import { Capacitor } from '@capacitor/core';

export const MAWQIFI_NATIVE_SCHEME = 'mawqifi';
export const MAWQIFI_PRODUCTION_ORIGIN = 'https://mawqifiapp.vercel.app';
export const MAWQIFI_NATIVE_POST_ROUTE = '/post/view';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** True only inside an installed Capacitor application, never in the web PWA. */
export function isNativeCapacitor(): boolean {
  return typeof window !== 'undefined' && Capacitor.isNativePlatform();
}

export function isNativeIOS(): boolean {
  return isNativeCapacitor() && Capacitor.getPlatform() === 'ios';
}

function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

function getStaticPostPath(postId: string, conversationId?: string | null): string {
  const params = new URLSearchParams({ id: postId });
  if (conversationId) params.set('chat', conversationId);
  return `${MAWQIFI_NATIVE_POST_ROUTE}?${params.toString()}`;
}

/**
 * Uses one static route for first-party navigation in every runtime. This
 * prevents the locally bundled app from ever requesting an ungenerated
 * `/post/<id>` file before client hydration. Existing browser/PWA deep links
 * are retained through the Vercel compatibility redirect in next.config.js.
 */
export function getMawqifiPostHref(postId: string, conversationId?: string | null): string {
  if (!isUuid(postId) || (conversationId && !isUuid(conversationId))) {
    throw new Error('Invalid Mawqifi post or conversation identifier.');
  }

  return getStaticPostPath(postId, conversationId);
}

/** Converts an existing internal post link to the correct route for this runtime. */
export function getMawqifiCurrentPostHref(href: string): string {
  if (!href.startsWith('/')) return href;

  try {
    const url = new URL(href, MAWQIFI_PRODUCTION_ORIGIN);
    const postMatch = url.pathname.match(/^\/post\/([0-9a-f-]+)$/i);
    if (!postMatch || !isUuid(postMatch[1])) return href;

    const chatId = url.searchParams.get('chat');
    return getMawqifiPostHref(postMatch[1], chatId && isUuid(chatId) ? chatId : null);
  } catch {
    return href;
  }
}

/**
 * Convert an app/notification URL into one of Mawqifi's supported internal
 * routes. Reject everything else so push payloads cannot navigate the WebView
 * to an arbitrary destination.
 */
export function getMawqifiInternalPath(rawUrl: string | null | undefined): string | null {
  if (!rawUrl) return null;

  try {
    // Existing web-push payloads use internal relative paths (for example
    // `/post/<id>?chat=<id>`). Resolve only those against the approved origin
    // before applying the same strict destination allowlist below.
    const url = rawUrl.startsWith('/')
      ? new URL(rawUrl, MAWQIFI_PRODUCTION_ORIGIN)
      : new URL(rawUrl);
    const isCustomScheme = url.protocol === `${MAWQIFI_NATIVE_SCHEME}:`;
    const isProductionUrl = url.origin === MAWQIFI_PRODUCTION_ORIGIN;
    if (!isCustomScheme && !isProductionUrl) return null;

    const pathname = isCustomScheme
      ? `/${[url.hostname, url.pathname.replace(/^\//, '')].filter(Boolean).join('/')}`
      : url.pathname;

    if (pathname === '/' || pathname === '/notifications') return pathname;

    const postMatch = pathname.match(/^\/post\/([0-9a-f-]+)$/i);
    if (!postMatch || !isUuid(postMatch[1])) return null;

    const chatId = url.searchParams.get('chat');
    if (!chatId) return getStaticPostPath(postMatch[1]);
    if (!isUuid(chatId)) return null;
    return getStaticPostPath(postMatch[1], chatId);
  } catch {
    return null;
  }
}

/** Opens external HTTPS destinations outside Mawqifi's native navigation. */
export async function openExternalUrl(rawUrl: string): Promise<void> {
  const url = new URL(rawUrl);
  if (url.protocol !== 'https:') throw new Error('Only HTTPS external URLs are supported.');

  if (isNativeCapacitor()) {
    const { Browser } = await import('@capacitor/browser');
    await Browser.open({ url: url.href });
    return;
  }

  window.open(url.href, '_blank', 'noopener,noreferrer');
}

/** A small native acknowledgement for a completed student action. */
export async function triggerNativeLightHaptic(): Promise<void> {
  if (!isNativeCapacitor()) return;

  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    // Native feedback is optional and must never affect the saved action.
  }
}
