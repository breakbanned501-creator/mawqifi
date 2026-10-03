import type { ParkingPost } from './types';
let published: { post: ParkingPost; savedAt: number } | null = null;
// Public post metadata only. Exact coordinates never enter this cache or storage.
export function rememberPublishedPost(post: ParkingPost): void { published={post,savedAt:Date.now()}; }
export function takePublishedPost(userId: string | null,placeId: string | null,scope: string | null): ParkingPost | null {
  const saved=published;
  if(!saved || Date.now()-saved.savedAt>30000) {published=null;return null;}
  if(saved.post.user_id!==userId || saved.post.place_id!==placeId || saved.post.sub_place_id!==scope)return null;
  return saved.post;
}
export function clearPublishedPost(userId: string | null,placeId: string | null,scope: string | null): void {
  if(published?.post.user_id===userId && published.post.place_id===placeId && published.post.sub_place_id===scope) published=null;
}
