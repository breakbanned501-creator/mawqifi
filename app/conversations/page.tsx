'use client';

import Link from 'next/link';
import { MessageCircle } from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import PageHeader from '@/components/PageHeader';
import { mockConversations } from '@/lib/mock';
import { formatGate } from '@/lib/university';

export default function ConversationsPage() {
  return (
    <main className="min-h-screen px-4 pb-28 pt-6">
      <div className="mx-auto max-w-md space-y-5">
        <PageHeader title="المحادثات" subtitle="تواصل خاص بخصوص المواقف المتاحة" backHref="/" />

        <div className="space-y-3">
          {mockConversations.map((conversation) => (
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
                    <h2 className="truncate font-extrabold text-white">{conversation.post?.college}</h2>
                    <p className="truncate text-sm text-white/55">
                      {conversation.post?.gate ? formatGate(conversation.post.gate) : ''}
                      {conversation.last_message ? ` — ${conversation.last_message}` : ' — لا توجد رسائل بعد'}
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
      </div>
      <BottomNav />
    </main>
  );
}
