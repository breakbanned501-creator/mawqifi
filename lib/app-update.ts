export const MAWQIFI_APP_STORE_ID = '6818279551';
export const MAWQIFI_APP_STORE_URL = `https://apps.apple.com/app/id${MAWQIFI_APP_STORE_ID}`;
export const MAWQIFI_VERSION = '1.0.1';

const VERSION_PATTERN = /^\d+(?:\.\d+){0,3}$/;

export function isNewerVersion(installed: string, published: string): boolean {
  if (!VERSION_PATTERN.test(installed) || !VERSION_PATTERN.test(published)) return false;
  const current = installed.split('.').map(Number);
  const available = published.split('.').map(Number);
  const length = Math.max(current.length, available.length);

  for (let index = 0; index < length; index += 1) {
    const left = available[index] ?? 0;
    const right = current[index] ?? 0;
    if (left !== right) return left > right;
  }
  return false;
}

type LookupResult = {
  trackId?: number;
  bundleId?: string;
  version?: string;
};

type LookupResponse = {
  resultCount?: number;
  results?: LookupResult[];
};

export async function fetchPublishedIOSVersion(signal?: AbortSignal): Promise<string | null> {
  const response = await fetch(
    `https://itunes.apple.com/lookup?id=${MAWQIFI_APP_STORE_ID}&country=kw&entity=software`,
    { cache: 'no-store', signal },
  );
  if (!response.ok) return null;

  const payload = await response.json() as LookupResponse;
  const app = payload.resultCount === 1 ? payload.results?.[0] : null;
  if (app?.trackId !== Number(MAWQIFI_APP_STORE_ID) || app.bundleId !== 'com.mawqifi.app') return null;
  return app.version && VERSION_PATTERN.test(app.version) ? app.version : null;
}
