'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import BottomNav from '@/components/BottomNav';
import PageHeader from '@/components/PageHeader';
import { useLocale } from '@/components/LocaleProvider';
import { MAWQIFI_VERSION } from '@/lib/app-update';

const REVIEW_TAPS_REQUIRED = 5;
const TAP_SEQUENCE_TIMEOUT_MS = 5000;

export default function AboutPage() {
  const router = useRouter();
  const { t, dir } = useLocale();
  const tapCount = useRef(0);
  const resetTimer = useRef<number | null>(null);

  useEffect(() => () => {
    if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
  }, []);

  const handleVersionTap = () => {
    tapCount.current += 1;
    if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
    if (tapCount.current >= REVIEW_TAPS_REQUIRED) {
      tapCount.current = 0;
      router.push('/review-demo');
      return;
    }
    resetTimer.current = window.setTimeout(() => { tapCount.current = 0; }, TAP_SEQUENCE_TIMEOUT_MS);
  };

  return (
    <main className="page-with-chrome min-h-screen px-4 pt-6" dir={dir}>
      <div className="mx-auto max-w-md space-y-5">
        <PageHeader title={t('settings.about')} subtitle={t('settings.aboutDescription')} backHref="/settings" />
        <section className="glass-card p-6 text-center">
          <h1 className="text-2xl font-black text-white">موقفي <span dir="ltr">Mawqifi</span></h1>
          <p className="mt-3 text-sm leading-7 text-white/60">{t('settings.communityNotice')}</p>
          <button
            type="button"
            onClick={handleVersionTap}
            className="mt-6 rounded-xl px-4 py-2 text-xs font-semibold text-white/35 transition-colors hover:bg-white/5 hover:text-white/55"
            aria-label={`${t('settings.version')}; ${MAWQIFI_VERSION}`}
          >
            {t('settings.version')}
          </button>
        </section>
      </div>
      <BottomNav />
    </main>
  );
}
