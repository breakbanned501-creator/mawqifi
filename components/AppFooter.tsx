import Link from 'next/link';

/** Standalone footer for screens without bottom navigation (auth, chat) */
export default function AppFooter() {
  return (
    <footer className="mt-auto border-t border-white/10 px-4 py-6 text-center">
      <div className="mb-4 flex flex-wrap justify-center gap-4 text-xs">
        <Link href="/privacy" className="text-cyan-300 hover:underline">
          سياسة الخصوصية
        </Link>
        <Link href="/terms" className="text-cyan-300 hover:underline">
          الشروط والأحكام
        </Link>
        <Link href="/feedback" className="text-cyan-300 hover:underline">
          تواصل معنا
        </Link>
      </div>
      <p className="text-[10px] font-semibold leading-5 text-white/40 sm:text-xs">
        © 2026 موقفي — الإصدار التجريبي v1.0 — Developed by Eid Althaydi
      </p>
    </footer>
  );
}
