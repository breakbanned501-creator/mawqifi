'use client';

import { type FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Send } from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import ErrorBanner from '@/components/ErrorBanner';
import Toast from '@/components/Toast';
import { useAuth } from '@/components/AuthProvider';
import { createParkingPost } from '@/lib/posts';
import { getSupabase } from '@/lib/supabase';
import { departurePresets, formatGate, formatZone, kuColleges } from '@/lib/university';

const NOTES_MAX = 500;

export default function CreatePage() {
  const router = useRouter();
  const { userId } = useAuth();
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

  const canPublish = Boolean(college && gate && userId && isValidDuration);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading || !canPublish || !userId) {
      if (!college || !gate) {
        setError('اختر الكلية والبوابة قبل النشر');
      } else if (!isValidDuration) {
        setError('حدّد وقت مغادرة صالحاً بين ١ و ١٨٠ دقيقة');
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
        college,
        zone: selectedCollege.zone,
        gate,
        carDesc: trimmedNotes || null,
        departureMinutes,
        expiresAt,
      });

      setToast('تم نشر موقفك بنجاح');

      // Broadcast Web Push notification to other subscribed users
      if (createdPost?.id) {
        const { data: sessionData } = await getSupabase().auth.getSession();
        const accessToken = sessionData.session?.access_token;
        if (accessToken) {
          void fetch('/api/push/notify-new-post', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
            body: JSON.stringify({ postId: createdPost.id }),
          }).catch((err) => console.error('Push broadcast error:', err));
        }
      }

      setTimeout(() => router.push('/'), 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر نشر الموقف');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="page-with-chrome min-h-screen px-4 pt-6">
      <Toast message={toast} visible={Boolean(toast)} onHide={() => setToast('')} />
      <div className="mx-auto max-w-md md:max-w-xl lg:max-w-2xl space-y-5">
        <header className="flex items-center gap-3">
          <button type="button" onClick={() => router.back()} className="rounded-2xl bg-white/10 p-2.5 sm:p-3 text-white/70 hover:bg-white/15">
            <ArrowRight className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl font-black truncate">نشر موقف</h1>
            <p className="text-xs sm:text-sm text-white/50 truncate">شارك موقفك خلال ثواني</p>
          </div>
        </header>

        {error && <ErrorBanner message={error} />}

        <form onSubmit={handleSubmit} className="glass-card animate-fade-up space-y-5 p-4 sm:p-5">
          <div>
            <label className="mb-2 block text-sm font-bold text-white/70">الكلية</label>
            <select
              className="input"
              value={college}
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
                  {item.nameAr}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-2 block text-sm font-bold text-white/70">المنطقة</label>
              <input className="input" value={formatZone(selectedCollege.zone)} readOnly />
            </div>
            <div>
              <label className="mb-2 block text-sm font-bold text-white/70">أقرب بوابة</label>
              <select className="input" value={gate} required onChange={(e) => setGate(e.target.value)}>
                {selectedCollege.gates.map((item) => (
                  <option key={item} value={item}>
                    {formatGate(item)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="notes" className="mb-2 block text-sm font-bold text-white/70">
              ملاحظات إضافية
              <span className="ms-1 font-normal text-white/40">(اختياري)</span>
            </label>
            <textarea
              id="notes"
              className="textarea"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={NOTES_MAX}
              rows={4}
              dir="rtl"
              lang="ar"
              placeholder="مثال: الموقف قريب من الباب، السيارة خلف الباص الأحمر"
            />
            <p className="mt-2 text-xs text-white/40">
              {notes.length}/{NOTES_MAX} — ساعد الطلاب بتحديد مكانك بدقة
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-white/70">وقت المغادرة</label>
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
                  {preset} د
                </button>
              ))}
            </div>
            <input
              className="input mt-3"
              type="number"
              min={1}
              max={180}
              inputMode="numeric"
              value={customMinutes}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === '' || Number(raw) >= 0) setCustomMinutes(raw);
              }}
              placeholder="دقائق مخصصة (١–١٨٠)"
            />
            {customMinutes.trim() !== '' && !isValidDuration && (
              <p className="mt-2 text-xs font-bold text-red-200">أدخل مدة بين ١ و ١٨٠ دقيقة</p>
            )}
            {isValidDuration && (
              <p className="mt-2 text-xs font-bold text-cyan-200/80">
                ينتهي الموقف تلقائياً بعد {departureMinutes} دقيقة
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !canPublish}
            className="btn btn-primary flex w-full items-center justify-center gap-2 py-4 text-lg transition-all disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send className="h-5 w-5" />
            {loading ? 'جاري النشر...' : 'نشر الموقف'}
          </button>
        </form>
      </div>
      <BottomNav />
    </main>
  );
}
