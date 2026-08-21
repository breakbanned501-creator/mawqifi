/* Stable custom Service Worker handlers for Mawqifi Web Push Notifications */

function sameOriginPath(value) {
  try {
    const url = new URL(typeof value === 'string' ? value : '/', self.location.origin);
    return url.origin === self.location.origin ? `${url.pathname}${url.search}${url.hash}` : '/';
  } catch {
    return '/';
  }
}

self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const language = data.lang === 'en' ? 'en' : 'ar';
    const direction = data.dir === 'ltr' ? 'ltr' : 'rtl';
    const title = data.title || (language === 'en' ? 'Mawqifi 🚗' : 'موقفي 🚗');
    const notificationData = {
      url: sameOriginPath(data.url),
    };

    if (typeof data.postId === 'string') notificationData.postId = data.postId;
    if (typeof data.type === 'string') notificationData.type = data.type;
    if (typeof data.chatId === 'string') notificationData.chatId = data.chatId;
    if (typeof data.messageId === 'string') notificationData.messageId = data.messageId;

    const tag =
      notificationData.type === 'chat_message' && notificationData.messageId
        ? `chat-${notificationData.messageId}`
        : notificationData.postId
          ? `post-${notificationData.postId}`
          : 'mawqifi-notification';

    const options = {
      body: data.body || (language === 'en'
        ? 'A new parking spot is available on campus'
        : 'تم نشر موقف جديد متاح في الجامعة'),
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: notificationData,
      dir: direction,
      lang: language,
      tag,
      renotify: true,
      vibrate: [100, 50, 100],
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    console.error('Service Worker push error:', err);
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = sameOriginPath(event.notification.data?.url);

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clientList) => {
      for (const client of clientList) {
        let clientOrigin = '';
        try {
          clientOrigin = new URL(client.url).origin;
        } catch {
          continue;
        }

        if (clientOrigin !== self.location.origin || !('focus' in client)) continue;

        const currentPath = sameOriginPath(client.url);
        if (currentPath === targetUrl) {
          return client.focus();
        }

        if ('navigate' in client) {
          try {
            const navigatedClient = await client.navigate(targetUrl);
            return (navigatedClient || client).focus();
          } catch {
            // Do not focus a different conversation. Fall through to open the
            // exact notification destination in a new Mawqifi window.
          }
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    }),
  );
});
