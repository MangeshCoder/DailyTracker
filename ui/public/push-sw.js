// ─────────────────────────────────────────────────────────────────────────────
//  Push notifications (loaded into the app's service worker — vite.config.ts
//  workbox.importScripts). The server sends { title, body, url, tag }.
// ─────────────────────────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; }
  catch { data = { body: event.data ? event.data.text() : '' }; }

  event.waitUntil((async () => {
    // the app is open and in front: it already shows the notification itself
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (windows.some((w) => w.focused && w.visibilityState === 'visible')) return;

    await self.registration.showNotification(data.title || 'DailyTracker', {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: data.tag || undefined,          // same tag (e.g. one chat) → replaces the older one
      renotify: !!data.tag,
      data: { url: data.url || '/notifications' },
    });
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of windows) {
      if (w.url.startsWith(self.location.origin)) {
        await w.focus();
        try { await w.navigate(url); } catch { w.postMessage({ type: 'open-url', url }); }
        return;
      }
    }
    await self.clients.openWindow(url);
  })());
});
