'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { BellRing, CarFront, Clock3, MapPin, RefreshCw, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import BottomNav from '@/components/BottomNav';
import HomeHeader from '@/components/HomeHeader';
import PlaceSelector from '@/components/PlaceSelector';
import WhatsAppChannelCta from '@/components/WhatsAppChannelCta';
import { useAuth } from '@/components/AuthProvider';
import { usePlace } from '@/components/PlaceProvider';
import { useLocale } from '@/components/LocaleProvider';
import { useNotifications } from '@/components/NotificationProvider';
import type { ParkingLocation } from '@/lib/handoff';
import { getSupabase } from '@/lib/supabase';
import { getMawqifiPostHref } from '@/lib/capacitor';
import {
  acquirePublishLocation,
  cancelPublishLocation,
  hasGrantedLocationPermission,
  usablePublishLocation,
} from '@/lib/publish-location';
import { fetchMawqifiServerApi } from '@/lib/server-api';

type ParkingRequest = {
  id: string;
  status: 'active' | 'offered' | 'matched';
  place_id: string;
  sub_place_id: string | null;
  expires_at: string;
};
type Offer = {
  id: string;
  status: 'pending' | 'accepted';
  post_id: string;
  conversation_id: string | null;
  expires_at: string;
};
type MyRequest = { request: ParkingRequest | null; offer: Offer | null; server_now: string };
type NearbyRequest = {
  id: string;
  created_at: string;
  expires_at: string;
  distance_band: 'near' | 'medium' | 'far';
};
type OfferCreation = { offer_id: string; post_id: string; expires_at: string };
type AcceptedHandoff = { claim?: { post_id: string; conversation_id: string } };

const bandLabel = (band: NearbyRequest['distance_band'], english: boolean) =>
  band === 'near'
    ? (english ? 'Within roughly 150 m' : 'تقريبًا أقل من 150 متر')
    : band === 'medium'
      ? (english ? 'Roughly 150–300 m' : 'تقريبًا من 150 إلى 300 متر')
      : (english ? 'Roughly 300–500 m' : 'تقريبًا من 300 إلى 500 متر');

function errorText(error: unknown, english: boolean): string {
  const message = error && typeof error === 'object' && 'message' in error ? String(error.message) : '';
  if (message.includes('OFFER_REQUEST_UNAVAILABLE') || message.includes('OFFER_EXPIRED')) {
    return english ? 'This request is no longer available.' : 'هالطلب انتهى أو انربط بشخص ثاني';
  }
  if (message.includes('OFFER_TOO_FAR')) {
    return english ? 'You are too far from this request.' : 'الطلب بعيد عن موقع سيارتك';
  }
  if (message.includes('REQUEST_RATE_LIMIT')) {
    return english ? 'Please wait briefly before creating another request.' : 'انتظر شوي قبل إنشاء طلب جديد';
  }
  if (message.includes('DISCOVERY_RATE_LIMIT')) {
    return english ? 'Please wait a few seconds before refreshing.' : 'انتظر ثواني قبل تحديث الطلبات';
  }
  if (message.includes('SAFETY_BLOCKED') || message.includes('OFFER_SCOPE_MISMATCH')) {
    return english ? 'This parking match is not available.' : 'مطابقة الموقف غير متاحة';
  }
  if (message.includes('REQUEST_LOCATION_REQUIRED') || message.includes('OFFER_LOCATION_REQUIRED') ||
      message.includes('PUBLISH_LOCATION_')) {
    return english ? 'A precise current location is required. Please try again outdoors.' : 'نحتاج موقعك الحالي بدقة. جرّب مرة ثانية في مكان مفتوح';
  }
  return english ? 'Something went wrong. Please try again.' : 'صار خطأ، جرّب مرة ثانية';
}

/** Staging-only reverse matching screen. The page guard also verifies the staging project URL. */
export default function ReverseParkingHome() {
  const router = useRouter();
  const { userId } = useAuth();
  const { place, subPlaceId, ready } = usePlace();
  const { locale, dir } = useLocale();
  const english = locale === 'en';
  const { unreadCount } = useNotifications();
  const [myRequest, setMyRequest] = useState<MyRequest | null>(null);
  const [nearby, setNearby] = useState<NearbyRequest[]>([]);
  const [myLocation, setMyLocation] = useState<ParkingLocation | null>(null);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationPermissionGranted, setLocationPermissionGranted] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [clock, setClock] = useState(Date.now());
  const [serverOffsetMs, setServerOffsetMs] = useState(0);
  const locked = useRef(false);
  const mineRefresh = useRef<Promise<void> | null>(null);
  const nearbyRefresh = useRef<Promise<void> | null>(null);
  const automaticLocationScope = useRef<string | null>(null);
  const scopeRef = useRef('');
  const placeId = place?.id ?? null;
  const scopeKey = JSON.stringify([userId, placeId, subPlaceId]);
  scopeRef.current = scopeKey;

  const refreshMine = useCallback(() => {
    if (!userId) return Promise.resolve();
    if (mineRefresh.current) return mineRefresh.current;
    const task = (async () => {
      const before = Date.now();
      const { data, error: rpcError } = await getSupabase().rpc('my_parking_request');
      const after = Date.now();
      if (rpcError) throw rpcError;
      const state = data as MyRequest;
      const remoteMs = Date.parse(state.server_now);
      if (Number.isFinite(remoteMs)) setServerOffsetMs(remoteMs - ((before + after) / 2));
      setMyRequest(state);
    })().finally(() => { mineRefresh.current = null; });
    mineRefresh.current = task;
    return task;
  }, [userId]);

  const refreshNearby = useCallback((location: ParkingLocation) => {
    if (!userId || !ready || !placeId || location.accuracy_meters == null) return Promise.resolve();
    if (nearbyRefresh.current) return nearbyRefresh.current;
    const capturedScope = JSON.stringify([userId, placeId, subPlaceId]);
    const task = (async () => {
      const { data, error: rpcError } = await getSupabase().rpc('nearby_parking_requests', {
        p_place_id: placeId,
        p_sub_place_id: subPlaceId,
        p_lat: location.latitude,
        p_lng: location.longitude,
        p_accuracy: location.accuracy_meters,
        p_limit: 20,
      });
      if (rpcError) throw rpcError;
      if (capturedScope === scopeRef.current) setNearby((data ?? []) as NearbyRequest[]);
    })().finally(() => { nearbyRefresh.current = null; });
    nearbyRefresh.current = task;
    return task;
  }, [userId, ready, placeId, subPlaceId]);

  useEffect(() => {
    setNearby([]);
    setMyLocation(null);
    setError(null);
    cancelPublishLocation();
  }, [scopeKey]);

  useEffect(() => {
    const requestOpen = myRequest?.request?.status === 'active' || myRequest?.request?.status === 'offered';
    const offerAccepted = myRequest?.offer?.status === 'accepted';
    if (!userId || !ready || !placeId || requestOpen || offerAccepted || automaticLocationScope.current === scopeKey) return;
    automaticLocationScope.current = scopeKey;
    let disposed = false;
    void hasGrantedLocationPermission().then(async granted => {
      if (disposed) return;
      setLocationPermissionGranted(granted);
      if (!granted) return;
      try {
        setLocating(true);
        const fix = await acquirePublishLocation();
        if (!usablePublishLocation(fix)) throw new Error('REQUEST_LOCATION_REQUIRED');
        const location: ParkingLocation = {
          latitude: fix.latitude,
          longitude: fix.longitude,
          accuracy_meters: fix.accuracy_meters,
        };
        if (disposed || scopeRef.current !== scopeKey) return;
        setMyLocation(location);
        await refreshNearby(location);
      } catch {
        if (!disposed) setError(english ? 'Unable to update nearby requests.' : 'تعذر تحديث الطلبات القريبة');
      } finally {
        if (!disposed) setLocating(false);
      }
    }).catch(() => {
      if (!disposed) setLocationPermissionGranted(false);
    });
    return () => { disposed = true; };
  }, [userId, ready, placeId, scopeKey, myRequest, refreshNearby, english]);

  useEffect(() => {
    if (!userId) return;
    let disposed = false;
    const tick = () => {
      if (document.visibilityState === 'visible') {
        void refreshMine().catch(() => {
          if (!disposed) setError(english ? 'Unable to update request.' : 'تعذر تحديث حالة الطلب');
        });
      }
    };
    tick();
    const interval = window.setInterval(tick, 6000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      disposed = true;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [userId, refreshMine, english]);

  useEffect(() => {
    if (!myLocation || !ready) return;
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refreshNearby(myLocation).catch(() => {});
    }, 12000);
    return () => window.clearInterval(interval);
  }, [myLocation, ready, refreshNearby]);

  useEffect(() => {
    const interval = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => () => cancelPublishLocation(), []);

  const run = async (operation: () => Promise<void>) => {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await operation();
    } catch (failure) {
      setError(errorText(failure, english));
    } finally {
      setBusy(false);
      setLocating(false);
      locked.current = false;
    }
  };

  const acquirePreciseLocation = async (): Promise<ParkingLocation> => {
    setLocating(true);
    const fix = await acquirePublishLocation();
    if (!usablePublishLocation(fix)) throw new Error('REQUEST_LOCATION_REQUIRED');
    return {
      latitude: fix.latitude,
      longitude: fix.longitude,
      accuracy_meters: fix.accuracy_meters,
    };
  };

  const locateAndRefresh = () => void run(async () => {
    if (!ready || !placeId) {
      document.getElementById('place-selector')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      throw new Error('OFFER_SCOPE_MISMATCH');
    }
    const location = await acquirePreciseLocation();
    setLocationPermissionGranted(true);
    setMyLocation(location);
    await refreshNearby(location);
  });

  const startRequest = () => void run(async () => {
    if (!ready || !placeId || !userId) {
      document.getElementById('place-selector')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      throw new Error('OFFER_SCOPE_MISMATCH');
    }
    const capturedScope = scopeKey;
    const location = await acquirePreciseLocation();
    if (capturedScope !== scopeRef.current) return;
    const { error: rpcError } = await getSupabase().rpc('create_parking_request', {
      p_place_id: placeId,
      p_sub_place_id: subPlaceId,
      p_lat: location.latitude,
      p_lng: location.longitude,
      p_accuracy: location.accuracy_meters,
    });
    if (rpcError) throw rpcError;
    setMyLocation(location);
    await refreshMine();
  });

  const cancelRequest = () => void run(async () => {
    if (!myRequest?.request) return;
    const { error: rpcError } = await getSupabase().rpc('cancel_parking_request', {
      p_request_id: myRequest.request.id,
    });
    if (rpcError) throw rpcError;
    await refreshMine();
  });

  const giveSpot = (requestId: string) => void run(async () => {
    if (!placeId || !userId || !ready) return;
    const capturedScope = scopeKey;
    const fix = await acquirePublishLocation();
    if (capturedScope !== scopeRef.current || !usablePublishLocation(fix)) {
      throw new Error('OFFER_LOCATION_REQUIRED');
    }
    const { data, error: rpcError } = await getSupabase().rpc('give_parking_to_request', {
      p_request_id: requestId,
      p_place_id: placeId,
      p_sub_place_id: subPlaceId,
      p_lat: fix.latitude,
      p_lng: fix.longitude,
      p_accuracy: fix.accuracy_meters,
    });
    if (rpcError) throw rpcError;
    const offer = data as OfferCreation;
    if (!offer?.offer_id) throw new Error('OFFER_EXPIRED');
    setNearby(current => current.filter(item => item.id !== requestId));
    setSuccess(english ? 'Your parking offer was sent.' : 'تم إرسال عرض موقفك للطالب');

    // The database offer and in-app notification are already committed. Remote
    // push is targeted and best-effort, so a delivery outage cannot duplicate it.
    try {
      const { data: authData } = await getSupabase().auth.getSession();
      const token = authData.session?.access_token;
      if (token) {
        await fetchMawqifiServerApi('/api/push/notify-match-offer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
          body: JSON.stringify({ offerId: offer.offer_id }),
        });
      }
    } catch {
      // Realtime/in-app delivery remains available.
    }
  });

  const acceptOffer = () => void run(async () => {
    const offer = myRequest?.offer;
    if (!offer) return;
    const { data, error: rpcError } = await getSupabase().rpc('accept_parking_offer', {
      p_offer_id: offer.id,
    });
    if (rpcError) throw rpcError;
    const handoff = data as AcceptedHandoff;
    if (!handoff?.claim?.conversation_id || !handoff.claim.post_id) throw new Error('OFFER_EXPIRED');
    router.push(getMawqifiPostHref(handoff.claim.post_id, handoff.claim.conversation_id));
  });

  const declineOffer = () => void run(async () => {
    if (!myRequest?.offer) return;
    const { error: rpcError } = await getSupabase().rpc('decline_parking_offer', {
      p_offer_id: myRequest.offer.id,
    });
    if (rpcError) throw rpcError;
    await refreshMine();
  });

  const serverClock = clock + serverOffsetMs;
  const active = Boolean(
    myRequest?.request &&
    ['active', 'offered'].includes(myRequest.request.status) &&
    Date.parse(myRequest.request.expires_at) > serverClock,
  );
  const pendingOffer =
    myRequest?.offer?.status === 'pending' && Date.parse(myRequest.offer.expires_at) > serverClock
      ? myRequest.offer
      : null;
  const acceptedOffer = myRequest?.offer?.status === 'accepted' ? myRequest.offer : null;
  const requestSecs = myRequest?.request
    ? Math.max(0, Math.ceil((Date.parse(myRequest.request.expires_at) - serverClock) / 1000))
    : 0;
  const offerSecs = pendingOffer
    ? Math.max(0, Math.ceil((Date.parse(pendingOffer.expires_at) - serverClock) / 1000))
    : 0;
  const formatClock = (seconds: number) =>
    `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

  return (
    <main className="page-with-chrome min-h-screen px-4 pt-5" dir={dir}>
      <div className="container">
        <HomeHeader
          unreadCount={unreadCount}
          onRefresh={() => {
            void refreshMine().catch(() => {});
            if (myLocation) void refreshNearby(myLocation).catch(() => {});
          }}
        />
        <div data-tutorial-target="place">
          <PlaceSelector />
        </div>

        {error && (
          <p role="alert" className="glass-card mb-4 border border-rose-400/30 p-3 text-sm text-rose-200">
            {error}
          </p>
        )}
        {success && (
          <p role="status" className="glass-card mb-4 border border-cyan-400/30 p-3 text-sm text-cyan-100">
            {success}
          </p>
        )}

        {!active && !acceptedOffer && (
          <button
            type="button"
            className="btn btn-primary mb-5 flex min-h-20 w-full items-center justify-center gap-2 text-lg"
            disabled={busy || !ready}
            onClick={startRequest}
            data-tutorial-target="request"
          >
            <CarFront className="h-6 w-6" aria-hidden="true" />
            {locating
              ? (english ? 'Finding location…' : 'نحدد موقعك…')
              : (english ? 'I Need Parking' : 'أبي موقف')}
          </button>
        )}

        {acceptedOffer?.conversation_id && (
          <button
            type="button"
            className="btn btn-primary mb-5 w-full"
            onClick={() => router.push(getMawqifiPostHref(acceptedOffer.post_id, acceptedOffer.conversation_id!))}
          >
            {english ? 'Open private parking chat' : 'افتح محادثة الموقف الخاصة'}
          </button>
        )}

        {active && (
          <section className="glass-card mb-5 space-y-3 p-4" role="status" aria-live="polite">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-bold">{english ? 'Your parking request is active' : 'طلبك ظاهر للناس'}</h2>
              <span className="font-mono text-lg font-bold" dir="ltr">{formatClock(requestSecs)}</span>
            </div>
            <p className="text-sm text-white/70">
              {english
                ? 'Your request stays active for 15 minutes, even if you close the app.'
                : 'طلبك يستمر 15 دقيقة حتى لو سكرت التطبيق. يوصلك تنبيه إذا أحد عرض عليك موقف.'}
            </p>
            {pendingOffer && (
              <div data-tutorial-target="offer" className="rounded-xl border border-cyan-300/30 bg-cyan-500/10 p-4">
                <div className="flex items-center gap-2">
                  <BellRing className="h-5 w-5 text-cyan-300" aria-hidden="true" />
                  <strong>{english ? 'Someone is offering you a spot!' : 'في شخص قريب يبي يعطيك موقف!'}</strong>
                </div>
                <p className="mt-2 text-sm text-white/70">
                  {english
                    ? 'The exact location appears only after accepting. You have one minute to decide.'
                    : 'الموقع الدقيق يطلع لك فقط بعد الموافقة، وعندك دقيقة تقرر.'}
                </p>
                <p className="my-2 font-mono" dir="ltr">{formatClock(offerSecs)}</p>
                <div className="grid grid-cols-2 gap-2">
                  <button disabled={busy} onClick={acceptOffer} className="btn btn-primary">
                    {english ? 'Accept' : 'أوافق'}
                  </button>
                  <button disabled={busy} onClick={declineOffer} className="btn btn-secondary">
                    {english ? 'Decline' : 'مو مناسب'}
                  </button>
                </div>
              </div>
            )}
            <button
              disabled={busy}
              onClick={cancelRequest}
              className="btn btn-secondary flex w-full items-center justify-center gap-2"
            >
              <X className="h-4 w-4" aria-hidden="true" />
              {english ? 'Cancel my request' : 'إلغاء طلبي'}
            </button>
          </section>
        )}

        {!active && !acceptedOffer && (
          <section data-tutorial-target="nearby" className="mb-6 space-y-3" aria-label={english ? 'Nearby parking requests' : 'طلبات المواقف القريبة'}>
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-bold">{english ? 'Nearby parking requests' : 'طلبات المواقف القريبة'}</h2>
              <button
                type="button"
                disabled={busy || !ready}
                onClick={locateAndRefresh}
                className="flex items-center gap-1 rounded-lg p-2 text-xs text-cyan-300 disabled:opacity-50"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                {myLocation
                  ? (english ? 'Refresh' : 'تحديث')
                  : locationPermissionGranted === false
                    ? (english ? 'Allow location' : 'السماح بالموقع')
                    : (english ? 'Show nearby' : 'عرض القريب')}
              </button>
            </div>
            {!myLocation && (
              <p className="text-sm text-white/60">
                {english
                  ? 'Allow location to show nearby requests. Your exact coordinates stay private.'
                  : 'اسمح بالموقع لعرض الطلبات القريبة. إحداثياتك الدقيقة تبقى خاصة.'}
              </p>
            )}
            {myLocation && nearby.length === 0 && (
              <p className="glass-card p-5 text-center text-sm text-white/70">
                {english ? 'No nearby requests right now.' : 'ما فيه طلبات قريبة حاليًا.'}
              </p>
            )}
            {nearby.map((request, index) => (
              <article className="glass-card space-y-3 p-4" key={request.id}>
                <div className="flex items-center justify-between gap-2">
                  <strong>{english ? 'Parking request' : 'شخص يدور موقف'}</strong>
                  {index === 0 && (
                    <span className="rounded-lg bg-cyan-500/15 px-2 py-1 text-xs text-cyan-200">
                      {english ? 'Nearest' : 'الأقرب'}
                    </span>
                  )}
                </div>
                <p className="flex items-center gap-2 text-sm text-white/70">
                  <MapPin className="h-4 w-4 text-cyan-300" aria-hidden="true" />
                  {english ? place?.name_en : place?.name_ar}
                </p>
                <p className="flex items-center gap-2 text-sm text-white/70">
                  <Clock3 className="h-4 w-4" aria-hidden="true" />
                  {bandLabel(request.distance_band, english)}
                </p>
                <button
                  type="button"
                  disabled={busy || !ready}
                  onClick={() => giveSpot(request.id)}
                  className="btn btn-primary w-full"
                >
                  {english ? 'Offer My Spot' : 'عطه الموقف'}
                </button>
              </article>
            ))}
          </section>
        )}

        <WhatsAppChannelCta />
      </div>
      <BottomNav />
    </main>
  );
}
