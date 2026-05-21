'use client';

import Link from 'next/link';
import { Car, Clock, MapPin, MessageCircle, Trash2 } from 'lucide-react';
import type { ParkingPost } from '@/lib/types';
import { deleteStoredPost, isPostActive } from '@/lib/posts';
import { formatGate, formatZone } from '@/lib/university';
import CountdownTimer from './CountdownTimer';

interface ParkingCardProps {
  post: ParkingPost;
  onDelete?: () => void;
}

export default function ParkingCard({ post, onDelete }: ParkingCardProps) {
  const active = isPostActive(post);

  const handleDelete = () => {
    deleteStoredPost(post.id);
    onDelete?.();
  };

  return (
    <article className={`glass-card animate-fade-up p-4 transition-transform active:scale-[0.99] ${active ? '' : 'opacity-60'}`}>
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
          <CountdownTimer expiresAt={new Date(post.expires_at).getTime()} />
          {post.user_id === 'local-user' && (
            <button
              type="button"
              onClick={handleDelete}
              className="rounded-xl p-2 text-white/45 transition-colors hover:bg-red-500/15 hover:text-red-200"
              aria-label="حذف الموقف"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {post.car_desc && (
        <div className="mb-3 flex items-center gap-2 rounded-2xl bg-white/5 px-3 py-2 text-sm text-white/80">
          <Car className="h-4 w-4 shrink-0 text-cyan-300" />
          <span>{post.car_desc}</span>
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
        <Link
          href={`/post/${post.id}`}
          className={`flex shrink-0 items-center gap-2 rounded-2xl px-4 py-2 text-sm font-extrabold shadow-lg ${
            active
              ? 'bg-cyan-500 text-navy-900 shadow-cyan-500/20'
              : 'pointer-events-none bg-white/10 text-white/40'
          }`}
        >
          <MessageCircle className="h-4 w-4" />
          {active ? 'تواصل' : 'مغلقة'}
        </Link>
      </div>
    </article>
  );
}
