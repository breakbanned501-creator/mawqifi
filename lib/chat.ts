import { getSupabase } from './supabase';
import type { ChatMessage } from './types';

export async function fetchMessages(conversationId: string): Promise<ChatMessage[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as ChatMessage[];
}

export type SendMessageInput = {
  conversationId: string;
  senderId: string;
  type: 'text' | 'image' | 'location';
  text?: string | null;
  imageUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

export async function sendMessage(input: SendMessageInput): Promise<ChatMessage> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: input.conversationId,
      sender_id: input.senderId,
      type: input.type,
      text: input.text ?? null,
      image_url: input.imageUrl ?? null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as ChatMessage;
}

export async function uploadChatImage(
  conversationId: string,
  userId: string,
  file: File,
): Promise<string> {
  const supabase = getSupabase();
  const safeName = file.name.replace(/[^\w.\-]+/g, '_');
  const path = `chat/${conversationId}/${userId}-${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage.from('chat-images').upload(path, file, {
    upsert: false,
    contentType: file.type,
  });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from('chat-images').getPublicUrl(path);
  return data.publicUrl;
}
