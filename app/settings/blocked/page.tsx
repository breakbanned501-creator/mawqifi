'use client';

import { useCallback, useEffect, useState } from 'react';
import BottomNav from '@/components/BottomNav';
import PageHeader from '@/components/PageHeader';
import { useAuth } from '@/components/AuthProvider';
import { useLocale } from '@/components/LocaleProvider';
import { fetchBlockedUsers, setUserBlocked, type BlockedUser } from '@/lib/safety';

export default function BlockedUsersPage() {
  const { userId } = useAuth();
  const { t, dir } = useLocale();
  const [items, setItems] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setError(false);
    try { setItems(await fetchBlockedUsers()); }
    catch { setError(true); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { if (userId) void load(); }, [userId, load]);
  const unblock = async (id: string) => {
    setBusy(id); setError(false);
    try { await setUserBlocked(id, false); await load(); }
    catch { setError(true); }
    finally { setBusy(null); }
  };
  return <main dir={dir} className="page-with-chrome min-h-screen px-4 pt-6">
    <div className="mx-auto max-w-md space-y-4">
      <PageHeader title={t('safety.blockedUsers')} subtitle={t('safety.blockedHint')} backHref="/settings" />
      {error && <div role="alert"><p className="text-red-300">{t('common.error')}</p><button onClick={() => void load()}>{t('common.retry')}</button></div>}
      {loading ? <p>{t('common.loading')}</p> : !items.length && <p className="text-white/60">{t('safety.none')}</p>}
      {items.map(item => {
        const profile = Array.isArray(item.users) ? item.users[0] : item.users;
        return <div className="glass-card flex items-center justify-between gap-3 p-4" key={item.blocked_id}>
          <span dir="auto" className="min-w-0 truncate">{profile?.username || t('safety.user')}</span>
          <button disabled={busy !== null} onClick={() => void unblock(item.blocked_id)} className="shrink-0 text-cyan-300">{busy === item.blocked_id ? t('common.loading') : t('safety.unblock')}</button>
        </div>;
      })}
    </div><BottomNav />
  </main>;
}
