'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, MapPin } from 'lucide-react';
import PlaceSelector from '@/components/PlaceSelector';
import { currentParkingLocation, type ParkingLocation } from '@/lib/handoff';
import { usePlace } from '@/components/PlaceProvider';
import BottomNav from '@/components/BottomNav';
import ErrorBanner from '@/components/ErrorBanner';
import { useLocale } from '@/components/LocaleProvider';
import Toast from '@/components/Toast';
import { useAuth } from '@/components/AuthProvider';
import { getSupabase } from '@/lib/supabase';
import { fetchMawqifiServerApi } from '@/lib/server-api';
import { safetyErrorKey } from '@/lib/safety';

export default function CreatePage() {
  const router = useRouter();
  const { userId } = useAuth();
  const { place, subPlaceId, ready } = usePlace();
  const placeId = place?.id ?? null;
  const { dir, t } = useLocale();
  const [location, setLocation] = useState<ParkingLocation | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [published, setPublished] = useState(false);
  const request = useRef(0);
  const publishLock = useRef(false);

  const locate = useCallback(async () => {
    const version = ++request.current;
    setLocation(null);
    setLocationError(false);
    setLocating(false);
    if (!ready || !placeId || !userId) return;
    setLocating(true);
    try {
      const next = await currentParkingLocation();
      if (version === request.current) setLocation(next);
    } catch {
      if (version === request.current) setLocationError(true);
    } finally {
      if (version === request.current) setLocating(false);
    }
  }, [placeId, ready, userId]);

  useEffect(() => {
    setError(null);
    void locate();
    const invalidate = () => { request.current++; };
    return invalidate;
  }, [locate, subPlaceId]);

  useEffect(() => {
    if (!published) return;
    const timeout = setTimeout(() => router.replace('/'), 900);
    return () => clearTimeout(timeout);
  }, [published, router]);

  const publish = async () => {
    if (publishLock.current || !ready || !userId || !placeId || !location) return;
    publishLock.current = true;
    setLoading(true);
    setError(null);
    try {
      // Same atomic private-GPS RPC. No invented college, gate, or description.
      const { data: postId, error: publishError } = await getSupabase().rpc('publish_parking_handoff', {
        payload: { place_id: placeId, sub_place_id: subPlaceId, departure_minutes: 10 },
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy_meters: location.accuracy_meters,
      });
      if (publishError) throw publishError;
      setPublished(true);
      const { data } = await getSupabase().auth.getSession();
      const token = data.session?.access_token;
      if (postId && token) {
        void fetchMawqifiServerApi('/api/push/notify-new-post', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
          body: JSON.stringify({ postId }),
        }).catch(() => {});
      }
    } catch (failure) {
      publishLock.current = false;
      setError(t(safetyErrorKey(failure)));
    } finally {
      setLoading(false);
    }
  };

  const BackIcon = dir === 'rtl' ? ArrowRight : ArrowLeft;
  return (
    <main className="page-with-chrome min-h-screen px-4 pt-6" dir={dir}>
      <Toast message={t('handoff.published')} visible={published} onHide={() => {}} />
      <div className="mx-auto max-w-md space-y-5">
        <header className="flex items-center gap-3">
          <button type="button" onClick={() => router.back()} aria-label={t('common.back')}
            className="rounded-2xl bg-white/10 p-3 text-white/70">
            <BackIcon className="h-5 w-5" />
          </button>
          <h1 className="text-xl font-black">{t('handoff.leave')}</h1>
        </header>
        {!loading && !published && <PlaceSelector />}
        {error && <ErrorBanner message={error} />}
        {locationError && <ErrorBanner message={t('handoff.locationRequired')} onRetry={() => void locate()} />}
        {!ready ? <p className="glass-card p-5 text-center text-sm">{t(!place ? 'place.empty' : placeId === 'kuwait_university' ? 'subPlace.kuHelper' : 'subPlace.paaetHelper')}</p> : (
          <section className="glass-card space-y-4 p-5 text-center" aria-live="polite">
            <MapPin className="mx-auto h-8 w-8 text-cyan-300" aria-hidden="true" />
            {locating ? <p role="status">{t('common.loading')}</p> : location ? (
              <>
                <h2 className="text-lg font-extrabold">{t('handoff.confirmPublish')}</h2>
                <p className="text-sm text-white/60">{t('handoff.private')}</p>
                <button type="button" onClick={() => void publish()} disabled={loading || published}
                  className="btn btn-primary min-h-12 w-full disabled:opacity-50">
                  {loading ? t('create.posting') : t('handoff.publish')}
                </button>
              </>
            ) : null}
            <button type="button" className="btn btn-secondary min-h-12 w-full" disabled={loading || published}
              onClick={() => router.back()}>{t('common.cancel')}</button>
          </section>
        )}
      </div>
      <BottomNav />
    </main>
  );
}
