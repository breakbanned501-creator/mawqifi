'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useLocale } from '@/components/LocaleProvider';
import { isNativeIOS, openExternalUrl } from '@/lib/capacitor';
import {
  fetchPublishedIOSVersion,
  isNewerVersion,
  MAWQIFI_APP_STORE_URL,
} from '@/lib/app-update';

const PASSIVE_ROUTES = new Set(['/', '/about', '/settings']);
const DISMISSED_VERSION_KEY = 'mawqifi.dismissed-ios-update';

export default function UpdateAvailableNotice() {
  const pathname = usePathname();
  const { t, dir } = useLocale();
  const [availableVersion, setAvailableVersion] = useState<string | null>(null);

  useEffect(() => {
    if (!isNativeIOS()) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);

    void (async () => {
      try {
        const [{ App }, published] = await Promise.all([
          import('@capacitor/app'),
          fetchPublishedIOSVersion(controller.signal),
        ]);
        if (!published) return;
        const { version: installed } = await App.getInfo();
        if (
          isNewerVersion(installed, published)
          && window.localStorage.getItem(DISMISSED_VERSION_KEY) !== published
        ) {
          setAvailableVersion(published);
        }
      } catch {
        // Offline, timeout and store lookup errors must never interrupt the app.
      } finally {
        window.clearTimeout(timeout);
      }
    })();

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, []);

  if (!availableVersion || !PASSIVE_ROUTES.has(pathname)) return null;

  const dismiss = () => {
    window.localStorage.setItem(DISMISSED_VERSION_KEY, availableVersion);
    setAvailableVersion(null);
  };

  return (
    <aside
      dir={dir}
      role="status"
      aria-live="polite"
      className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-40 mx-auto max-w-md rounded-3xl border border-cyan-300/25 bg-navy-900/95 p-4 shadow-2xl backdrop-blur"
    >
      <button
        type="button"
        onClick={dismiss}
        className="absolute end-3 top-3 rounded-full p-2 text-white/55 hover:bg-white/10 hover:text-white"
        aria-label={t('update.dismiss')}
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
      <div className="pe-9">
        <h2 className="font-extrabold text-white">{t('update.title')}</h2>
        <p className="mt-1 text-sm leading-6 text-white/65">{t('update.body')}</p>
      </div>
      <button
        type="button"
        onClick={() => void openExternalUrl(MAWQIFI_APP_STORE_URL).catch(() => undefined)}
        className="btn btn-primary mt-3 w-full py-2.5 text-sm"
      >
        {t('update.now')}
      </button>
    </aside>
  );
}
