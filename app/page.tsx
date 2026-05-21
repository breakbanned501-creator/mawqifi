'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bell, Car, Map, MessageCircle, PlusCircle, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import BottomNav from '@/components/BottomNav';
import ErrorBanner from '@/components/ErrorBanner';
import ParkingCard from '@/components/ParkingCard';
import { useAuth } from '@/components/AuthProvider';
import { fetchNotifications, unreadCount } from '@/lib/notifications';
import { expireStalePosts, fetchParkingPosts, filterActivePosts } from '@/lib/posts';
import { getSupabase } from '@/lib/supabase';
import type { ParkingPost } from '@/lib/types';

export default function Home() {
  const { userId } = useAuth();
  const [posts, setPosts] = useState<ParkingPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(async () => {
    if (!userId) return;
    setError(null);
    try {
      const [nextPosts, notifications] = await Promise.all([
        fetchParkingPosts(),
        fetchNotifications(userId),
      ]);
      setPosts(filterActivePosts(nextPosts));
      setUnread(unreadCount(notifications));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحميل المواقف');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!userId) return;

    const supabase = getSupabase();
    const channel = supabase
      .channel('home-parking-posts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'parking_posts' }, () => {
        void refresh();
      })
      .subscribe();

    const interval = setInterval(() => void refresh(), 60000);

    return () => {
      clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [userId, refresh]);

  const handlePostExpired = useCallback((postId: string) => {
    setPosts((current) => current.filter((post) => post.id !== postId));
    void expireStalePosts().catch(() => {});
  }, []);

  useEffect(() => {
    const tick = setInterval(() => {
      setPosts((current) => filterActivePosts(current));
    }, 1000);
    return () => clearInterval(tick);
  }, []);

  const activePosts = filterActivePosts(posts);

  return (
    <main className="page-with-chrome min-h-screen px-4 pt-5">
      <div className="container">
        <header className="mb-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-cyan-500 shadow-glow">
                <Car size={24} className="text-navy-900" />
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl font-black leading-tight text-white">موقفي</h1>
                <p className="text-sm leading-6 text-white/60">مواقف جامعة الكويت — الشدادية</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Link
                href="/notifications"
                className="relative rounded-2xl p-3 text-white/60 transition-colors hover:bg-white/10 hover:text-cyan-300"
                aria-label="التنبيهات"
              >
                <Bell size={20} />
                {unread > 0 && (
                  <span className="absolute end-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-cyan-500 px-1 text-[10px] font-black text-navy-900">
                    {unread}
                  </span>
                )}
              </Link>
              <button
                type="button"
                onClick={() => {
                  setIsLoading(true);
                  void refresh();
                }}
                className="rounded-2xl p-3 text-white/60 transition-colors hover:bg-white/10 hover:text-cyan-300"
                aria-label="تحديث"
              >
                <RefreshCw size={20} />
              </button>
            </div>
          </div>
        </header>

        {error && (
          <div className="mb-5">
            <ErrorBanner message={error} onRetry={() => { setIsLoading(true); void refresh(); }} />
          </div>
        )}

        <div className="mb-5 grid grid-cols-2 gap-3">
          <Link href="/conversations" className="glass-card flex items-center gap-3 p-4 text-white">
            <MessageCircle className="h-5 w-5 shrink-0 text-cyan-300" />
            <span className="text-sm font-bold">المحادثات</span>
          </Link>
          <Link href="/map" className="glass-card flex items-center gap-3 p-4 text-white">
            <Map className="h-5 w-5 shrink-0 text-cyan-300" />
            <span className="text-sm font-bold">خريطة الجامعة</span>
          </Link>
        </div>

        <Link
          href="/create"
          className="btn btn-primary mb-6 flex w-full items-center justify-center gap-2 py-4 text-base"
        >
          <PlusCircle className="h-5 w-5" />
          نشر موقف جديد
        </Link>

        <div>
          {isLoading ? (
            <div className="py-12 text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent" />
              <p className="mt-4 text-white/60">جاري التحميل...</p>
            </div>
          ) : activePosts.length === 0 ? (
            <div className="glass-card py-12 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-cyan-500/10">
                <Car size={32} className="text-cyan-300" />
              </div>
              <h3 className="mb-2 text-lg font-extrabold text-white">لا توجد مواقف حالياً</h3>
              <p className="text-sm leading-6 text-white/60">كن أول من يشارك موقفاً متاحاً للطلاب</p>
            </div>
          ) : (
            <div className="mb-6">
              <h2 className="mb-4 text-lg font-extrabold text-white">
                المواقف المتاحة ({activePosts.length})
              </h2>
              <div className="space-y-4">
                {activePosts.map((post) => (
                  <ParkingCard
                    key={post.id}
                    post={post}
                    currentUserId={userId!}
                    onChanged={refresh}
                    onExpire={handlePostExpired}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <BottomNav />
    </main>
  );
}
