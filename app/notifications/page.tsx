'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Award, Bell, Car, MessageCircle, Trash2 } from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import ErrorBanner from '@/components/ErrorBanner';
import LoadingScreen from '@/components/LoadingScreen';
import PageHeader from '@/components/PageHeader';
import PushNotificationControl from '@/components/PushNotificationControl';
import { useLocale } from '@/components/LocaleProvider';
import { useNotifications } from '@/components/NotificationProvider';
import { formatGate, formatZone, getCollegeName } from '@/lib/university';
import type { AppNotification } from '@/lib/notifications';
import { getMawqifiCurrentPostHref, getMawqifiPostHref } from '@/lib/capacitor';

function dataString(data: Record<string, unknown>, key: string): string {
  const value = data[key];
  return typeof value === 'string' ? value : '';
}

function notificationHref(item: AppNotification): string {
  if (item.href) return getMawqifiCurrentPostHref(item.href);
  if (item.post_id && item.conversation_id) {
    return getMawqifiPostHref(item.post_id, item.conversation_id);
  }
  return item.post_id ? getMawqifiPostHref(item.post_id) : '/';
}

export default function NotificationsPage() {
  const { locale, formatDate, t } = useLocale();
  const {
    items,
    unreadCount,
    isLoading,
    error,
    refresh,
    markRead,
    markAllRead,
    clearRead,
  } = useNotifications();

  const presentedItems = useMemo(() => items.map((item) => {
    const data = item.data;
    if (item.kind === 'parking_post') {
      const zone = dataString(data, 'zone');
      const gate = dataString(data, 'gate');
      const location = [
        getCollegeName(dataString(data, 'college'), locale),
        zone === 'A' || zone === 'B' ? formatZone(zone, locale) : '',
        gate ? formatGate(gate, locale) : '',
      ].filter(Boolean).join(' — ');

      return {
        ...item,
        title: t('notifications.newParking'),
        body: t('notifications.parkingBody', { location }),
        href: notificationHref(item),
        Icon: Car,
      };
    }

    if (item.kind === 'chat_message') {
      const sender = dataString(data, 'sender_name') || t('auth.guest');
      const preview = dataString(data, 'preview');
      const messageType = dataString(data, 'message_type');
      const body = preview
        ? `${sender}: ${preview}`
        : messageType === 'image'
          ? t('notifications.imageMessage')
          : messageType === 'location'
            ? t('notifications.locationMessage')
            : t('notifications.messageFallback', { sender });

      return {
        ...item,
        title: t('notifications.newMessage'),
        body,
        href: notificationHref(item),
        Icon: MessageCircle,
      };
    }

    if (dataString(data, 'event_key') === 'top_parking_contributor_award') {
      return {
        ...item,
        title: t('notifications.topParkingContributorTitle'),
        body: t('notifications.topParkingContributorBody'),
        href: notificationHref(item),
        Icon: Award,
      };
    }

    return {
      ...item,
      title: dataString(data, 'title') || t('notifications.system'),
      body: dataString(data, 'body') || t('notifications.emptyBody'),
      href: notificationHref(item),
      Icon: Bell,
    };
  }), [items, locale, t]);

  if (isLoading && items.length === 0) return <LoadingScreen message={t('common.loading')} />;

  return (
    <main className="page-with-chrome min-h-screen px-4 pt-6">
      <div className="mx-auto max-w-md space-y-5 md:max-w-xl lg:max-w-2xl">
        <PageHeader
          title={t('notifications.title')}
          subtitle={unreadCount > 0 ? t('notifications.unreadCount', { count: unreadCount }) : t('notifications.allCaughtUp')}
          backHref="/"
          action={items.length > 0 ? (
            <button
              type="button"
              onClick={() => void markAllRead()}
              disabled={unreadCount === 0}
              className="rounded-xl px-3 py-2 text-xs font-bold text-cyan-200 transition-colors hover:bg-cyan-500/10 disabled:opacity-40"
            >
              {t('common.markAllRead')}
            </button>
          ) : undefined}
        />

        <PushNotificationControl />

        {error && <ErrorBanner message={t('notifications.loadError')} onRetry={() => void refresh()} />}

        {presentedItems.length === 0 ? (
          <div className="glass-card py-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-cyan-500/10">
              <Bell className="h-8 w-8 text-cyan-300" />
            </div>
            <h3 className="mb-2 text-lg font-extrabold text-white">{t('notifications.emptyTitle')}</h3>
            <p className="text-sm leading-6 text-white/60">{t('notifications.emptyBody')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {presentedItems.map((item) => {
              const Icon = item.Icon;
              const isRead = Boolean(item.read_at);
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={() => {
                    if (!isRead) void markRead(item.id);
                  }}
                  className={`block glass-card p-4 transition-colors hover:border-cyan-400/35 ${
                    isRead ? 'border-white/10 opacity-80' : 'border-cyan-400/25'
                  }`}
                >
                  <article className="flex gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-cyan-500/15 text-cyan-300">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h2 className="font-extrabold text-white">{item.title}</h2>
                        {!isRead && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-cyan-400" aria-label={t('notifications.unreadCount', { count: 1 })} />}
                      </div>
                      <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-white/65" dir="auto">{item.body}</p>
                      <p className="mt-2 text-xs text-white/40">
                        {formatDate(item.created_at, {
                          hour: '2-digit',
                          minute: '2-digit',
                          day: 'numeric',
                          month: 'short',
                        })}
                      </p>
                    </div>
                  </article>
                </Link>
              );
            })}
            {items.some((item) => item.read_at) && (
              <button
                type="button"
                onClick={() => void clearRead()}
                className="mx-auto flex items-center gap-2 px-3 py-2 text-xs font-bold text-white/50 transition-colors hover:text-red-200"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {t('notifications.clearRead')}
              </button>
            )}
          </div>
        )}
      </div>
      <BottomNav />
    </main>
  );
}
