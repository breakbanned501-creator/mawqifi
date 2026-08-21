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
import { Bell, Car, MessageCircle, PlusCircle, Sparkles, type LucideIcon } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { completeTutorial, hasCompletedTutorial } from '@/lib/tutorial';

type TutorialTarget = 'feed' | 'publish' | 'chat' | 'notifications';

type TutorialStep = {
  title: string;
  description: string;
  target?: TutorialTarget;
  icon: LucideIcon;
};

type TutorialContextValue = {
  replayTutorial: () => void;
  isTutorialOpen: boolean;
};

type HighlightRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    title: 'حياك في موقفي 👋',
    description: 'موقفي يساعد طلبة جامعة الكويت في مشاركة المواقف المتاحة والعثور عليها بسرعة.',
    icon: Sparkles,
  },
  {
    title: 'دور على موقف 🚗',
    description: 'شوف المواقف المتاحة حاليًا واختر المنطقة المناسبة لك.',
    target: 'feed',
    icon: Car,
  },
  {
    title: 'بتطلع من موقفك؟',
    description: 'انشر موقفك خلال ثواني وساعد طالب ثاني.',
    target: 'publish',
    icon: PlusCircle,
  },
  {
    title: 'تواصل بسرعة 💬',
    description: 'تواصل مع صاحب الموقف مباشرة واتفقوا على الموقع.',
    target: 'chat',
    icon: MessageCircle,
  },
  {
    title: 'لا يطوفك موقف 🔔',
    description: 'فعّل الإشعارات عشان تعرف عن المواقف والرسائل الجديدة.',
    target: 'notifications',
    icon: Bell,
  },
];

const TutorialContext = createContext<TutorialContextValue | null>(null);

export function useTutorial(): TutorialContextValue {
  const context = useContext(TutorialContext);

  if (!context) {
    throw new Error('useTutorial must be used within TutorialProvider');
  }

  return context;
}

/** Keeps normal app content inaccessible while the modal tutorial is active. */
export function TutorialContent({ children }: { children: ReactNode }) {
  const { isTutorialOpen } = useTutorial();

  return (
    <div
      className="flex min-h-screen flex-1 flex-col"
      aria-hidden={isTutorialOpen ? true : undefined}
      inert={isTutorialOpen}
    >
      {children}
    </div>
  );
}

function getHighlightRect(element: HTMLElement): HighlightRect {
  const bounds = element.getBoundingClientRect();
  const padding = 6;
  const top = Math.max(8, bounds.top - padding);
  const left = Math.max(8, bounds.left - padding);

  return {
    top,
    left,
    width: Math.min(window.innerWidth - left - 8, bounds.width + padding * 2),
    height: Math.min(window.innerHeight - top - 8, bounds.height + padding * 2),
  };
}

function TutorialTour({
  open,
  stepIndex,
  onBack,
  onNext,
  onDismiss,
}: {
  open: boolean;
  stepIndex: number;
  onBack: () => void;
  onNext: () => void;
  onDismiss: () => void;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const primaryActionRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [highlight, setHighlight] = useState<HighlightRect | null>(null);
  const step = TUTORIAL_STEPS[stepIndex];
  const isLastStep = stepIndex === TUTORIAL_STEPS.length - 1;

  useEffect(() => {
    if (!open || !step.target) {
      setHighlight(null);
      return;
    }

    const target = document.querySelector<HTMLElement>(`[data-tutorial-target="${step.target}"]`);
    if (!target) {
      setHighlight(null);
      return;
    }

    target.classList.add('mawqifi-tutorial-highlight');
    target.scrollIntoView({ block: 'center' });

    const updateHighlight = () => setHighlight(getHighlightRect(target));
    const frame = window.requestAnimationFrame(updateHighlight);
    const delayedFrame = window.setTimeout(updateHighlight, 120);

    window.addEventListener('resize', updateHighlight);
    window.addEventListener('scroll', updateHighlight, true);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(delayedFrame);
      window.removeEventListener('resize', updateHighlight);
      window.removeEventListener('scroll', updateHighlight, true);
      target.classList.remove('mawqifi-tutorial-highlight');
    };
  }, [open, step.target]);

  useEffect(() => {
    if (!open) return;

    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onDismiss();
        return;
      }

      if (event.key !== 'Tab' || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
      if (previousFocusRef.current?.isConnected) previousFocusRef.current.focus();
    };
  }, [open, onDismiss]);

  useEffect(() => {
    if (!open) return;

    const frame = window.requestAnimationFrame(() => primaryActionRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open, stepIndex]);

  if (!open) return null;

  const Icon = step.icon;

  return (
    <>
      <div className="fixed inset-0 z-[140] bg-navy-950/80 backdrop-blur-[2px]" aria-hidden="true" />
      {highlight && (
        <div
          className="pointer-events-none fixed z-[141] rounded-3xl border-2 border-cyan-300 shadow-[0_0_0_4px_rgba(0,212,255,0.18),0_0_28px_rgba(0,212,255,0.55)] transition-all duration-200 motion-reduce:transition-none"
          style={highlight}
          aria-hidden="true"
        />
      )}
      <section
        ref={dialogRef}
        className="fixed inset-x-3 bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] z-[150] mx-auto max-h-[calc(100dvh-2rem)] w-auto max-w-md overflow-y-auto rounded-3xl border border-cyan-400/30 bg-navy-900/95 p-4 shadow-[0_0_40px_rgba(0,212,255,0.24)] backdrop-blur-xl sm:inset-x-4 sm:p-5"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mawqifi-tutorial-title"
        aria-describedby="mawqifi-tutorial-description"
        dir="rtl"
      >
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-bold text-cyan-200/85" aria-live="polite">
            الخطوة {stepIndex + 1} من {TUTORIAL_STEPS.length}
          </p>
          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 rounded-xl px-2 py-1 text-xs font-bold text-white/60 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
          >
            تخطي
          </button>
        </div>

        <div className="mt-4 flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-cyan-500/15 text-cyan-300 shadow-[0_0_20px_rgba(0,212,255,0.16)]">
            <Icon className="h-6 w-6" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="mawqifi-tutorial-title" className="text-lg font-black leading-7 text-white">
              {step.title}
            </h2>
            <p id="mawqifi-tutorial-description" className="mt-1.5 break-words text-sm leading-7 text-white/70">
              {step.description}
            </p>
          </div>
        </div>

        <div className="mt-5 flex gap-1.5" aria-hidden="true">
          {TUTORIAL_STEPS.map((tourStep, index) => (
            <span
              key={tourStep.title}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                index <= stepIndex ? 'bg-cyan-400' : 'bg-white/15'
              }`}
            />
          ))}
        </div>

        <div className="mt-5 flex items-center gap-2.5">
          {stepIndex > 0 && (
            <button
              type="button"
              onClick={onBack}
              className="btn btn-secondary shrink-0 px-4 py-2.5 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
            >
              السابق
            </button>
          )}
          <button
            ref={primaryActionRef}
            type="button"
            onClick={onNext}
            className="btn btn-primary min-w-0 flex-1 py-2.5 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-100"
          >
            {isLastStep ? 'ابدأ استخدام موقفي' : 'التالي'}
          </button>
        </div>
      </section>
    </>
  );
}

export default function TutorialProvider({ children }: { children: ReactNode }) {
  const { isReady } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const autoTourStartedRef = useRef(false);
  const replayPendingRef = useRef(false);

  const openTour = useCallback(() => {
    setStepIndex(0);
    setIsOpen(true);
  }, []);

  const dismissTutorial = useCallback(() => {
    completeTutorial();
    setIsOpen(false);
  }, []);

  const replayTutorial = useCallback(() => {
    autoTourStartedRef.current = true;
    setStepIndex(0);

    if (pathname === '/') {
      setIsOpen(true);
      return;
    }

    replayPendingRef.current = true;
    router.push('/');
  }, [pathname, router]);

  useEffect(() => {
    if (!isReady || pathname !== '/' || autoTourStartedRef.current) return;
    if (hasCompletedTutorial()) {
      autoTourStartedRef.current = true;
      return;
    }

    const timer = window.setTimeout(() => {
      autoTourStartedRef.current = true;
      openTour();
    }, 750);

    return () => window.clearTimeout(timer);
  }, [isReady, openTour, pathname]);

  useEffect(() => {
    if (!isReady || pathname !== '/' || !replayPendingRef.current) return;

    const timer = window.setTimeout(() => {
      replayPendingRef.current = false;
      openTour();
    }, 80);

    return () => window.clearTimeout(timer);
  }, [isReady, openTour, pathname]);

  const moveBack = useCallback(() => {
    setStepIndex((current) => Math.max(0, current - 1));
  }, []);

  const moveNext = useCallback(() => {
    if (stepIndex >= TUTORIAL_STEPS.length - 1) {
      dismissTutorial();
      return;
    }

    setStepIndex((current) => current + 1);
  }, [dismissTutorial, stepIndex]);

  const contextValue = useMemo(
    () => ({ replayTutorial, isTutorialOpen: isOpen }),
    [isOpen, replayTutorial],
  );

  return (
    <TutorialContext.Provider value={contextValue}>
      {children}
      <TutorialTour
        open={isOpen}
        stepIndex={stepIndex}
        onBack={moveBack}
        onNext={moveNext}
        onDismiss={dismissTutorial}
      />
    </TutorialContext.Provider>
  );
}
