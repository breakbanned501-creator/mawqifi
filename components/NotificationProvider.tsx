'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '@/components/AuthProvider';
import {
  clearReadNotifications,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  NotificationDataError,
  unreadCount,
  type AppNotification,
} from '@/lib/notifications';
import { getSupabase } from '@/lib/supabase';

type NotificationContextValue = {
  items: AppNotification[];
  unreadCount: number;
  isLoading: boolean;
  error: NotificationDataError | null;
  refresh: () => Promise<void>;
  markRead: (notificationId: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  clearRead: () => Promise<void>;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function useNotifications(): NotificationContextValue {
  const context = useContext(NotificationContext);

  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }

  return context;
}

function toProviderError(error: unknown): NotificationDataError {
  return error instanceof NotificationDataError
    ? error
    : new NotificationDataError('request_failed', error);
}

export default function NotificationProvider({ children }: { children: ReactNode }) {
  const { userId } = useAuth();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<NotificationDataError | null>(null);
  const refreshInFlight = useRef<Promise<void> | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!userId) {
      if (mounted.current) {
        setItems([]);
        setError(null);
        setIsLoading(false);
      }
      return;
    }

    if (refreshInFlight.current) return refreshInFlight.current;

    const request = (async () => {
      try {
        const nextItems = await fetchNotifications(userId);
        if (mounted.current) {
          setItems(nextItems);
          setError(null);
        }
      } catch (nextError) {
        if (mounted.current) setError(toProviderError(nextError));
      } finally {
        if (mounted.current) setIsLoading(false);
      }
    })();

    refreshInFlight.current = request;
    void request.finally(() => {
      if (refreshInFlight.current === request) {
        refreshInFlight.current = null;
      }
    });

    return request;
  }, [userId]);

  useEffect(() => {
    setIsLoading(Boolean(userId));
    void refresh();
  }, [userId, refresh]);

  useEffect(() => {
    if (!userId) return;

    const supabase = getSupabase();
    const channel = supabase
      .channel(`app-notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'app_notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void refresh();
        },
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          if (mounted.current) {
            setError((current) =>
              current ?? new NotificationDataError('realtime_unavailable'),
            );
          }
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, refresh]);

  const markRead = useCallback(
    async (notificationId: string) => {
      if (!userId) return;

      const previousItems = items;
      const readAt = new Date().toISOString();
      setItems((current) =>
        current.map((item) =>
          item.id === notificationId ? { ...item, read_at: readAt, read: true } : item,
        ),
      );

      try {
        await markNotificationRead(notificationId, userId);
        setError(null);
      } catch (nextError) {
        setItems(previousItems);
        setError(toProviderError(nextError));
        throw nextError;
      }
    },
    [items, userId],
  );

  const markAllRead = useCallback(async () => {
    if (!userId) return;

    const previousItems = items;
    const readAt = new Date().toISOString();
    setItems((current) =>
      current.map((item) => ({ ...item, read_at: item.read_at ?? readAt, read: true })),
    );

    try {
      await markAllNotificationsRead(userId);
      setError(null);
    } catch (nextError) {
      setItems(previousItems);
      setError(toProviderError(nextError));
      throw nextError;
    }
  }, [items, userId]);

  const clearRead = useCallback(async () => {
    if (!userId) return;

    const previousItems = items;
    setItems((current) => current.filter((item) => !item.read_at));

    try {
      await clearReadNotifications(userId);
      setError(null);
    } catch (nextError) {
      setItems(previousItems);
      setError(toProviderError(nextError));
      throw nextError;
    }
  }, [items, userId]);

  const value = useMemo<NotificationContextValue>(
    () => ({
      items,
      unreadCount: unreadCount(items),
      isLoading,
      error,
      refresh,
      markRead,
      markAllRead,
      clearRead,
    }),
    [items, isLoading, error, refresh, markRead, markAllRead, clearRead],
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}
