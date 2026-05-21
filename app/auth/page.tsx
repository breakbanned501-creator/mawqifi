'use client';

import { type FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Car, LogIn, UserPlus } from 'lucide-react';
import { ensureUserProfile } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase';
import Toast from '@/components/Toast';
import ErrorBanner from '@/components/ErrorBanner';
import { useAuth } from '@/components/AuthProvider';

export default function AuthPage() {
  const router = useRouter();
  const { refreshProfile, isGuest } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getSupabase();
    supabase.auth.getSession().then((result) => {
      if (result.data.session && !result.data.session.user.is_anonymous) {
        router.replace('/');
      }
    });
  }, [router]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    setError(null);

    const supabase = getSupabase();

    try {
      if (mode === 'signup') {
        const result = await supabase.auth.signUp({
          email,
          password,
          options: { data: { username: username || 'طالب' } },
        });
        if (result.error) throw result.error;
        if (result.data.user) {
          await ensureUserProfile(result.data.user.id, false);
          await supabase
            .from('users')
            .update({ username: username || 'طالب', is_guest: false })
            .eq('id', result.data.user.id);
        }
        setMessage('تم إنشاء الحساب. تحقق من بريدك إن طُلب ذلك.');
      } else {
        const result = await supabase.auth.signInWithPassword({ email, password });
        if (result.error) throw result.error;
        if (result.data.user) {
          await ensureUserProfile(result.data.user.id, false);
        }
        setMessage('تم تسجيل الدخول');
      }

      await refreshProfile();
      setTimeout(() => router.push('/'), 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تسجيل الدخول');
    } finally {
      setLoading(false);
    }
  };

  const continueAsGuest = () => {
    router.push('/');
  };

  return (
    <main className="flex min-h-screen flex-col justify-center px-4 py-8">
      <Toast message={message} visible={Boolean(message)} onHide={() => setMessage('')} />
      <div className="mx-auto w-full max-w-md space-y-4">
        <div className="mb-4 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-cyan-500 text-navy-900 shadow-glow">
            <Car className="h-8 w-8" />
          </div>
          <h1 className="text-3xl font-black text-white">موقفي</h1>
          <p className="mt-2 text-sm leading-7 text-white/60">
            {isGuest ? 'أنت تستخدم حساب ضيف — يمكنك ربط بريد لاحقاً' : 'سجّل دخولك أو أنشئ حساباً'}
          </p>
        </div>

        {error && <ErrorBanner message={error} />}

        <form onSubmit={handleSubmit} className="glass-card space-y-4 p-5">
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-navy-950/60 p-1">
            <button
              type="button"
              onClick={() => setMode('signin')}
              className={`rounded-xl py-2 text-sm font-bold ${mode === 'signin' ? 'bg-cyan-500 text-navy-900' : 'text-white/50'}`}
            >
              دخول
            </button>
            <button
              type="button"
              onClick={() => setMode('signup')}
              className={`rounded-xl py-2 text-sm font-bold ${mode === 'signup' ? 'bg-cyan-500 text-navy-900' : 'text-white/50'}`}
            >
              حساب جديد
            </button>
          </div>

          {mode === 'signup' && (
            <input
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="اسم المستخدم"
              required
            />
          )}
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="البريد الإلكتروني"
            required
          />
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="كلمة المرور"
            required
            minLength={6}
          />

          <button
            disabled={loading}
            className="btn btn-primary flex w-full items-center justify-center gap-2 disabled:opacity-50"
          >
            {mode === 'signup' ? <UserPlus className="h-5 w-5" /> : <LogIn className="h-5 w-5" />}
            {loading ? 'جاري المعالجة...' : mode === 'signup' ? 'إنشاء حساب' : 'تسجيل الدخول'}
          </button>
        </form>

        {isGuest && (
          <button
            type="button"
            onClick={continueAsGuest}
            className="w-full rounded-3xl border border-white/10 bg-white/5 py-4 text-sm font-bold text-white/70"
          >
            متابعة كضيف
          </button>
        )}

        <p className="text-center text-xs leading-6 text-white/45">
          الضيوف يمكنهم النشر والمحادثة فوراً. الحساب بالبريد يحفظ بياناتك على كل الأجهزة.
        </p>
      </div>
    </main>
  );
}
