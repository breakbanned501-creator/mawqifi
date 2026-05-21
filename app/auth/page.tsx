'use client';

import { type FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Car, LogIn, UserPlus } from 'lucide-react';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import Toast from '@/components/Toast';

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then((result) => {
      if (result.data.session) router.replace('/');
    });
  }, [router]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setMessage('');

    if (!supabase) {
      localStorage.setItem('mawqifi_local_user', JSON.stringify({ email, username: username || 'طالب جامعة الكويت' }));
      setMessage('تم تسجيل الدخول محلياً');
      setTimeout(() => router.push('/'), 700);
      setLoading(false);
      return;
    }

    const result = mode === 'signup'
      ? await supabase.auth.signUp({ email, password, options: { data: { username } } })
      : await supabase.auth.signInWithPassword({ email, password });

    if (result.error) {
      setMessage(result.error.message);
    } else {
      setMessage(mode === 'signup' ? 'تم إنشاء الحساب، تحقق من بريدك إن لزم' : 'تم تسجيل الدخول');
      setTimeout(() => router.push('/'), 800);
    }

    setLoading(false);
  };

  return (
    <main className="flex min-h-screen flex-col justify-center px-4 py-8">
      <Toast message={message} visible={Boolean(message)} onHide={() => setMessage('')} />
      <div className="mx-auto w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-cyan-500 text-navy-900 shadow-glow">
            <Car className="h-8 w-8" />
          </div>
          <h1 className="text-3xl font-black text-white">موقفي</h1>
          <p className="mt-2 text-sm leading-7 text-white/60">منصة طلابية لمشاركة المواقف في الشدادية</p>
        </div>

        <form onSubmit={handleSubmit} className="glass-card space-y-4 p-5">
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-navy-950/60 p-1">
            <button type="button" onClick={() => setMode('signin')} className={`rounded-xl py-2 text-sm font-bold ${mode === 'signin' ? 'bg-cyan-500 text-navy-900' : 'text-white/50'}`}>
              دخول
            </button>
            <button type="button" onClick={() => setMode('signup')} className={`rounded-xl py-2 text-sm font-bold ${mode === 'signup' ? 'bg-cyan-500 text-navy-900' : 'text-white/50'}`}>
              حساب جديد
            </button>
          </div>

          {mode === 'signup' && (
            <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="اسم المستخدم" required />
          )}
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="البريد الإلكتروني" required />
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="كلمة المرور" required minLength={6} />

          {!isSupabaseConfigured && (
            <p className="rounded-2xl bg-yellow-400/10 p-3 text-xs text-yellow-100">Supabase غير مفعّل حالياً، سيتم استخدام جلسة محلية للعرض.</p>
          )}

          <button disabled={loading} className="btn btn-primary flex w-full items-center justify-center gap-2 disabled:opacity-50">
            {mode === 'signup' ? <UserPlus className="h-5 w-5" /> : <LogIn className="h-5 w-5" />}
            {loading ? 'جاري المعالجة...' : mode === 'signup' ? 'إنشاء حساب' : 'تسجيل الدخول'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs leading-6 text-white/45">
          بالمتابعة أنت توافق على استخدام التطبيق للتنسيق المجتمعي فقط دون أي حجز رسمي.
        </p>
      </div>
    </main>
  );
}
