import { NextResponse } from 'next/server';
import {
  configureWebPush,
  deliverPushNotifications,
  PushConfigurationError,
} from '@/lib/push-server';
import { getRequestUser, getSupabaseServiceRole } from '@/lib/supabase-server';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_NOTIFICATION_PREVIEW_LENGTH = 120;

type StoredMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  type: 'text' | 'image' | 'location';
  text: string | null;
};

type StoredConversation = {
  id: string;
  post_id: string;
  owner_id: string;
  requester_id: string;
};

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

function compactPreview(text: string): string {
  const compacted = text.replace(/\s+/g, ' ').trim();
  if (compacted.length <= MAX_NOTIFICATION_PREVIEW_LENGTH) return compacted;
  return `${compacted.slice(0, MAX_NOTIFICATION_PREVIEW_LENGTH - 1).trimEnd()}…`;
}

function getNotificationBody(message: StoredMessage, senderName: string): string {
  const preview = message.text ? compactPreview(message.text) : '';
  if (preview) return `${senderName}: ${preview}`;
  if (message.type === 'image') return 'أرسل لك صورة 📷';
  if (message.type === 'location') return 'أرسل لك موقعًا 📍';
  return `${senderName}: أرسل لك رسالة جديدة`;
}

export async function POST(request: Request) {
  try {
    const user = await getRequestUser(request);
    if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول لإرسال تنبيه الرسالة.' }, { status: 401 });

    const { messageId } = (await request.json()) as { messageId?: unknown };
    if (!isUuid(messageId)) {
      return NextResponse.json({ error: 'معرّف الرسالة غير صالح.' }, { status: 400 });
    }

    const supabase = getSupabaseServiceRole();
    const { data: rawMessage, error: messageError } = await supabase
      .from('messages')
      .select('id, conversation_id, sender_id, type, text')
      .eq('id', messageId)
      .maybeSingle();
    if (messageError) throw messageError;
    if (!rawMessage) return NextResponse.json({ error: 'الرسالة غير موجودة.' }, { status: 404 });

    const message = rawMessage as StoredMessage;
    if (message.sender_id !== user.id) {
      return NextResponse.json({ error: 'غير مصرح بإرسال هذا التنبيه.' }, { status: 403 });
    }

    const { data: rawConversation, error: conversationError } = await supabase
      .from('conversations')
      .select('id, post_id, owner_id, requester_id')
      .eq('id', message.conversation_id)
      .maybeSingle();
    if (conversationError) throw conversationError;
    if (!rawConversation) return NextResponse.json({ error: 'المحادثة غير موجودة.' }, { status: 404 });

    const conversation = rawConversation as StoredConversation;
    const recipientId =
      conversation.owner_id === user.id
        ? conversation.requester_id
        : conversation.requester_id === user.id
          ? conversation.owner_id
          : null;
    if (!recipientId || recipientId === user.id) {
      return NextResponse.json({ error: 'غير مصرح بإرسال هذا التنبيه.' }, { status: 403 });
    }

    const { data: sender, error: senderError } = await supabase
      .from('users')
      .select('username')
      .eq('id', user.id)
      .maybeSingle();
    if (senderError) throw senderError;

    // Validate configuration before claiming an event, so a transient missing
    // deployment setting does not permanently suppress this message notification.
    configureWebPush();

    const { error: eventError } = await supabase.from('push_notification_events').insert({
      message_id: message.id,
      creator_id: user.id,
      recipient_id: recipientId,
    });
    if (eventError?.code === '23505') {
      return NextResponse.json({ success: true, duplicate: true, sentCount: 0 });
    }
    if (eventError) throw eventError;

    const delivery = await deliverPushNotifications({
      recipientUserId: recipientId,
      payload: {
        title: 'رسالة جديدة 💬',
        body: getNotificationBody(message, sender?.username?.trim() || 'طالب'),
        type: 'chat_message',
        chatId: conversation.id,
        messageId: message.id,
        postId: conversation.post_id,
        url: `/post/${encodeURIComponent(conversation.post_id)}?chat=${encodeURIComponent(conversation.id)}`,
      },
    });

    return NextResponse.json({ success: true, sentCount: delivery.sentCount });
  } catch (error) {
    if (error instanceof PushConfigurationError) {
      console.error('Push notification configuration is incomplete.');
      return NextResponse.json({ success: false, warning: 'إعداد الإشعارات غير مكتمل.' }, { status: 503 });
    }
    console.error('Error sending chat push notification.');
    return NextResponse.json({ error: 'تعذر إرسال إشعار الرسالة.' }, { status: 500 });
  }
}
