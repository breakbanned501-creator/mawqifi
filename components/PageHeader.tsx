'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useLocale } from '@/components/LocaleProvider';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  backHref?: string;
  action?: ReactNode;
}

export default function PageHeader({ title, subtitle, backHref, action }: PageHeaderProps) {
  const { dir, t } = useLocale();
  const BackIcon = dir === 'rtl' ? ArrowRight : ArrowLeft;

  return (
    <header className="mb-5 flex items-start justify-between gap-2.5 sm:gap-3">
      <div className="flex min-w-0 flex-1 items-center gap-2.5 sm:gap-3">
        {backHref && (
          <Link
            href={backHref}
            className="shrink-0 rounded-2xl bg-white/10 p-2.5 sm:p-3 text-white/70 transition-colors hover:bg-white/15 hover:text-cyan-200"
            aria-label={t('common.back')}
          >
            <BackIcon className="h-5 w-5" />
          </Link>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl font-black leading-tight text-white truncate">{title}</h1>
          {subtitle && <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm leading-5 sm:leading-6 text-white/60 truncate">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}
