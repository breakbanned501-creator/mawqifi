'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bell, Car, MessageCircle, PlusCircle, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import BottomNav from '@/components/BottomNav';
import ErrorBanner from '@/components/ErrorBanner';
import { useLocale } from '@/components/LocaleProvider';
import { useNotifications } from '@/components/NotificationProvider';
import PlaceSelector from '@/components/PlaceSelector';
import { usePlace } from '@/components/PlaceProvider';
import ParkingCard from '@/components/ParkingCard';
import WhatsAppChannelCta from '@/components/WhatsAppChannelCta';
import { useAuth } from '@/components/AuthProvider';
import { expireStalePosts, fetchParkingPosts, filterActivePosts } from '@/lib/posts';
import { getSupabase } from '@/lib/supabase';
import type { ParkingPost } from '@/lib/types';

export default function Home() {
  const { userId } = useAuth();
  const { place } = usePlace();
  const placeId = place?.id ?? null;
  const refreshVersion = useRef(0);
  const { t, formatNumber } = useLocale();
  const { unreadCount } = useNotifications();
  const [posts, setPosts] = useState<ParkingPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const version = ++refreshVersion.current;
    if (!userId || !placeId) { setPosts([]); setIsLoading(false); return; }
    setError(null);
    try {
      const nextPosts = await fetchParkingPosts(placeId);
      if (version === refreshVersion.current) setPosts(filterActivePosts(nextPosts));
    } catch {
      if (version === refreshVersion.current) setError(t('home.loadError'));
    } finally {
      if (version === refreshVersion.current) setIsLoading(false);
    }
  }, [t, userId, placeId]);

  useEffect(() => {
    setPosts([]);
    setIsLoading(Boolean(placeId));
    void refresh();
    const invalidate = () => { refreshVersion.current++; };
    return invalidate;
  }, [refresh, placeId]);

  useEffect(() => {
    if (!userId || !placeId) return;

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
  }, [userId, refresh, placeId]);

  const handlePostExpired = useCallback((postId: string) => {
    setPosts((current) => current.filter((post) => post.id !== postId));
    void expireStalePosts().catch(() => {});
  }, []);

  const activePosts = useMemo(() => filterActivePosts(posts).filter(post => post.place_id === placeId), [posts, placeId]);

  return (
    <main className="page-with-chrome min-h-screen px-4 pt-5">
      <div className="container">
        <header className="mb-5">
          <div className="flex items-center justify-between gap-2.5 sm:gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-2.5 sm:gap-3">
              <div className="flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-2xl bg-cyan-500 shadow-glow">
                <Car size={22} className="text-navy-900" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-xl sm:text-2xl font-black leading-tight text-white truncate">{t('home.title')}</h1>
                <p className="text-xs sm:text-sm leading-5 sm:leading-6 text-white/60 truncate">{t('home.subtitle')}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1 sm:gap-2">
              <Link
                href="/notifications"
                data-tutorial-target="notifications"
                className="relative rounded-2xl p-2.5 sm:p-3 text-white/60 transition-colors hover:bg-white/10 hover:text-cyan-300"
                aria-label={t('home.notifications')}
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute end-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-cyan-500 px-1 text-[10px] font-black text-navy-900">
                    {formatNumber(unreadCount)}
                  </span>
                )}
              </Link>
              <button
                type="button"
                onClick={() => {
                  setIsLoading(true);
                  void refresh();
                }}
                className="rounded-2xl p-2.5 sm:p-3 text-white/60 transition-colors hover:bg-white/10 hover:text-cyan-300"
                aria-label={t('common.refresh')}
              >
                <RefreshCw size={20} />
              </button>
            </div>
          </div>
        </header>

        <PlaceSelector />

        {error && place && (
          <div className="mb-5">
            <ErrorBanner message={error} onRetry={() => { setIsLoading(true); void refresh(); }} />
          </div>
        )}

        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button type="button" className="btn btn-primary min-h-20 text-lg" onClick={()=>{
            if(!place){const selector=document.getElementById('place-selector');selector?.scrollIntoView({behavior:'smooth',block:'start'});selector?.focus();return;}
            document.querySelector('[data-tutorial-target="feed"]')?.scrollIntoView({behavior:'smooth',block:'start'});
          }}>{t('handoff.need')}</button>
          <Link href="/create" data-tutorial-target="publish" className="btn btn-secondary flex min-h-20 items-center justify-center gap-2 text-lg">
            <PlusCircle className="h-6 w-6"/>{t('handoff.leave')}
          </Link>
        </div>
        {!place&&<p className="glass-card mb-5 p-5 text-center text-sm leading-7">{t('place.empty')}</p>}
        <Link href="/conversations" data-tutorial-target="chat" className="mb-5 flex items-center gap-2 p-3 font-bold"><MessageCircle className="h-5 w-5"/>{t('home.chat')}</Link>

        <WhatsAppChannelCta />

        <div data-tutorial-target="feed">
          {!place ? null : isLoading ? (
            <div className="py-12 text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent" />
              <p className="mt-4 text-white/60">{t('common.loading')}</p>
            </div>
          ) : activePosts.length === 0 ? (
            <div className="glass-card py-12 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-cyan-500/10">
                <Car size={32} className="text-cyan-300" />
              </div>
              <h3 className="mb-2 text-lg font-extrabold text-white">{t('place.emptyPosts')}</h3>
              <p className="text-sm leading-6 text-white/60">{t('place.emptyPostsHint')}</p>
            </div>
          ) : (
            <div className="mb-6">
              <h2 className="mb-4 text-lg font-extrabold text-white">
                {t('home.availablePosts', { count: formatNumber(activePosts.length) })}
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
