import { getSupabase } from './supabase';
import { parseBadgeKeys } from './badges';
import type { ParkingPost } from './types';
import { fetchBlockedUsers } from './safety';
import { requiresSubPlace, scopeReady } from './sub-places';

type UserRow = {
  username: string;
  user_badges?: { badge_key: string }[] | null;
};

type ParkingPostRow = {
  id: string;
  user_id: string;
  place_id: string | null;
  sub_place_id: string | null;
  location_description: string | null;
  place?: { name_ar: string; name_en: string } | { name_ar: string; name_en: string }[] | null;
  college: string | null;
  zone: 'A' | 'B' | null;
  gate: string | null;
  car_desc: string | null;
  departure_minutes: number;
  expires_at: string;
  status: 'active' | 'closed' | 'expired' | 'claimed' | 'completed' | 'cancelled';
  created_at: string;
  users: UserRow | UserRow[] | null;
};

function mapRow(row: ParkingPostRow): ParkingPost {
  const user = Array.isArray(row.users) ? row.users[0] : row.users;
  return {
    id: row.id,
    user_id: row.user_id,
    place_id: row.place_id,
    sub_place_id: row.sub_place_id,
    location_description: row.location_description,
    place: Array.isArray(row.place) ? row.place[0] ?? null : row.place ?? null,
    college: row.college,
    zone: row.zone,
    gate: row.gate,
    car_desc: row.car_desc,
    departure_minutes: row.departure_minutes,
    expires_at: row.expires_at,
    status: row.status,
    username: user?.username ?? 'مستخدم',
    badges: parseBadgeKeys(user?.user_badges),
    created_at: row.created_at,
  };
}

export async function expireStalePosts(): Promise<void> {
  const supabase = getSupabase();
  await supabase.rpc('expire_old_parking_posts');
}

export function filterActivePosts(posts: ParkingPost[]): ParkingPost[] {
  return posts.filter(isPostActive);
}

export async function fetchParkingPosts(placeId: string | null, subPlaceId: string | null = null): Promise<ParkingPost[]> {
  const supabase = getSupabase();

  if (!scopeReady(placeId, subPlaceId)) return [];
  const now = new Date().toISOString();
  let query = supabase
    .from('parking_posts')
    .select(
      `
      id,
      user_id,
      place_id,
      sub_place_id,
      location_description,
      place:places(name_ar,name_en),
      college,
      zone,
      gate,
      car_desc,
      departure_minutes,
      expires_at,
      status,
      created_at,
      users (username, user_badges (badge_key))
    `,
    )
    .eq('place_id', placeId)
    .eq('status', 'active')
    .gt('expires_at', now)
    .order('created_at', { ascending: false });
  if (requiresSubPlace(placeId)) query = query.eq('sub_place_id', subPlaceId!);
  const [{ data, error }, blockRows] = await Promise.all([query, fetchBlockedUsers()]);

  if (error) throw error;
  const blocked = new Set(blockRows.map(row => row.blocked_id));
  return filterActivePosts((data as ParkingPostRow[]).map(mapRow)).filter(post => !blocked.has(post.user_id));
}

export type CreateParkingPostInput = {
  userId: string;
  placeId: string;
  locationDescription: string | null;
  college: string | null;
  zone: 'A' | 'B' | null;
  gate: string | null;
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
      place_id: input.placeId,
      location_description: input.locationDescription,
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
      place_id,
      sub_place_id,
      location_description,
      place:places(name_ar,name_en),
      college,
      zone,
      gate,
      car_desc,
      departure_minutes,
      expires_at,
      status,
      created_at,
      users (username, user_badges (badge_key))
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
      place_id,
      sub_place_id,
      location_description,
      place:places(name_ar,name_en),
      college,
      zone,
      gate,
      car_desc,
      departure_minutes,
      expires_at,
      status,
      created_at,
      users (username, user_badges (badge_key))
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
  const { error } = await supabase.from('parking_posts').update({ status: 'cancelled' }).eq('id', postId).eq('user_id', userId);
  if (error) throw error;
}

export function isPostActive(post: ParkingPost): boolean {
  return new Date(post.expires_at).getTime() > Date.now() && post.status === 'active';
}
