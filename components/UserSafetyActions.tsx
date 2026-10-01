'use client';

import { useState } from 'react';
import ReportModal from './ReportModal';
import { useLocale } from './LocaleProvider';
import { setUserBlocked, submitReport } from '@/lib/safety';

export default function UserSafetyActions({ userId, onBlocked }: { userId: string; onBlocked?: () => void }) {
  const { t } = useLocale();
  const [report, setReport] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const block = async () => {
    setBusy(true); setError(false);
    try { await setUserBlocked(userId, true); setConfirm(false); onBlocked?.(); }
    catch { setError(true); }
    finally { setBusy(false); }
  };
  return (
    <div className="mt-2 text-xs">
      <div className="flex flex-wrap gap-3">
        <button type="button" className="text-white/60 underline" onClick={() => setReport(true)}>{t('safety.reportUser')}</button>
        <button type="button" className="text-red-300 underline" onClick={() => setConfirm(true)}>{t('safety.block')}</button>
      </div>
      {confirm && <div className="mt-2 rounded-xl border border-white/10 bg-navy-950 p-3" role="group" aria-label={t('safety.block')}>
        <p className="mb-3 text-white/80">{t('safety.confirm')}</p>
        <div className="flex gap-4">
          <button type="button" disabled={busy} onClick={() => void block()} className="text-red-300">{busy ? t('common.loading') : t('safety.block')}</button>
          <button type="button" disabled={busy} onClick={() => setConfirm(false)}>{t('common.cancel')}</button>
        </div>
      </div>}
      {error && <p role="alert" className="mt-2 text-red-300">{t('common.error')}</p>}
      <ReportModal isOpen={report} onClose={() => setReport(false)} targetType="user"
        onSubmit={(reason, details) => submitReport('user', userId, reason, details)} />
    </div>
  );
}
