'use client';

import { useEffect, useState } from 'react';
import { Bell, Settings, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { useLocale } from '@/components/LocaleProvider';
import { useTutorial } from '@/components/TutorialProvider';
import { isNativeCapacitor, openNativeAppSettings } from '@/lib/capacitor';
import { getNativePushDeviceState, subscribeToNativePushNotifications } from '@/lib/native-push';
import { getPushDeviceState, subscribeToPushNotifications, type PushDeviceState } from '@/lib/push';

const ENTRY_PROMPT_SEEN_KEY = 'mawqifi_push_entry_prompt_seen';
const DENIED_PROMPT_DISMISSED_KEY = 'mawqifi_push_denied_prompt_dismissed';

/** Explanation-first notification prompt shared by native iOS and the browser/PWA. */
export default function NotificationPermissionPrompt() {
  const router = useRouter();
  const { userId } = useAuth();
  const { t, dir } = useLocale();
  const { isTutorialOpen } = useTutorial();
  const nativeRuntime = isNativeCapacitor();
  const [state, setState] = useState<PushDeviceState | null>(null);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (!userId || isTutorialOpen) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        const next = await (nativeRuntime ? getNativePushDeviceState() : getPushDeviceState());
        if (cancelled) return;
        const hidden = next.kind === 'permission-denied'
          ? window.sessionStorage.getItem(DENIED_PROMPT_DISMISSED_KEY) === 'true'
          : window.localStorage.getItem(ENTRY_PROMPT_SEEN_KEY) === 'true';
        if (!hidden && (next.kind === 'permission-default' || next.kind === 'permission-denied')) setState(next);
      })().catch(() => undefined);
    }, 1000);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [isTutorialOpen, nativeRuntime, userId]);

  if (!state || isTutorialOpen) return null;

  const denied = state.kind === 'permission-denied';
  const dismiss = () => {
    try {
      const storage = denied ? window.sessionStorage : window.localStorage;
      storage.setItem(denied ? DENIED_PROMPT_DISMISSED_KEY : ENTRY_PROMPT_SEEN_KEY, 'true');
    } catch { /* A storage restriction must not trap the user in the prompt. */ }
    setState(null);
  };

  const enable = async () => {
    setWorking(true);
    try {
      const result = await (nativeRuntime ? subscribeToNativePushNotifications() : subscribeToPushNotifications());
      if (result.success) {
        try { window.localStorage.setItem(ENTRY_PROMPT_SEEN_KEY, 'true'); } catch { /* Local preference only. */ }
        setState(null);
      } else {
        setState({ kind: result.state ?? 'error', message: result.message, stage: result.stage });
      }
    } finally {
      setWorking(false);
    }
  };

  const openSettings = async () => {
    if (nativeRuntime) await openNativeAppSettings().catch(() => router.push('/settings'));
    else router.push('/settings');
    dismiss();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:items-center" dir={dir}>
      <section role="dialog" aria-modal="true" aria-labelledby="notification-permission-title"
        className="relative w-full max-w-md rounded-3xl border border-cyan-300/25 bg-navy-900 p-5 shadow-2xl">
        <button type="button" onClick={dismiss} aria-label={t('common.close')}
          className="absolute end-3 top-3 rounded-full p-2 text-white/55 hover:bg-white/10 hover:text-white">
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
        <Bell className="mb-3 h-8 w-8 text-cyan-300" aria-hidden="true" />
        <h2 id="notification-permission-title" className="pe-9 text-lg font-extrabold text-white">
          {t('push.explainerTitle')}
        </h2>
        <p className="mt-2 text-sm leading-7 text-white/70">
          {denied ? t('push.permissionDenied') : t('push.explainerBody')}
        </p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button type="button" disabled={working} onClick={() => void (denied ? openSettings() : enable())}
            className="btn btn-primary flex items-center justify-center gap-2">
            {denied && <Settings className="h-4 w-4" aria-hidden="true" />}
            {denied ? t('push.openSettings') : t('push.enable')}
          </button>
          <button type="button" disabled={working} onClick={dismiss} className="btn btn-secondary">
            {t('push.later')}
          </button>
        </div>
      </section>
    </div>
  );
}
