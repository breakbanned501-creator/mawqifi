'use client';

import Link from 'next/link';
import { Eye, Lock, MapPin, MessageCircle, Shield } from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import PageHeader from '@/components/PageHeader';
import { useLocale } from '@/components/LocaleProvider';

export default function PrivacyPage() {
  const { t } = useLocale();

  return (
    <main className="page-with-chrome min-h-screen px-4 pt-6">
      <div className="mx-auto max-w-md space-y-6">
        <PageHeader title={t('privacy.title')} subtitle={t('privacy.subtitle')} backHref="/" />

        <div className="space-y-4">
          <section className="glass-card p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/15">
                <Shield className="h-5 w-5 text-cyan-300" />
              </div>
              <h2 className="text-lg font-extrabold text-white">{t('privacy.commitmentTitle')}</h2>
            </div>
            <p className="text-sm leading-7 text-white/70">{t('privacy.commitmentBody')}</p>
          </section>

          <section className="glass-card p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/15">
                <MapPin className="h-5 w-5 text-cyan-300" />
              </div>
              <h2 className="text-lg font-extrabold text-white">{t('privacy.locationTitle')}</h2>
            </div>
            <p className="text-sm leading-7 text-white/70">{t('privacy.locationBody')}</p>
          </section>

          <section className="glass-card p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/15">
                <MessageCircle className="h-5 w-5 text-cyan-300" />
              </div>
              <h2 className="text-lg font-extrabold text-white">{t('privacy.messagesTitle')}</h2>
            </div>
            <p className="text-sm leading-7 text-white/70">{t('privacy.messagesBody')}</p>
          </section>

          <section className="glass-card p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/15">
                <Eye className="h-5 w-5 text-cyan-300" />
              </div>
              <h2 className="text-lg font-extrabold text-white">{t('privacy.parkingTitle')}</h2>
            </div>
            <p className="text-sm leading-7 text-white/70">{t('privacy.parkingBody')}</p>
          </section>

          <section className="glass-card p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/15">
                <Lock className="h-5 w-5 text-cyan-300" />
              </div>
              <h2 className="text-lg font-extrabold text-white">{t('privacy.noSaleTitle')}</h2>
            </div>
            <p className="text-sm leading-7 text-white/70">{t('privacy.noSaleBody')}</p>
          </section>

          <section className="glass-card p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/15">
                <Shield className="h-5 w-5 text-cyan-300" />
              </div>
              <h2 className="text-lg font-extrabold text-white">{t('privacy.analyticsTitle')}</h2>
            </div>
            <p className="text-sm leading-7 text-white/70">{t('privacy.analyticsBody')}</p>
          </section>

          <section className="glass-card p-5">
            <h2 className="mb-3 text-lg font-extrabold text-white">{t('privacy.rightsTitle')}</h2>
            <ul className="space-y-2 text-sm leading-7 text-white/70">
              {[t('privacy.rightAccess'), t('privacy.rightDelete'), t('privacy.rightEdit'), t('privacy.rightWithdraw')].map(
                (right) => (
                  <li key={right} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400" />
                    <span>{right}</span>
                  </li>
                ),
              )}
            </ul>
          </section>

          <section className="glass-card p-5">
            <h2 className="mb-3 text-lg font-extrabold text-white">{t('privacy.contactTitle')}</h2>
            <p className="text-sm leading-7 text-white/70">
              {t('privacy.contactPrefix')}
              <Link href="/feedback" className="text-cyan-300 underline">
                {t('feedback.title')}
              </Link>
            </p>
          </section>
        </div>
      </div>
      <BottomNav />
    </main>
  );
}
