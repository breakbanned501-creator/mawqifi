'use client';

import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Send } from 'lucide-react';
import PlaceSelector from '@/components/PlaceSelector';
import PlaceGuidance from '@/components/PlaceGuidance';
import { usePlace } from '@/components/PlaceProvider';
import { LOCATION_DESCRIPTION_MAX, usefulLocationDescription } from '@/lib/places';
import BottomNav from '@/components/BottomNav';
import ErrorBanner from '@/components/ErrorBanner';
import { useLocale } from '@/components/LocaleProvider';
import Toast from '@/components/Toast';
import { useAuth } from '@/components/AuthProvider';
import { createParkingPost } from '@/lib/posts';
import { getSupabase } from '@/lib/supabase';
import { fetchMawqifiServerApi } from '@/lib/server-api';
import { safetyErrorKey } from '@/lib/safety';
import {
  departurePresets,
  formatGate,
  formatZone,
  getCollegeName,
  kuColleges,
} from '@/lib/university';

const NOTES_MAX = 500;

export default function CreatePage() {
  const router = useRouter();
  const { userId } = useAuth();
  const { place } = usePlace();
  const isKu = place?.id === 'kuwait_university';
  const [locationDescription, setLocationDescription] = useState('');
  const { dir, formatNumber, locale, t } = useLocale();
  const [college, setCollege] = useState(kuColleges[0].nameAr);
  const [gate, setGate] = useState(kuColleges[0].gates[0]);
  const [notes, setNotes] = useState('');
  const [minutes, setMinutes] = useState(10);
  const [customMinutes, setCustomMinutes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState('');

  const selectedCollege = useMemo(
    () => kuColleges.find((item) => item.nameAr === college) ?? kuColleges[0],
    [college],
  );

  const departureMinutes = useMemo(() => {
    if (customMinutes.trim() !== '') {
      const parsed = Number(customMinutes);
      return Number.isFinite(parsed) ? Math.floor(parsed) : NaN;
    }
    return minutes;
  }, [customMinutes, minutes]);

  const isValidDuration =
    Number.isFinite(departureMinutes) && departureMinutes >= 1 && departureMinutes <= 180;

  useEffect(() => { setLocationDescription(''); setError(null); }, [place?.id]);

  const canPublish = Boolean(place && userId && isValidDuration && (isKu ? college && gate : usefulLocationDescription(locationDescription)));

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading || !canPublish || !userId || !place) {
      if (!place || (!isKu && !usefulLocationDescription(locationDescription))) {
        setError(t('place.locationRequired'));
      } else if (!college || !gate) {
        setError(t('create.invalidLocation'));
      } else if (!isValidDuration) {
        setError(t('create.invalidMinutes'));
      }
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const expiresAt = new Date(Date.now() + departureMinutes * 60 * 1000).toISOString();
      const trimmedNotes = notes.trim().slice(0, NOTES_MAX);

      const createdPost = await createParkingPost({
        userId,
        placeId: place.id,
        locationDescription: isKu ? null : locationDescription.trim(),
        college: isKu ? college : null,
        zone: isKu ? selectedCollege.zone : null,
        gate: isKu ? gate : null,
        carDesc: trimmedNotes || null,
        departureMinutes,
        expiresAt,
      });

      setToast(t('create.success'));

      // Broadcast Web Push notification to other subscribed users
      if (createdPost?.id) {
        const { data: sessionData } = await getSupabase().auth.getSession();
        const accessToken = sessionData.session?.access_token;
        if (accessToken) {
          void fetchMawqifiServerApi('/api/push/notify-new-post', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
            body: JSON.stringify({ postId: createdPost.id }),
          }).catch((err) => console.error('Push broadcast error:', err));
        }
      }

      setTimeout(() => router.push('/'), 900);
    } catch (error) {
      setError(t(safetyErrorKey(error)));
    } finally {
      setLoading(false);
    }
  };

  const BackIcon = dir === 'rtl' ? ArrowRight : ArrowLeft;

  return (
    <main className="page-with-chrome min-h-screen px-4 pt-6" dir={dir}>
      <Toast message={toast} visible={Boolean(toast)} onHide={() => setToast('')} />
      <div className="mx-auto max-w-md md:max-w-xl lg:max-w-2xl space-y-5">
        <header className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            aria-label={t('common.back')}
            className="rounded-2xl bg-white/10 p-2.5 sm:p-3 text-white/70 hover:bg-white/15"
          >
            <BackIcon className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl font-black truncate">{t('create.title')}</h1>
            <p className="text-xs sm:text-sm text-white/50 truncate">{t('create.subtitle')}</p>
          </div>
        </header>

        <PlaceSelector />
        <PlaceGuidance />
        {error && <ErrorBanner message={error} />}

        {!place ? <p className="glass-card p-5 text-center text-sm leading-7 text-white/70">{t('place.empty')}</p> : <form key={place.id} onSubmit={handleSubmit} className="glass-card animate-fade-up space-y-5 p-4 sm:p-5">
          {isKu ? <>
          <div>
            <label className="mb-2 block text-sm font-bold text-white/70">{t('create.college')}</label>
            <select
              className="input"
              value={college}
              dir={dir}
              required
              onChange={(e) => {
                setCollege(e.target.value);
                setGate(
                  (kuColleges.find((item) => item.nameAr === e.target.value) ?? kuColleges[0]).gates[0],
                );
              }}
            >
              {kuColleges.map((item) => (
                <option key={item.nameAr} value={item.nameAr}>
                  {getCollegeName(item, locale)}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-2 block text-sm font-bold text-white/70">{t('create.zone')}</label>
              <input
                className="input"
                value={formatZone(selectedCollege.zone, locale)}
                dir={dir}
                readOnly
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-bold text-white/70">{t('create.gate')}</label>
              <select
                className="input"
                value={gate}
                dir={dir}
                required
                onChange={(e) => setGate(e.target.value)}
              >
                {selectedCollege.gates.map((item) => (
                  <option key={item} value={item}>
                    {formatGate(item, locale)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          </> : <div>
            <label htmlFor="parking-location" className="mb-2 block text-sm font-bold text-white/70">{t('place.describeLocation')}</label>
            <textarea id="parking-location" className="input min-h-28" dir="auto" required minLength={3} maxLength={LOCATION_DESCRIPTION_MAX}
              value={locationDescription} onChange={event => setLocationDescription(event.target.value)} placeholder={t('place.locationHint')} />
            <p className="mt-2 text-xs leading-6 text-white/50">{t(place.id === 'paaet' ? 'place.paaetLocationHint' : 'place.locationHint')}</p>
          </div>}
          <div>
            <label htmlFor="notes" className="mb-2 block text-sm font-bold text-white/70">
              {t('create.notes')}
              <span className="ms-1 font-normal text-white/40">({t('common.optional')})</span>
            </label>
            <textarea
              id="notes"
              className="textarea"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={NOTES_MAX}
              rows={4}
              dir="auto"
              lang={locale}
              placeholder={t('create.notesPlaceholder')}
            />
            <p className="mt-2 text-xs text-white/40">
              {formatNumber(notes.length)}/{formatNumber(NOTES_MAX)}
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-white/70">{t('create.departureTime')}</label>
            <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
              {departurePresets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setMinutes(preset);
                    setCustomMinutes('');
                  }}
                  className={`rounded-2xl py-2.5 sm:py-3 text-xs sm:text-sm font-extrabold transition-all ${
                    minutes === preset && customMinutes.trim() === ''
                      ? 'bg-cyan-500 text-navy-900 shadow-lg shadow-cyan-500/20'
                      : 'bg-white/10 text-white/60 hover:bg-white/15'
                  }`}
                >
                  {t('create.departurePreset', { minutes: formatNumber(preset) })}
                </button>
              ))}
            </div>
            <input
              className="input mt-3"
              type="number"
              min={1}
              max={180}
              inputMode="numeric"
              dir="ltr"
              value={customMinutes}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === '' || Number(raw) >= 0) setCustomMinutes(raw);
              }}
              placeholder={t('create.customMinutes')}
            />
            {customMinutes.trim() !== '' && !isValidDuration && (
              <p className="mt-2 text-xs font-bold text-red-200">{t('create.invalidMinutes')}</p>
            )}
            {isValidDuration && (
              <p className="mt-2 text-xs font-bold text-cyan-200/80">
                {t('create.autoExpiry', { minutes: formatNumber(departureMinutes) })}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !canPublish}
            className="btn btn-primary flex w-full items-center justify-center gap-2 py-4 text-lg transition-all disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send className="h-5 w-5" />
            {loading ? t('create.posting') : t('create.post')}
          </button>
        </form>}
      </div>
      <BottomNav />
    </main>
  );
}
