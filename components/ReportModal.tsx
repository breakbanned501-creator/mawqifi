'use client';

import { useState } from 'react';
import { AlertTriangle, X, Check } from 'lucide-react';
import { reportRateLimiter, sanitizeInput } from '@/lib/security';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reason: string, details: string) => Promise<void>;
  targetType: 'post' | 'message' | 'conversation';
}

const reportReasons = [
  { id: 'spam', label: 'رسائل غير مرغوبة', icon: '📢' },
  { id: 'fake', label: 'موقف وهمي', icon: '🚫' },
  { id: 'abuse', label: 'إساءة أو تحرش', icon: '⚠️' },
  { id: 'harassment', label: 'مضايقة', icon: '🚨' },
  { id: 'inappropriate', label: 'محتوى غير لائق', icon: '🔞' },
  { id: 'other', label: 'أخرى', icon: '📝' },
];

export default function ReportModal({ isOpen, onClose, onSubmit, targetType }: ReportModalProps) {
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedReason) {
      setError('الرجاء اختيار سبب الإبلاغ');
      return;
    }

    if (selectedReason === 'other' && !details.trim()) {
      setError('الرجاء كتابة تفاصيل الإبلاغ');
      return;
    }

    if (details.length > 300) {
      setError('التفاصيل طويلة جداً (الحد الأقصى 300 حرف)');
      return;
    }

    // Rate limiting check
    const userId = 'user'; // In production, use actual user ID
    if (!reportRateLimiter.canMakeRequest(userId)) {
      setError('لقد تجاوزت الحد المسموح من الإبلاغات. الرجاء المحاولة لاحقاً');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(selectedReason, sanitizeInput(details.trim()));
      setSuccess(true);
      setTimeout(() => {
        onClose();
        setSuccess(false);
        setSelectedReason('');
        setDetails('');
      }, 2000);
    } catch (err) {
      setError('حدث خطأ أثناء إرسال الإبلاغ. الرجاء المحاولة مرة أخرى');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-title"
    >
      <div className="glass-card w-full max-w-md p-6 animate-fade-up">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/15">
              <AlertTriangle className="h-5 w-5 text-red-300" />
            </div>
            <h2 id="report-title" className="text-lg font-extrabold text-white">
              إبلاغ عن {targetType === 'post' ? 'موقف' : targetType === 'message' ? 'رسالة' : 'محادثة'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="إغلاق"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {success ? (
          <div className="py-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/15">
              <Check className="h-8 w-8 text-green-300" />
            </div>
            <h3 className="mb-2 text-lg font-extrabold text-white">تم الإبلاغ بنجاح</h3>
            <p className="text-sm text-white/70">شكراً لمساعدتك في تحسين المجتمع</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="mb-3 block text-sm font-bold text-white">سبب الإبلاغ</label>
              <div className="grid grid-cols-2 gap-2">
                {reportReasons.map((reason) => (
                  <button
                    key={reason.id}
                    type="button"
                    onClick={() => setSelectedReason(reason.id)}
                    className={`rounded-xl border-2 p-3 text-sm transition-all ${
                      selectedReason === reason.id
                        ? 'border-cyan-500 bg-cyan-500/10 text-white'
                        : 'border-white/10 bg-white/5 text-white/70 hover:border-white/20'
                    }`}
                  >
                    <span className="mb-1 block text-lg">{reason.icon}</span>
                    <span className="font-bold">{reason.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="details" className="mb-2 block text-sm font-bold text-white">
                تفاصيل إضافية <span className="text-white/40">(اختياري)</span>
              </label>
              <textarea
                id="details"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="اكتب أي تفاصيل إضافية قد تساعدنا..."
                maxLength={300}
                rows={3}
                className="w-full rounded-2xl border border-white/10 bg-navy-950 px-4 py-3 text-sm text-white outline-none placeholder:text-white/40 focus:border-cyan-500 resize-none"
              />
              <p className="mt-1 text-xs text-white/40">{details.length}/300</p>
            </div>

            {error && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-3">
                <p className="text-sm font-bold text-red-200">{error}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex flex-1 items-center justify-center rounded-2xl bg-white/10 py-3 text-sm font-bold text-white transition-colors hover:bg-white/15"
                disabled={submitting}
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="btn btn-primary flex flex-1 items-center justify-center py-3 text-sm font-bold"
                disabled={submitting || !selectedReason}
              >
                {submitting ? 'جاري الإرسال...' : 'إرسال الإبلاغ'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
