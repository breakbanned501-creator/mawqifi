'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { MessageCircle } from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import ErrorBanner from '@/components/ErrorBanner';
import LoadingScreen from '@/components/LoadingScreen';
import PageHeader from '@/components/PageHeader';
import { useAuth } from '@/components/AuthProvider';
import { fetchConversations } from '@/lib/conversations';
import { getSupabase } from '@/lib/supabase';
import type { Conversation } from '@/lib/types';
import { formatGate } from '@/lib/university';

export default function ConversationsPage() {
  const { userId } = useAuth();
  const [items, setItems] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setError(null);
    try {
      setItems(await fetchConversations(userId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحميل المحادثات');
    } finally {
      setLoading(false);
    }
  }, [userId]);

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

  if (loading) return <LoadingScreen message="جاري تحميل المحادثات..." />;

  return (
    <main className="page-with-chrome min-h-screen px-4 pt-6">
      <div className="mx-auto max-w-md space-y-5">
        <PageHeader title="المحادثات" subtitle="تواصل خاص بخصوص المواقف المتاحة" backHref="/" />

        {error && <ErrorBanner message={error} onRetry={() => { setLoading(true); void load(); }} />}

        {items.length === 0 ? (
          <div className="glass-card py-10 text-center text-sm text-white/55">
            لا توجد محادثات بعد. افتح موقفاً من الرئيسية واضغط «تواصل».
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((conversation) => (
              <Link
                key={conversation.id}
                href={`/post/${conversation.post_id}`}
                className={`block glass-card p-4 transition-opacity ${conversation.closed ? 'opacity-50 grayscale' : 'hover:border-cyan-400/30'}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-cyan-500/15 text-cyan-300">
                      <MessageCircle className="h-6 w-6" />
                      {Boolean(conversation.unread_count) && (
                        <span className="absolute -top-1 end-0 flex h-5 min-w-5 items-center justify-center rounded-full bg-cyan-500 px-1 text-xs font-black text-navy-900">
                          {conversation.unread_count}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <h2 className="truncate font-extrabold text-white">
                        {conversation.post?.college ?? 'محادثة'}
                      </h2>
                      <p className="truncate text-sm text-white/55">
                        {conversation.post?.gate ? formatGate(conversation.post.gate) : ''}
                        {conversation.last_message
                          ? ` — ${conversation.last_message}`
                          : ' — لا توجد رسائل بعد'}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 text-xs font-bold text-white/40">
                    {conversation.closed ? 'مغلقة' : 'نشطة'}
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
