'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Clock, MapPin, MessageCircle, Trash2, Flag } from 'lucide-react';
import type { ParkingPost } from '@/lib/types';
import { deleteParkingPost, isPostActive } from '@/lib/posts';
import { formatGate, formatZone } from '@/lib/university';
import CountdownTimer from './CountdownTimer';
import ReportModal from './ReportModal';

interface ParkingCardProps {
  post: ParkingPost;
  currentUserId: string;
  onChanged?: () => void;
  onExpire?: (postId: string) => void;
}

export default function ParkingCard({ post, currentUserId, onChanged, onExpire }: ParkingCardProps) {
  const active = isPostActive(post);
  const isOwner = post.user_id === currentUserId;
  const [deleting, setDeleting] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  const handleDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await deleteParkingPost(post.id, currentUserId);
      onChanged?.();
    } catch {
      /* parent may show error via refresh */
    } finally {
      setDeleting(false);
    }
  };

  const handleReport = async (reason: string, details: string) => {
    // In production, this would send to a backend endpoint
    console.log('Report submitted:', { postId: post.id, reason, details });
    // For now, just log it
  };

  if (!active) return null;

  return (
    <article className="glass-card animate-fade-up p-4 transition-all duration-300 active:scale-[0.99]">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-extrabold leading-snug text-white">{post.college}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-white/70">
            <span className="rounded-full bg-cyan-400/10 px-2.5 py-1 font-bold text-cyan-200">
              {formatZone(post.zone)}
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="h-4 w-4 shrink-0 text-cyan-300" />
              {formatGate(post.gate)}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <CountdownTimer
            expiresAt={new Date(post.expires_at).getTime()}
            onComplete={() => onExpire?.(post.id)}
          />
          <div className="flex gap-1">
            {!isOwner && (
              <button
                type="button"
                onClick={() => setShowReportModal(true)}
                className="rounded-xl p-2 text-white/45 transition-colors hover:bg-red-500/15 hover:text-red-200"
                aria-label="الإبلاغ"
              >
                <Flag className="h-4 w-4" />
              </button>
            )}
            {isOwner && (
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={deleting}
                className="rounded-xl p-2 text-white/45 transition-colors hover:bg-red-500/15 hover:text-red-200 disabled:opacity-40"
                aria-label="حذف الموقف"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {post.car_desc && (
        <div className="mb-3 rounded-2xl bg-white/5 px-3 py-2.5 text-sm leading-7 text-white/80">
          <p className="mb-1 text-xs font-bold text-cyan-200/70">ملاحظات</p>
          <p className="whitespace-pre-wrap">{post.car_desc}</p>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-3">
        <div className="text-xs text-white/50">
          <p className="font-bold text-white/75">{post.username}</p>
          <p className="mt-1 flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            يغادر خلال {post.departure_minutes} د
          </p>
        </div>
        {isOwner ? (
          <Link
            href="/conversations"
            className="flex shrink-0 items-center gap-2 rounded-2xl bg-white/10 px-4 py-2 text-sm font-extrabold text-white/70"
          >
            <MessageCircle className="h-4 w-4" />
            محادثاتي
          </Link>
        ) : (
          <Link
            href={`/post/${post.id}`}
            className="flex shrink-0 items-center gap-2 rounded-2xl bg-cyan-500 px-4 py-2 text-sm font-extrabold text-navy-900 shadow-lg shadow-cyan-500/20"
          >
            <MessageCircle className="h-4 w-4" />
            تواصل
          </Link>
        )}
      </div>
      
      <ReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        onSubmit={handleReport}
        targetType="post"
      />
    </article>
  );
}
