'use client';

import Link from 'next/link';
import { Bell, Car, RefreshCw } from 'lucide-react';
import { useLocale } from './LocaleProvider';

export default function HomeHeader({ unreadCount, onRefresh }: {
  unreadCount: number;
  onRefresh: () => void;
}) {
  const { t, dir, formatNumber } = useLocale();
  const count = Math.max(0, unreadCount);
  const badge = formatNumber(Math.min(count, 99)) + (count > 99 ? '+' : '');
  return (
    <header className="mb-5 grid min-h-16 grid-cols-[3rem_minmax(0,1fr)_6rem] items-center gap-2" dir={dir}>
      <div className="relative isolate flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-cyan-500 shadow-glow">
        <Car size={22} className="text-navy-900" aria-hidden="true" />
        {count > 0 && (
          <span aria-hidden="true" dir="ltr"
            className="absolute end-0.5 top-0.5 flex h-4 min-w-4 max-w-10 items-center justify-center rounded-full bg-navy-950 px-1 text-[10px] font-black leading-none text-cyan-200 ring-1 ring-cyan-200/30">
            {badge}
          </span>
        )}
      </div>
      <div className="min-w-0 text-start">
        <h1 className="text-xl font-black leading-normal text-white sm:text-2xl">{t('home.title')}</h1>
        <p className="mt-2 break-words text-xs leading-5 text-white/60 sm:text-sm">{t('home.subtitle')}</p>
      </div>
      <div className="grid grid-cols-2 items-center gap-1">
        <Link href="/notifications" data-tutorial-target="notifications"
          className="flex h-11 w-11 items-center justify-center rounded-2xl text-white/60 transition-colors hover:bg-white/10 hover:text-cyan-300"
          aria-label={t('home.notifications') + (count > 0 ? ' (' + formatNumber(count) + ')' : '')}>
          <Bell size={20} aria-hidden="true" />
        </Link>
        <button type="button" onClick={onRefresh}
          className="flex h-11 w-11 items-center justify-center rounded-2xl text-white/60 transition-colors hover:bg-white/10 hover:text-cyan-300"
          aria-label={t('common.refresh')}>
          <RefreshCw size={20} aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
