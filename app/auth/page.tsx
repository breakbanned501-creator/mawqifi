'use client';

import { type FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Car, LogIn, UserPlus } from 'lucide-react';
import { ensureUserProfile } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase';
import AppFooter from '@/components/AppFooter';
import Toast from '@/components/Toast';
import ErrorBanner from '@/components/ErrorBanner';
import { useAuth } from '@/components/AuthProvider';
import { useLocale } from '@/components/LocaleProvider';

export default function AuthPage() {
  const router = useRouter();
  const { refreshProfile, isGuest } = useAuth();
  const { t } = useLocale();
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
          options: { data: { username: username || t('auth.guest') } },
        });
        if (result.error) throw result.error;
        if (result.data.user) {
          await ensureUserProfile(result.data.user.id, false);
          await supabase
            .from('users')
            .update({ username: username || t('auth.guest'), is_guest: false })
            .eq('id', result.data.user.id);
        }
        setMessage(t('auth.accountCreated'));
      } else {
        const result = await supabase.auth.signInWithPassword({ email, password });
        if (result.error) throw result.error;
        if (result.data.user) {
          await ensureUserProfile(result.data.user.id, false);
        }
        setMessage(t('auth.signedIn'));
      }

      await refreshProfile();
      setTimeout(() => router.push('/'), 800);
    } catch {
      setError(t('auth.signInError'));
    } finally {
      setLoading(false);
    }
  };

  const continueAsGuest = () => {
    router.push('/');
  };

  return (
    <main className="flex min-h-screen flex-col justify-center px-4 py-8 pb-6">
      <Toast message={message} visible={Boolean(message)} onHide={() => setMessage('')} />
      <div className="mx-auto w-full max-w-md space-y-4">
        <div className="mb-4 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-cyan-500 text-navy-900 shadow-glow">
            <Car className="h-8 w-8" />
          </div>
          <h1 className="text-3xl font-black text-white">{t('app.name')}</h1>
          <p className="mt-2 text-sm leading-7 text-white/60">
            {isGuest ? t('auth.guestNotice') : t('auth.signInOrCreate')}
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
              {t('auth.signIn')}
            </button>
            <button
              type="button"
              onClick={() => setMode('signup')}
              className={`rounded-xl py-2 text-sm font-bold ${mode === 'signup' ? 'bg-cyan-500 text-navy-900' : 'text-white/50'}`}
            >
              {t('auth.signUp')}
            </button>
          </div>

          {mode === 'signup' && (
            <input
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={t('auth.username')}
              aria-label={t('auth.username')}
              required
            />
          )}
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('auth.email')}
            aria-label={t('auth.email')}
            required
          />
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('auth.password')}
            aria-label={t('auth.password')}
            required
            minLength={6}
          />

          <button
            disabled={loading}
            className="btn btn-primary flex w-full items-center justify-center gap-2 disabled:opacity-50"
          >
            {mode === 'signup' ? <UserPlus className="h-5 w-5" /> : <LogIn className="h-5 w-5" />}
            {loading ? t('auth.processing') : mode === 'signup' ? t('auth.createAccount') : t('auth.signIn')}
          </button>
        </form>

        {isGuest && (
          <button
            type="button"
            onClick={continueAsGuest}
            className="w-full rounded-3xl border border-white/10 bg-white/5 py-4 text-sm font-bold text-white/70"
          >
            {t('auth.continueGuest')}
          </button>
        )}

        <p className="text-center text-xs leading-6 text-white/45">
          {t('auth.guestBenefits')}
        </p>
      </div>
      <AppFooter />
    </main>
  );
}
