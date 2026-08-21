'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bell, Check, LoaderCircle } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { useLocale } from '@/components/LocaleProvider';
import {
  getPushDeviceState,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
  type PushStage,
  type PushDeviceState,
} from '@/lib/push';

const PUSH_EXPLAINER_DEFERRED_KEY = 'mawqifi_push_explainer_deferred';

function getDisplayedPushMessage(
  state: PushDeviceState,
  t: (key: string) => string,
  locale: 'ar' | 'en',
): string {
  if (locale === 'ar') return state.message;

  const stageKey: Record<PushStage, string> = {
    permission: 'push.stage.permission',
    'service-worker-registration': 'push.stage.serviceWorkerRegistration',
    'service-worker-activation': 'push.stage.serviceWorkerActivation',
    'subscription-lookup': 'push.stage.subscriptionLookup',
    'subscription-create': 'push.stage.subscriptionCreate',
    'subscription-remove': 'push.stage.subscriptionRemove',
    session: 'push.stage.session',
    'server-save': 'push.stage.serverSave',
  };
  if (state.stage) return t(stageKey[state.stage]);

  switch (state.kind) {
    case 'enabled':
      return t('push.enabled');
    case 'permission-default':
      return t('push.permissionDefault');
    case 'permission-denied':
      return t('push.permissionDenied');
    case 'not-registered':
      return t('push.unsavedDevice');
    case 'requires-home-screen':
      return t('push.iosInstructions');
    case 'unsupported':
      return t('push.unsupported');
    case 'disabled':
      return t('push.disabled');
    case 'error':
      return t('common.error');
    default:
      return state.message || t('common.error');
  }
}

/**
 * Shared, explanation-first device-push control. It never opens the browser
 * permission prompt until the user explicitly confirms the Mawqifi explainer.
 */
export default function PushNotificationControl() {
  const { userId } = useAuth();
  const { locale, t } = useLocale();
  const [pushState, setPushState] = useState<PushDeviceState>({ kind: 'disabled', message: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [showExplainer, setShowExplainer] = useState(false);
  const [deferred, setDeferred] = useState(false);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    try {
      setDeferred(window.localStorage.getItem(PUSH_EXPLAINER_DEFERRED_KEY) === 'true');
    } catch {
      setDeferred(false);
    }

    void (async () => {
      setIsLoading(true);
      try {
        const next = await getPushDeviceState();
        if (!cancelled) setPushState(next);
      } catch {
        if (!cancelled) setPushState({ kind: 'error', message: t('common.error') });
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [t, userId]);

  const notifyEnabled = pushState.kind === 'enabled';
  const actionLabel = useMemo(() => {
    if (isLoading) return t('common.loading');
    if (notifyEnabled) return t('push.enabled');
    if (pushState.kind === 'not-registered') return t('push.retry');
    return t('push.enable');
  }, [isLoading, notifyEnabled, pushState.kind, t]);

  const performEnable = async () => {
    setShowExplainer(false);
    setIsLoading(true);
    try {
      const result = await subscribeToPushNotifications();
      setPushState({
        kind: result.success ? 'enabled' : result.state ?? 'error',
        message: result.message,
        stage: result.stage,
      });
    } catch {
      setPushState({ kind: 'error', message: t('common.error') });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAction = async () => {
    if (isLoading) return;

    if (notifyEnabled) {
      setIsLoading(true);
      try {
        const result = await unsubscribeFromPushNotifications();
        setPushState({
          kind: result.success && result.deviceUnsubscribed ? 'disabled' : result.state ?? 'error',
          message: result.message,
          stage: result.stage,
        });
      } catch {
        setPushState({ kind: 'error', message: t('common.error') });
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // The native prompt is only invoked from `performEnable`, after the user
    // sees this first-party explanation. A denied permission never triggers it.
    if (pushState.kind === 'permission-default') {
      setShowExplainer(true);
      return;
    }

    if (pushState.kind === 'permission-denied' || pushState.kind === 'requires-home-screen') {
      return;
    }

    await performEnable();
  };

  const handleLater = () => {
    try {
      window.localStorage.setItem(PUSH_EXPLAINER_DEFERRED_KEY, 'true');
    } catch {
      // Treat storage restrictions as a local-only dismissal.
    }
    setDeferred(true);
    setShowExplainer(false);
  };

  const message = getDisplayedPushMessage(pushState, t, locale);

  return (
    <section className="glass-card space-y-4 p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Bell className="h-5 w-5 shrink-0 text-cyan-300" />
          <div className="min-w-0">
            <h3 className="font-bold text-white">{t('settings.devicePush')}</h3>
            <p className="text-sm text-white/55">{t('settings.devicePushDescription')}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void handleAction()}
          disabled={isLoading || pushState.kind === 'permission-denied' || pushState.kind === 'requires-home-screen'}
          className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-2xl px-4 py-2 text-xs font-bold transition-all disabled:opacity-50 ${
            notifyEnabled
              ? 'border border-emerald-400/30 bg-emerald-400/15 text-emerald-200'
              : 'bg-cyan-500 text-navy-900 shadow-lg shadow-cyan-500/20'
          }`}
        >
          {isLoading ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden /> : notifyEnabled && <Check className="h-3.5 w-3.5" aria-hidden />}
          <span>{actionLabel}</span>
        </button>
      </div>

      {message && (
        <div className={`rounded-2xl border p-3 text-xs leading-6 ${
          notifyEnabled
            ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200'
            : 'border-cyan-500/20 bg-cyan-500/10 text-cyan-100'
        }`}>
          <p className="whitespace-pre-line font-bold">{message}</p>
        </div>
      )}

      {showExplainer && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="push-explainer-title"
          className="rounded-2xl border border-cyan-400/30 bg-navy-950/95 p-4 shadow-xl"
        >
          <h4 id="push-explainer-title" className="text-base font-extrabold text-white">
            {t('push.explainerTitle')}
          </h4>
          <p className="mt-2 text-sm leading-6 text-white/70">{t('push.explainerBody')}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => void performEnable()} className="btn btn-primary px-4 py-2 text-xs">
              {t('push.enable')}
            </button>
            <button type="button" onClick={handleLater} className="btn btn-secondary px-4 py-2 text-xs">
              {t('push.later')}
            </button>
          </div>
        </div>
      )}

      {deferred && pushState.kind === 'permission-default' && !showExplainer && (
        <p className="text-xs leading-5 text-white/45">{t('push.deferredHint')}</p>
      )}
    </section>
  );
}
