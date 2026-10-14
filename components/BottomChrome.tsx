'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, MessageCircle, PlusCircle, User } from 'lucide-react';
import { publishTiming } from '@/lib/publish-timing';
import { useLocale } from '@/components/LocaleProvider';

/** Fixed footer + bottom navigation — always visible together */
export default function BottomChrome() {
  const pathname = usePathname();
  const { t } = useLocale();
  const reverseMatching = process.env.NEXT_PUBLIC_REVERSE_MATCHING === '1';
  const items = [
    { href: '/', label: t('nav.home'), icon: Home },
    ...(reverseMatching ? [] : [{ href: '/create', label: t('nav.create'), icon: PlusCircle }]),
    { href: '/conversations', label: t('nav.conversations'), icon: MessageCircle },
    { href: '/settings', label: t('nav.account'), icon: User },
  ];

  return (
    <div className="bottom-chrome fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-navy-950/95 shadow-[0_-8px_32px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
      <footer className="border-b border-white/5 px-4 py-2.5 text-center">
        <p className="text-[10px] font-semibold leading-5 text-white/40 sm:text-xs">
          {t('footer.credit')}
        </p>
      </footer>
      <nav className="safe-bottom px-1.5 sm:px-3 pb-2 pt-1.5" aria-label={t('nav.main')}>
        <div className={`mx-auto grid w-full max-w-md min-[440px]:max-w-lg md:max-w-xl ${reverseMatching ? 'grid-cols-3' : 'grid-cols-4'} gap-0.5 min-[360px]:gap-1`}>
          {items.map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                data-tutorial-target={item.href === '/conversations' ? 'chat' : undefined}
                onClick={() => {if(item.href==='/create')publishTiming('tap');}}
                className={`flex flex-col items-center justify-center gap-1 rounded-2xl px-1 py-1.5 min-[360px]:px-1.5 min-[360px]:py-2 transition-all ${
                  active
                    ? 'bg-cyan-500 text-navy-900 shadow-lg shadow-cyan-500/20'
                    : 'text-white/55 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="font-bold leading-none text-[10px] min-[360px]:text-[11px] sm:text-xs truncate max-w-full">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
