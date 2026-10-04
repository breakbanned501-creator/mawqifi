import { getSupabase } from './supabase';
import { isNativeCapacitor } from './capacitor';

export const DELETION_PENDING_KEY = 'mawqifi_account_deletion_pending';
export const DELETED_USER_NAME = 'Deleted User';
export const DELETED_MESSAGE_TEXT = '[deleted message]';

export async function deleteOwnAccount(): Promise<void> {
  const client = getSupabase();
  const { data, error } = await client.functions.invoke('delete-account', { body: {}, timeout: 120000 });
  if (!error && data?.code === 'ACCOUNT_DELETED') return;
  // A lost success response must not strand the UI after Auth is gone. This RPC
  // returns only our own completion acknowledgement, with no private data.
  const { data: status } = await client.rpc('account_deletion_status');
  if (status?.completed === true) return;
  throw new Error('DELETION_RETRY_REQUIRED');
}

export async function clearDeletedAccountSession(): Promise<void> {
  const client = getSupabase();
  try {
    if (isNativeCapacitor()) {
      const { clearDeletedAccountNativePush } = await import('./native-push');
      await clearDeletedAccountNativePush();
    } else if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        const subscription = await registration.pushManager?.getSubscription();
        if (subscription) await subscription.unsubscribe();
        const notifications = await registration.getNotifications();
        notifications.forEach(notification => notification.close());
      }
    }
  } catch { /* Server tokens/access are already removed even if an OS API fails. */ }
  await client.removeAllChannels().catch(() => {});
  await client.auth.signOut({ scope: 'local' }).catch(() => {});
  // Logout events also notify other tabs. Clear account-scoped state and tour so
  // the next load has a new guest identity rather than old private React memory.
  try {
    for (const key of Object.keys(localStorage)) {
      if (((key.startsWith('mawqifi_') || key.startsWith('mawqifi.')) && key !== 'mawqifi_locale') || key.startsWith('sb-')) localStorage.removeItem(key);
    }
    sessionStorage.clear();
  } catch { /* Restricted WebView storage: server access is already revoked. */ }
  try { if ('caches' in window) {
    const names = await caches.keys();
    await Promise.all(names.map(name => caches.delete(name)));
  } } catch { /* Offline static-cache cleanup must not retain authenticated memory. */ }
  window.location.replace('/');
}
