'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale } from '@/components/LocaleProvider';
import {
  getTextDirection,
  readStoredLocale,
  translate,
  type Locale,
  type TranslationKey,
} from '@/lib/i18n';

export default function ConfigError({
  message,
  messageKey,
}: {
  message?: string;
  messageKey?: TranslationKey;
}) {
  const { t } = useLocale();
  const [storedLocale, setStoredLocale] = useState<Locale | null>(null);
  const earlyT = useMemo(
    () => (key: string) => (storedLocale ? translate(storedLocale, key) : t(key)),
    [storedLocale, t],
  );

  useEffect(() => {
    setStoredLocale(readStoredLocale());
  }, []);

  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center px-6 text-center"
      dir={storedLocale ? getTextDirection(storedLocale) : undefined}
      lang={storedLocale ?? undefined}
    >
      <div className="glass-card max-w-md space-y-4 p-6">
        <h1 className="text-xl font-black text-white">{earlyT('config.title')}</h1>
        <p className="text-sm leading-7 text-white/65">
          {message ?? earlyT(messageKey ?? 'config.body')}
        </p>
        <ul className="text-start text-xs leading-6 text-cyan-100/80">
          <li>NEXT_PUBLIC_SUPABASE_URL</li>
          <li>NEXT_PUBLIC_SUPABASE_ANON_KEY</li>
        </ul>
      </div>
    </main>
  );
}
