import { getSupabase } from './supabase';
import { fetchMawqifiServerApi } from './server-api';
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

/**
 * Ask the server to deliver a push notification for a message that has already
 * been stored. The API resolves the recipient from the authenticated sender
 * and the saved message, so the client never supplies a user id.
 */
async function requestChatMessagePush(messageId: string): Promise<void> {
  const supabase = getSupabase();

  const getAccessToken = async (refresh = false): Promise<string | null> => {
    const result = refresh ? await supabase.auth.refreshSession() : await supabase.auth.getSession();
    return result.data.session?.access_token ?? null;
  };

  const send = (accessToken: string) =>
    fetchMawqifiServerApi('/api/push/notify-chat-message', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ messageId }),
    });

  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      console.warn('[chat-push] dispatch skipped: no authenticated session');
      return;
    }

    let response = await send(accessToken);
    if (response.status === 401) {
      const refreshedAccessToken = await getAccessToken(true);
      if (!refreshedAccessToken) {
        console.warn('[chat-push] dispatch skipped: session refresh unavailable');
        return;
      }
      response = await send(refreshedAccessToken);
    }

    if (!response.ok) {
      console.warn('[chat-push] dispatch request was not accepted', { status: response.status });
    }
  } catch {
    // Delivery must never make an already-saved chat message appear to fail.
    console.warn('[chat-push] dispatch request failed');
  }
}

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
  const message = data as ChatMessage;

  // The message is durable before dispatch is attempted. Await the internally
  // handled request so navigation immediately after sending cannot discard the
  // one notification attempt. Delivery failures still never make the saved
  // chat message appear to fail.
  await requestChatMessagePush(message.id);

  return message;
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
