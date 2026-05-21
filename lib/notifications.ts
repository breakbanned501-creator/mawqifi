export type AppNotification = {
  id: string;
  title: string;
  body: string;
  created_at: string;
  read: boolean;
  href?: string;
};

const STORAGE_KEY = 'mawqifi_notifications';

export const defaultNotifications: AppNotification[] = [
  {
    id: 'n1',
    title: 'رسالة جديدة',
    body: 'نورة: أنا عند البوابة ٥',
    created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    read: false,
    href: '/post/demo-education-gate-5',
  },
  {
    id: 'n2',
    title: 'موقف قريب منك',
    body: 'كلية الهندسة — المنطقة ب — البوابة ٧',
    created_at: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    read: false,
    href: '/',
  },
  {
    id: 'n3',
    title: 'انتهى وقت الموقف',
    body: 'تم إغلاق محادثة موقف سابق تلقائياً',
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    read: true,
  },
];

export function getNotifications(): AppNotification[] {
  if (typeof window === 'undefined') return defaultNotifications;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultNotifications));
      return defaultNotifications;
    }
    return JSON.parse(raw) as AppNotification[];
  } catch {
    return defaultNotifications;
  }
}

export function saveNotifications(items: AppNotification[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function unreadCount(items: AppNotification[]): number {
  return items.filter((item) => !item.read).length;
}
