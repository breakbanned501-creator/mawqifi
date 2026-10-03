'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PlusCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getOrCreateConversation } from '@/lib/conversations';
import { getMawqifiPostHref } from '@/lib/capacitor';
import { safetyErrorKey } from '@/lib/safety';
import BottomNav from '@/components/BottomNav';
import ErrorBanner from '@/components/ErrorBanner';
import { useLocale } from '@/components/LocaleProvider';
import { useNotifications } from '@/components/NotificationProvider';
import PlaceSelector from '@/components/PlaceSelector';
import { usePlace } from '@/components/PlaceProvider';
import { requiresSubPlace } from '@/lib/sub-places';
import ParkingCard from '@/components/ParkingCard';
import WhatsAppChannelCta from '@/components/WhatsAppChannelCta';
import { useAuth } from '@/components/AuthProvider';
import { expireStalePosts, fetchParkingPosts, filterActivePosts } from '@/lib/posts';
import { getSupabase } from '@/lib/supabase';
import { takePublishedPost, clearPublishedPost } from '@/lib/published-post';
import { publishTiming } from '@/lib/publish-timing';
import Toast from '@/components/Toast';
import HomeHeader from '@/components/HomeHeader';
import type { ParkingPost } from '@/lib/types';

export default function Home() {
  const router = useRouter();
  const { userId } = useAuth();
  const { place, subPlaceId, ready } = usePlace();
  const placeId = place?.id ?? null;
  const refreshVersion = useRef(0);
  const { t, dir } = useLocale();
  const { unreadCount } = useNotifications();
  const [posts, setPosts] = useState<ParkingPost[]>(()=>{const post=takePublishedPost(userId,placeId,subPlaceId);return post?[post]:[];});
  const [recentPublish,setRecentPublish]=useState(()=>Boolean(takePublishedPost(userId,placeId,subPlaceId)));
  const feedRequest=useRef<{key:string;promise:Promise<ParkingPost[]>}|null>(null);
  const loadPosts=useCallback(()=>{
    const key=JSON.stringify([userId,placeId,subPlaceId]);
    if(feedRequest.current?.key===key)return feedRequest.current.promise;
    const promise=fetchParkingPosts(placeId,subPlaceId);
    const request={key,promise};feedRequest.current=request;
    void promise.finally(()=>{if(feedRequest.current===request)feedRequest.current=null;}).catch(()=>{});
    return promise;
  },[userId,placeId,subPlaceId]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const version = ++refreshVersion.current;
    if (!userId || !placeId || !ready) { setPosts([]); setIsLoading(false); return; }
    setError(null);
    try {
      const nextPosts = await loadPosts();
      if (version === refreshVersion.current) {setPosts(filterActivePosts(nextPosts));clearPublishedPost(userId,placeId,subPlaceId);publishTiming('feed-ready');}
    } catch {
      if (version === refreshVersion.current) setError(t('home.loadError'));
    } finally {
      if (version === refreshVersion.current) setIsLoading(false);
    }
  }, [t, userId, placeId, subPlaceId, ready, loadPosts]);

  useEffect(() => {
    const optimistic=takePublishedPost(userId,placeId,subPlaceId);
    setPosts(optimistic?[optimistic]:[]);
    if(optimistic){setRecentPublish(true);publishTiming('success-ui');}
    setIsLoading(ready && !optimistic);
    void refresh();
    const invalidate = () => { refreshVersion.current++; };
    return invalidate;
  }, [refresh, userId, placeId, subPlaceId, ready]);

  useEffect(() => {
    if (!userId || !placeId || !ready) return;

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
  }, [userId, refresh, placeId, ready]);

  const handlePostExpired = useCallback((postId: string) => {
    setPosts((current) => current.filter((post) => post.id !== postId));
    void expireStalePosts().catch(() => {});
  }, []);

  const activePosts = useMemo(() => filterActivePosts(posts).filter(post => ready && post.place_id === placeId && (!requiresSubPlace(placeId) || post.sub_place_id === subPlaceId)), [posts, placeId, subPlaceId, ready]);


  const availablePosts = activePosts.filter(post => post.user_id !== userId);
  const scopeKey = JSON.stringify([placeId, subPlaceId]);
  const selectedScope = useRef(scopeKey);
  selectedScope.current = scopeKey;
  const actionLock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [showSpots, setShowSpots] = useState(false);
  const [noSpotToast, setNoSpotToast] = useState(0);
  const hideNoSpotToast = useCallback(() => setNoSpotToast(0), []);
  const hidePublishedToast = useCallback(() => setRecentPublish(false), []);
  useEffect(() => { setShowSpots(false); setNoSpotToast(0); }, [placeId, subPlaceId]);

  const claim = async (post: ParkingPost) => {
    if (!userId || !ready || JSON.stringify([post.place_id, requiresSubPlace(placeId) ? post.sub_place_id : null]) !== selectedScope.current) return;
    const { conversation } = await getOrCreateConversation(post.id, userId);
    router.push(getMawqifiPostHref(post.id, conversation.id));
  };

  const needSpot = async (post?: ParkingPost) => {
    if (!ready || !placeId) {
      const selector = document.getElementById('place-selector');
      selector?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      selector?.focus();
      return;
    }
    if (!userId || actionLock.current) return;
    actionLock.current = true;
    setBusy(true);
    setError(null);
    try {
      if (post) {
        setNoSpotToast(0);
        await claim(post);
      } else {
        // Fetch again at the tap, rather than auto-claiming from a stale feed.
        const selected = placeId;
        const selectedKey = scopeKey;
        const latest = filterActivePosts(await loadPosts()).filter(item => item.place_id === selected);
        if (selectedKey !== selectedScope.current) return;
        setPosts(latest);
        const choices = latest.filter(item => item.user_id !== userId);
        setShowSpots(choices.length > 0);
        if (choices.length === 0) {
          setRecentPublish(false);
          setNoSpotToast(current => current + 1);
        } else {
          setNoSpotToast(0);
          if (choices.length === 1) await claim(choices[0]);
        }
      }
    } catch (failure) {
      setError(t(safetyErrorKey(failure)));
      void refresh();
    } finally {
      actionLock.current = false;
      setBusy(false);
    }
  };

  return (
    <main className="page-with-chrome min-h-screen px-4 pt-5" dir={dir}>
      <div className="container">
        <HomeHeader unreadCount={unreadCount} onRefresh={() => { setIsLoading(true); void refresh(); }} />

        <Toast message={t('handoff.published')} visible={recentPublish && noSpotToast === 0} onHide={hidePublishedToast} />
        <Toast message={t('handoff.noSpots')} visible={noSpotToast > 0} onHide={hideNoSpotToast}
          duration={3000} resetKey={noSpotToast} variant="info" />
        <PlaceSelector />

        {error && place && (
          <div className="mb-5">
            <ErrorBanner message={error} onRetry={() => { setIsLoading(true); void refresh(); }} />
          </div>
        )}

        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button type="button" className="btn btn-primary min-h-20 text-lg" disabled={busy || isLoading} onClick={() => void needSpot()}>
            {busy ? t('common.loading') : t('handoff.need')}
          </button>
          <Link href="/create" onClick={() => publishTiming('tap')} data-tutorial-target="publish" className="btn btn-secondary flex min-h-20 items-center justify-center gap-2 text-lg">
            <PlusCircle className="h-6 w-6"/>{t('handoff.leave')}
          </Link>
        </div>
        {!ready&&<p className="glass-card mb-5 p-5 text-center text-sm leading-7">{t(!place ? 'place.empty' : placeId === 'kuwait_university' ? 'subPlace.kuHelper' : 'subPlace.paaetHelper')}</p>}


        {ready && showSpots && availablePosts.length > 0 && (
          <section data-tutorial-target="feed" className="mb-5 space-y-3" aria-live="polite">
            <h2 className="text-lg font-bold">{t('handoff.chooseSpot')}</h2>
            {availablePosts.map(post => (
              <ParkingCard key={post.id} compact post={post} currentUserId={userId!} busy={busy}
                onClaim={() => void needSpot(post)} onExpire={handlePostExpired} />
            ))}
          </section>
        )}
        {activePosts.filter(post => post.user_id === userId).map(post => (
          <ParkingCard key={post.id} compact post={post} currentUserId={userId!}
            onChanged={refresh} onExpire={handlePostExpired} />
        ))}
        <WhatsAppChannelCta />

      </div>
      <BottomNav />
    </main>
  );
}
