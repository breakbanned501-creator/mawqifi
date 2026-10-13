'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PlusCircle } from 'lucide-react';
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
import { takePublishedPost, clearPublishedPost, rememberPublishedPost } from '@/lib/published-post';
import { acquirePublishLocation, cancelPublishLocation, usablePublishLocation } from '@/lib/publish-location';
import { fetchMawqifiServerApi } from '@/lib/server-api';
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
  const publicationEpoch = useRef(0);
  const { t, dir } = useLocale();
  const { unreadCount } = useNotifications();
  const [posts, setPosts] = useState<ParkingPost[]>(()=>{const post=takePublishedPost(userId,placeId,subPlaceId);return post?[post]:[];});
  const [recentPublish,setRecentPublish]=useState(()=>Boolean(takePublishedPost(userId,placeId,subPlaceId)));
  const feedRequest=useRef<{key:string;promise:Promise<ParkingPost[]>;epoch:number}|null>(null);
  const loadPosts=useCallback(()=>{
    const key=JSON.stringify([userId,placeId,subPlaceId]);
    if(feedRequest.current?.key===key)return feedRequest.current.promise;
    const promise=fetchParkingPosts(placeId,subPlaceId);
    const request={key,promise,epoch:publicationEpoch.current};feedRequest.current=request;
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
      const read = loadPosts();
      const epoch = feedRequest.current?.epoch ?? publicationEpoch.current;
      const nextPosts = await read;
      if (version === refreshVersion.current && epoch === publicationEpoch.current) {
        setPosts(filterActivePosts(nextPosts));
        clearPublishedPost(userId, placeId, subPlaceId);
        publishTiming('feed-ready');
      }
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
  const [scopeToast, setScopeToast] = useState(0);
  const hideScopeToast = useCallback(() => setScopeToast(0), []);
  const [publishPhase, setPublishPhase] = useState<'locating' | 'publishing' | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishErrorToast, setPublishErrorToast] = useState(false);
  const hidePublishErrorToast = useCallback(() => setPublishErrorToast(false), []);
  const publishRequest = useRef(0);
  const publishLock = useRef(false);
  const invalidatePublish = useCallback(() => { publishRequest.current++; cancelPublishLocation(); }, []);
  useEffect(() => {
    setPublishError(null);
    setPublishErrorToast(false);
    setScopeToast(0);
    return invalidatePublish;
  }, [userId, placeId, subPlaceId, invalidatePublish]);
  useEffect(() => { if (recentPublish) publishTiming('success-ui'); }, [recentPublish]);
  useEffect(() => { setShowSpots(false); setNoSpotToast(0); }, [placeId, subPlaceId]);

  const leaveSpot = async () => {
    if (publishLock.current || actionLock.current) return;
    if (!ready || !placeId) {
      setRecentPublish(false);
      setNoSpotToast(0);
      setScopeToast(n => n + 1);
      const selector = document.getElementById('place-selector');
      selector?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      selector?.focus();
      return;
    }
    if (!userId) return;
    publishLock.current = true;
    const version = publishRequest.current;
    const key = scopeKey;
    const current = () => version === publishRequest.current && key === selectedScope.current;
    setPublishError(null);
    setPublishErrorToast(false);
    setRecentPublish(false);
    setNoSpotToast(0);
    publishTiming('tap');
    setPublishPhase('locating');
    try {
      const fix = await acquirePublishLocation();
      if (!current()) return;
      if (!usablePublishLocation(fix)) throw new Error('HANDOFF_LOCATION_REQUIRED');
      setPublishPhase('publishing');
      publishTiming('rpc-start');
      // Reuse the existing atomic private-GPS transaction; no public coordinates.
      const { data: postId, error: failure } = await getSupabase().rpc('publish_parking_handoff', {
        payload: { place_id: placeId, sub_place_id: subPlaceId, departure_minutes: 10 },
        latitude: fix.latitude, longitude: fix.longitude, accuracy_meters: fix.accuracy_meters,
      });
      if (failure) throw failure;
      if (!postId) throw new Error('HANDOFF_INVALID');
      publishTiming('rpc-success');
      const now = new Date();
      const post: ParkingPost = {
        id: postId, user_id: userId, place_id: placeId, sub_place_id: subPlaceId,
        place: { name_ar: place!.name_ar, name_en: place!.name_en },
        location_description: null, college: null, zone: null, gate: null, car_desc: null,
        departure_minutes: 10, expires_at: new Date(now.getTime() + 600000).toISOString(),
        status: 'active', created_at: now.toISOString(), username: '', badges: [],
      };
      rememberPublishedPost(post);
      if (current()) {
        // Invalidate reads started before publication without overlapping their replacement.
        refreshVersion.current++;
        publicationEpoch.current++;
        const pendingRead = feedRequest.current?.promise;
        setPosts(items => [post, ...items.filter(item => item.id !== post.id)]);
        setIsLoading(false);
        setRecentPublish(true);
        void (async () => {
          if (pendingRead) await pendingRead.catch(() => {});
          if (current()) await refresh();
        })();
      }
      // Preserve optional notification dispatch, outside the success/refresh critical path.
      void (async () => {
        const { data } = await getSupabase().auth.getSession();
        const token = data.session?.access_token;
        if (token) await fetchMawqifiServerApi('/api/push/notify-new-post', {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
          body: JSON.stringify({ postId }),
        });
      })().catch(() => {});
    } catch (failure) {
      if (!current()) return;
      const code = failure instanceof Error ? failure.message : '';
      setPublishError(t(code === 'PUBLISH_LOCATION_TIMEOUT' ? 'handoff.locationTimeout' :
        code === 'PUBLISH_LOCATION_INACCURATE' ? 'handoff.locationAccuracy' :
        code.startsWith('PUBLISH_LOCATION_') ? 'handoff.locationRequired' : safetyErrorKey(failure)));
      setPublishErrorToast(true);
    } finally {
      publishLock.current = false;
      setPublishPhase(null);
    }
  };

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
    if (!userId || actionLock.current || publishLock.current) return;
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
        <Toast message={t('handoff.chooseLocation')} visible={scopeToast > 0} onHide={hideScopeToast}
          duration={3000} resetKey={scopeToast} variant="info" />
        <Toast message={publishError ?? ''} visible={publishErrorToast} onHide={hidePublishErrorToast}
          duration={3000} variant="info" />
        <PlaceSelector />
        {publishError && <div className="mb-5"><ErrorBanner message={publishError} onRetry={() => void leaveSpot()} /></div>}

        {error && place && (
          <div className="mb-5">
            <ErrorBanner message={error} onRetry={() => { setIsLoading(true); void refresh(); }} />
          </div>
        )}

        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button type="button" className="btn btn-primary min-h-20 text-lg" disabled={busy || isLoading || publishPhase !== null} onClick={() => void needSpot()}>
            {busy ? t('common.loading') : t('handoff.need')}
          </button>
          <button type="button" onClick={() => void leaveSpot()} disabled={busy || publishPhase !== null}
            aria-busy={publishPhase !== null} data-tutorial-target="publish"
            className="btn btn-secondary flex min-h-20 items-center justify-center gap-2 text-lg disabled:opacity-50">
            <PlusCircle className="h-6 w-6" aria-hidden="true" />
            <span role={publishPhase ? 'status' : undefined}>{t(publishPhase === 'locating' ? 'handoff.locating' : publishPhase === 'publishing' ? 'handoff.publishing' : 'handoff.leave')}</span>
          </button>
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
