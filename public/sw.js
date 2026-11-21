/* public/sw.js — Belwee Pet Clinic push notification service worker (spike v1)
 *
 * Design invariants (kept):
 * - showNotification is driven from the SW so pushes arrive while no tab is open.
 * - Notification click → focus an existing window on our origin, or open the
 *   target page; the page may then run its own tracking hook via
 *   data.tracking.
 * - The raw customer email never goes into the push payload or the notification
 *   click target: channels.userChannel() hashes the address (lib/channels.ts).
 */

const MAX_VISIBLE = 5;

self.addEventListener('notificationclick', (event) => {
  console.log('[SW] notificationclick');
  event.preventDefault();
  const data = (event.notification.data || {}) || {};
  event.notification.close();
  const url = typeof data.url === 'string' ? data.url : '/client-portal';
  const recordEvent = (channel, eventType) => {
    if (data.tracking && data.tracking[eventType]) {
      const trackUrl = data.tracking[eventType];
      const img = new Image();
      img.src = trackUrl.replace(/\{nid\}/g, String(data.req || ''));
    }
  };

  recordEvent(undefined, 'click');
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((all) => {
      const sameOrigin = all.find((client) => new URL(client.url).origin === self.location.origin);
      if (sameOrigin) return sameOrigin.focus().then((client) => client.navigate(url));
      return self.clients.openWindow(url);
    })
  );
});

self.addEventListener('message', (event) => {
  console.log('[SW] message received:', event.data && event.data.type);
  try {
    self.onmessage(event);
  } catch (e) {
    console.log('[SW] onmessage error:', String(e));
  }
});

self.onmessage = async (event) => {
  const msg = event.data;
  if (!msg || typeof msg !== 'object') return;

  if (msg.type === 'notify') {
    console.log('[SW] showing notification:', msg.title);
    const ok = self.registration.showNotification(msg.title, {
      body: msg.body,
      icon: msg.icon || '/icon-512.png',
      badge: msg.icon || '/icon-512.png',
      tag: msg.tag || `belewee-ntf-${Date.now()}`,
      data: { url: msg.url || '/client-portal', req: msg.req || null },
      lang: msg.lang || 'vi',
      dir: 'ltr',
      renotify: true,
      priority: 'high',
    });
    event.source?.postMessage({ type: 'shown', ok: !!ok });
    self.registration.update();
  } else if (msg.type === 'get-subscription') {
    console.log('[SW] get-subscription');
    const sub = await self.registration.pushManager.getSubscription();
    event.source?.postMessage({
      type: 'subscription',
      endpoint: sub?.endpoint ?? null,
      p256dh: sub?.keys?.p256dh ?? null,
      auth: sub?.keys?.auth ?? null,
    });
  }
};
