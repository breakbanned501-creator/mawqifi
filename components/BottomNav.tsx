'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Map, MessageCircle, PlusCircle, User } from 'lucide-react';

const items = [
  { href: '/', label: 'الرئيسية', icon: Home },
  { href: '/create', label: 'نشر', icon: PlusCircle },
  { href: '/conversations', label: 'محادثات', icon: MessageCircle },
  { href: '/map', label: 'الخريطة', icon: Map },
  { href: '/settings', label: 'حسابي', icon: User },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-navy-950/90 px-2 pb-2 pt-2 backdrop-blur-2xl">
      <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 rounded-2xl px-1.5 py-2 text-[11px] transition-all ${
                active ? 'bg-cyan-500 text-navy-900 shadow-lg shadow-cyan-500/20' : 'text-white/55 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="font-bold leading-none">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
