'use client';

import { MapPin, Trash2, Calendar } from 'lucide-react';
import CountdownTimer from './CountdownTimer';
import { Post } from '@/lib/storage';

interface PostCardProps {
  post: Post;
  onDelete: (id: string) => void;
}

export default function PostCard({ post, onDelete }: PostCardProps) {
  const isExpired = Date.now() > post.expiresAt;

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('ar-SA', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className={`card ${isExpired ? 'opacity-60' : ''}`}>
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <h3 className="font-extrabold text-lg text-white mb-1">
            {post.location}
          </h3>
          <p className="text-white/70 text-sm leading-6">
            {post.description}
          </p>
        </div>
        <button
          onClick={() => onDelete(post.id)}
          className="p-2 text-white/55 hover:text-red-200 hover:bg-red-500/15 rounded-xl transition-colors"
          aria-label="حذف"
        >
          <Trash2 size={18} />
        </button>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-white/10">
        <div className="flex items-center gap-2 text-sm text-white/60">
          <MapPin size={14} />
          <span>{post.duration} دقيقة</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-white/60">
          <Calendar size={14} />
          <span>{formatDate(post.createdAt)}</span>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-white/10">
        <CountdownTimer
          expiresAt={post.expiresAt}
          onComplete={() => {
            // Force re-render when expired
            window.location.reload();
          }}
        />
      </div>
    </div>
  );
}
