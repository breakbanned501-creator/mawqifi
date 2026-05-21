'use client';

import { type ChangeEvent, type KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Camera, ImageIcon, MapPin, Send, X } from 'lucide-react';
import Toast from '@/components/Toast';
import CountdownTimer from '@/components/CountdownTimer';
import { appendLocalMessage, getLocalMessages, saveLocalMessages } from '@/lib/chat';
import { loadPosts } from '@/lib/posts';
import { mockPosts } from '@/lib/mock';
import { formatGate, formatZone } from '@/lib/university';
import { supabase } from '@/lib/supabase';
import type { ChatMessage } from '@/lib/types';

type RealtimeInsertPayload = {
  new: Record<string, unknown>;
};

interface PostChatPageProps {
  params: { id: string };
}

export default function PostChatPage({ params }: PostChatPageProps) {
  const post = useMemo(() => {
    const all = loadPosts();
    return all.find((item) => item.id === params.id) ?? mockPosts.find((item) => item.id === params.id) ?? mockPosts[0];
  }, [params.id]);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [typing, setTyping] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const expired = new Date(post.expires_at).getTime() <= Date.now();

  useEffect(() => {
    if (!supabase) {
      setMessages(getLocalMessages(params.id));
      return;
    }

    const client = supabase;
    const loadMessages = async () => {
      const result = await client
        .from('messages')
        .select('*')
        .eq('conversation_id', params.id)
        .order('created_at', { ascending: true });
      if (result.data?.length) {
        setMessages(result.data as ChatMessage[]);
        saveLocalMessages(params.id, result.data as ChatMessage[]);
      } else {
        setMessages(getLocalMessages(params.id));
      }
    };

    void loadMessages();
    const channel = client
      .channel(`chat:${params.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload: RealtimeInsertPayload) => {
          setMessages((current) => {
            const next = [...current, payload.new as ChatMessage];
            saveLocalMessages(params.id, next);
            return next;
          });
        },
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [params.id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const pushLocalMessage = (message: Omit<ChatMessage, 'id' | 'created_at' | 'conversation_id' | 'sender_id'>) => {
    const full: ChatMessage = {
      id: crypto.randomUUID(),
      conversation_id: params.id,
      sender_id: 'local-user',
      created_at: new Date().toISOString(),
      ...message,
    };
    setMessages(appendLocalMessage(params.id, full));
  };

  const sendMessage = async () => {
    if (!text.trim() || expired) return;
    const value = text.trim();
    setText('');

    if (supabase) {
      await supabase.from('messages').insert({
        conversation_id: params.id,
        type: 'text',
        text: value,
      });
    } else {
      pushLocalMessage({ type: 'text', text: value, image_url: null, latitude: null, longitude: null });
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') void sendMessage();
  };

  const handleImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || expired) return;
    setUploading(true);
    const previewUrl = URL.createObjectURL(file);

    if (supabase) {
      const path = `chat/${params.id}/${Date.now()}-${file.name}`;
      const upload = await supabase.storage.from('chat-images').upload(path, file, { upsert: false });
      const publicUrl = upload.data
        ? supabase.storage.from('chat-images').getPublicUrl(upload.data.path).data.publicUrl
        : previewUrl;
      await supabase.from('messages').insert({
        conversation_id: params.id,
        type: 'image',
        image_url: publicUrl,
      });
    } else {
      pushLocalMessage({ type: 'image', text: null, image_url: previewUrl, latitude: null, longitude: null });
    }

    setToast('تم إرسال الصورة');
    setUploading(false);
    event.target.value = '';
  };

  const sendLocation = () => {
    if (expired || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((position) => {
      const { latitude, longitude } = position.coords;
      if (supabase) {
        void supabase.from('messages').insert({
          conversation_id: params.id,
          type: 'location',
          text: 'موقعي الحالي',
          latitude,
          longitude,
        });
      } else {
        pushLocalMessage({
          type: 'location',
          text: 'موقعي الحالي',
          image_url: null,
          latitude,
          longitude,
        });
      }
      setToast('تم إرسال الموقع');
    });
  };

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
        <div className="mx-auto flex max-w-md items-center gap-3">
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
            {typing && <p className="mt-1 text-xs text-cyan-300 animate-pulse-soft">يكتب الآن...</p>}
          </div>
        </div>
      </header>

      <section className="mx-auto flex w-full max-w-md flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
        {messages.map((message) => {
          const mine = message.sender_id === 'local-user';
          return (
            <div key={message.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
              <div
                className={`max-w-[82%] rounded-3xl px-4 py-3 ${
                  mine
                    ? 'rounded-be-md bg-cyan-500 text-navy-900'
                    : 'rounded-bs-md bg-white/10 text-white'
                }`}
              >
                {message.type === 'text' && <p className="text-sm leading-7">{message.text}</p>}
                {message.type === 'image' && message.image_url && (
                  <button type="button" onClick={() => setSelectedImage(message.image_url)}>
                    <Image
                      src={message.image_url}
                      alt="صورة"
                      width={240}
                      height={180}
                      className="rounded-2xl object-cover"
                      unoptimized
                    />
                  </button>
                )}
                {message.type === 'location' && message.latitude && message.longitude && (
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

      {expired ? (
        <div className="animate-fade-up border-t border-red-400/20 bg-red-500/10 px-4 py-5 text-center text-red-100">
          تم انتهاء الموقف وإغلاق المحادثة
        </div>
      ) : (
        <footer className="safe-bottom border-t border-white/10 bg-navy-900/95 px-4 py-3 backdrop-blur-xl">
          <div className="mx-auto flex max-w-md items-center gap-2">
            <label className="shrink-0 rounded-full bg-white/10 p-3 text-white/60">
              <Camera className="h-5 w-5" />
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImage} />
            </label>
            <label className="shrink-0 rounded-full bg-white/10 p-3 text-white/60">
              <ImageIcon className="h-5 w-5" />
              <input type="file" accept="image/*" className="hidden" onChange={handleImage} />
            </label>
            <button
              type="button"
              onClick={sendLocation}
              className="shrink-0 rounded-full bg-white/10 p-3 text-white/60"
              aria-label="إرسال الموقع"
            >
              <MapPin className="h-5 w-5" />
            </button>
            <input
              value={text}
              onFocus={() => setTyping(true)}
              onBlur={() => setTyping(false)}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={uploading ? 'جاري رفع الصورة...' : 'اكتب رسالة...'}
              className="min-w-0 flex-1 rounded-full border border-white/10 bg-navy-950 px-4 py-3 text-sm text-white outline-none placeholder:text-white/40 focus:border-cyan-500"
            />
            <button
              type="button"
              onClick={() => void sendMessage()}
              disabled={!text.trim()}
              className="shrink-0 rounded-full bg-cyan-500 p-3 text-navy-900 disabled:opacity-40"
              aria-label="إرسال"
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
        </footer>
      )}
    </main>
  );
}
