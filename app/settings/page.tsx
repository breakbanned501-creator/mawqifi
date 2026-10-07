'use client';

import { type MouseEvent, useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { Bell, CircleHelp, Languages, LogOut, MessageCircle, ShieldCheck, User, Trash2 } from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import ErrorBanner from '@/components/ErrorBanner';
import PageHeader from '@/components/PageHeader';
import PushNotificationControl from '@/components/PushNotificationControl';
import { useAuth } from '@/components/AuthProvider';
import { useLocale } from '@/components/LocaleProvider';
import { useTutorial } from '@/components/TutorialProvider';
import { signOut, updateUsername } from '@/lib/auth';
import { MAWQIFI_WHATSAPP_CHANNEL_URL } from '@/lib/links';
import { isNativeCapacitor, openExternalUrl } from '@/lib/capacitor';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  fetchNotificationPreferences,
  updateNotificationPreferences,
  type NotificationPreferences,
  type NotificationPreferencesPatch,
} from '@/lib/notification-preferences';
import { getSupabase } from '@/lib/supabase';

type PreferenceKey = Exclude<keyof NotificationPreferencesPatch, 'locale'>;

function PreferenceToggle({
  label,
  description,
  checked,
  loading,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  loading: boolean;
  onChange: () => void;
}) {
  const { dir } = useLocale();

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/[0.03] p-3.5">
      <div className="min-w-0 flex-1">
        <p className="font-bold text-white">{label}</p>
        <p className="mt-0.5 text-xs leading-5 text-white/55">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={loading}
        onClick={onChange}
        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition-colors disabled:opacity-50 ${
          checked ? 'bg-cyan-500' : 'bg-white/15'
        }`}
      >
        <span
          className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
            checked ? (dir === 'rtl' ? '-translate-x-[1.25rem]' : 'translate-x-[1.25rem]') : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}

export default function SettingsPage() {
  const { profile, isGuest, refreshProfile, userId, deleteAccount } = useAuth();
  const { locale, setLocale, t } = useLocale();
  const { replayTutorial } = useTutorial();
  const [activePosts, setActivePosts] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [username, setUsername] = useState(profile?.username ?? '');
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [preferenceLoading, setPreferenceLoading] = useState<PreferenceKey | null>(null);
  const [preferencesError, setPreferencesError] = useState(false);
  const deletionDialog = useRef<HTMLDialogElement>(null);

  const handleChannelClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!isNativeCapacitor()) return;
    event.preventDefault();
    void openExternalUrl(MAWQIFI_WHATSAPP_CHANNEL_URL).catch(() => setError(t('common.error')));
  };

  useEffect(() => {
    setUsername(profile?.username ?? '');
  }, [profile?.username]);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    void (async () => {
      try {
        const next = await fetchNotificationPreferences(userId);
        if (!cancelled) {
          setPreferences(next);
          setPreferencesError(false);
        }
      } catch {
        if (!cancelled) setPreferencesError(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    void (async () => {
      try {
        const { data: posts, error: loadError } = await getSupabase().from('parking_posts').select('id').eq('user_id', userId).eq('status', 'active').gt('expires_at', new Date().toISOString());
        if (!loadError) setActivePosts(posts?.length ?? 0);
      } catch { /* Keep account settings usable offline. */ }
    })();
  }, [userId]);

  const saveUsername = async () => {
    if (!userId || !username.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await updateUsername(userId, username.trim());
      await refreshProfile();
    } catch {
      setError(t('settings.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const logout = async () => {
    try {
      await signOut();
      window.location.href = '/';
    } catch {
      setError(t('settings.signOutError'));
    }
  };

  const updatePreference = async (key: PreferenceKey) => {
    if (!userId || preferenceLoading) return;

    const current = preferences ?? {
      user_id: userId,
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      created_at: '',
      updated_at: '',
    };
    const nextValue = !current[key];
    setPreferenceLoading(key);
    setPreferencesError(false);
    setPreferences({ ...current, [key]: nextValue });

    try {
      const next = await updateNotificationPreferences({ [key]: nextValue }, userId);
      setPreferences(next);
    } catch {
      setPreferences(current);
      setPreferencesError(true);
    } finally {
      setPreferenceLoading(null);
    }
  };

  const currentPreferences = preferences ?? {
    user_id: userId ?? '',
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    created_at: '',
    updated_at: '',
  };

  return (
    <main className="page-with-chrome min-h-screen px-4 pt-6">
      <div className="mx-auto max-w-md space-y-5 md:max-w-xl lg:max-w-2xl">
        <PageHeader title={t('settings.title')} subtitle={t('settings.subtitle')} backHref="/" />

        {error && <ErrorBanner message={error} />}

        <section className="glass-card p-5">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl bg-cyan-500/15 text-cyan-300">
              <User className="h-8 w-8" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-lg font-extrabold text-white">{profile?.username}</h2>
              <p className="text-sm text-white/55">
                {isGuest ? t('settings.guestAccount') : t('settings.registeredAccount')} — {t('settings.activePosts', { count: activePosts })}
              </p>
            </div>
          </div>
          {isGuest && <p className="mt-3 text-sm leading-7 text-white/60">{t('auth.guestNotice')}</p>}
          <div className="mt-4 flex gap-2">
            <input
              className="input min-w-0 flex-1"
              value={username}
              dir="auto"
              onChange={(event) => setUsername(event.target.value)}
              placeholder={t('settings.displayName')}
              aria-label={t('settings.displayName')}
            />
            <button
              type="button"
              onClick={() => void saveUsername()}
              disabled={saving}
              className="btn btn-secondary shrink-0 px-4"
            >
              {saving ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </section>

        <section className="glass-card p-5">
          <div className="flex items-center gap-3">
            <Languages className="h-5 w-5 shrink-0 text-cyan-300" />
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-white">{t('settings.language')}</h3>
              <p className="text-sm text-white/55">{t('settings.languageDescription')}</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 rounded-2xl bg-white/5 p-1" role="group" aria-label={t('settings.language')}>
            {(['ar', 'en'] as const).map((option) => {
              const selected = locale === option;
              const label = option === 'ar' ? t('settings.languageArabic') : t('settings.languageEnglish');
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => setLocale(option)}
                  aria-pressed={selected}
                  className={`rounded-xl px-3 py-2.5 text-sm font-bold transition-colors ${
                    selected ? 'bg-cyan-500 text-navy-900 shadow-sm' : 'text-white/60 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </section>

        <section className="glass-card space-y-3 p-5">
          <div className="flex items-center gap-3">
            <Bell className="h-5 w-5 shrink-0 text-cyan-300" />
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-white">{t('settings.notifications')}</h3>
              <p className="text-sm text-white/55">{t('settings.preferencesDescription')}</p>
            </div>
          </div>
          <PreferenceToggle
            label={t('settings.notificationParking')}
            description={t('settings.notificationParkingDescription')}
            checked={currentPreferences.parking_push_enabled}
            loading={preferenceLoading === 'parking_push_enabled'}
            onChange={() => void updatePreference('parking_push_enabled')}
          />
          <PreferenceToggle
            label={t('settings.notificationMessages')}
            description={t('settings.notificationMessagesDescription')}
            checked={currentPreferences.chat_push_enabled}
            loading={preferenceLoading === 'chat_push_enabled'}
            onChange={() => void updatePreference('chat_push_enabled')}
          />
          <PreferenceToggle
            label={t('settings.inAppNotifications')}
            description={t('settings.inAppNotificationsDescription')}
            checked={currentPreferences.in_app_enabled}
            loading={preferenceLoading === 'in_app_enabled'}
            onChange={() => void updatePreference('in_app_enabled')}
          />
          {preferencesError && <p className="text-xs font-bold text-red-200">{t('settings.preferencesError')}</p>}
        </section>

        <PushNotificationControl />

        <Link
          href="/review-demo"
          className="block rounded-2xl border border-amber-300/25 bg-amber-300/10 px-4 py-3 text-center transition-colors hover:bg-amber-300/15"
        >
          <span className="block text-sm font-extrabold text-amber-100">
            {locale === 'ar' ? 'وضع مراجعة App Store' : 'App Review Demo'}
          </span>
          <span className="mt-1 block text-xs text-white/60">
            {locale === 'ar' ? 'تجربة مستقلة ببيانات تجريبية فقط' : 'An isolated experience using synthetic data only'}
          </span>
        </Link>

        <Link
          href="/notifications"
          className="block rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm font-bold text-white/80 transition-colors hover:bg-white/10"
        >
          {t('settings.notificationCenter')}
        </Link>

        <section className="glass-card p-5">
          <div className="flex items-center gap-3">
            <CircleHelp className="h-5 w-5 shrink-0 text-cyan-300" />
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-white">{t('settings.tutorial')}</h3>
              <p className="text-sm text-white/55">{t('settings.tutorialDescription')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={replayTutorial}
            className="btn btn-secondary mt-4 w-full py-2.5 text-xs"
          >
            {t('settings.replayTutorial')}
          </button>
        </section>

        <section className="glass-card space-y-3 p-5">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-cyan-300" />
            <div>
              <h3 className="font-bold text-white">{t('settings.importantNotice')}</h3>
              <p className="mt-1 text-sm leading-7 text-white/65">{t('settings.communityNotice')}</p>
            </div>
          </div>
        </section>

        <section className="glass-card space-y-3 p-5">
          <h3 className="font-bold text-white">{t('settings.legalLinks')}</h3>
          <div className="space-y-2">
            <Link href="/privacy" className="block rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm font-bold text-white/80">
              {t('settings.privacy')}
            </Link>
            <Link href="/terms" className="block rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm font-bold text-white/80">
              {t('settings.terms')}
            </Link>
            <Link href="/feedback" className="block rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm font-bold text-white/80">
              {t('safety.support')}
            </Link>
            <Link href="/settings/blocked" className="block rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm font-bold text-white/80">
              {t('safety.blockedUsers')}
            </Link>
            <a
              href={MAWQIFI_WHATSAPP_CHANNEL_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleChannelClick}
              aria-label={t('whatsapp.channelAria')}
              className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm font-bold text-white/80 transition-colors hover:bg-white/10"
            >
              <MessageCircle className="h-4 w-4 shrink-0 text-cyan-300" aria-hidden="true" />
              <span>{t('whatsapp.channelTitle')}</span>
            </a>
          </div>
        </section>

        <div className="text-center">
          <p className="text-[10px] font-semibold text-white/30">{t('settings.version')}</p>
        </div>

        <section className="glass-card space-y-3 p-5">
          <p className="text-sm leading-7 text-white/65">{t('deletion.summary')}</p>
          <button type="button" className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-400/30 bg-red-500/10 p-4 font-bold text-red-200"
            onClick={() => deletionDialog.current?.showModal()}>
            <Trash2 className="h-5 w-5" aria-hidden="true" />{t('deletion.title')}
          </button>
        </section>
        <dialog ref={deletionDialog} aria-labelledby="delete-account-title" aria-describedby="delete-account-description"
          className="w-[calc(100%_-_2rem)] max-w-md rounded-3xl border border-white/15 bg-navy-900 p-5 text-white backdrop:bg-black/70">
          <h2 id="delete-account-title" className="font-extrabold text-red-200">{t('deletion.title')}</h2>
          <p id="delete-account-description" className="my-4 whitespace-pre-line text-sm leading-7">{t('deletion.confirm')}</p>
          <div className="flex flex-wrap gap-3">
            <button type="button" autoFocus className="btn btn-secondary flex-1" onClick={() => deletionDialog.current?.close()}>{t('common.cancel')}</button>
            <button type="button" className="flex-1 rounded-2xl bg-red-600 p-3 font-bold" onClick={() => { deletionDialog.current?.close(); void deleteAccount(); }}>{t('deletion.title')}</button>
          </div>
        </dialog>

        {!isGuest ? (
          <button
            type="button"
            onClick={() => void logout()}
            className="flex w-full items-center justify-center gap-2 rounded-3xl border border-red-400/20 bg-red-500/10 p-4 font-bold text-red-200"
          >
            <LogOut className="h-5 w-5" />
            {t('settings.signOut')}
          </button>
        ) : (
          <Link
            href="/auth"
            className="block rounded-3xl border border-cyan-400/25 bg-cyan-500/10 p-4 text-center font-bold text-cyan-100"
          >
            {t('settings.linkEmail')}
          </Link>
        )}
      </div>
      <BottomNav />
    </main>
  );
}
