import { isNativeCapacitor } from './capacitor';

const officialMapHosts = new Set([
  'www.paaet.edu.kw', 'www.gust.edu.kw', 'maps.app.goo.gl', 'engineering.ku.edu.kw',
]);

/** Open verified map sources through the OS URL handler, never the local WebView. */
export async function openOfficialMapUrl(rawUrl: string): Promise<void> {
  const url = new URL(rawUrl);
  if (url.protocol !== 'https:' || url.username || url.password || !officialMapHosts.has(url.hostname)) {
    throw new Error('Unsupported official map source.');
  }
  if (isNativeCapacitor()) {
    const { AppLauncher } = await import('@capacitor/app-launcher');
    const { completed } = await AppLauncher.openUrl({ url: url.href });
    if (!completed) throw new Error('Could not open the official map source.');
    return;
  }
  window.open(url.href, '_blank', 'noopener,noreferrer');
}
