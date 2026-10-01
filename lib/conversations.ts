import { getSupabase } from './supabase';
import { parseBadgeKeys } from './badges';
import type { Conversation, ParkingPost } from './types';
import { fetchParkingPostById, isPostActive } from './posts';
import { canStartConversation } from './safety';

type ConversationRow = {
  id: string;
  post_id: string;
  owner_id: string;
  requester_id: string;
  closed: boolean;
  owner_last_read_at: string;
  requester_last_read_at: string;
  last_message_text: string | null;
  last_message_at: string | null;
  updated_at: string;
  parking_posts: ParkingPostRow | ParkingPostRow[] | null;
};

type UserRow = {
  username: string;
  user_badges?: { badge_key: string }[] | null;
};

type ParkingPostRow = {
  id: string;
  user_id: string;
  college: string;
  zone: 'A' | 'B';
  gate: string;
  car_desc: string | null;
  departure_minutes: number;
  expires_at: string;
  status: 'active' | 'expired' | 'closed';
  created_at: string;
  users: UserRow | UserRow[] | null;
};

function mapPost(row: ParkingPostRow): ParkingPost {
  const user = Array.isArray(row.users) ? row.users[0] : row.users;
  return {
    id: row.id,
    user_id: row.user_id,
    college: row.college,
    zone: row.zone,
    gate: row.gate,
    car_desc: row.car_desc,
    departure_minutes: row.departure_minutes,
    expires_at: row.expires_at,
    status: row.status,
    username: user?.username ?? 'طالب',
    badges: parseBadgeKeys(user?.user_badges),
    created_at: row.created_at,
  };
}

function mapConversation(row: ConversationRow, currentUserId: string): Conversation {
  const postRaw = Array.isArray(row.parking_posts) ? row.parking_posts[0] : row.parking_posts;
  const isOwner = row.owner_id === currentUserId;
  const lastRead = isOwner ? row.owner_last_read_at : row.requester_last_read_at;
  const unread =
    row.last_message_at && new Date(row.last_message_at) > new Date(lastRead) && row.last_message_at
      ? 1
      : 0;

  return {
    id: row.id,
    post_id: row.post_id,
    owner_id: row.owner_id,
    requester_id: row.requester_id,
    closed: row.closed || (postRaw ? !isPostActive(mapPost(postRaw)) : false),
    unread_count: unread,
    last_message: row.last_message_text,
    updated_at: row.updated_at,
    post: postRaw ? mapPost(postRaw) : undefined,
  };
}

export async function fetchConversations(userId: string): Promise<Conversation[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('conversations')
    .select(
      `
      id,
      post_id,
      owner_id,
      requester_id,
      closed,
      owner_last_read_at,
      requester_last_read_at,
      last_message_text,
      last_message_at,
      updated_at,
      parking_posts (
        id,
        user_id,
        college,
        zone,
        gate,
        car_desc,
        departure_minutes,
        expires_at,
        status,
        created_at,
        users (username, user_badges (badge_key))
      )
    `,
    )
    .or(`owner_id.eq.${userId},requester_id.eq.${userId}`)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return (data as ConversationRow[]).map((row) => mapConversation(row, userId));
}

export async function getOrCreateConversation(
  postId: string,
  requesterId: string,
): Promise<{ conversation: Conversation; post: ParkingPost }> {
  const post = await fetchParkingPostById(postId);
  if (!post) throw new Error('الموقف غير موجود');
  if (post.user_id === requesterId) {
    throw new Error('لا يمكنك بدء محادثة على موقفك الخاص');
  }
  if (!canStartConversation(post)) {
    throw new Error('SAFETY_POST_EXPIRED');
  }

  const supabase = getSupabase();
  const { data: existing, error: findError } = await supabase
    .from('conversations')
    .select('id')
    .eq('post_id', postId)
    .eq('requester_id', requesterId)
    .maybeSingle();

  if (findError) throw findError;

  if (!existing) {
    const { error: insertError } = await supabase.from('conversations').insert({
      post_id: postId,
      owner_id: post.user_id,
      requester_id: requesterId,
    });
    if (insertError) throw insertError;
  }

  const { data, error } = await supabase
    .from('conversations')
    .select(
      `
      id,
      post_id,
      owner_id,
      requester_id,
      closed,
      owner_last_read_at,
      requester_last_read_at,
      last_message_text,
      last_message_at,
      updated_at,
      parking_posts (
        id,
        user_id,
        college,
        zone,
        gate,
        car_desc,
        departure_minutes,
        expires_at,
        status,
        created_at,
        users (username, user_badges (badge_key))
      )
    `,
    )
    .eq('post_id', postId)
    .eq('requester_id', requesterId)
    .single();

  if (error) throw error;
  return {
    conversation: mapConversation(data as ConversationRow, requesterId),
    post,
  };
}

export async function markConversationRead(conversationId: string, userId: string): Promise<void> {
  const supabase = getSupabase();
  const { data: conv, error: fetchError } = await supabase
    .from('conversations')
    .select('owner_id, requester_id')
    .eq('id', conversationId)
    .single();

  if (fetchError) throw fetchError;

  const patch =
    conv.owner_id === userId
      ? { owner_last_read_at: new Date().toISOString() }
      : { requester_last_read_at: new Date().toISOString() };

  const { error } = await supabase.from('conversations').update(patch).eq('id', conversationId);
  if (error) throw error;
}

export async function fetchConversationByPostForUser(
  postId: string,
  userId: string,
): Promise<Conversation | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('conversations')
    .select(
      `
      id,
      post_id,
      owner_id,
      requester_id,
      closed,
      owner_last_read_at,
      requester_last_read_at,
      last_message_text,
      last_message_at,
      updated_at,
      parking_posts (
        id,
        user_id,
        college,
        zone,
        gate,
        car_desc,
        departure_minutes,
        expires_at,
        status,
        created_at,
        users (username, user_badges (badge_key))
      )
    `,
    )
    .eq('post_id', postId)
    .or(`owner_id.eq.${userId},requester_id.eq.${userId}`)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return mapConversation(data as ConversationRow, userId);
}

/**
 * Loads one specific conversation only when the current user is one of its
 * participants. This is used by notification links so an owner with several
 * conversations on the same parking post opens the intended chat.
 */
export async function fetchConversationByIdForUser(
  conversationId: string,
  userId: string,
): Promise<Conversation | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('conversations')
    .select(
      `
      id,
      post_id,
      owner_id,
      requester_id,
      closed,
      owner_last_read_at,
      requester_last_read_at,
      last_message_text,
      last_message_at,
      updated_at,
      parking_posts (
        id,
        user_id,
        college,
        zone,
        gate,
        car_desc,
        departure_minutes,
        expires_at,
        status,
        created_at,
        users (username, user_badges (badge_key))
      )
    `,
    )
    .eq('id', conversationId)
    .or(`owner_id.eq.${userId},requester_id.eq.${userId}`)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return mapConversation(data as ConversationRow, userId);
}
