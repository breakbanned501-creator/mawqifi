'use client';

import { useState, type MouseEvent } from 'react';
import { ArrowUpRight, FileText, MapPinned } from 'lucide-react';
import { isNativeCapacitor } from '@/lib/capacitor';
import { openOfficialMapUrl } from '@/lib/official-map-links';
import { useLocale } from './LocaleProvider';

type OfficialMapCardProps = {
  title: string;
  description: string;
  href: string;
  sourceUrl: string;
  kind: 'directory' | 'directions' | 'campus' | 'pdf';
};

/** Link-only guidance: no copied map imagery or fabricated map preview. */
export default function OfficialMapCard({ title, description, href, sourceUrl, kind }: OfficialMapCardProps) {
  const { t } = useLocale();
  const [openError, setOpenError] = useState(false);
  const Icon = kind === 'pdf' ? FileText : MapPinned;
  const openSource = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!isNativeCapacitor()) return;
    event.preventDefault();
    const url = event.currentTarget.href;
    setOpenError(false);
    void openOfficialMapUrl(url).catch(() => { setOpenError(true); });
  };
  return (
    <article className="overflow-hidden rounded-3xl border border-cyan-300/20 bg-navy-950/50 p-4 shadow-glow sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-200" aria-hidden="true">
          <Icon className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="mb-1 text-xs font-bold text-cyan-200/80">{t('place.mapKind.' + kind)}</p>
          <h3 className="break-words text-sm font-extrabold leading-6 text-white sm:text-base">{title}</h3>
        </div>
      </div>
      <p className="mt-3 text-sm leading-6 text-white/65">{description}</p>
      <a href={href} target="_blank" rel="noopener noreferrer" onClick={openSource}
        aria-label={t('place.viewOfficialMap') + ' — ' + title}
        className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-cyan-400 px-3 py-3 text-center text-sm font-extrabold text-navy-950 transition-colors hover:bg-cyan-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300">
        {t('place.viewOfficialMap')}<ArrowUpRight className="h-4 w-4 shrink-0" aria-hidden="true" />
      </a>
      <p className="mt-2 text-center text-xs leading-5 text-white/50">{t('place.externalBrowser')}</p>
      <a href={sourceUrl} target="_blank" rel="noopener noreferrer" onClick={openSource}
        className="mt-2 block min-h-11 rounded-xl py-2 text-center text-sm font-bold text-cyan-200 underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300">
        {t('place.officialSource')}
      </a>
      {openError && <p role="alert" className="mt-2 text-sm text-red-200">{t('common.error')}</p>}
    </article>
  );
}
