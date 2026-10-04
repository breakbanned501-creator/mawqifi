'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { ensureSession, fetchProfile } from '@/lib/auth';
import type { TranslationKey } from '@/lib/i18n';
import { isSupabaseConfigured } from '@/lib/supabase';
import type { Profile } from '@/lib/types';
import LoadingScreen from './LoadingScreen';
import ConfigError from './ConfigError';
import { clearDeletedAccountSession, deleteOwnAccount, DELETION_PENDING_KEY } from '@/lib/account-deletion';
import { readStoredLocale, translate, getTextDirection } from '@/lib/i18n';
import { getSupabase } from '@/lib/supabase';

type AuthContextValue = {
  userId: string | null;
  profile: Profile | null;
  isGuest: boolean;
  isReady: boolean;
  refreshProfile: () => Promise<void>;
  deleteAccount: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  userId: null,
  profile: null,
  isGuest: true,
  isReady: false,
  refreshProfile: async () => {},
  deleteAccount: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isGuest, setIsGuest] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [initErrorKey, setInitErrorKey] = useState<TranslationKey | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deletionFailed, setDeletionFailed] = useState(false);
  const deletionLock = useRef(false);

  const deleteAccount = useCallback(async () => {
    if (deletionLock.current) return;
    deletionLock.current = true;
    setDeleting(true);
    setDeletionFailed(false);
    try { localStorage.setItem(DELETION_PENDING_KEY, 'true'); } catch { /* The in-memory navigation gate still applies. */ }
    // Unmount authenticated screens immediately, releasing blobs, GPS watches,
    // realtime subscriptions and private component state before server cleanup.
    try {
      await deleteOwnAccount();
      setUserId(null);
      setProfile(null);
      await clearDeletedAccountSession();
    } catch {
      setDeletionFailed(true);
      deletionLock.current = false;
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!userId) return;
    const next = await fetchProfile(userId);
    setProfile(next);
  }, [userId]);

  useEffect(() => {
    let pending = false;
    try { pending = localStorage.getItem(DELETION_PENDING_KEY) === 'true'; } catch { /* No persisted session in restricted storage. */ }
    if (pending) {
      void deleteAccount();
      return;
    }
    if (!isSupabaseConfigured) {
      setInitErrorKey('config.missingEnvironment');
      setIsReady(true);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const session = await ensureSession();
        if (cancelled) return;
        const userProfile = await fetchProfile(session.userId);
        if (cancelled) return;
        setUserId(session.userId);
        setIsGuest(session.isGuest);
        setProfile(userProfile);
        setInitErrorKey(null);
      } catch {
        if (cancelled) return;
        // Authentication runs before LocaleProvider. Keep technical details in
        // diagnostics and render only a localized, safe message to students.
        setInitErrorKey('config.connectionError');
      } finally {
        if (!cancelled) setIsReady(true);
      }
    })();

    // A logout from another tab must discard its private React state too.
    const { data: listener } = getSupabase().auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT' && !deletionLock.current) window.location.replace('/');
    });
    return () => { cancelled = true; listener.subscription.unsubscribe(); };
  }, [deleteAccount]);

  const value = useMemo(
    () => ({ userId, profile, isGuest, isReady, refreshProfile, deleteAccount }),
    [userId, profile, isGuest, isReady, refreshProfile, deleteAccount],
  );

  if (deleting) {
    const locale = readStoredLocale() ?? 'ar';
    return <main className="page-with-chrome flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center" dir={getTextDirection(locale)} aria-live="polite" aria-busy={!deletionFailed}>
      <p className="font-bold">{translate(locale, deletionFailed ? 'deletion.retryBody' : 'deletion.progress')}</p>
      {deletionFailed ? <button type="button" className="btn btn-secondary" onClick={() => void deleteAccount()}>{translate(locale, 'common.retry')}</button> : <div className="h-8 w-8 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent" />}
    </main>;
  }

  if (!isReady) return <LoadingScreen messageKey="auth.prepareAccount" />;

  if (initErrorKey || !isSupabaseConfigured) {
    return <ConfigError messageKey={initErrorKey ?? 'config.missingEnvironment'} />;
  }

  if (!userId || !profile) {
    return <LoadingScreen messageKey="auth.signingIn" />;
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
