'use client';

import { type FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Send } from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import Toast from '@/components/Toast';
import { addStoredPost } from '@/lib/posts';
import { departurePresets, formatGate, formatZone, kuColleges } from '@/lib/university';
import { supabase } from '@/lib/supabase';
import type { ParkingPost } from '@/lib/types';

export default function CreatePage() {
  const router = useRouter();
  const [college, setCollege] = useState(kuColleges[0].nameAr);
  const [gate, setGate] = useState(kuColleges[0].gates[0]);
  const [carDesc, setCarDesc] = useState('');
  const [minutes, setMinutes] = useState(10);
  const [customMinutes, setCustomMinutes] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(false);

  const selectedCollege = useMemo(() => kuColleges.find((item) => item.nameAr === college) ?? kuColleges[0], [college]);
  const departureMinutes = customMinutes ? Number(customMinutes) : minutes;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading || !college || !gate || !departureMinutes) return;

    setLoading(true);
    const expiresAt = new Date(Date.now() + departureMinutes * 60 * 1000).toISOString();

    if (supabase) {
      const userResult = await supabase.auth.getUser();
      const user = userResult.data.user;
      await supabase.from('posts').insert({
        user_id: user?.id ?? 'anonymous',
        college,
        zone: selectedCollege.zone,
        gate,
        car_desc: carDesc || null,
        departure_minutes: departureMinutes,
        expires_at: expiresAt,
        status: 'active',
        username: user?.user_metadata.username || user?.email || 'طالب',
      });
    } else {
      const localPost: ParkingPost = {
        id: `local-${Date.now()}`,
        user_id: 'local-user',
        college,
        zone: selectedCollege.zone,
        gate,
        car_desc: carDesc || null,
        departure_minutes: departureMinutes,
        expires_at: expiresAt,
        status: 'active',
        username: JSON.parse(localStorage.getItem('mawqifi_local_user') || '{}')?.username || 'طالب جامعة الكويت',
        created_at: new Date().toISOString(),
      };
      addStoredPost(localPost);
    }

    setToast(true);
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('موقفي', { body: 'تم نشر موقفك بنجاح' });
    }
    setTimeout(() => router.push('/'), 900);
    setLoading(false);
  };

  return (
    <main className="min-h-screen px-4 pb-28 pt-6">
      <Toast message="تم نشر موقفك بنجاح" visible={toast} />
      <div className="mx-auto max-w-md space-y-5">
        <header className="flex items-center gap-3">
          <button onClick={() => router.back()} className="rounded-2xl bg-white/10 p-3 text-white/70">
            <ArrowRight className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-black">نشر موقف</h1>
            <p className="text-sm text-white/50">شارك موقفك خلال ثواني</p>
          </div>
        </header>

        <form onSubmit={handleSubmit} className="glass-card space-y-5 p-5">
          <div>
            <label className="mb-2 block text-sm font-bold text-white/70">الكلية</label>
            <select className="input" value={college} onChange={(e) => { setCollege(e.target.value); setGate((kuColleges.find((item) => item.nameAr === e.target.value) ?? kuColleges[0]).gates[0]); }}>
              {kuColleges.map((item) => <option key={item.nameAr} value={item.nameAr}>{item.nameAr}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-2 block text-sm font-bold text-white/70">المنطقة</label>
              <input className="input" value={formatZone(selectedCollege.zone)} readOnly />
            </div>
            <div>
              <label className="mb-2 block text-sm font-bold text-white/70">أقرب بوابة</label>
              <select className="input" value={gate} onChange={(e) => setGate(e.target.value)}>
                {selectedCollege.gates.map((item) => (
                  <option key={item} value={item}>
                    {formatGate(item)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-white/70">وصف السيارة اختياري</label>
            <input className="input" value={carDesc} onChange={(e) => setCarDesc(e.target.value)} placeholder="مثال: جيب أسود" />
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-white/70">وقت المغادرة</label>
            <div className="grid grid-cols-4 gap-2">
              {departurePresets.map((preset) => (
                <button key={preset} type="button" onClick={() => { setMinutes(preset); setCustomMinutes(''); }} className={`rounded-2xl py-3 text-sm font-extrabold ${minutes === preset && !customMinutes ? 'bg-cyan-500 text-navy-900' : 'bg-white/10 text-white/60'}`}>
                  {preset} د
                </button>
              ))}
            </div>
            <input className="input mt-3" type="number" min={1} max={180} value={customMinutes} onChange={(e) => setCustomMinutes(e.target.value)} placeholder="دقائق مخصصة" />
          </div>

          <button disabled={loading} className="btn btn-primary flex w-full items-center justify-center gap-2 py-4 text-lg disabled:opacity-50">
            <Send className="h-5 w-5" />
            {loading ? 'جاري النشر...' : 'نشر الموقف'}
          </button>
        </form>
      </div>
      <BottomNav />
    </main>
  );
}
