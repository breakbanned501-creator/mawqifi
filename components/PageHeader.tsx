import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  backHref?: string;
  action?: ReactNode;
}

export default function PageHeader({ title, subtitle, backHref, action }: PageHeaderProps) {
  return (
    <header className="mb-5 flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        {backHref && (
          <Link
            href={backHref}
            className="shrink-0 rounded-2xl bg-white/10 p-3 text-white/70 transition-colors hover:bg-white/15 hover:text-cyan-200"
            aria-label="رجوع"
          >
            <ArrowRight className="h-5 w-5" />
          </Link>
        )}
        <div className="min-w-0">
          <h1 className="text-2xl font-black leading-tight text-white">{title}</h1>
          {subtitle && <p className="mt-1 text-sm leading-6 text-white/60">{subtitle}</p>}
        </div>
      </div>
      {action}
    </header>
  );
}
