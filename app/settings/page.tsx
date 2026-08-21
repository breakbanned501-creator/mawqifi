'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell, CircleHelp, LogOut, ShieldCheck, User } from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import ErrorBanner from '@/components/ErrorBanner';
import PageHeader from '@/components/PageHeader';
import { useAuth } from '@/components/AuthProvider';
import { useTutorial } from '@/components/TutorialProvider';
import { signOut, updateUsername } from '@/lib/auth';
import { fetchParkingPosts } from '@/lib/posts';
import {
  getPushDeviceState,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
  type PushDeviceState,
} from '@/lib/push';

export default function SettingsPage() {
  const { profile, isGuest, refreshProfile, userId } = useAuth();
  const { replayTutorial } = useTutorial();
  const [pushState, setPushState] = useState<PushDeviceState>({ kind: 'disabled', message: '' });
  const [activePosts, setActivePosts] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [username, setUsername] = useState(profile?.username ?? '');
  const [notifyLoading, setNotifyLoading] = useState(false);
  const notifyEnabled = pushState.kind === 'enabled';

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    setNotifyLoading(true);
    void getPushDeviceState().then((next) => {
      if (!cancelled) {
        setPushState(next);
        setNotifyLoading(false);
      }
    }).catch(() => {
      if (!cancelled) {
        setPushState({ kind: 'error', message: 'تعذر التحقق من حالة إشعارات هذا الجهاز.' });
        setNotifyLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const handleToggleNotifications = async () => {
    if (!userId) return;
    setNotifyLoading(true);

    try {
      if (notifyEnabled) {
        const result = await unsubscribeFromPushNotifications();
        if (result.deviceUnsubscribed) {
          setPushState({ kind: 'disabled', message: result.message });
        } else {
          const next = await getPushDeviceState();
          setPushState({ ...next, message: result.message });
        }
      } else {
        const result = await subscribeToPushNotifications();
        if (result.success) {
          setPushState({ kind: 'enabled', message: result.message });
        } else {
          const next = await getPushDeviceState();
          setPushState({ ...next, message: result.message });
        }
      }
    } finally {
      setNotifyLoading(false);
    }
  };

  useEffect(() => {
    setUsername(profile?.username ?? '');
  }, [profile?.username]);

  useEffect(() => {
    if (!userId) return;
    void fetchParkingPosts().then((posts) => {
      setActivePosts(posts.filter((p) => p.user_id === userId && p.status === 'active').length);
    });
  }, [userId]);

  const saveUsername = async () => {
    if (!userId || !username.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await updateUsername(userId, username.trim());
      await refreshProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر حفظ الاسم');
    } finally {
      setSaving(false);
    }
  };

  const logout = async () => {
    try {
      await signOut();
      window.location.href = '/';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تسجيل الخروج');
    }
  };

  return (
    <main className="page-with-chrome min-h-screen px-4 pt-6">
      <div className="mx-auto max-w-md md:max-w-xl lg:max-w-2xl space-y-5">
        <PageHeader title="حسابي" subtitle="إدارة الحساب والتنبيهات" backHref="/" />

        {error && <ErrorBanner message={error} />}

        <section className="glass-card p-5">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl bg-cyan-500/15 text-cyan-300">
              <User className="h-8 w-8" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-extrabold text-white">{profile?.username}</h2>
              <p className="text-sm text-white/55">
                {isGuest ? 'حساب ضيف' : 'حساب مسجّل'} — منشورات نشطة: {activePosts}
              </p>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <input
              className="input min-w-0 flex-1"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="اسم العرض"
            />
            <button
              type="button"
              onClick={() => void saveUsername()}
              disabled={saving}
              className="btn btn-secondary shrink-0 px-4"
            >
              {saving ? '...' : 'حفظ'}
            </button>
          </div>
        </section>

        <section className="glass-card space-y-4 p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <Bell className="h-5 w-5 text-cyan-300" />
              <div className="min-w-0">
                <h3 className="font-bold text-white">إشعارات الفورية (Push)</h3>
                <p className="text-sm text-white/55">تنبيه فوري عند نشر موقف جديد</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void handleToggleNotifications()}
              disabled={notifyLoading}
              className={`rounded-2xl px-4 py-2 text-xs font-bold transition-all disabled:opacity-50 ${
                notifyEnabled ? 'bg-emerald-400/15 text-emerald-200 border border-emerald-400/30' : 'bg-cyan-500 text-navy-900 shadow-lg shadow-cyan-500/20'
              }`}
            >
              {notifyLoading
                ? '...'
                : notifyEnabled
                  ? 'مفعّلة ✓'
                  : pushState.kind === 'not-registered'
                    ? 'إعادة المحاولة'
                    : 'تفعيل'}
            </button>
          </div>

          {pushState.message && (
            <div className={`rounded-2xl p-3 text-xs leading-6 ${notifyEnabled ? 'bg-emerald-500/10 text-emerald-200 border border-emerald-500/20' : 'bg-cyan-500/10 text-cyan-200 border border-cyan-500/20'}`}>
              <p className="whitespace-pre-line font-bold">{pushState.message}</p>
            </div>
          )}

          {pushState.kind === 'requires-home-screen' && (
            <div className="rounded-2xl border border-cyan-400/25 bg-cyan-500/10 p-3.5 text-xs leading-6 text-cyan-100">
              <p className="font-extrabold mb-1">لتفعيل إشعارات موقفي على الآيفون أو الآيباد:</p>
              <ol className="list-decimal list-inside space-y-0.5 text-white/80">
                <li>اضغط مشاركة (Share) في أسفل المتصفح</li>
                <li>اختر إضافة إلى الشاشة الرئيسية (Add to Home Screen)</li>
                <li>افتح تطبيق موقفي من الشاشة الرئيسية</li>
                <li>اضغط تفعيل الإشعارات</li>
              </ol>
            </div>
          )}

          <Link
            href="/notifications"
            className="block rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm font-bold text-white/80 transition-colors hover:bg-white/10"
          >
            عرض مركز التنبيهات
          </Link>
        </section>

        <section className="glass-card p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <CircleHelp className="h-5 w-5 shrink-0 text-cyan-300" />
              <div className="min-w-0">
                <h3 className="font-bold text-white">شرح استخدام موقفي</h3>
                <p className="text-sm text-white/55">راجع أهم الميزات بخطوات سريعة</p>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={replayTutorial}
            className="btn btn-secondary mt-4 w-full py-2.5 text-xs"
          >
            عرض شرح استخدام موقفي
          </button>
        </section>

        <section className="glass-card space-y-3 p-5">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-cyan-300" />
            <div>
              <h3 className="font-bold text-white">تنبيه مهم</h3>
              <p className="mt-1 text-sm leading-7 text-white/65">
                موقفي تطبيق مجتمعي للطلاب وغير تابع رسمياً لجامعة الكويت. لا يوجد حجز مواقف — فقط تنسيق ودي.
              </p>
            </div>
          </div>
        </section>

        <section className="glass-card space-y-3 p-5">
          <h3 className="font-bold text-white">روابط قانونية</h3>
          <div className="space-y-2">
            <Link
              href="/privacy"
              className="block rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm font-bold text-white/80"
            >
              سياسة الخصوصية
            </Link>
            <Link
              href="/terms"
              className="block rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm font-bold text-white/80"
            >
              الشروط والأحكام
            </Link>
            <Link
              href="/feedback"
              className="block rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm font-bold text-white/80"
            >
              تواصل معنا
            </Link>
          </div>
        </section>

        <div className="text-center">
          <p className="text-[10px] font-semibold text-white/30">
            الإصدار التجريبي v1.0
          </p>
        </div>

        {!isGuest ? (
          <button
            type="button"
            onClick={() => void logout()}
            className="flex w-full items-center justify-center gap-2 rounded-3xl border border-red-400/20 bg-red-500/10 p-4 font-bold text-red-200"
          >
            <LogOut className="h-5 w-5" />
            تسجيل الخروج
          </button>
        ) : (
          <Link
            href="/auth"
            className="block rounded-3xl border border-cyan-400/25 bg-cyan-500/10 p-4 text-center font-bold text-cyan-100"
          >
            ربط حساب بالبريد الإلكتروني
          </Link>
        )}
      </div>
      <BottomNav />
    </main>
  );
}
