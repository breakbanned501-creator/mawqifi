'use client';

import Link from 'next/link';
import { useLocale } from '@/components/LocaleProvider';

/** Standalone footer for screens without bottom navigation (auth, chat) */
export default function AppFooter() {
  const { t } = useLocale();

  return (
    <footer className="mt-auto border-t border-white/10 px-4 py-6 text-center">
      <div className="mb-4 flex flex-wrap justify-center gap-4 text-xs">
        <Link href="/privacy" className="text-cyan-300 hover:underline">
          {t('footer.privacy')}
        </Link>
        <Link href="/terms" className="text-cyan-300 hover:underline">
          {t('footer.terms')}
        </Link>
        <Link href="/feedback" className="text-cyan-300 hover:underline">
          {t('footer.feedback')}
        </Link>
      </div>
      <p className="text-[10px] font-semibold leading-5 text-white/40 sm:text-xs">
        {t('footer.credit')}
      </p>
    </footer>
  );
}
