'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell, CheckCheck } from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import PageHeader from '@/components/PageHeader';
import {
  getNotifications,
  saveNotifications,
  unreadCount,
  type AppNotification,
} from '@/lib/notifications';

export default function NotificationsPage() {
  const [items, setItems] = useState<AppNotification[]>([]);

  useEffect(() => {
    setItems(getNotifications());
  }, []);

  const markAllRead = () => {
    const next = items.map((item) => ({ ...item, read: true }));
    saveNotifications(next);
    setItems(next);
  };

  const markRead = (id: string) => {
    const next = items.map((item) => (item.id === id ? { ...item, read: true } : item));
    saveNotifications(next);
    setItems(next);
  };

  const unread = unreadCount(items);

  return (
    <main className="min-h-screen px-4 pb-28 pt-6">
      <div className="mx-auto max-w-md space-y-5">
        <PageHeader
          title="التنبيهات"
          subtitle={unread > 0 ? `${unread} تنبيهات غير مقروءة` : 'لا توجد تنبيهات جديدة'}
          backHref="/"
          action={
            unread > 0 ? (
              <button
                type="button"
                onClick={markAllRead}
                className="flex items-center gap-1 rounded-2xl bg-white/10 px-3 py-2 text-xs font-bold text-cyan-200"
              >
                <CheckCheck className="h-4 w-4" />
                قراءة الكل
              </button>
            ) : null
          }
        />

        <div className="space-y-3">
          {items.map((item) => {
            const content = (
              <article
                className={`glass-card flex gap-3 p-4 transition-colors ${item.read ? 'opacity-70' : 'border-cyan-400/25'}`}
              >
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${item.read ? 'bg-white/10 text-white/50' : 'bg-cyan-500/15 text-cyan-300'}`}>
                  <Bell className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-extrabold text-white">{item.title}</h2>
                    {!item.read && <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-cyan-400" />}
                  </div>
                  <p className="mt-1 text-sm leading-6 text-white/65">{item.body}</p>
                  <p className="mt-2 text-xs text-white/40">
                    {new Date(item.created_at).toLocaleString('ar-KW', {
                      hour: '2-digit',
                      minute: '2-digit',
                      day: 'numeric',
                      month: 'short',
                    })}
                  </p>
                </div>
              </article>
            );

            if (item.href) {
              return (
                <Link key={item.id} href={item.href} onClick={() => markRead(item.id)}>
                  {content}
                </Link>
              );
            }

            return (
              <button key={item.id} type="button" className="block w-full text-start" onClick={() => markRead(item.id)}>
                {content}
              </button>
            );
          })}
        </div>
      </div>
      <BottomNav />
    </main>
  );
}
