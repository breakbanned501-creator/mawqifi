'use client';

import { type MouseEvent } from 'react';
import { ExternalLink, MessageCircle } from 'lucide-react';
import { useLocale } from '@/components/LocaleProvider';
import { MAWQIFI_WHATSAPP_CHANNEL_URL } from '@/lib/links';
import { isNativeCapacitor, openExternalUrl } from '@/lib/capacitor';

/** A low-friction link to Mawqifi's official announcement channel. */
export default function WhatsAppChannelCta() {
  const { t } = useLocale();

  const handleChannelClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!isNativeCapacitor()) return;
    event.preventDefault();
    void openExternalUrl(MAWQIFI_WHATSAPP_CHANNEL_URL).catch(() => undefined);
  };

  return (
    <section className="glass-card mb-6 border-cyan-400/20 bg-cyan-500/[0.06] p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3 text-start">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-cyan-500/15 text-cyan-300">
            <MessageCircle className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-extrabold text-white sm:text-lg">
              {t('whatsapp.channelTitle')}
            </h2>
            <p className="mt-1 text-sm leading-6 text-white/65">
              {t('whatsapp.channelDescription')}
            </p>
          </div>
        </div>

        <a
          href={MAWQIFI_WHATSAPP_CHANNEL_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleChannelClick}
          aria-label={t('whatsapp.channelAria')}
          className="btn inline-flex w-full shrink-0 items-center justify-center gap-2 border border-cyan-300/25 bg-cyan-400/10 text-cyan-50 hover:bg-cyan-400/20 sm:w-auto"
        >
          <span>{t('whatsapp.joinChannel')}</span>
          <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
        </a>
      </div>
      <p className="mt-3 text-start text-xs leading-5 text-white/45">{t('whatsapp.channelNote')}</p>
    </section>
  );
}
