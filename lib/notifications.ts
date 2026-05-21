import { fetchConversations } from './conversations';

export type AppNotification = {
  id: string;
  title: string;
  body: string;
  created_at: string;
  read: boolean;
  href?: string;
};

export async function fetchNotifications(userId: string): Promise<AppNotification[]> {
  const conversations = await fetchConversations(userId);

  return conversations
    .filter((c) => (c.unread_count ?? 0) > 0 && c.last_message)
    .map((c) => ({
      id: c.id,
      title: c.post?.college ? `رسالة — ${c.post.college}` : 'رسالة جديدة',
      body: c.last_message ?? '',
      created_at: c.updated_at,
      read: false,
      href: `/post/${c.post_id}`,
    }));
}

export function unreadCount(items: AppNotification[]): number {
  return items.filter((item) => !item.read).length;
}
