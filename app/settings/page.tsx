'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell, LogOut, ShieldCheck, User } from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import ErrorBanner from '@/components/ErrorBanner';
import PageHeader from '@/components/PageHeader';
import { useAuth } from '@/components/AuthProvider';
import { signOut, updateUsername } from '@/lib/auth';
import { fetchParkingPosts } from '@/lib/posts';

export default function SettingsPage() {
  const { profile, isGuest, refreshProfile, userId } = useAuth();
  const [notifyEnabled, setNotifyEnabled] = useState(false);
  const [activePosts, setActivePosts] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [username, setUsername] = useState(profile?.username ?? '');

  useEffect(() => {
    if ('Notification' in window) {
      setNotifyEnabled(Notification.permission === 'granted');
    }
  }, []);

  useEffect(() => {
    setUsername(profile?.username ?? '');
  }, [profile?.username]);

  useEffect(() => {
    if (!userId) return;
    void fetchParkingPosts().then((posts) => {
      setActivePosts(posts.filter((p) => p.user_id === userId && p.status === 'active').length);
    });
  }, [userId]);

  const requestNotifications = async () => {
    if (!('Notification' in window)) return;
    const permission = await Notification.requestPermission();
    setNotifyEnabled(permission === 'granted');
  };

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
      <div className="mx-auto max-w-md space-y-5">
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
            <div className="flex items-center gap-3">
              <Bell className="h-5 w-5 text-cyan-300" />
              <div>
                <h3 className="font-bold text-white">تنبيهات المتصفح</h3>
                <p className="text-sm text-white/55">تنبيه عند رسالة جديدة</p>
              </div>
            </div>
            <button
              type="button"
              onClick={requestNotifications}
              className={`rounded-2xl px-4 py-2 text-xs font-bold ${notifyEnabled ? 'bg-emerald-400/15 text-emerald-200' : 'bg-cyan-500 text-navy-900'}`}
            >
              {notifyEnabled ? 'مفعّلة' : 'تفعيل'}
            </button>
          </div>
          <Link
            href="/notifications"
            className="block rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm font-bold text-white/80"
          >
            عرض مركز التنبيهات
          </Link>
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
