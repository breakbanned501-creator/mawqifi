'use client';

import { AlertTriangle, AlertCircle } from 'lucide-react';
import { useLocale } from '@/components/LocaleProvider';

interface WarningCardProps {
  type: 'yellow' | 'red';
  title: string;
  message: string;
}

const warningStyles = {
  yellow: 'border-yellow-400/30 bg-yellow-500/10 shadow-yellow-500/20',
  red: 'border-red-400/30 bg-red-500/10 shadow-red-500/20',
};

const warningIcons = {
  yellow: <AlertTriangle className="h-5 w-5 text-yellow-300" />,
  red: <AlertCircle className="h-5 w-5 text-red-300" />,
};

export default function WarningCard({ type, title, message }: WarningCardProps) {
  const { dir } = useLocale();

  return (
    <div className={`glass-card animate-fade-up border-2 p-5 shadow-lg ${warningStyles[type]}`} dir={dir}>
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-navy-950/50">
          {warningIcons[type]}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="mb-2 text-start text-base font-extrabold text-white">{title}</h3>
          <p className="text-start text-sm leading-7 text-white/70">{message}</p>
        </div>
      </div>
    </div>
  );
}
