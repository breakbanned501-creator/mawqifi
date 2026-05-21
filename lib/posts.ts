import { getSupabase } from './supabase';
import type { ParkingPost } from './types';

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
  users: { username: string } | { username: string }[] | null;
};

function mapRow(row: ParkingPostRow): ParkingPost {
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
    created_at: row.created_at,
  };
}

export async function expireStalePosts(): Promise<void> {
  const supabase = getSupabase();
  await supabase.rpc('expire_old_parking_posts');
}

export function getExpiryTimestamp(post: ParkingPost): number {
  return new Date(post.expires_at).getTime();
}

export function getSecondsUntilExpiry(post: ParkingPost): number {
  return Math.max(0, Math.floor((getExpiryTimestamp(post) - Date.now()) / 1000));
}

export function filterActivePosts(posts: ParkingPost[]): ParkingPost[] {
  return posts.filter(isPostActive);
}

export async function fetchParkingPosts(): Promise<ParkingPost[]> {
  const supabase = getSupabase();
  await expireStalePosts();

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('parking_posts')
    .select(
      `
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
      users (username)
    `,
    )
    .eq('status', 'active')
    .gt('expires_at', now)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return filterActivePosts((data as ParkingPostRow[]).map(mapRow));
}

export type CreateParkingPostInput = {
  userId: string;
  college: string;
  zone: 'A' | 'B';
  gate: string;
  carDesc: string | null;
  departureMinutes: number;
  expiresAt: string;
};

export async function createParkingPost(input: CreateParkingPostInput): Promise<ParkingPost> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('parking_posts')
    .insert({
      user_id: input.userId,
      college: input.college,
      zone: input.zone,
      gate: input.gate,
      car_desc: input.carDesc,
      departure_minutes: input.departureMinutes,
      expires_at: input.expiresAt,
      status: 'active',
    })
    .select(
      `
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
      users (username)
    `,
    )
    .single();

  if (error) throw error;
  return mapRow(data as ParkingPostRow);
}

export async function fetchParkingPostById(postId: string): Promise<ParkingPost | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('parking_posts')
    .select(
      `
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
      users (username)
    `,
    )
    .eq('id', postId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return mapRow(data as ParkingPostRow);
}

export async function deleteParkingPost(postId: string, userId: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from('parking_posts').delete().eq('id', postId).eq('user_id', userId);
  if (error) throw error;
}

export function isPostActive(post: ParkingPost): boolean {
  return new Date(post.expires_at).getTime() > Date.now() && post.status === 'active';
}

/** @deprecated Homepage shows active posts only — use filterActivePosts */
export function partitionPosts(posts: ParkingPost[]) {
  const active = filterActivePosts(posts);
  return { active, expired: [] as ParkingPost[] };
}
