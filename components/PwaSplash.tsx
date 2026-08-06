'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { isStandaloneMode } from '@/lib/pwa';

/** Brief branded splash when opened as installed PWA */
export default function PwaSplash() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isStandaloneMode()) return;
    setVisible(true);
    const timer = window.setTimeout(() => setVisible(false), 700);
    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[#0a1128] animate-fade-up"
      aria-hidden
    >
      <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-cyan-500 shadow-[0_0_48px_rgba(0,212,255,0.45)]">
        <Image src="/icon-192.png" alt="" width={72} height={72} className="rounded-2xl" priority />
      </div>
      <h1 className="text-2xl font-black text-white">موقفي</h1>
      <p className="mt-2 text-sm text-white/55">جامعة الكويت — الشدادية</p>
      <div className="mt-8 h-1 w-16 overflow-hidden rounded-full bg-white/10">
        <div className="h-full w-1/2 animate-pulse-soft rounded-full bg-cyan-500" />
      </div>
    </div>
  );
}
