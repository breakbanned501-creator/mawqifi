import 'server-only';

import webPush from 'web-push';
import { getSupabaseServiceRole } from '@/lib/supabase-server';

type StoredSubscription = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type PushNotificationPayload = {
  title: string;
  body: string;
  url: string;
  postId?: string;
  type?: 'parking_post' | 'chat_message';
  chatId?: string;
  messageId?: string;
};

export type PushDeliveryOptions = {
  payload: PushNotificationPayload;
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
  payload,
  recipientUserId,
  excludeUserId,
}: PushDeliveryOptions): Promise<PushDeliveryResult> {
  configureWebPush();

  const supabase = getSupabaseServiceRole();
  let subscriptionsQuery = supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
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
  const serializedPayload = JSON.stringify(payload);
  const deliveries = await Promise.all(
    activeSubscriptions.map(async (subscription) => {
      try {
        await webPush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          serializedPayload,
        );
        return { sent: true, staleSubscriptionId: null as string | null };
      } catch (error) {
        const statusCode = getPushStatusCode(error);
        console.warn('Web push delivery failed.', {
          notificationType: payload.type ?? 'parking_post',
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
        notificationType: payload.type ?? 'parking_post',
        staleCount: staleSubscriptionIds.length,
      });
    }
  }

  const sentCount = deliveries.filter(({ sent }) => sent).length;
  console.info('Web push delivery completed.', {
    notificationType: payload.type ?? 'parking_post',
    subscriptionCount: activeSubscriptions.length,
    sentCount,
    staleCount: staleSubscriptionIds.length,
  });

  return {
    subscriptionCount: activeSubscriptions.length,
    sentCount,
    staleCount: staleSubscriptionIds.length,
  };
}
