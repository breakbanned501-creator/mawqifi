'use client';

import BottomNav from '@/components/BottomNav';
import PageHeader from '@/components/PageHeader';
import { useLocale } from '@/components/LocaleProvider';
import { MAWQIFI_VERSION } from '@/lib/app-update';

export default function AboutPage() {
  const { t, dir } = useLocale();

  return (
    <main className="page-with-chrome min-h-screen px-4 pt-6" dir={dir}>
      <div className="mx-auto max-w-md space-y-5">
        <PageHeader title={t('settings.about')} subtitle={t('settings.aboutDescription')} backHref="/settings" />
        <section className="glass-card p-6 text-center">
          <h1 className="text-2xl font-black text-white">موقفي <span dir="ltr">Mawqifi</span></h1>
          <p className="mt-3 text-sm leading-7 text-white/60">{t('settings.communityNotice')}</p>
          <p className="mt-6 text-xs font-semibold text-white/35" aria-label={`${t('settings.version')}; ${MAWQIFI_VERSION}`}>
            {t('settings.version')}
          </p>
        </section>
      </div>
      <BottomNav />
    </main>
  );
}
