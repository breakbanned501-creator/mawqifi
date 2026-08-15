'use client';

import { type ChangeEvent, type KeyboardEvent, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Camera, ImageIcon, MapPin, Send, X, Flag } from 'lucide-react';
import AppFooter from '@/components/AppFooter';
import Toast from '@/components/Toast';
import CountdownTimer from '@/components/CountdownTimer';
import ErrorBanner from '@/components/ErrorBanner';
import LoadingScreen from '@/components/LoadingScreen';
import ReportModal from '@/components/ReportModal';
import { useAuth } from '@/components/AuthProvider';
import { fetchMessages, sendMessage, uploadChatImage } from '@/lib/chat';
import {
  fetchConversationByPostForUser,
  getOrCreateConversation,
  markConversationRead,
} from '@/lib/conversations';
import { fetchParkingPostById, isPostActive } from '@/lib/posts';
import { getSupabase } from '@/lib/supabase';
import { formatGate, formatZone } from '@/lib/university';
import type { ChatMessage, Conversation, ParkingPost } from '@/lib/types';

interface PostChatPageProps {
  params: { id: string };
}

export default function PostChatPage({ params }: PostChatPageProps) {
  const { userId } = useAuth();
  const [post, setPost] = useState<ParkingPost | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [typing, setTyping] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [showReportModal, setShowReportModal] = useState(false);
  const [messageToReport, setMessageToReport] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const expired = post ? !isPostActive(post) : false;
  const conversationId = conversation?.id;

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const loadedPost = await fetchParkingPostById(params.id);
        if (!loadedPost) throw new Error('الموقف غير موجود');
        if (cancelled) return;
        setPost(loadedPost);

        let conv: Conversation;
        if (loadedPost.user_id === userId) {
          const existing = await fetchConversationByPostForUser(params.id, userId);
          if (!existing) {
            setError('هذا موقفك. انتظر رسائل الطلاب من صفحة المحادثات.');
            setLoading(false);
            return;
          }
          conv = existing;
        } else {
          const result = await getOrCreateConversation(params.id, userId);
          conv = result.conversation;
        }

        if (cancelled) return;
        setConversation(conv);

        const initialMessages = await fetchMessages(conv.id);
        if (cancelled) return;
        setMessages(initialMessages);
        await markConversationRead(conv.id, userId);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'تعذر فتح المحادثة');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [params.id, userId]);

  useEffect(() => {
    if (!conversationId) return;

    const supabase = getSupabase();
    const channel = supabase
      .channel(`chat:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const row = payload.new as ChatMessage;
          setMessages((current) => {
            if (current.some((m) => m.id === row.id)) return current;
            return [...current, row];
          });
          if (userId) void markConversationRead(conversationId, userId);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversationId, userId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendText = async () => {
    if (!text.trim() || expired || !conversationId || !userId) return;
    const value = text.trim();
    setText('');
    setError(null);
    try {
      await sendMessage({
        conversationId,
        senderId: userId,
        type: 'text',
        text: value,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إرسال الرسالة');
      setText(value);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') void sendText();
  };

  const handleImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || expired || !conversationId || !userId) return;

    setUploading(true);
    setError(null);
    try {
      const publicUrl = await uploadChatImage(conversationId, userId, file);
      await sendMessage({
        conversationId,
        senderId: userId,
        type: 'image',
        imageUrl: publicUrl,
      });
      setToast('تم إرسال الصورة');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر رفع الصورة');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const sendLocation = () => {
    if (expired || !conversationId || !userId) return;

    if (!navigator.geolocation) {
      setError('المتصفح لا يدعم تحديد الموقع');
      return;
    }

    setError(null);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          await sendMessage({
            conversationId,
            senderId: userId,
            type: 'location',
            text: 'موقعي الحالي',
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
          setToast('تم إرسال الموقع');
        } catch (err) {
          setError(err instanceof Error ? err.message : 'تعذر إرسال الموقع');
        }
      },
      (geoError) => {
        const messages: Record<number, string> = {
          1: 'يجب السماح بالوصول إلى الموقع من إعدادات المتصفح',
          2: 'تعذر تحديد الموقع حالياً',
          3: 'انتهت مهلة تحديد الموقع، حاول مرة أخرى',
        };
        setError(messages[geoError.code] ?? 'تعذر الحصول على الموقع');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
    );
  };

  const handleReport = async (reason: string, details: string) => {
    // In production, this would send to a backend endpoint
    console.log('Report submitted:', { messageId: messageToReport, reason, details });
    // For now, just log it
  };

  if (loading) return <LoadingScreen message="جاري فتح المحادثة..." />;

  if (!post) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <ErrorBanner message={error ?? 'الموقف غير موجود'} />
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-navy-950">
      <Toast message={toast} visible={Boolean(toast)} onHide={() => setToast('')} />
      {selectedImage && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setSelectedImage(null)}
          role="presentation"
        >
          <button
            type="button"
            className="absolute end-4 top-4 rounded-full bg-white/10 p-3"
            onClick={() => setSelectedImage(null)}
            aria-label="إغلاق"
          >
            <X className="h-6 w-6" />
          </button>
          <Image
            src={selectedImage}
            alt="صورة المحادثة"
            width={900}
            height={900}
            className="max-h-[85vh] w-auto rounded-3xl object-contain"
            unoptimized
          />
        </div>
      )}

      <header className="sticky top-0 z-40 border-b border-white/10 bg-navy-950/90 px-4 py-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-md md:max-w-xl lg:max-w-2xl items-center gap-3">
          <Link href="/conversations" className="rounded-2xl bg-white/10 p-2.5 text-white/70">
            <ArrowRight className="h-5 w-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-extrabold text-white">محادثة الموقف</h1>
            <p className="truncate text-sm text-white/55">
              {post.college} — {formatZone(post.zone)} — {formatGate(post.gate)}
            </p>
            {!expired && (
              <div className="mt-1">
                <CountdownTimer expiresAt={new Date(post.expires_at).getTime()} />
              </div>
            )}
            {typing && <p className="mt-1 animate-pulse-soft text-xs text-cyan-300">يكتب الآن...</p>}
          </div>
        </div>
      </header>

      {error && (
        <div className="mx-auto w-full max-w-md md:max-w-xl lg:max-w-2xl px-4 pt-3">
          <ErrorBanner message={error} onRetry={() => setError(null)} />
        </div>
      )}

      <section className="mx-auto flex w-full max-w-md md:max-w-xl lg:max-w-2xl flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 && !error && (
          <p className="py-8 text-center text-sm text-white/45">ابدأ المحادثة بخصوص هذا الموقف</p>
        )}
        {messages.map((message) => {
          const mine = message.sender_id === userId;
          return (
            <div key={message.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
              <div className="flex items-end gap-2">
                <div
                  className={`max-w-[85%] rounded-3xl px-4 py-3 ${
                    mine
                      ? 'rounded-be-md bg-cyan-500 text-navy-900'
                      : 'rounded-bs-md bg-white/10 text-white'
                  }`}
                >
                  {message.type === 'text' && <p className="text-sm leading-7 break-words">{message.text}</p>}
                  {message.type === 'image' && message.image_url && (
                    <button type="button" onClick={() => setSelectedImage(message.image_url)}>
                      <Image
                        src={message.image_url}
                        alt="صورة"
                        width={240}
                        height={180}
                        className="rounded-2xl object-cover max-w-full"
                        unoptimized
                      />
                    </button>
                  )}
                  {message.type === 'location' &&
                    message.latitude != null &&
                    message.longitude != null && (
                      <div className="space-y-2">
                        <div className="rounded-2xl bg-navy-900/60 p-4 text-center">
                          <MapPin className="mx-auto h-8 w-8 text-cyan-300" />
                          <p className="mt-2 text-sm font-bold">موقع الطالب الحالي</p>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs font-bold">
                          <a
                            className="rounded-xl bg-white/15 px-3 py-2"
                            target="_blank"
                            rel="noreferrer"
                            href={`https://www.google.com/maps?q=${message.latitude},${message.longitude}`}
                          >
                            خرائط Google
                          </a>
                          <a
                            className="rounded-xl bg-white/15 px-3 py-2"
                            target="_blank"
                            rel="noreferrer"
                            href={`https://maps.apple.com/?q=${message.latitude},${message.longitude}`}
                          >
                            خرائط Apple
                          </a>
                        </div>
                      </div>
                    )}
                </div>
                {!mine && (
                  <button
                    type="button"
                    onClick={() => {
                      setMessageToReport(message.id);
                      setShowReportModal(true);
                    }}
                    className="mb-1 rounded-full p-1.5 text-white/30 transition-colors hover:bg-red-500/15 hover:text-red-300"
                    aria-label="الإبلاغ عن الرسالة"
                  >
                    <Flag className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <span className="mt-1 text-[11px] text-white/35">
                {new Date(message.created_at).toLocaleTimeString('ar-KW', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          );
        })}
        <div ref={endRef} />
      </section>

      {expired || conversation?.closed ? (
        <div className="animate-fade-up border-t border-red-400/20 bg-red-500/10 px-4 py-5 text-center text-red-100">
          تم انتهاء الموقف وإغلاق المحادثة
        </div>
      ) : (
        <footer className="safe-bottom border-t border-white/10 bg-navy-900/95 px-3 sm:px-4 py-2.5 sm:py-3 backdrop-blur-xl">
          <div className="mx-auto flex max-w-md md:max-w-xl lg:max-w-2xl items-center gap-1.5 sm:gap-2">
            <label className="shrink-0 rounded-full bg-white/10 p-2.5 sm:p-3 text-white/60 cursor-pointer hover:bg-white/15">
              <Camera className="h-4 w-4 sm:h-5 sm:w-5" />
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleImage}
                disabled={uploading}
              />
            </label>
            <label className="shrink-0 rounded-full bg-white/10 p-2.5 sm:p-3 text-white/60 cursor-pointer hover:bg-white/15">
              <ImageIcon className="h-4 w-4 sm:h-5 sm:w-5" />
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImage}
                disabled={uploading}
              />
            </label>
            <button
              type="button"
              onClick={sendLocation}
              disabled={uploading}
              className="shrink-0 rounded-full bg-white/10 p-2.5 sm:p-3 text-white/60 hover:bg-white/15 disabled:opacity-40"
              aria-label="إرسال الموقع"
            >
              <MapPin className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
            <input
              value={text}
              onFocus={() => setTyping(true)}
              onBlur={() => setTyping(false)}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={uploading ? 'جاري رفع الصورة...' : 'اكتب رسالة...'}
              disabled={uploading}
              className="min-w-0 flex-1 rounded-full border border-white/10 bg-navy-950 px-3.5 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm text-white outline-none placeholder:text-white/40 focus:border-cyan-500 disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => void sendText()}
              disabled={!text.trim() || uploading}
              className="shrink-0 rounded-full bg-cyan-500 p-2.5 sm:p-3 text-navy-900 disabled:opacity-40 hover:bg-cyan-400"
              aria-label="إرسال"
            >
              <Send className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
          </div>
        </footer>
      )}
      
      <ReportModal
        isOpen={showReportModal}
        onClose={() => {
          setShowReportModal(false);
          setMessageToReport(null);
        }}
        onSubmit={handleReport}
        targetType="message"
      />
      
      <AppFooter />
    </main>
  );
}
