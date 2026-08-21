import 'server-only';

import webPush from 'web-push';
import type { Locale } from '@/lib/i18n';
import { getSupabaseServiceRole } from '@/lib/supabase-server';

type StoredSubscription = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

type StoredNotificationPreferences = {
  user_id: string;
  locale: Locale;
  parking_push_enabled: boolean;
  chat_push_enabled: boolean;
};

export type PushNotificationType = 'parking_post' | 'chat_message';

export type PushNotificationPayload = {
  title: string;
  body: string;
  url: string;
  lang: Locale;
  dir: 'rtl' | 'ltr';
  postId?: string;
  type: PushNotificationType;
  chatId?: string;
  messageId?: string;
};

export type PushDeliveryOptions = {
  /**
   * Device notifications are built on the server from the recipient's private
   * language preference. User-generated text stays unchanged; only Mawqifi's
   * surrounding copy is localized.
   */
  payloadForLocale: (locale: Locale) => PushNotificationPayload;
  notificationType: PushNotificationType;
  recipientUserId?: string;
  excludeUserId?: string;
};

export type PushDeliveryResult = {
  subscriptionCount: number;
  sentCount: number;
  staleCount: number;
};

export class PushConfigurationError extends Error {
  constructor() {
    super('VAPID environment variables are incomplete.');
    this.name = 'PushConfigurationError';
  }
}

/**
 * Configures the single web-push sender shared by parking and chat notifications.
 * This module is server-only so the private VAPID key never reaches the browser.
 */
export function configureWebPush(): void {
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT;

  if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
    throw new PushConfigurationError();
  }

  webPush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

function getPushStatusCode(error: unknown): number | null {
  if (!error || typeof error !== 'object') return null;
  const statusCode = (error as { statusCode?: unknown }).statusCode;
  return typeof statusCode === 'number' ? statusCode : null;
}

/**
 * Sends one payload through the existing subscription store. A caller may target
 * one recipient (chat) or exclude a sender (parking). Expired browser endpoints
 * are deactivated so future sends do not repeatedly fail.
 */
export async function deliverPushNotifications({
  payloadForLocale,
  notificationType,
  recipientUserId,
  excludeUserId,
}: PushDeliveryOptions): Promise<PushDeliveryResult> {
  configureWebPush();

  const supabase = getSupabaseServiceRole();
  let subscriptionsQuery = supabase
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth')
    .eq('active', true);

  if (recipientUserId) {
    subscriptionsQuery = subscriptionsQuery.eq('user_id', recipientUserId);
  }
  if (excludeUserId) {
    subscriptionsQuery = subscriptionsQuery.neq('user_id', excludeUserId);
  }

  const { data: subscriptions, error: subscriptionsError } = await subscriptionsQuery;
  if (subscriptionsError) throw subscriptionsError;

  const activeSubscriptions = (subscriptions ?? []) as StoredSubscription[];
  const userIds = [...new Set(activeSubscriptions.map((subscription) => subscription.user_id))];
  const preferencesByUser = new Map<string, StoredNotificationPreferences>();

  if (userIds.length) {
    const { data: preferences, error: preferencesError } = await supabase
      .from('user_notification_preferences')
      .select('user_id, locale, parking_push_enabled, chat_push_enabled')
      .in('user_id', userIds);
    if (preferencesError) throw preferencesError;

    for (const preference of (preferences ?? []) as StoredNotificationPreferences[]) {
      preferencesByUser.set(preference.user_id, preference);
    }
  }

  const isAllowedForType = (preference: StoredNotificationPreferences | undefined) => {
    if (!preference) return true;
    return notificationType === 'parking_post'
      ? preference.parking_push_enabled
      : preference.chat_push_enabled;
  };

  const eligibleSubscriptions = activeSubscriptions.filter((subscription) =>
    isAllowedForType(preferencesByUser.get(subscription.user_id)),
  );
  const serializedPayloads = new Map<Locale, string>();
  const payloadForSubscription = (subscription: StoredSubscription) => {
    const locale = preferencesByUser.get(subscription.user_id)?.locale === 'en' ? 'en' : 'ar';
    const existingPayload = serializedPayloads.get(locale);
    if (existingPayload) return existingPayload;

    const payload = JSON.stringify(payloadForLocale(locale));
    serializedPayloads.set(locale, payload);
    return payload;
  };

  const deliveries = await Promise.all(
    eligibleSubscriptions.map(async (subscription) => {
      try {
        await webPush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          payloadForSubscription(subscription),
        );
        return { sent: true, staleSubscriptionId: null as string | null };
      } catch (error) {
        const statusCode = getPushStatusCode(error);
        console.warn('Web push delivery failed.', {
          notificationType,
          statusCode,
        });
        return {
          sent: false,
          staleSubscriptionId: statusCode === 404 || statusCode === 410 ? subscription.id : null,
        };
      }
    }),
  );

  const staleSubscriptionIds = deliveries.flatMap(({ staleSubscriptionId }) =>
    staleSubscriptionId ? [staleSubscriptionId] : [],
  );
  if (staleSubscriptionIds.length) {
    const { error: deactivateError } = await supabase
      .from('push_subscriptions')
      .update({ active: false })
      .in('id', staleSubscriptionIds);
    if (deactivateError) {
      console.error('Unable to deactivate stale push subscriptions.', {
        notificationType,
        staleCount: staleSubscriptionIds.length,
      });
    }
  }

  const sentCount = deliveries.filter(({ sent }) => sent).length;
  console.info('Web push delivery completed.', {
    notificationType,
    subscriptionCount: activeSubscriptions.length,
    eligibleSubscriptionCount: eligibleSubscriptions.length,
    sentCount,
    staleCount: staleSubscriptionIds.length,
  });

  return {
    subscriptionCount: activeSubscriptions.length,
    sentCount,
    staleCount: staleSubscriptionIds.length,
  };
}
