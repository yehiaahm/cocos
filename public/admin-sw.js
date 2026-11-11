// Service worker for the Coco's Art dashboard (scope /admin): shows new-order notifications.
// Pushes arrive without data; the text is fetched from the API so nothing sensitive travels through push services.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  event.waitUntil(
    (async () => {
      let n = null;
      try {
        const res = await fetch('/api/admin/notifications/latest', { credentials: 'include', cache: 'no-store' });
        if (res.ok) n = (await res.json()).notification;
      } catch {
        /* offline or signed out — show a generic notification */
      }
      await self.registration.showNotification(n?.title || '🛍️ طلب جديد', {
        body: n?.body || 'افتح لوحة التحكم لعرض التفاصيل',
        icon: '/icon-192.png',
        badge: '/favicon-32.png',
        tag: n ? `cocos-${n.id}` : 'cocos',
        renotify: true,
        dir: 'rtl',
        lang: 'ar',
        vibrate: [120, 60, 120],
        data: { url: n?.url || '/admin' },
      });
    })(),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/admin', self.location.origin).href;
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const w of wins) {
        if (new URL(w.url).pathname.startsWith('/admin')) {
          await w.focus();
          return w.navigate(url);
        }
      }
      return self.clients.openWindow(url);
    })(),
  );
});
