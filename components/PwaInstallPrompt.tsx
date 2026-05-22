'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Download, Share, X } from 'lucide-react';
import {
  dismissInstallBanner,
  isAndroidDevice,
  isIOSDevice,
  isStandaloneMode,
  wasInstallBannerDismissed,
} from '@/lib/pwa';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export default function PwaInstallPrompt() {
  const pathname = usePathname();
  const hasBottomChrome = !pathname.startsWith('/post/') && pathname !== '/auth';
  const [show, setShow] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (isStandaloneMode() || wasInstallBannerDismissed()) return;

    const isMobile = isIOSDevice() || isAndroidDevice() || window.innerWidth < 768;
    if (!isMobile) return;

    if (isIOSDevice()) {
      setIos(true);
      setShow(true);
      return;
    }

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setShow(true);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);

    // Android Chrome may not fire the event immediately — show hint after short delay
    const fallback = window.setTimeout(() => {
      if (!isStandaloneMode() && isAndroidDevice() && !wasInstallBannerDismissed()) {
        setShow(true);
      }
    }, 2500);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.clearTimeout(fallback);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    setInstalling(true);
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setShow(false);
        dismissInstallBanner();
      }
    } finally {
      setInstalling(false);
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    dismissInstallBanner();
    setShow(false);
  };

  if (!show) return null;

  return (
    <div
      className="animate-fade-up fixed inset-x-3 z-[60] mx-auto max-w-md rounded-3xl border border-cyan-400/30 bg-navy-900/95 p-4 shadow-[0_0_32px_rgba(0,212,255,0.2)] backdrop-blur-xl sm:inset-x-4"
      style={{
        bottom: hasBottomChrome
          ? 'calc(7.75rem + env(safe-area-inset-bottom, 0px))'
          : 'calc(1rem + env(safe-area-inset-bottom, 0px))',
      }}
      role="region"
      aria-label="تثبيت التطبيق"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-cyan-500/15 text-cyan-300">
          <Download className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold leading-6 text-white">
            ثبت موقفي على جهازك للوصول السريع
          </p>
          {ios ? (
            <p className="mt-1.5 flex items-start gap-1.5 text-xs leading-6 text-white/60">
              <Share className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
              <span>
                اضغط زر المشاركة في Safari ثم اختر «إضافة إلى الشاشة الرئيسية»
              </span>
            </p>
          ) : (
            <p className="mt-1 text-xs leading-6 text-white/60">
              ثبّت التطبيق ليُفتح كتطبيق مستقل بدون شريط المتصفح
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="shrink-0 rounded-full p-1.5 text-white/45 hover:bg-white/10 hover:text-white"
          aria-label="إغلاق"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {!ios && deferredPrompt && (
        <button
          type="button"
          onClick={() => void handleInstall()}
          disabled={installing}
          className="btn btn-primary mt-3 w-full py-3 text-sm disabled:opacity-60"
        >
          {installing ? 'جاري التثبيت...' : 'تثبيت التطبيق'}
        </button>
      )}

      {!ios && !deferredPrompt && (
        <p className="mt-3 text-center text-[11px] text-white/40">
          من قائمة المتصفح: تثبيت التطبيق / Install app
        </p>
      )}
    </div>
  );
}
