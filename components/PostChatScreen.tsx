'use client';

import { postLocationTitle, postLocationDetails } from '@/lib/post-location';

import { type ChangeEvent, type KeyboardEvent, type MouseEvent, useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Camera, ImageIcon, MapPin, Send, X, Flag } from 'lucide-react';
import AppFooter from '@/components/AppFooter';
import Toast from '@/components/Toast';
import HandoffPanel from '@/components/HandoffPanel';
import KeyboardAssist from '@/components/KeyboardAssist';
import ErrorBanner from '@/components/ErrorBanner';
import LoadingScreen from '@/components/LoadingScreen';
import ReportModal from '@/components/ReportModal';
import UserBadge from '@/components/UserBadge';
import UserSafetyActions from '@/components/UserSafetyActions';
import { isUserBlocked, submitReport, safetyErrorKey } from '@/lib/safety';
import { useAuth } from '@/components/AuthProvider';
import { useLocale } from '@/components/LocaleProvider';
import { fetchMessages, sendMessage, uploadChatImage } from '@/lib/chat';
import {
  fetchConversationByIdForUser,
  fetchConversationByPostForUser,
  getOrCreateConversation,
  markConversationRead,
} from '@/lib/conversations';
import { fetchParkingPostById } from '@/lib/posts';
import { getSupabase } from '@/lib/supabase';
import { isNativeCapacitor, openExternalUrl, triggerNativeLightHaptic } from '@/lib/capacitor';
import { getNativeCurrentLocation, selectNativeChatImage, type NativeChatImageSource } from '@/lib/native-media';
import type { TranslationKey } from '@/lib/i18n';
import type { ChatMessage, Conversation, ParkingPost } from '@/lib/types';

interface PostChatScreenProps {
  postId: string;
  requestedConversationId: string | null;
}

type ChatError = { key: TranslationKey } | { message: string };

export default function PostChatScreen({ postId, requestedConversationId }: PostChatScreenProps) {
  const { userId } = useAuth();
  const { dir, formatDate, locale, t } = useLocale();
  const [post, setPost] = useState<ParkingPost | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [typing, setTyping] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [nativeRuntime, setNativeRuntime] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ChatError | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [showReportModal, setShowReportModal] = useState(false);
  const [messageToReport, setMessageToReport] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(true);
  const otherUserId = conversation ? (conversation.owner_id === userId ? conversation.requester_id : conversation.owner_id) : null;
  const endRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const [handoffClosed, setHandoffClosed] = useState(true);
  const onHandoffClosed = useCallback((closed: boolean) => setHandoffClosed(closed), []);
  const expired = handoffClosed || Boolean(conversation?.closed);
  const conversationId = conversation?.id;
  const errorMessage = error ? ('key' in error ? t(error.key) : error.message) : null;
  const BackIcon = dir === 'rtl' ? ArrowRight : ArrowLeft;

  useEffect(() => {
    if (!otherUserId) return;
    let cancelled = false;
    const check = () => { void isUserBlocked(otherUserId).then(value => { if (!cancelled) setBlocked(value); }).catch(() => { if (!cancelled) setBlocked(true); }); };
    check();
    window.addEventListener('focus', check);
    return () => { cancelled = true; window.removeEventListener('focus', check); };
  }, [otherUserId]);

  useEffect(() => {
    setNativeRuntime(isNativeCapacitor());
  }, []);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const loadedPost = await fetchParkingPostById(postId);
        if (cancelled) return;
        if (!loadedPost) {
          setError({ key: 'chat.postNotFound' });
          return;
        }

        setPost(loadedPost);

        let conv: Conversation;
        if (requestedConversationId) {
          const requestedConversation = await fetchConversationByIdForUser(
            requestedConversationId,
            userId,
          );
          if (cancelled) return;
          if (!requestedConversation || requestedConversation.post_id !== postId) {
            setError({ key: 'chat.openError' });
            return;
          }
          conv = requestedConversation;
        } else if (loadedPost.user_id === userId) {
          const existing = await fetchConversationByPostForUser(postId, userId);
          if (cancelled) return;
          if (!existing) {
            setError({ key: 'chat.ownerOnly' });
            return;
          }
          conv = existing;
        } else {
          const result = await getOrCreateConversation(postId, userId);
          if (cancelled) return;
          conv = result.conversation;
        }

        if (cancelled) return;
        setConversation(conv);

        const initialMessages = await fetchMessages(conv.id);
        if (cancelled) return;
        setMessages(initialMessages);
        await markConversationRead(conv.id, userId);
      } catch (error) {
        if (!cancelled) {
          const key = safetyErrorKey(error);
          setError({ key: key === 'common.error' ? 'chat.openError' : key });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [postId, requestedConversationId, userId]);

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

  useEffect(() => {
    const composer = composerRef.current;
    if (!composer) return;

    composer.style.height = 'auto';
    composer.style.height = `${Math.min(composer.scrollHeight, 128)}px`;
  }, [text]);

  const sendText = async () => {
    if (!text.trim() || blocked || expired || !conversationId || !userId) return;
    const value = text;
    setText('');
    setError(null);
    try {
      await sendMessage({
        conversationId,
        senderId: userId,
        type: 'text',
        text: value,
      });
      void triggerNativeLightHaptic();
    } catch (error) {
      setError({ key: safetyErrorKey(error) });
      setText(value);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void sendText();
    }
  };

  const uploadSelectedImage = async (getFile: () => Promise<File | null>) => {
    if (blocked || expired || !conversationId || !userId) return;

    setUploading(true);
    setError(null);
    try {
      const file = await getFile();
      if (!file) return;
      const publicUrl = await uploadChatImage(conversationId, userId, file);
      await sendMessage({
        conversationId,
        senderId: userId,
        type: 'image',
        imageUrl: publicUrl,
      });
      setToast(t('chat.sendImage'));
      void triggerNativeLightHaptic();
    } catch (error) {
      setError({ key: safetyErrorKey(error) });
    } finally {
      setUploading(false);
    }
  };

  const handleImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      await uploadSelectedImage(async () => file);
    } finally {
      event.target.value = '';
    }
  };

  const handleNativeImage = async (source: NativeChatImageSource) => {
    await uploadSelectedImage(() => selectNativeChatImage(source));
  };

  const sendLocation = () => {
    if (blocked || expired || !conversationId || !userId) return;

    const sendCurrentLocation = async (latitude: number, longitude: number) => {
      try {
        await sendMessage({
          conversationId,
          senderId: userId,
          type: 'location',
          text: t('chat.location'),
          latitude,
          longitude,
        });
        setToast(t('chat.sendLocationSuccess'));
        void triggerNativeLightHaptic();
      } catch (error) {
        const key = safetyErrorKey(error);
        setError({ key: key === 'common.error' ? 'chat.sendError' : key });
      }
    };

    if (nativeRuntime) {
      void (async () => {
        try {
          const position = await getNativeCurrentLocation();
          await sendCurrentLocation(position.latitude, position.longitude);
        } catch {
          setError({ key: 'chat.locationUnavailable' });
        }
      })();
      return;
    }

    if (!navigator.geolocation) {
      setError({ key: 'chat.locationUnsupported' });
      return;
    }

    setError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => void sendCurrentLocation(position.coords.latitude, position.coords.longitude),
      (geoError) => {
        const messages: Record<number, TranslationKey> = {
          1: 'chat.locationPermission',
          2: 'chat.locationUnavailable',
          3: 'chat.locationTimeout',
        };
        setError({ key: messages[geoError.code] ?? 'chat.locationUnavailable' });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
    );
  };

  const handleExternalMapLink = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!nativeRuntime) return;
    event.preventDefault();
    void openExternalUrl(event.currentTarget.href).catch(() => setError({ key: 'chat.locationUnavailable' }));
  };

  const handleReport = async (reason: string, details: string) => {
    if (!messageToReport) throw new Error('No message selected');
    await submitReport('message', messageToReport, reason, details);
  };

  if (loading) return <LoadingScreen message={t('common.loading')} />;

  if (!post) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <ErrorBanner message={errorMessage ?? t('parking.notFound')} />
      </main>
    );
  }

  return (
    <main className="handoff-chat flex flex-col bg-navy-950" dir={dir}>
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
            aria-label={t('common.close')}
          >
            <X className="h-6 w-6" />
          </button>
          <Image
            src={selectedImage}
            alt={t('chat.imageAlt')}
            width={900}
            height={900}
            className="max-h-[85vh] w-auto rounded-3xl object-contain"
            unoptimized
          />
        </div>
      )}

      <header className="sticky top-0 z-40 border-b border-white/10 bg-navy-950/90 px-4 py-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-md md:max-w-xl lg:max-w-2xl items-center gap-3">
          <Link
            href="/conversations"
            className="rounded-2xl bg-white/10 p-2.5 text-white/70"
            aria-label={t('common.back')}
          >
            <BackIcon className="h-5 w-5" aria-hidden="true" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-extrabold text-white">{t('chat.title')}</h1>
            <p className="truncate text-sm text-white/55">
              {postLocationTitle(post, locale)} — {postLocationDetails(post, locale)}
            </p>
            <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5 text-xs">
              <p dir="auto" className="min-w-0 max-w-full truncate font-bold text-white/70">{post.username}</p>
              <UserBadge badges={post.badges} />
            </div>
            {typing && <p className="mt-1 animate-pulse-soft text-xs text-cyan-300">{t('chat.typing')}</p>}
            {otherUserId && <UserSafetyActions userId={otherUserId} onBlocked={() => setBlocked(true)} />}
          </div>
        </div>
      </header>

      {conversationId && userId && <HandoffPanel conversationId={conversationId} userId={userId} blocked={blocked} onClosed={onHandoffClosed}/>}
      {error && (
        <div className="mx-auto w-full max-w-md md:max-w-xl lg:max-w-2xl px-4 pt-3">
          <ErrorBanner message={errorMessage ?? t('common.error')} onRetry={() => setError(null)} />
        </div>
      )}

      <section className="mx-auto flex w-full max-w-md md:max-w-xl lg:max-w-2xl flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 && !error && (
          <p className="py-8 text-center text-sm text-white/45">{t('chat.empty')}</p>
        )}
        {messages.map((message) => {
          const mine = message.sender_id === userId;
          const hasText = message.type !== 'location' && Boolean(message.text?.trim());
          const hasImage = Boolean(message.image_url);
          return (
            <div
              key={message.id}
              className={`flex w-full min-w-0 items-end gap-2 ${mine ? 'justify-end' : 'justify-start'}`}
            >
              <article
                className={`h-auto w-fit min-w-0 max-w-[84%] rounded-3xl px-4 py-3 sm:max-w-[78%] md:max-w-[68%] lg:max-w-[60%] ${
                  mine
                    ? 'rounded-be-md bg-cyan-500 text-navy-900'
                    : 'rounded-bs-md bg-white/10 text-white'
                }`}
              >
                <div className="min-w-0 space-y-2">
                  {hasText && (
                    <p
                      dir="auto"
                      className="whitespace-pre-wrap text-start text-sm leading-7 break-normal [overflow-wrap:anywhere]"
                    >
                      {message.text}
                    </p>
                  )}
                  {hasImage && message.image_url && (
                    <button
                      type="button"
                      onClick={() => setSelectedImage(message.image_url)}
                      className="block max-w-full min-w-0 overflow-hidden rounded-2xl"
                    >
                      <Image
                        src={message.image_url}
                        alt={t('chat.imageAlt')}
                        width={240}
                        height={180}
                        className="block h-auto max-w-full rounded-2xl object-cover"
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
                          <p className="mt-2 text-sm font-bold">{t('chat.location')}</p>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs font-bold">
                          <a
                            className="rounded-xl bg-white/15 px-3 py-2"
                            target="_blank"
                            rel="noopener noreferrer"
                            href={`https://www.google.com/maps?q=${message.latitude},${message.longitude}`}
                            onClick={handleExternalMapLink}
                          >
                            {t('chat.googleMaps')}
                          </a>
                          <a
                            className="rounded-xl bg-white/15 px-3 py-2"
                            target="_blank"
                            rel="noopener noreferrer"
                            href={`https://maps.apple.com/?q=${message.latitude},${message.longitude}`}
                            onClick={handleExternalMapLink}
                          >
                            {t('chat.appleMaps')}
                          </a>
                        </div>
                      </div>
                    )}
                </div>
                <time
                  dateTime={message.created_at}
                  className={`mt-2 block text-[11px] ${mine ? 'text-navy-900/60' : 'text-white/45'}`}
                >
                  {formatDate(message.created_at, {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </time>
              </article>
              {!mine && (
                <button
                  type="button"
                  onClick={() => {
                    setMessageToReport(message.id);
                    setShowReportModal(true);
                  }}
                  className="mb-1 shrink-0 rounded-full p-1.5 text-white/30 transition-colors hover:bg-red-500/15 hover:text-red-300"
                  aria-label={t('parking.report')}
                >
                  <Flag className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          );
        })}
        <div ref={endRef} />
      </section>

      {blocked || expired || conversation?.closed ? (
        <div className="animate-fade-up border-t border-red-400/20 bg-red-500/10 px-4 py-5 text-center text-red-100">
          {t(blocked ? 'safety.blockedHint' : 'handoff.closed')}
        </div>
      ) : (
        <footer className="chat-composer safe-bottom sticky bottom-0 border-t border-white/10 bg-navy-900/95 px-3 sm:px-4 py-2.5 sm:py-3 backdrop-blur-xl">
          <div className="mx-auto flex max-w-md md:max-w-xl lg:max-w-2xl items-center gap-1.5 sm:gap-2">
            {nativeRuntime ? (
              <button
                type="button"
                onClick={() => void handleNativeImage('camera')}
                disabled={uploading}
                className="shrink-0 rounded-full bg-white/10 p-2.5 text-white/60 hover:bg-white/15 disabled:opacity-40 sm:p-3"
                aria-label={t('chat.takePhoto')}
              >
                <Camera className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
            ) : (
              <label aria-label={t('chat.takePhoto')} className="cursor-pointer shrink-0 rounded-full bg-white/10 p-2.5 text-white/60 hover:bg-white/15 sm:p-3">
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
            )}
            {nativeRuntime ? (
              <button
                type="button"
                onClick={() => void handleNativeImage('photos')}
                disabled={uploading}
                className="shrink-0 rounded-full bg-white/10 p-2.5 text-white/60 hover:bg-white/15 disabled:opacity-40 sm:p-3"
                aria-label={t('chat.chooseImage')}
              >
                <ImageIcon className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
            ) : (
              <label aria-label={t('chat.chooseImage')} className="cursor-pointer shrink-0 rounded-full bg-white/10 p-2.5 text-white/60 hover:bg-white/15 sm:p-3">
                <ImageIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImage}
                  disabled={uploading}
                />
              </label>
            )}
            <button
              type="button"
              onClick={sendLocation}
              disabled={uploading}
              className="shrink-0 rounded-full bg-white/10 p-2.5 sm:p-3 text-white/60 hover:bg-white/15 disabled:opacity-40"
              aria-label={t('chat.sendLocation')}
            >
              <MapPin className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
            <textarea
              ref={composerRef}
              rows={1}
              value={text}
              onFocus={() => setTyping(true)}
              onBlur={() => setTyping(false)}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={uploading ? t('chat.uploading') : t('chat.typeMessage')}
              aria-label={t('chat.typeMessage')}
              dir="auto"
              disabled={uploading}
              className="min-h-10 max-h-32 min-w-0 flex-1 resize-none overflow-y-auto rounded-3xl border border-white/10 bg-navy-950 px-3.5 py-2.5 text-base leading-6 text-white outline-none placeholder:text-white/40 focus:border-cyan-500 disabled:opacity-50 sm:min-h-11 sm:px-4 sm:py-3 sm:text-sm"
            />
            <button
              type="button"
              onClick={() => void sendText()}
              disabled={!text.trim() || uploading}
              className="shrink-0 rounded-full bg-cyan-500 p-2.5 sm:p-3 text-navy-900 disabled:opacity-40 hover:bg-cyan-400"
              aria-label={t('chat.send')}
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
      
      <KeyboardAssist />
      <AppFooter />
    </main>
  );
}
