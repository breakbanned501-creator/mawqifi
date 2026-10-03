'use client';

import { useEffect } from 'react';
import { CheckCircle2, Info } from 'lucide-react';
import { useLocale } from '@/components/LocaleProvider';

interface ToastProps {
  message: string;
  visible: boolean;
  onHide?: () => void;
  duration?: number;
  resetKey?: number;
  variant?: 'success' | 'info';
}

export default function Toast({ message, visible, onHide, duration = 2800, resetKey = 0, variant = 'success' }: ToastProps) {
  const { dir } = useLocale();
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => onHide?.(), duration);
    return () => clearTimeout(timer);
  }, [visible, onHide, duration, resetKey]);

  if (!visible) return null;

  const Icon = variant === 'info' ? Info : CheckCircle2;
  return (
    <div
      className="pointer-events-none fixed inset-x-4 top-5 z-[70] mx-auto max-w-sm animate-fade-up rounded-2xl border border-cyan-400/30 bg-navy-800/95 p-4 text-white shadow-glow backdrop-blur-xl"
      dir={dir}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-3">
        <Icon className="h-5 w-5 shrink-0 text-cyan-400" aria-hidden="true" />
        <p className="text-sm font-bold leading-6">{message}</p>
      </div>
    </div>
  );
}
