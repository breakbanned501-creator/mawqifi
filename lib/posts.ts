import { mockPosts } from './mock';
import type { ParkingPost } from './types';

export const POSTS_STORAGE_KEY = 'mawqifi_supabase_like_posts';

export function getStoredPosts(): ParkingPost[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(POSTS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ParkingPost[]) : [];
  } catch {
    return [];
  }
}

export function saveStoredPosts(posts: ParkingPost[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(POSTS_STORAGE_KEY, JSON.stringify(posts));
}

export function addStoredPost(post: ParkingPost): void {
  saveStoredPosts([post, ...getStoredPosts()]);
}

export function deleteStoredPost(id: string): void {
  saveStoredPosts(getStoredPosts().filter((post) => post.id !== id));
}

export function loadPosts(includeDemo = true): ParkingPost[] {
  const stored = getStoredPosts();
  const source = stored.length > 0 || !includeDemo ? stored : [...mockPosts, ...stored];
  return [...source].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

export function isPostActive(post: ParkingPost): boolean {
  return new Date(post.expires_at).getTime() > Date.now() && post.status === 'active';
}

export function partitionPosts(posts: ParkingPost[]) {
  const active: ParkingPost[] = [];
  const expired: ParkingPost[] = [];
  for (const post of posts) {
    if (isPostActive(post)) active.push(post);
    else expired.push(post);
  }
  return { active, expired };
}
