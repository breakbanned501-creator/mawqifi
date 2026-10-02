'use client';

import { postLocationTitle, postLocationDetails } from '@/lib/post-location';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { MessageCircle } from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import ErrorBanner from '@/components/ErrorBanner';
import LoadingScreen from '@/components/LoadingScreen';
import { useLocale } from '@/components/LocaleProvider';
import PageHeader from '@/components/PageHeader';
import { useAuth } from '@/components/AuthProvider';
import { fetchConversations } from '@/lib/conversations';
import { getSupabase } from '@/lib/supabase';
import type { Conversation } from '@/lib/types';
import { getMawqifiPostHref } from '@/lib/capacitor';

export default function ConversationsPage() {
  const { userId } = useAuth();
  const { dir, formatNumber, locale, t } = useLocale();
  const [items, setItems] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setError(null);
    try {
      setItems(await fetchConversations(userId));
    } catch {
      setError(t('conversations.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!userId) return;
    const supabase = getSupabase();
    const channel = supabase
      .channel('conversations-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => {
        void load();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, load]);

  if (loading) return <LoadingScreen message={t('common.loading')} />;

  return (
    <main className="page-with-chrome min-h-screen px-4 pt-6" dir={dir}>
      <div className="mx-auto max-w-md md:max-w-xl lg:max-w-2xl space-y-5">
        <PageHeader
          title={t('conversations.title')}
          subtitle={t('conversations.subtitle')}
          backHref="/"
        />

        {error && <ErrorBanner message={error} onRetry={() => { setLoading(true); void load(); }} />}

        {items.length === 0 ? (
          <div className="glass-card py-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-cyan-500/10">
              <MessageCircle className="h-8 w-8 text-cyan-300" />
            </div>
            <h3 className="mb-2 text-lg font-extrabold text-white">{t('conversations.emptyTitle')}</h3>
            <p className="text-sm leading-6 text-white/60">{t('conversations.emptyBody')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((conversation) => (
              <Link
                key={conversation.id}
                href={getMawqifiPostHref(conversation.post_id, conversation.id)}
                className={`block glass-card p-4 transition-opacity ${conversation.closed ? 'opacity-50 grayscale' : 'hover:border-cyan-400/30'}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-cyan-500/15 text-cyan-300">
                      <MessageCircle className="h-6 w-6" />
                      {Boolean(conversation.unread_count) && (
                        <span className="absolute -top-1 end-0 flex h-5 min-w-5 items-center justify-center rounded-full bg-cyan-500 px-1 text-xs font-black text-navy-900">
                          {formatNumber(conversation.unread_count ?? 0)}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <h2 className="truncate font-extrabold text-white">
                        {conversation.post?.place_id
                          ? postLocationTitle(conversation.post, locale)
                          : t('conversations.new')}
                      </h2>
                      <p className="truncate text-sm text-white/55">
                        {conversation.post?.place_id && (
                          <span>{postLocationDetails(conversation.post, locale)}</span>
                        )}
                        <span aria-hidden="true"> — </span>
                        {conversation.last_message ? (
                          <bdi dir="auto">{conversation.last_message}</bdi>
                        ) : (
                          t('conversations.noMessages')
                        )}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 text-xs font-bold text-white/40">
                    {conversation.closed ? t('conversations.closed') : t('conversations.active')}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
      <BottomNav />
    </main>
  );
}
