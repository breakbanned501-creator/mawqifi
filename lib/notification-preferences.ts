import { getSupabase } from './supabase';

export type SupportedLocale = 'ar' | 'en';

export type NotificationPreferenceValues = {
  locale: SupportedLocale;
  parking_push_enabled: boolean;
  chat_push_enabled: boolean;
  in_app_enabled: boolean;
};

export type NotificationPreferences = NotificationPreferenceValues & {
  user_id: string;
  created_at: string;
  updated_at: string;
};

export type NotificationPreferencesPatch = Partial<NotificationPreferenceValues>;

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferenceValues = {
  locale: 'ar',
  parking_push_enabled: true,
  chat_push_enabled: true,
  in_app_enabled: true,
};

export type NotificationPreferencesErrorCode =
  | 'not_authenticated'
  | 'invalid_preferences'
  | 'preferences_unavailable'
  | 'request_failed';

/**
 * A machine-readable data-layer error. UI code should translate the code rather
 * than show this message directly.
 */
export class NotificationPreferencesError extends Error {
  constructor(
    public readonly code: NotificationPreferencesErrorCode,
    cause?: unknown,
  ) {
    super(`notification-preferences:${code}`);
    this.name = 'NotificationPreferencesError';
    this.cause = cause;
  }
}

type PreferenceRow = {
  user_id: string;
  locale: string;
  parking_push_enabled: boolean;
  chat_push_enabled: boolean;
  in_app_enabled: boolean;
  created_at: string;
  updated_at: string;
};

const PREFERENCE_COLUMNS =
  'user_id, locale, parking_push_enabled, chat_push_enabled, in_app_enabled, created_at, updated_at';

function isSupportedLocale(value: unknown): value is SupportedLocale {
  return value === 'ar' || value === 'en';
}

function normalizePreferenceRow(row: PreferenceRow): NotificationPreferences {
  return {
    user_id: row.user_id,
    locale: isSupportedLocale(row.locale) ? row.locale : DEFAULT_NOTIFICATION_PREFERENCES.locale,
    parking_push_enabled: Boolean(row.parking_push_enabled),
    chat_push_enabled: Boolean(row.chat_push_enabled),
    in_app_enabled: Boolean(row.in_app_enabled),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function isMissingTableError(error: { code?: string; message?: string } | null): boolean {
  const message = error?.message ?? '';

  return (
    error?.code === '42P01' ||
    (/user_notification_preferences/i.test(message) &&
      /does not exist|relation|schema cache|could not find/i.test(message))
  );
}

function toPreferencesError(error: unknown): NotificationPreferencesError {
  if (error instanceof NotificationPreferencesError) return error;

  if (typeof error === 'object' && error !== null && isMissingTableError(error as { code?: string; message?: string })) {
    return new NotificationPreferencesError('preferences_unavailable', error);
  }

  return new NotificationPreferencesError('request_failed', error);
}

async function getAuthenticatedUserId(expectedUserId?: string): Promise<string> {
  const supabase = getSupabase();
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error || !session?.user) {
    throw new NotificationPreferencesError('not_authenticated', error);
  }

  if (expectedUserId && session.user.id !== expectedUserId) {
    throw new NotificationPreferencesError('not_authenticated');
  }

  return session.user.id;
}

function createDefaultPreferences(userId: string): NotificationPreferences {
  const timestamp = new Date().toISOString();

  return {
    user_id: userId,
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    created_at: timestamp,
    updated_at: timestamp,
  };
}

function validatePatch(patch: NotificationPreferencesPatch): void {
  if (patch.locale !== undefined && !isSupportedLocale(patch.locale)) {
    throw new NotificationPreferencesError('invalid_preferences');
  }

  for (const key of ['parking_push_enabled', 'chat_push_enabled', 'in_app_enabled'] as const) {
    if (patch[key] !== undefined && typeof patch[key] !== 'boolean') {
      throw new NotificationPreferencesError('invalid_preferences');
    }
  }
}

/**
 * Reads the current authenticated user's private preferences. A missing row is
 * represented by defaults so callers can render safely before first save.
 */
export async function fetchNotificationPreferences(
  expectedUserId?: string,
): Promise<NotificationPreferences> {
  const userId = await getAuthenticatedUserId(expectedUserId);
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('user_notification_preferences')
    .select(PREFERENCE_COLUMNS)
    .eq('user_id', userId)
    .maybeSingle<PreferenceRow>();

  if (error) throw toPreferencesError(error);
  return data ? normalizePreferenceRow(data) : createDefaultPreferences(userId);
}

/**
 * Creates or updates only the current authenticated user's preferences. The
 * user id always comes from the Supabase session, never from caller input.
 */
export async function upsertNotificationPreferences(
  patch: NotificationPreferencesPatch,
  expectedUserId?: string,
): Promise<NotificationPreferences> {
  validatePatch(patch);

  const userId = await getAuthenticatedUserId(expectedUserId);
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('user_notification_preferences')
    .upsert(
      {
        user_id: userId,
        ...patch,
      },
      { onConflict: 'user_id' },
    )
    .select(PREFERENCE_COLUMNS)
    .single<PreferenceRow>();

  if (error) throw toPreferencesError(error);
  return normalizePreferenceRow(data);
}

/** Ensures a durable preference row exists for the current authenticated user. */
export async function ensureNotificationPreferences(
  expectedUserId?: string,
): Promise<NotificationPreferences> {
  return upsertNotificationPreferences({}, expectedUserId);
}

export async function updateNotificationPreferences(
  patch: NotificationPreferencesPatch,
  expectedUserId?: string,
): Promise<NotificationPreferences> {
  return upsertNotificationPreferences(patch, expectedUserId);
}

export function isNotificationPreferencesError(
  error: unknown,
): error is NotificationPreferencesError {
  return error instanceof NotificationPreferencesError;
}
