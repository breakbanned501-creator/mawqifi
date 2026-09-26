import { getSupabase } from './supabase';
import { getMawqifiCurrentPostHref, getMawqifiPostHref } from './capacitor';

export type AppNotificationKind = 'parking_post' | 'chat_message' | 'system';

export type AppNotificationData = Record<string, unknown>;

export type AppNotification = {
  id: string;
  user_id: string;
  kind: AppNotificationKind;
  post_id: string | null;
  conversation_id: string | null;
  message_id: string | null;
  actor_id: string | null;
  data: AppNotificationData;
  read_at: string | null;
  created_at: string;
  /** Compatibility fields for existing callers while notification UI migrates. */
  read: boolean;
  title: string;
  body: string;
  href?: string;
};

export type NotificationDataErrorCode =
  | 'not_authenticated'
  | 'notifications_unavailable'
  | 'request_failed'
  | 'realtime_unavailable';

/**
 * A machine-readable data-layer error. UI code should translate the code rather
 * than show this message directly.
 */
export class NotificationDataError extends Error {
  constructor(public readonly code: NotificationDataErrorCode, cause?: unknown) {
    super(`app-notifications:${code}`);
    this.name = 'NotificationDataError';
    this.cause = cause;
  }
}

type NotificationRow = Omit<AppNotification, 'read' | 'title' | 'body' | 'href'> & {
  kind: string;
  data: unknown;
};

const NOTIFICATION_COLUMNS =
  'id, user_id, kind, post_id, conversation_id, message_id, actor_id, data, read_at, created_at';

function isNotificationKind(value: unknown): value is AppNotificationKind {
  return value === 'parking_post' || value === 'chat_message' || value === 'system';
}

function isRecord(value: unknown): value is AppNotificationData {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getString(data: AppNotificationData, key: string): string {
  const value = data[key];
  return typeof value === 'string' ? value : '';
}

function getHref(row: NotificationRow, data: AppNotificationData): string | undefined {
  const explicitHref = getString(data, 'href');
  if (explicitHref.startsWith('/')) return getMawqifiCurrentPostHref(explicitHref);
  if (row.post_id && row.conversation_id) {
    return getMawqifiPostHref(row.post_id, row.conversation_id);
  }
  if (row.post_id) return getMawqifiPostHref(row.post_id);
  return undefined;
}

function normalizeNotificationRow(row: NotificationRow): AppNotification {
  const data = isRecord(row.data) ? row.data : {};

  return {
    id: row.id,
    user_id: row.user_id,
    kind: isNotificationKind(row.kind) ? row.kind : 'system',
    post_id: row.post_id,
    conversation_id: row.conversation_id,
    message_id: row.message_id,
    actor_id: row.actor_id,
    data,
    read_at: row.read_at,
    created_at: row.created_at,
    read: Boolean(row.read_at),
    // These optional legacy values are intentionally data-provided. New UI
    // formats semantic notification data through the active locale.
    title: getString(data, 'title'),
    body: getString(data, 'body'),
    href: getHref(row, data),
  };
}

function isMissingTableError(error: { code?: string; message?: string } | null): boolean {
  const message = error?.message ?? '';

  return (
    error?.code === '42P01' ||
    (/app_notifications/i.test(message) &&
      /does not exist|relation|schema cache|could not find/i.test(message))
  );
}

function toNotificationDataError(error: unknown): NotificationDataError {
  if (error instanceof NotificationDataError) return error;

  if (typeof error === 'object' && error !== null && isMissingTableError(error as { code?: string; message?: string })) {
    return new NotificationDataError('notifications_unavailable', error);
  }

  return new NotificationDataError('request_failed', error);
}

async function getAuthenticatedUserId(expectedUserId?: string): Promise<string> {
  const supabase = getSupabase();
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error || !session?.user) {
    throw new NotificationDataError('not_authenticated', error);
  }

  if (expectedUserId && session.user.id !== expectedUserId) {
    throw new NotificationDataError('not_authenticated');
  }

  return session.user.id;
}

/** Fetches only notifications belonging to the current authenticated user. */
export async function fetchNotifications(
  expectedUserId?: string,
  { limit = 100 }: { limit?: number } = {},
): Promise<AppNotification[]> {
  const userId = await getAuthenticatedUserId(expectedUserId);
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('app_notifications')
    .select(NOTIFICATION_COLUMNS)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(Math.max(1, Math.min(limit, 200)));

  if (error) throw toNotificationDataError(error);
  return ((data ?? []) as NotificationRow[]).map(normalizeNotificationRow);
}

export function unreadCount(items: Pick<AppNotification, 'read_at' | 'read'>[]): number {
  return items.filter((item) => !(item.read_at ?? item.read)).length;
}

/** Marks one notification as read, scoped to the active Supabase user. */
export async function markNotificationRead(
  notificationId: string,
  expectedUserId?: string,
): Promise<boolean> {
  const userId = await getAuthenticatedUserId(expectedUserId);
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('app_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .eq('user_id', userId)
    .is('read_at', null)
    .select('id');

  if (error) throw toNotificationDataError(error);
  return (data?.length ?? 0) > 0;
}

/** Marks every unread notification for the active Supabase user as read. */
export async function markAllNotificationsRead(expectedUserId?: string): Promise<number> {
  const userId = await getAuthenticatedUserId(expectedUserId);
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('app_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null)
    .select('id');

  if (error) throw toNotificationDataError(error);
  return data?.length ?? 0;
}

/** Deletes only previously read notifications for the active Supabase user. */
export async function clearReadNotifications(expectedUserId?: string): Promise<number> {
  const userId = await getAuthenticatedUserId(expectedUserId);
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('app_notifications')
    .delete()
    .eq('user_id', userId)
    .not('read_at', 'is', null)
    .select('id');

  if (error) throw toNotificationDataError(error);
  return data?.length ?? 0;
}

export function isNotificationDataError(error: unknown): error is NotificationDataError {
  return error instanceof NotificationDataError;
}
