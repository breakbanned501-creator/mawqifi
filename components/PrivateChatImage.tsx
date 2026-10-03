'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { downloadChatImage } from '@/lib/chat-images';
import { useLocale } from './LocaleProvider';

export default function PrivateChatImage({ reference, conversationId, userId, onEnlarge }: {
  reference: string; conversationId: string; userId: string | null; onEnlarge: (url: string) => void;
}) {
  const { t } = useLocale();
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    setSrc(null); setFailed(false);
    if (userId) void downloadChatImage(reference, conversationId).then(blob => {
      if (cancelled) return;
      objectUrl = URL.createObjectURL(blob); setSrc(objectUrl);
    }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [reference, conversationId, userId, retry]);
  if (failed) return <div role="status" className="space-y-2 text-sm"><p>{t('chat.imageLoadError')}</p>
    <button type="button" className="rounded-xl bg-white/10 px-3 py-2" onClick={() => setRetry(n => n + 1)}>{t('common.retry')}</button></div>;
  if (!src) return <p role="status" className="text-sm">{t('common.loading')}</p>;
  return <button type="button" onClick={() => onEnlarge(src)} className="block max-w-full min-w-0 overflow-hidden rounded-2xl">
    <Image src={src} alt={t('chat.imageAlt')} width={240} height={180} className="block h-auto max-w-full rounded-2xl object-cover" unoptimized />
  </button>;
}
