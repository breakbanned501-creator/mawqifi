'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import ErrorBanner from '@/components/ErrorBanner';
import LoadingScreen from '@/components/LoadingScreen';
import PageHeader from '@/components/PageHeader';
import { useAuth } from '@/components/AuthProvider';
import { checkPushSupport, subscribeToPushNotifications } from '@/lib/push';
import { fetchNotifications, unreadCount, type AppNotification } from '@/lib/notifications';
import { markConversationRead } from '@/lib/conversations';

export default function NotificationsPage() {
  const { userId } = useAuth();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushStatusMsg, setPushStatusMsg] = useState<string | null>(null);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushInfo, setPushInfo] = useState(() => checkPushSupport());

  useEffect(() => {
    const info = checkPushSupport();
    setPushInfo(info);
    setPushEnabled(info.permission === 'granted');
  }, []);

  const handleEnablePush = async () => {
    if (!userId) return;
    setPushLoading(true);
    setPushStatusMsg(null);

    const currentSupport = checkPushSupport();
    setPushInfo(currentSupport);

    if (currentSupport.requiresHomeScreen) {
      setPushStatusMsg(currentSupport.errorMessage || 'يجب إضافة موقفي إلى الشاشة الرئيسية أولاً.');
      setPushLoading(false);
      return;
    }

    if (!currentSupport.supported) {
      setPushStatusMsg(currentSupport.errorMessage || 'الإشعارات غير مدعومة على هذا الجهاز أو المتصفح.');
      setPushLoading(false);
      return;
    }

    const res = await subscribeToPushNotifications();
    if (res.success) {
      setPushEnabled(true);
      setPushStatusMsg('الإشعارات مفعلة ✓');
    } else {
      setPushStatusMsg(res.message);
    }
    setPushLoading(false);
  };

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
      <div className="mx-auto max-w-md md:max-w-xl lg:max-w-2xl space-y-5">
        <PageHeader
          title="التنبيهات"
          subtitle={unread > 0 ? `${unread} تنبيهات غير مقروءة` : 'لا توجد تنبيهات جديدة'}
          backHref="/"
        />

        {!pushEnabled && (
          <div className="glass-card border-cyan-400/30 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-cyan-500/15 text-cyan-300">
                  <Bell className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-white">تفعيل الإشعارات الفورية</h3>
                  <p className="text-xs text-white/60">ليصلك تنبيه فور نشر موقف جديد</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void handleEnablePush()}
                disabled={pushLoading}
                className="btn btn-primary shrink-0 px-4 py-2 text-xs"
              >
                {pushLoading ? '...' : 'تفعيل'}
              </button>
            </div>
            {pushStatusMsg && (
              <p className="mt-3 whitespace-pre-line rounded-xl bg-cyan-500/10 p-2.5 text-xs font-bold text-cyan-200">
                {pushStatusMsg}
              </p>
            )}
            {pushInfo.requiresHomeScreen && !pushStatusMsg && (
              <div className="mt-3 rounded-xl border border-cyan-400/25 bg-cyan-500/10 p-3 text-xs leading-5 text-cyan-100">
                <p className="font-extrabold mb-1">لتفعيل إشعارات موقفي على الآيفون:</p>
                <ol className="list-decimal list-inside space-y-0.5 text-white/80">
                  <li>اضغط مشاركة في أسفل المتصفح</li>
                  <li>اختر إضافة إلى الشاشة الرئيسية</li>
                  <li>افتح موقفي من الشاشة الرئيسية</li>
                  <li>اضغط تفعيل الإشعارات</li>
                </ol>
              </div>
            )}
          </div>
        )}

        {error && <ErrorBanner message={error} onRetry={() => { setLoading(true); void load(); }} />}

        {items.length === 0 ? (
          <div className="glass-card py-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-cyan-500/10">
              <Bell className="h-8 w-8 text-cyan-300" />
            </div>
            <h3 className="mb-2 text-lg font-extrabold text-white">لا توجد تنبيهات جديدة</h3>
            <p className="text-sm leading-6 text-white/60">سنخبرك عندما تكون هناك تحديثات مهمة</p>
          </div>
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
