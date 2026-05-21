'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import ErrorBanner from '@/components/ErrorBanner';
import LoadingScreen from '@/components/LoadingScreen';
import PageHeader from '@/components/PageHeader';
import { useAuth } from '@/components/AuthProvider';
import { fetchNotifications, unreadCount, type AppNotification } from '@/lib/notifications';
import { markConversationRead } from '@/lib/conversations';

export default function NotificationsPage() {
  const { userId } = useAuth();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setError(null);
    try {
      setItems(await fetchNotifications(userId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحميل التنبيهات');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleOpen = async (item: AppNotification) => {
    if (!userId) return;
    try {
      await markConversationRead(item.id, userId);
      setItems((current) => current.filter((n) => n.id !== item.id));
    } catch {
      /* still navigate */
    }
  };

  const unread = unreadCount(items);

  if (loading) return <LoadingScreen message="جاري تحميل التنبيهات..." />;

  return (
    <main className="page-with-chrome min-h-screen px-4 pt-6">
      <div className="mx-auto max-w-md space-y-5">
        <PageHeader
          title="التنبيهات"
          subtitle={unread > 0 ? `${unread} تنبيهات غير مقروءة` : 'لا توجد تنبيهات جديدة'}
          backHref="/"
        />

        {error && <ErrorBanner message={error} onRetry={() => { setLoading(true); void load(); }} />}

        {items.length === 0 ? (
          <div className="glass-card py-10 text-center text-sm text-white/55">لا توجد تنبيهات جديدة</div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <Link
                key={item.id}
                href={item.href ?? '/conversations'}
                onClick={() => void handleOpen(item)}
                className="block glass-card border-cyan-400/25 p-4"
              >
                <article className="flex gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-cyan-500/15 text-cyan-300">
                    <Bell className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="font-extrabold text-white">{item.title}</h2>
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
              </Link>
            ))}
          </div>
        )}
      </div>
      <BottomNav />
    </main>
  );
}
