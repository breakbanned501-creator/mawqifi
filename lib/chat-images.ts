import { getSupabase } from './supabase';

const BUCKET = 'chat-images';

/** Retain old message records; only resolve this project's conversation-scoped objects. */
export function chatImagePath(reference: string, conversationId: string): string {
  const url = new URL(reference);
  const origin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').origin;
  if (url.origin !== origin || url.search || url.hash) throw new Error('Invalid chat image');
  const prefix = /^\/storage\/v1\/object\/(?:public|authenticated)\/chat-images\//;
  if (!prefix.test(url.pathname)) throw new Error('Invalid chat image');
  const path = decodeURIComponent(url.pathname.replace(prefix, ''));
  if (!path.startsWith(`chat/${conversationId}/`) || path.split('/').length !== 3 || /(?:^|\/)\.\.?($|\/)/.test(path)) {
    throw new Error('Invalid chat image');
  }
  return path;
}

export function authenticatedChatImageReference(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/authenticated/${BUCKET}/${path}`;
}

/** Authenticated download, never a bearer-less public/signed URL. Blob stays in memory. */
export async function downloadChatImage(reference: string, conversationId: string): Promise<Blob> {
  const path = chatImagePath(reference, conversationId);
  const { data, error } = await getSupabase().storage.from(BUCKET).download(path);
  if (error || !data) throw error ?? new Error('Image unavailable');
  return data;
}
