'use client';

import Link from 'next/link';
import { memo, useCallback, useState } from 'react';
import { Clock, MapPin, MessageCircle, Trash2, Flag } from 'lucide-react';
import type { ParkingPost } from '@/lib/types';
import { deleteParkingPost, isPostActive } from '@/lib/posts';
import { getCollegeName, formatGate, formatZone } from '@/lib/university';
import { useLocale } from '@/components/LocaleProvider';
import CountdownTimer from './CountdownTimer';
import ReportModal from './ReportModal';

interface ParkingCardProps {
  post: ParkingPost;
  currentUserId: string;
  onChanged?: () => void;
  onExpire?: (postId: string) => void;
}

function ParkingCard({ post, currentUserId, onChanged, onExpire }: ParkingCardProps) {
  const { dir, formatNumber, locale, t } = useLocale();
  const active = isPostActive(post);
  const isOwner = post.user_id === currentUserId;
  const [deleting, setDeleting] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  const handleDelete = useCallback(async () => {
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
  }, [currentUserId, deleting, onChanged, post.id]);

  const handleReport = useCallback(async (reason: string, details: string) => {
    // In production, this would send to a backend endpoint
    console.log('Report submitted:', { postId: post.id, reason, details });
    // For now, just log it
  }, [post.id]);

  if (!active) return null;

  return (
    <article
      className="glass-card animate-fade-up min-w-0 max-w-full p-3.5 transition-all duration-300 active:scale-[0.99] sm:p-4"
      dir={dir}
    >
      <div className="mb-3 flex items-start justify-between gap-2.5 sm:gap-3">
        <div className="min-w-0 flex-1">
          <h3 dir="auto" className="break-words text-base font-extrabold leading-snug text-white sm:text-lg">
            {getCollegeName(post.college, locale)}
          </h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-white/70">
            <span className="rounded-full bg-cyan-400/10 px-2 py-0.5 sm:px-2.5 sm:py-1 font-bold text-cyan-200 text-[11px] sm:text-xs">
              {formatZone(post.zone, locale)}
            </span>
            <span className="flex items-center gap-1 text-xs sm:text-sm">
              <MapPin className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 text-cyan-300" />
              {formatGate(post.gate, locale)}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5 sm:gap-2">
          <CountdownTimer
            expiresAt={new Date(post.expires_at).getTime()}
            onComplete={() => onExpire?.(post.id)}
          />
          <div className="flex gap-1">
            {!isOwner && (
              <button
                type="button"
                onClick={() => setShowReportModal(true)}
                className="rounded-xl p-1.5 sm:p-2 text-white/45 transition-colors hover:bg-red-500/15 hover:text-red-200"
                aria-label={t('parking.report')}
              >
                <Flag className="h-4 w-4" />
              </button>
            )}
            {isOwner && (
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={deleting}
                className="rounded-xl p-1.5 sm:p-2 text-white/45 transition-colors hover:bg-red-500/15 hover:text-red-200 disabled:opacity-40"
                aria-label={t('parking.delete')}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {post.car_desc && (
        <div className="mb-3 rounded-2xl bg-white/5 px-3 py-2.5 text-xs sm:text-sm leading-6 sm:leading-7 text-white/80 min-w-0">
          <p className="mb-1 text-[11px] font-bold text-cyan-200/70 sm:text-xs">{t('parking.notes')}</p>
          <p dir="auto" className="whitespace-pre-wrap break-words">{post.car_desc}</p>
        </div>
      )}

      <div className="flex items-center justify-between gap-2.5 sm:gap-3 border-t border-white/10 pt-3">
        <div className="min-w-0 flex-1 text-xs text-white/50">
          <p dir="auto" className="truncate font-bold text-white/75">{post.username}</p>
          <p className="mt-0.5 flex items-center gap-1 text-[11px] sm:text-xs truncate">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            {t('parking.leavesIn', { minutes: formatNumber(post.departure_minutes) })}
          </p>
        </div>
        {isOwner ? (
          <Link
            href="/conversations"
            className="flex shrink-0 items-center gap-1.5 sm:gap-2 rounded-2xl bg-white/10 px-3 sm:px-4 py-2 text-xs sm:text-sm font-extrabold text-white/70 transition-colors hover:bg-white/15"
          >
            <MessageCircle className="h-4 w-4 shrink-0" />
            {t('parking.myChats')}
          </Link>
        ) : (
          <Link
            href={`/post/${post.id}`}
            className="flex shrink-0 items-center gap-1.5 sm:gap-2 rounded-2xl bg-cyan-500 px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-extrabold text-navy-900 shadow-lg shadow-cyan-500/20 transition-transform active:scale-95"
          >
            <MessageCircle className="h-4 w-4 shrink-0" />
            {t('parking.contact')}
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

export default memo(ParkingCard);
