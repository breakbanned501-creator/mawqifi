'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import {
  AlertTriangle,
  Ban,
  Camera,
  CheckCircle2,
  Clock3,
  Flag,
  MapPin,
  MessageCircle,
  RotateCcw,
  Send,
  ShieldCheck,
  Trash2,
  UserRound,
} from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import PageHeader from '@/components/PageHeader';
import ReportModal from '@/components/ReportModal';
import { useLocale } from '@/components/LocaleProvider';
import { openExternalUrl } from '@/lib/capacitor';
import {
  appendReviewDemoText,
  createReviewDemoState,
  REVIEW_DEMO_LOCATION,
  REVIEW_DEMO_MAP_URL,
  REVIEW_DEMO_PLACES,
  type ReviewDemoState,
} from '@/lib/review-demo';

const FIFTEEN_MINUTES_SECONDS = 15 * 60;

export default function AppReviewDemoPage() {
  const { isArabic, dir } = useLocale();
  const [state, setState] = useState<ReviewDemoState>(() => createReviewDemoState(isArabic));
  const [draft, setDraft] = useState('');
  const [remainingSeconds, setRemainingSeconds] = useState(FIFTEEN_MINUTES_SECONDS);
  const [reportTarget, setReportTarget] = useState<'user' | 'message' | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const chatRef = useRef<HTMLElement>(null);

  const copy = isArabic
    ? {
        title: 'وضع مراجعة App Store',
        subtitle: 'تجربة مستقلة ببيانات تجريبية',
        notice: 'وضع تجريبي مخصص لمراجعة App Store ويستخدم بيانات تجريبية فقط.',
        isolation: 'لا يتصل هذا الوضع بالمستخدمين أو الرسائل أو المواقع الحقيقية، ولا يرسل إشعارات.',
        synthetic: 'بيانات تجريبية فقط',
        reset: 'إعادة ضبط العرض',
        place: '١. اختر الجهة',
        available: '٢. موقف تجريبي متاح',
        availableBody: 'مستخدم تجريبي يغادر موقفاً الآن. الموقع الدقيق مخفي حتى الحجز.',
        publish: 'نشر موقف تجريبي',
        published: 'تم نشر موقفك التجريبي محلياً من دون إرسال أي بيانات.',
        claim: 'احجز وافتح المحادثة',
        claimed: 'تم الحجز — فُتحت المحادثة الخاصة والموقع التجريبي.',
        chat: '٣. محادثة تسليم الموقف',
        reserved: 'تم حجز هذا الموقف لك مؤقتاً. تواصل مع السائق لمعرفة التفاصيل.',
        placeholder: 'اكتب رسالة تجريبية…',
        send: 'إرسال',
        image: 'إرسال صورة تجريبية',
        imageAlt: 'صورة موقف تجريبية مصطنعة',
        location: 'موقع الموقف',
        openMaps: 'افتح في الخرائط',
        arrive: 'وصلت للموقف',
        arrived: 'وصلت — ستغلق المحادثة بعد 15 دقيقة',
        closePreview: 'معاينة انتهاء المؤقت',
        closed: 'انتهت المحادثة — يمكنك مشاهدة الرسائل السابقة فقط',
        reportUser: 'الإبلاغ عن المستخدم التجريبي',
        reportMessage: 'الإبلاغ عن الرسالة التجريبية',
        reported: 'تم تسجيل البلاغ داخل العرض التجريبي فقط.',
        block: 'حظر المستخدم التجريبي',
        unblock: 'إلغاء الحظر التجريبي',
        blocked: 'تم الحظر داخل العرض. بقي سجل المحادثة مرئياً.',
        profile: '٤. الحساب والملف الشخصي',
        reviewer: 'مراجع App Store التجريبي',
        counterpart: 'سائق موقفي التجريبي',
        delete: 'حذف الحساب التجريبي',
        deleteQuestion: 'حذف الحساب التجريبي؟ سيُعاد إنشاؤه بأمان عند الطلب ولن يتأثر أي حساب حقيقي.',
        cancel: 'إلغاء',
        confirmDelete: 'حذف العرض التجريبي',
        deleted: 'تم حذف الحساب والبيانات التجريبية المحلية.',
        recreate: 'إعادة إنشاء الحساب التجريبي',
        chooseFirst: 'اختر جهة أولاً لعرض الموقف التجريبي.',
      }
    : {
        title: 'App Review Demo',
        subtitle: 'An isolated experience with synthetic data',
        notice: 'This demonstration mode is provided for App Store Review and uses synthetic demo data.',
        isolation: 'This mode never connects to real users, messages, or locations and sends no notifications.',
        synthetic: 'Synthetic data only',
        reset: 'Reset demonstration',
        place: '1. Choose an institution',
        available: '2. Available demo parking spot',
        availableBody: 'A synthetic user is leaving a spot now. Its exact location is hidden until you claim it.',
        publish: 'Publish a demo spot',
        published: 'Your synthetic spot was published locally without sending any data.',
        claim: 'Claim and open chat',
        claimed: 'Claimed — the private conversation and synthetic location are now available.',
        chat: '3. Parking handoff conversation',
        reserved: 'This spot is temporarily reserved for you. Chat with the driver for details.',
        placeholder: 'Write a demo message…',
        send: 'Send',
        image: 'Send demo image',
        imageAlt: 'Synthetic demonstration parking image',
        location: 'Parking location',
        openMaps: 'Open in Maps',
        arrive: "I've arrived",
        arrived: 'Arrived — this chat will close in 15 minutes',
        closePreview: 'Preview timer completion',
        closed: 'Chat closed — previous messages remain available',
        reportUser: 'Report demo user',
        reportMessage: 'Report demo message',
        reported: 'The report was recorded only inside this demonstration.',
        block: 'Block demo user',
        unblock: 'Unblock demo user',
        blocked: 'Blocked inside the demo. Conversation history remains visible.',
        profile: '4. Account and profile',
        reviewer: 'Synthetic App Store Reviewer',
        counterpart: 'Synthetic Mawqifi Driver',
        delete: 'Delete demo account',
        deleteQuestion: 'Delete the demo account? It can be safely recreated and no real account will be affected.',
        cancel: 'Cancel',
        confirmDelete: 'Delete demo data',
        deleted: 'The local synthetic account and data were deleted.',
        recreate: 'Recreate demo account',
        chooseFirst: 'Choose an institution first to display the demo spot.',
      };

  useEffect(() => {
    if (!state.arrived || state.closed) return;
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      setRemainingSeconds(Math.max(0, FIFTEEN_MINUTES_SECONDS - elapsed));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [state.arrived, state.closed]);

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const countdown = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const reset = () => {
    setState(createReviewDemoState(isArabic));
    setDraft('');
    setRemainingSeconds(FIFTEEN_MINUTES_SECONDS);
    setDeleteConfirm(false);
    setReportTarget(null);
  };

  const claim = () => {
    if (!state.selectedPlace) return;
    setState((current) => ({ ...current, claimed: true, accountDeleted: false }));
    window.setTimeout(() => chatRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  };

  const sendText = () => {
    setState((current) => appendReviewDemoText(current, draft));
    setDraft('');
  };

  const sendImage = () => {
    setState((current) => {
      if (!current.claimed || current.closed || current.blocked || current.accountDeleted) return current;
      return {
        ...current,
        messages: [
          ...current.messages,
          {
            id: `demo-message-${current.messages.length + 1}`,
            sender: 'reviewer',
            kind: 'image',
            imageUrl: '/review-demo-parking.svg',
          },
        ],
      };
    });
  };

  if (state.accountDeleted) {
    return (
      <main className="min-h-screen px-4 py-8" dir={dir}>
        <div className="mx-auto max-w-md">
          <section className="glass-card p-7 text-center">
            <Trash2 className="mx-auto h-12 w-12 text-cyan-300" />
            <h1 className="mt-4 text-xl font-black text-white">{copy.deleted}</h1>
            <button type="button" className="btn btn-primary mt-6 w-full" onClick={reset}>{copy.recreate}</button>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="page-with-chrome min-h-screen px-4 pt-6" dir={dir}>
      <div className="mx-auto max-w-xl space-y-5">
        <PageHeader
          title={copy.title}
          subtitle={copy.subtitle}
          backHref="/"
          action={
            <button type="button" onClick={reset} className="rounded-2xl bg-white/10 p-3 text-cyan-200" aria-label={copy.reset}>
              <RotateCcw className="h-5 w-5" />
            </button>
          }
        />

        <section className="rounded-3xl border border-amber-300/30 bg-amber-300/10 p-5">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-amber-200" />
            <div>
              <p className="font-extrabold text-amber-100">{copy.notice}</p>
              <p className="mt-2 text-sm leading-6 text-white/70">{copy.isolation}</p>
              <span className="mt-3 inline-flex rounded-full bg-amber-200/15 px-3 py-1 text-xs font-bold text-amber-100">{copy.synthetic}</span>
            </div>
          </div>
        </section>

        <section className="glass-card p-5">
          <h2 className="font-black text-white">{copy.place}</h2>
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {REVIEW_DEMO_PLACES.map((place) => (
              <button
                key={place.id}
                type="button"
                aria-pressed={state.selectedPlace === place.id}
                onClick={() => setState((current) => ({ ...current, selectedPlace: place.id, claimed: false }))}
                className={`rounded-2xl border px-3 py-3 text-sm font-bold transition-colors ${
                  state.selectedPlace === place.id
                    ? 'border-cyan-300 bg-cyan-500 text-navy-950'
                    : 'border-white/10 bg-white/5 text-white hover:bg-white/10'
                }`}
              >
                {isArabic ? place.ar : place.en}
              </button>
            ))}
          </div>
        </section>

        <section className="glass-card p-5">
          <div className="flex items-start gap-3">
            <MapPin className="h-6 w-6 shrink-0 text-cyan-300" />
            <div className="min-w-0 flex-1">
              <h2 className="font-black text-white">{copy.available}</h2>
              <p className="mt-1 text-sm leading-6 text-white/65">{copy.availableBody}</p>
            </div>
          </div>
          {!state.selectedPlace ? (
            <p className="mt-4 rounded-2xl bg-white/5 p-4 text-center text-sm font-bold text-white/60">{copy.chooseFirst}</p>
          ) : (
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-cyan-500/15"><UserRound className="h-5 w-5 text-cyan-300" /></div>
                  <div>
                    <p className="font-extrabold text-white">{copy.counterpart}</p>
                    <p className="text-xs text-white/50">{copy.synthetic}</p>
                  </div>
                </div>
                <button type="button" className="btn btn-primary mt-4 w-full" onClick={claim} disabled={state.claimed}>{state.claimed ? copy.claimed : copy.claim}</button>
              </div>
              <button type="button" className="btn btn-secondary w-full" onClick={() => setState((current) => ({ ...current, published: true }))}>{copy.publish}</button>
              {state.published && <p role="status" className="text-sm font-bold text-green-200">{copy.published}</p>}
            </div>
          )}
        </section>

        {state.claimed && (
          <section ref={chatRef} className="glass-card scroll-mt-6 p-5">
            <div className="flex items-center gap-3">
              <MessageCircle className="h-6 w-6 text-cyan-300" />
              <h2 className="font-black text-white">{copy.chat}</h2>
            </div>
            <p className="mt-4 rounded-2xl border border-cyan-300/20 bg-cyan-500/10 p-4 text-sm leading-6 text-cyan-50">{copy.reserved}</p>
            {state.arrived && !state.closed && (
              <div className="mt-3 rounded-2xl bg-amber-300/10 p-4 text-center">
                <p className="font-bold text-amber-100">{copy.arrived}</p>
                <p className="mt-1 font-mono text-2xl font-black text-white">{countdown}</p>
              </div>
            )}
            {state.closed && <p className="mt-3 rounded-2xl bg-white/[0.08] p-4 text-center font-bold text-white/70">{copy.closed}</p>}

            <div className="mt-4 max-h-80 space-y-3 overflow-y-auto rounded-2xl bg-navy-950/60 p-3">
              {state.messages.map((message) => (
                <div key={message.id} className={`flex ${message.sender === 'reviewer' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[86%] rounded-2xl p-3 ${message.sender === 'reviewer' ? 'bg-cyan-500 text-navy-950' : 'bg-white/10 text-white'}`}>
                    {message.kind === 'image' && message.imageUrl ? (
                      <Image src={message.imageUrl} width={600} height={360} alt={copy.imageAlt} className="h-auto w-full rounded-xl" />
                    ) : (
                      <p className="text-sm leading-6">{message.text}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 flex gap-2">
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter') sendText(); }}
                disabled={state.closed || state.blocked}
                className="input min-w-0 flex-1"
                placeholder={copy.placeholder}
                aria-label={copy.placeholder}
                dir="auto"
              />
              <button type="button" onClick={sendText} disabled={!draft.trim() || state.closed || state.blocked} className="btn btn-primary px-4" aria-label={copy.send}><Send className="h-5 w-5" /></button>
            </div>
            <button type="button" onClick={sendImage} disabled={state.closed || state.blocked} className="btn btn-secondary mt-2 flex w-full items-center justify-center gap-2"><Camera className="h-5 w-5" />{copy.image}</button>

            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center gap-2"><MapPin className="h-5 w-5 text-cyan-300" /><h3 className="font-extrabold text-white">{copy.location}</h3></div>
              <p className="mt-1 text-sm text-white/60">{isArabic ? REVIEW_DEMO_LOCATION.labelAr : REVIEW_DEMO_LOCATION.labelEn}</p>
              <button type="button" onClick={() => void openExternalUrl(REVIEW_DEMO_MAP_URL)} className="btn btn-primary mt-3 w-full">{copy.openMaps}</button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button type="button" disabled={state.arrived || state.closed} onClick={() => { setRemainingSeconds(FIFTEEN_MINUTES_SECONDS); setState((current) => ({ ...current, arrived: true })); }} className="btn btn-secondary flex items-center justify-center gap-2"><CheckCircle2 className="h-5 w-5" />{copy.arrive}</button>
              <button type="button" disabled={!state.arrived || state.closed} onClick={() => setState((current) => ({ ...current, closed: true }))} className="btn btn-secondary flex items-center justify-center gap-2"><Clock3 className="h-5 w-5" />{copy.closePreview}</button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button type="button" onClick={() => setReportTarget('user')} className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-3 text-sm font-bold text-amber-100"><Flag className="mx-auto mb-1 h-4 w-4" />{copy.reportUser}</button>
              <button type="button" onClick={() => setReportTarget('message')} className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-3 text-sm font-bold text-amber-100"><AlertTriangle className="mx-auto mb-1 h-4 w-4" />{copy.reportMessage}</button>
              <button type="button" onClick={() => setState((current) => ({ ...current, blocked: !current.blocked }))} className="sm:col-span-2 rounded-2xl border border-red-300/20 bg-red-500/10 p-3 text-sm font-bold text-red-100"><Ban className="mx-auto mb-1 h-4 w-4" />{state.blocked ? copy.unblock : copy.block}</button>
            </div>
            {state.reported && <p role="status" className="mt-3 text-sm font-bold text-green-200">{copy.reported}</p>}
            {state.blocked && <p role="status" className="mt-3 text-sm font-bold text-red-100">{copy.blocked}</p>}
          </section>
        )}

        <section className="glass-card p-5">
          <h2 className="font-black text-white">{copy.profile}</h2>
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-3 rounded-2xl bg-white/5 p-3"><span className="text-white/55">{copy.reviewer}</span><span className="font-bold text-white">DEMO-A</span></div>
            <div className="flex justify-between gap-3 rounded-2xl bg-white/5 p-3"><span className="text-white/55">{copy.counterpart}</span><span className="font-bold text-white">DEMO-B</span></div>
          </div>
          {!deleteConfirm ? (
            <button type="button" onClick={() => setDeleteConfirm(true)} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-red-300/25 bg-red-500/10 p-3 font-bold text-red-100"><Trash2 className="h-5 w-5" />{copy.delete}</button>
          ) : (
            <div className="mt-4 rounded-2xl border border-red-300/25 bg-red-500/10 p-4">
              <p className="text-sm leading-6 text-red-50">{copy.deleteQuestion}</p>
              <div className="mt-3 flex gap-2">
                <button type="button" className="btn btn-secondary flex-1" onClick={() => setDeleteConfirm(false)}>{copy.cancel}</button>
                <button type="button" className="flex-1 rounded-2xl bg-red-600 p-3 font-bold text-white" onClick={() => setState((current) => ({ ...current, accountDeleted: true }))}>{copy.confirmDelete}</button>
              </div>
            </div>
          )}
        </section>
      </div>

      <ReportModal
        isOpen={reportTarget !== null}
        targetType={reportTarget ?? 'user'}
        onClose={() => setReportTarget(null)}
        onSubmit={async () => { setState((current) => ({ ...current, reported: true })); }}
      />
      <BottomNav />
    </main>
  );
}

