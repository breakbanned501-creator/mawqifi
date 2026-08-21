'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import {
  formatLocaleDate,
  formatLocaleNumber,
  formatLocaleRelativeTime,
  getLocaleTag,
  getTextDirection,
  isLocale,
  persistLocale,
  readStoredLocale,
  translate,
  type Locale,
  type TextDirection,
  type TranslationKey,
  type TranslationValues,
} from '@/lib/i18n';
import { getSupabase } from '@/lib/supabase';

type LocaleContextValue = {
  locale: Locale;
  localeTag: string;
  dir: TextDirection;
  isArabic: boolean;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, values?: TranslationValues) => string;
  formatDate: (value: Date | string | number, options?: Intl.DateTimeFormatOptions) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  formatRelativeTime: (
    value: number,
    unit: Intl.RelativeTimeFormatUnit,
    options?: Intl.RelativeTimeFormatOptions,
  ) => string;
};

const defaultLocale: Locale = 'ar';

const LocaleContext = createContext<LocaleContextValue>({
  locale: defaultLocale,
  localeTag: getLocaleTag(defaultLocale),
  dir: getTextDirection(defaultLocale),
  isArabic: true,
  setLocale: () => {},
  t: (key, values) => translate(defaultLocale, key, values),
  formatDate: (value, options) => formatLocaleDate(defaultLocale, value, options),
  formatNumber: (value, options) => formatLocaleNumber(defaultLocale, value, options),
  formatRelativeTime: (value, unit, options) =>
    formatLocaleRelativeTime(defaultLocale, value, unit, options),
});

export function useLocale() {
  return useContext(LocaleContext);
}

/**
 * Keeps the preferred UI language local for instant switching and in the
 * authenticated user's private preferences row for cross-device continuity.
 */
export default function LocaleProvider({ children }: { children: ReactNode }) {
  const { userId } = useAuth();
  const pathname = usePathname();
  const [locale, setLocaleState] = useState<Locale>(defaultLocale);
  const localeRef = useRef<Locale>(defaultLocale);
  const hasStoredLocaleRef = useRef(false);
  const selectionVersionRef = useRef(0);

  const applyLocale = useCallback((nextLocale: Locale) => {
    localeRef.current = nextLocale;
    setLocaleState(nextLocale);
    persistLocale(nextLocale);
  }, []);

  useEffect(() => {
    const storedLocale = readStoredLocale();
    if (storedLocale) {
      hasStoredLocaleRef.current = true;
      applyLocale(storedLocale);
    }
  }, [applyLocale]);

  useEffect(() => {
    const root = document.documentElement;
    root.lang = locale;
    root.dir = getTextDirection(locale);
    document.title = translate(locale, 'app.documentTitle');

    const description = document.querySelector('meta[name="description"]');
    if (description) {
      description.setAttribute('content', translate(locale, 'app.documentDescription'));
    }
  }, [locale, pathname]);

  const saveLocaleForUser = useCallback(async (nextLocale: Locale, targetUserId: string) => {
    try {
      const { error } = await getSupabase()
        .from('user_notification_preferences')
        .upsert(
          {
            user_id: targetUserId,
            locale: nextLocale,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' },
        );

      // The preferences migration can be deployed after this client bundle.
      // Keep local persistence working when that table is not available yet.
      if (error) return;
    } catch {
      // Do not block language switching when offline or during a staged rollout.
    }
  }, []);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    const selectionVersionAtStart = selectionVersionRef.current;

    const loadLocalePreference = async () => {
      try {
        const { data, error } = await getSupabase()
          .from('user_notification_preferences')
          .select('locale')
          .eq('user_id', userId)
          .maybeSingle();

        if (cancelled || selectionVersionAtStart !== selectionVersionRef.current) return;

        if (!error && hasStoredLocaleRef.current) {
          // A browser-level choice is immediately visible and should not flash
          // back to an older account value while the preference is syncing.
          await saveLocaleForUser(localeRef.current, userId);
          return;
        }

        if (!error && isLocale(data?.locale)) {
          applyLocale(data.locale);
          return;
        }

        if (!error && !data) {
          await saveLocaleForUser(localeRef.current, userId);
        }
      } catch {
        // The local preference remains the source of truth until the private
        // preferences table is available or the connection recovers.
      }
    };

    void loadLocalePreference();

    return () => {
      cancelled = true;
    };
  }, [applyLocale, saveLocaleForUser, userId]);

  const setLocale = useCallback(
    (nextLocale: Locale) => {
      if (!isLocale(nextLocale)) return;

      selectionVersionRef.current += 1;
      applyLocale(nextLocale);

      if (userId) {
        void saveLocaleForUser(nextLocale, userId);
      }
    },
    [applyLocale, saveLocaleForUser, userId],
  );

  const value = useMemo<LocaleContextValue>(() => {
    const localeTag = getLocaleTag(locale);
    return {
      locale,
      localeTag,
      dir: getTextDirection(locale),
      isArabic: locale === 'ar',
      setLocale,
      t: (key, values) => translate(locale, key, values),
      formatDate: (date, options) => formatLocaleDate(locale, date, options),
      formatNumber: (number, options) => formatLocaleNumber(locale, number, options),
      formatRelativeTime: (number, unit, options) =>
        formatLocaleRelativeTime(locale, number, unit, options),
    };
  }, [locale, setLocale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}
