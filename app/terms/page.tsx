'use client';

import Link from 'next/link';
import { AlertTriangle, Ban, FileText, Shield, Users } from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import PageHeader from '@/components/PageHeader';
import { useLocale } from '@/components/LocaleProvider';

export default function TermsPage() {
  const { t } = useLocale();
  const prohibitedItems = [
    ['terms.falseParkingTitle', 'terms.falseParkingBody'],
    ['terms.harassmentTitle', 'terms.harassmentBody'],
    ['terms.spamTitle', 'terms.spamBody'],
    ['terms.illegalTitle', 'terms.illegalBody'],
  ] as const;

  return (
    <main className="page-with-chrome min-h-screen px-4 pt-6">
      <div className="mx-auto max-w-md space-y-6">
        <PageHeader title={t('terms.title')} subtitle={t('terms.subtitle')} backHref="/" />

        <div className="space-y-4">
          <section className="glass-card space-y-3 p-5"><h2 className="font-bold">{t("handoff.location")}</h2><p className="text-sm leading-7 text-white/70">{t("privacy.locationBody")}</p><p className="text-sm leading-7 text-white/70">{t("privacy.messagesBody")}</p></section>
          <section className="glass-card p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/15">
                <Users className="h-5 w-5 text-cyan-300" />
              </div>
              <h2 className="text-lg font-extrabold text-white">{t('terms.communityTitle')}</h2>
            </div>
            <p className="text-sm leading-7 text-white/70">{t('terms.communityBody')}</p>
          </section>

          <section className="glass-card p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/15">
                <Shield className="h-5 w-5 text-cyan-300" />
              </div>
              <h2 className="text-lg font-extrabold text-white">{t('terms.responsibilityTitle')}</h2>
            </div>
            <p className="text-sm leading-7 text-white/70">{t('terms.responsibilityBody')}</p>
          </section>

          <section className="glass-card p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/15">
                <Ban className="h-5 w-5 text-cyan-300" />
              </div>
              <h2 className="text-lg font-extrabold text-white">{t('terms.prohibitedTitle')}</h2>
            </div>
            <ul className="space-y-3 text-sm leading-7 text-white/70">
              {prohibitedItems.map(([titleKey, bodyKey]) => (
                <li key={titleKey} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
                  <span>
                    <strong className="text-white">{t(titleKey)}</strong> {t(bodyKey)}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="glass-card p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/15">
                <AlertTriangle className="h-5 w-5 text-cyan-300" />
              </div>
              <h2 className="text-lg font-extrabold text-white">{t('terms.reportTitle')}</h2>
            </div>
            <p className="text-sm leading-7 text-white/70">{t('terms.reportBody')}</p>
          </section>

          <section className="glass-card p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/15">
                <FileText className="h-5 w-5 text-cyan-300" />
              </div>
              <h2 className="text-lg font-extrabold text-white">{t('terms.changesTitle')}</h2>
            </div>
            <p className="text-sm leading-7 text-white/70">{t('terms.changesBody')}</p>
          </section>

          <section className="glass-card p-5">
            <h2 className="mb-3 text-lg font-extrabold text-white">{t('terms.complianceTitle')}</h2>
            <p className="text-sm leading-7 text-white/70">{t('terms.complianceBody')}</p>
          </section>

          <section className="glass-card p-5">
            <h2 className="mb-3 text-lg font-extrabold text-white">{t('terms.suspensionTitle')}</h2>
            <p className="text-sm leading-7 text-white/70">{t('terms.suspensionBody')}</p>
          </section>

          <section className="glass-card p-5">
            <h2 className="mb-3 text-lg font-extrabold text-white">{t('terms.contactTitle')}</h2>
            <p className="text-sm leading-7 text-white/70">
              {t('terms.contactPrefix')}
              <Link href="/feedback" className="text-cyan-300 underline">
                {t('feedback.title')}
              </Link>
            </p>
          </section>

          <section className="glass-card border-2 border-cyan-500/30 p-5">
            <p className="text-center text-sm font-bold text-cyan-200">{t('terms.confirmation')}</p>
          </section>
        </div>
      </div>
      <BottomNav />
    </main>
  );
}
