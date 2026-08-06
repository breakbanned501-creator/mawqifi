'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { ensureSession, fetchProfile } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/supabase';
import type { Profile } from '@/lib/types';
import LoadingScreen from './LoadingScreen';
import ConfigError from './ConfigError';

type AuthContextValue = {
  userId: string | null;
  profile: Profile | null;
  isGuest: boolean;
  isReady: boolean;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  userId: null,
  profile: null,
  isGuest: true,
  isReady: false,
  refreshProfile: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isGuest, setIsGuest] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  const refreshProfile = useCallback(async () => {
    if (!userId) return;
    const next = await fetchProfile(userId);
    setProfile(next);
  }, [userId]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setInitError('Supabase environment variables are missing.');
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
        setInitError(null);
      } catch (error) {
        if (cancelled) return;
        setInitError(error instanceof Error ? error.message : 'تعذر الاتصال بالخادم');
      } finally {
        if (!cancelled) setIsReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(
    () => ({ userId, profile, isGuest, isReady, refreshProfile }),
    [userId, profile, isGuest, isReady, refreshProfile],
  );

  if (!isReady) return <LoadingScreen message="جاري تجهيز الحساب..." />;

  if (initError || !isSupabaseConfigured) {
    return <ConfigError message={initError ?? undefined} />;
  }

  if (!userId || !profile) {
    return <LoadingScreen message="جاري تسجيل الدخول..." />;
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
