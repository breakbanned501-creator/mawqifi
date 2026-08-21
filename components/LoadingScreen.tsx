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

export default function LoadingScreen({
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
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center"
      dir={storedLocale ? getTextDirection(storedLocale) : undefined}
      lang={storedLocale ?? undefined}
    >
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent" />
      <p className="text-sm font-bold text-white/70">
        {message ?? earlyT(messageKey ?? 'common.loading')}
      </p>
    </div>
  );
}
