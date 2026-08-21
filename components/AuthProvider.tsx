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
import type { TranslationKey } from '@/lib/i18n';
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
  const [initErrorKey, setInitErrorKey] = useState<TranslationKey | null>(null);

  const refreshProfile = useCallback(async () => {
    if (!userId) return;
    const next = await fetchProfile(userId);
    setProfile(next);
  }, [userId]);

  useEffect(() => {
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

    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(
    () => ({ userId, profile, isGuest, isReady, refreshProfile }),
    [userId, profile, isGuest, isReady, refreshProfile],
  );

  if (!isReady) return <LoadingScreen messageKey="auth.prepareAccount" />;

  if (initErrorKey || !isSupabaseConfigured) {
    return <ConfigError messageKey={initErrorKey ?? 'config.missingEnvironment'} />;
  }

  if (!userId || !profile) {
    return <LoadingScreen messageKey="auth.signingIn" />;
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
