import { ReactNode } from 'react';

interface AIResultCardProps {
  icon: ReactNode;
  title: string;
  content: string;
  color: 'cyan' | 'yellow' | 'emerald' | 'blue' | 'purple' | 'amber';
}

const colorStyles = {
  cyan: 'border-cyan-400/30 bg-cyan-500/5',
  yellow: 'border-yellow-400/30 bg-yellow-500/5',
  emerald: 'border-emerald-400/30 bg-emerald-500/5',
  blue: 'border-blue-400/30 bg-blue-500/5',
  purple: 'border-purple-400/30 bg-purple-500/5',
  amber: 'border-amber-400/30 bg-amber-500/5',
};

export default function AIResultCard({ icon, title, content, color }: AIResultCardProps) {
  return (
    <div className={`glass-card border p-5 transition-all hover:border-white/20 ${colorStyles[color]}`}>
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-navy-950/50">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="mb-2 text-base font-extrabold text-white">{title}</h3>
          <p className="text-sm leading-7 text-white/70">{content}</p>
        </div>
      </div>
    </div>
  );
}
