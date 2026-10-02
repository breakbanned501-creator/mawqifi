import { getSupabase } from './supabase';

export type ReportTarget = 'post' | 'message' | 'user';
/** UX precheck only; the database independently checks its own wall-clock. */
export function canStartConversation(post: { status: string; expires_at: string }, now = Date.now()): boolean {
  return (post.status === 'active' || post.status === 'expired') && new Date(post.expires_at).getTime() > now - 30_000;
}
export function safetyErrorKey(error: unknown): 'safety.rateLimited' | 'safety.invalidText' | 'safety.duplicate' | 'safety.blockedHint' | 'safety.restricted' | 'safety.postExpired' | 'common.error' | 'place.locationRequired' | 'place.locationTooLong' | 'place.unavailable' {
  const message = typeof error === 'object' && error !== null && 'message' in error ? String(error.message) : '';
  if (message.includes('SAFETY_RATE_LIMIT')) return 'safety.rateLimited';
  if (message.includes('PLACE_UNAVAILABLE')) return 'place.unavailable';
  if (message.includes('PLACE_LOCATION_TOO_LONG')) return 'place.locationTooLong';
  if (message.includes('PLACE_')) return 'place.locationRequired';
  if (message.includes('SAFETY_INVALID_TEXT')) return 'safety.invalidText';
  if (message.includes('SAFETY_DUPLICATE')) return 'safety.duplicate';
  if (message.includes('SAFETY_BLOCKED')) return 'safety.blockedHint';
  if (message.includes('SAFETY_RESTRICTED')) return 'safety.restricted';
  if (message.includes('SAFETY_POST_EXPIRED')) return 'safety.postExpired';
  return 'common.error';
}
export async function submitReport(targetType: ReportTarget, targetId: string, reason: string, details: string): Promise<void> {
  const client = getSupabase();
  const { data, error: authError } = await client.auth.getSession();
  if (authError || !data.session) throw new Error('Authentication required');
  const { error } = await client.from('content_reports').insert({
    reporter_id: data.session.user.id, target_type: targetType, target_id: targetId, reason, details: details.trim(),
  });
  // One report per reporter/target is sufficient; retrying is idempotent.
  if (error && error.code !== '23505') throw error;
}

export async function setUserBlocked(targetId: string, blocked: boolean): Promise<void> {
  const client = getSupabase();
  const { data, error: authError } = await client.auth.getSession();
  if (authError || !data.session) throw new Error('Authentication required');
  const query = blocked
    ? client.from('user_blocks').insert({ blocker_id: data.session.user.id, blocked_id: targetId })
    : client.from('user_blocks').delete().eq('blocker_id', data.session.user.id).eq('blocked_id', targetId);
  const { error } = await query;
  if (error && !(blocked && error.code === '23505')) throw error;
}

export async function isUserBlocked(targetId: string): Promise<boolean> {
  const { data, error } = await getSupabase().rpc('is_user_blocked', { target_user: targetId });
  if (error) throw error;
  return data === true;
}

export type BlockedUser = { blocked_id: string; users: { username: string } | { username: string }[] | null };
export async function fetchBlockedUsers(): Promise<BlockedUser[]> {
  const { data, error } = await getSupabase().from('user_blocks').select('blocked_id, users!user_blocks_blocked_id_fkey(username)');
  if (error) throw error;
  return (data ?? []) as BlockedUser[];
}

/** Preserve normal Arabic, URLs and paragraphs; React renders this as escaped text. */
export function validateMessageText(text: string): void {
  if (!text.replace(/[\s\u200B-\u200F\uFEFF]/g, '') || /(.)\1{39,}/u.test(text)) {
    throw new Error('SAFETY_INVALID_TEXT');
  }
}
