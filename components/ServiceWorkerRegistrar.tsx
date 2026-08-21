'use client';

import { useEffect } from 'react';
import { ensureMawqifiServiceWorker } from '@/lib/service-worker';

/** Starts Mawqifi's single, root-scoped service worker without changing the UI. */
export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;

    void ensureMawqifiServiceWorker().catch((error: unknown) => {
      console.info('[service-worker] bootstrap deferred', {
        errorName: error instanceof Error ? error.name : 'unknown',
      });
    });
  }, []);

  return null;
}
