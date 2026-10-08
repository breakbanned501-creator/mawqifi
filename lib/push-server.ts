import 'server-only';

import webPush from 'web-push';
import type { Locale } from '@/lib/i18n';
import { getSupabaseServiceRole } from '@/lib/supabase-server';
import { blockedRecipientIds } from '@/lib/push-safety';
import { getApnsConfiguration, sendApnsNotification } from '@/lib/apns-server';

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

type StoredNativeToken = { id: string; user_id: string; device_token: string };

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
  nativeTokenCount: number;
  nativeSentCount: number;
};

export class PushConfigurationError extends Error {
  constructor() {
    super('Push delivery environment variables are incomplete.');
    this.name = 'PushConfigurationError';
  }
}

export function configurePushDelivery(): void {
  configureWebPush();
  if (!getApnsConfiguration()) throw new PushConfigurationError();
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
  let nativeTokensQuery = supabase
    .from('native_push_tokens')
    .select('id, user_id, device_token')
    .eq('platform', 'ios')
    .eq('enabled', true);
  if (recipientUserId) nativeTokensQuery = nativeTokensQuery.eq('user_id', recipientUserId);
  if (excludeUserId) nativeTokensQuery = nativeTokensQuery.neq('user_id', excludeUserId);
  const { data: rawNativeTokens, error: nativeTokensError } = await nativeTokensQuery;
  if (nativeTokensError) throw nativeTokensError;
  const nativeTokens = (rawNativeTokens ?? []) as StoredNativeToken[];
  let blockedRecipients = new Set<string>();
  if (excludeUserId) {
    const { data: blocks, error: blockError } = await supabase.from('user_blocks')
      .select('blocker_id, blocked_id').or(`blocker_id.eq.${excludeUserId},blocked_id.eq.${excludeUserId}`);
    if (blockError) throw blockError;
    blockedRecipients = blockedRecipientIds(excludeUserId, blocks ?? []);
  }
  const userIds = [...new Set([...activeSubscriptions, ...nativeTokens].map((subscription) => subscription.user_id))];
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
    !blockedRecipients.has(subscription.user_id) && isAllowedForType(preferencesByUser.get(subscription.user_id)),
  );
  const eligibleNativeTokens = nativeTokens.filter((token) =>
    !blockedRecipients.has(token.user_id) && isAllowedForType(preferencesByUser.get(token.user_id)),
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

  const apnsConfiguration = getApnsConfiguration();
  const nativeDeliveries = apnsConfiguration
    ? await Promise.all(eligibleNativeTokens.map(async (token) => {
        const locale = preferencesByUser.get(token.user_id)?.locale === 'en' ? 'en' : 'ar';
        try {
          const result = await sendApnsNotification(apnsConfiguration, token.device_token, payloadForLocale(locale));
          if (!result.accepted) console.warn('APNs delivery rejected.', { notificationType, status: result.status, reason: result.reason });
          return { sent: result.accepted, staleTokenId: result.stale ? token.id : null };
        } catch (error) {
          console.warn('APNs delivery failed.', { notificationType, errorName: error instanceof Error ? error.name : 'unknown' });
          return { sent: false, staleTokenId: null };
        }
      }))
    : [];
  const staleNativeTokenIds = nativeDeliveries.flatMap(({ staleTokenId }) => staleTokenId ? [staleTokenId] : []);
  if (staleNativeTokenIds.length) {
    const { error } = await supabase.from('native_push_tokens').update({ enabled: false }).in('id', staleNativeTokenIds);
    if (error) console.error('Unable to deactivate stale native push tokens.', { notificationType, staleCount: staleNativeTokenIds.length });
  }
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

  const webSentCount = deliveries.filter(({ sent }) => sent).length;
  const nativeSentCount = nativeDeliveries.filter(({ sent }) => sent).length;
  console.info('Web push delivery completed.', {
    notificationType,
    subscriptionCount: activeSubscriptions.length,
    eligibleSubscriptionCount: eligibleSubscriptions.length,
    sentCount: webSentCount,
    nativeSentCount,
    staleCount: staleSubscriptionIds.length,
  });

  return {
    subscriptionCount: activeSubscriptions.length,
    sentCount: webSentCount + nativeSentCount,
    staleCount: staleSubscriptionIds.length + staleNativeTokenIds.length,
    nativeTokenCount: nativeTokens.length,
    nativeSentCount,
  };
}
