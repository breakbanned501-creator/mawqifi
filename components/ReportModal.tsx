'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X, Check } from 'lucide-react';
import { useLocale } from '@/components/LocaleProvider';
import type { TranslationKey } from '@/lib/i18n';
import { sanitizeInput } from '@/lib/security';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reason: string, details: string) => Promise<void>;
  targetType: 'post' | 'message' | 'user';
}

const reportReasons = [
  { id: 'spam', labelKey: 'report.reasonSpam', icon: '📢' },
  { id: 'fake', labelKey: 'report.reasonFake', icon: '🚫' },
  { id: 'abuse', labelKey: 'report.reasonAbuse', icon: '⚠️' },
  { id: 'harassment', labelKey: 'report.reasonHarassment', icon: '🚨' },
  { id: 'inappropriate', labelKey: 'report.reasonInappropriate', icon: '🔞' },
  { id: 'other', labelKey: 'report.reasonOther', icon: '📝' },
] satisfies Array<{ id: string; labelKey: TranslationKey; icon: string }>;

export default function ReportModal({ isOpen, onClose, onSubmit, targetType }: ReportModalProps) {
  const { dir, t } = useLocale();
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorKey, setErrorKey] = useState<TranslationKey | null>(null);
  const [success, setSuccess] = useState(false);
  const targetKey: TranslationKey =
    targetType === 'post'
      ? 'report.postTarget'
      : targetType === 'message'
        ? 'report.messageTarget'
        : 'safety.user';

  if (!isOpen || typeof document === 'undefined') return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorKey(null);

    if (!selectedReason) {
      setErrorKey('report.validation');
      return;
    }

    if (selectedReason === 'other' && !details.trim()) {
      setErrorKey('report.detailsRequired');
      return;
    }

    if (details.length > 300) {
      setErrorKey('report.detailsTooLong');
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
    } catch (error) {
      setErrorKey(typeof error === 'object' && error !== null && 'message' in error && String(error.message).includes('SAFETY_RATE_LIMIT')
        ? 'report.rateLimited' : 'report.submitError');
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[55] flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-title"
      dir={dir}
    >
      <div className="glass-card max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto overscroll-contain p-6 animate-fade-up">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/15">
              <AlertTriangle className="h-5 w-5 text-red-300" />
            </div>
            <h2 id="report-title" className="text-lg font-extrabold text-white">
              {t('report.title', { target: t(targetKey) })}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            aria-label={t('common.close')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {success ? (
          <div className="py-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/15">
              <Check className="h-8 w-8 text-green-300" />
            </div>
            <h3 className="mb-2 text-lg font-extrabold text-white">{t('report.successTitle')}</h3>
            <p className="text-sm text-white/70">{t('report.successBody')}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="mb-3 block text-sm font-bold text-white">{t('report.reason')}</label>
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
                    <span className="font-bold">{t(reason.labelKey)}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="details" className="mb-2 block text-sm font-bold text-white">
                {t('report.details')} <span className="text-white/40">({t('common.optional')})</span>
              </label>
              <textarea
                id="details"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder={t('report.detailsPlaceholder')}
                dir="auto"
                maxLength={300}
                rows={3}
                className="w-full rounded-2xl border border-white/10 bg-navy-950 px-4 py-3 text-sm text-white outline-none placeholder:text-white/40 focus:border-cyan-500 resize-none"
              />
              <p className="mt-1 text-xs text-white/40">{details.length}/300</p>
            </div>

            {errorKey && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-3">
                <p className="text-sm font-bold text-red-200">{t(errorKey)}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex flex-1 items-center justify-center rounded-2xl bg-white/10 py-3 text-sm font-bold text-white transition-colors hover:bg-white/15"
                disabled={submitting}
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                className="btn btn-primary flex flex-1 items-center justify-center py-3 text-sm font-bold"
                disabled={submitting || !selectedReason}
              >
                {submitting ? t('report.submitting') : t('report.submit')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
}
