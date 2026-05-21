'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell, LogOut, ShieldCheck, User } from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import PageHeader from '@/components/PageHeader';
import { currentMockProfile } from '@/lib/mock';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/types';

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile>(currentMockProfile);
  const [notifyEnabled, setNotifyEnabled] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('mawqifi_local_user');
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as { username?: string; email?: string };
        setProfile((current) => ({
          ...current,
          username: parsed.username || current.username,
        }));
      } catch {
        /* ignore */
      }
    }

    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setProfile({
          id: data.user.id,
          username: data.user.user_metadata.username || data.user.email || 'طالب جامعة الكويت',
          avatar_url: data.user.user_metadata.avatar_url || null,
          active_post_count: 0,
        });
      }
    });

    if ('Notification' in window) {
      setNotifyEnabled(Notification.permission === 'granted');
    }
  }, []);

  const requestNotifications = async () => {
    if (!('Notification' in window)) return;
    const permission = await Notification.requestPermission();
    setNotifyEnabled(permission === 'granted');
  };

  const logout = async () => {
    if (supabase) await supabase.auth.signOut();
    localStorage.removeItem('mawqifi_local_user');
    window.location.href = '/auth';
  };

  return (
    <main className="min-h-screen px-4 pb-28 pt-6">
      <div className="mx-auto max-w-md space-y-5">
        <PageHeader title="حسابي" subtitle="إدارة الحساب والتنبيهات" backHref="/" />

        <section className="glass-card p-5">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl bg-cyan-500/15 text-cyan-300">
              <User className="h-8 w-8" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-white">{profile.username}</h2>
              <p className="text-sm text-white/55">منشورات نشطة: {profile.active_post_count ?? 0}</p>
            </div>
          </div>
        </section>

        <section className="glass-card space-y-4 p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Bell className="h-5 w-5 text-cyan-300" />
              <div>
                <h3 className="font-bold text-white">تنبيهات المتصفح</h3>
                <p className="text-sm text-white/55">تنبيه عند نشر موقفك أو رسالة جديدة</p>
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
                موقفي تطبيق مجتمعي للطلاب وغير تابع رسمياً لجامعة الكويت. لا يوجد حجز مواقف — فقط تنسيق ودي بين الطلاب.
              </p>
            </div>
          </div>
        </section>

        <Link
          href="/auth"
          className="block rounded-3xl border border-white/10 bg-white/5 p-4 text-center font-bold text-white/80"
        >
          تسجيل الدخول / إنشاء حساب
        </Link>

        <button
          type="button"
          onClick={logout}
          className="flex w-full items-center justify-center gap-2 rounded-3xl border border-red-400/20 bg-red-500/10 p-4 font-bold text-red-200"
        >
          <LogOut className="h-5 w-5" />
          تسجيل الخروج
        </button>
      </div>
      <BottomNav />
    </main>
  );
}
