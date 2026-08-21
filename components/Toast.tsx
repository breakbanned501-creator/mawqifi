'use client';

import { useEffect } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { useLocale } from '@/components/LocaleProvider';

interface ToastProps {
  message: string;
  visible: boolean;
  onHide?: () => void;
}

export default function Toast({ message, visible, onHide }: ToastProps) {
  const { dir } = useLocale();
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => onHide?.(), 2800);
    return () => clearTimeout(timer);
  }, [visible, onHide]);

  if (!visible) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-4 top-5 z-[70] mx-auto max-w-sm animate-fade-up rounded-2xl border border-cyan-400/30 bg-navy-800/95 p-4 text-white shadow-glow backdrop-blur-xl"
      dir={dir}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-3">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-cyan-400" />
        <p className="text-sm font-bold leading-6">{message}</p>
      </div>
    </div>
  );
}
