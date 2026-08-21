'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { isStandaloneMode } from '@/lib/pwa';
import { useLocale } from '@/components/LocaleProvider';
import { getTextDirection, readStoredLocale, translate, type Locale } from '@/lib/i18n';

/** Brief branded splash when opened as installed PWA */
export default function PwaSplash() {
  const { t } = useLocale();
  const [visible, setVisible] = useState(false);
  const [storedLocale, setStoredLocale] = useState<Locale | null>(null);
  const earlyT = useMemo(
    () => (key: string) => (storedLocale ? translate(storedLocale, key) : t(key)),
    [storedLocale, t],
  );

  useEffect(() => {
    setStoredLocale(readStoredLocale());
    if (!isStandaloneMode()) return;
    setVisible(true);
    const timer = window.setTimeout(() => setVisible(false), 700);
    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[#0a1128] animate-fade-up"
      aria-hidden
      dir={storedLocale ? getTextDirection(storedLocale) : undefined}
      lang={storedLocale ?? undefined}
    >
      <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-cyan-500 shadow-[0_0_48px_rgba(0,212,255,0.45)]">
        <Image src="/icon-192.png" alt="" width={72} height={72} className="rounded-2xl" priority />
      </div>
      <h1 className="text-2xl font-black text-white">{earlyT('app.name')}</h1>
      <p className="mt-2 text-sm text-white/55">{earlyT('app.tagline')}</p>
      <div className="mt-8 h-1 w-16 overflow-hidden rounded-full bg-white/10">
        <div className="h-full w-1/2 animate-pulse-soft rounded-full bg-cyan-500" />
      </div>
    </div>
  );
}
