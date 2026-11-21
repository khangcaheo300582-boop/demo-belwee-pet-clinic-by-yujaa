/* public/sw.js — Belwee Pet Clinic — service worker cho Web Push.
 *
 * - push: GET /api/notifications/latest?subId=X → showNotification(title, body, icon, data).
 * - notificationclick → openWindow(url) hoặc focus tab đang có; tracking pixel /api/notifications/track?id=<logId>&action=click.
 * - onmessage 'notify' + 'get-subscription': đường dây debug/spike (web-push thử nghiệm của giai đoạn B).
 */

const LATEST_URL = '/api/notifications/latest';

self.addEventListener('push', (event) => {
  event.waitUntil(handlePush());
});

async function handlePush() {
  let data = { url: '/client-portal' };
  try {
    const res = await fetch(`${LATEST_URL}${self.location.search || ''}`, { method: 'GET', credentials: 'include' });
    const json = await res.json().catch(() => null);
    if (res.ok && json && json.ok) data = json;
  } catch {
    /* Offline: vẫn hiện thông báo đã lưu của hệ thống, mặc định URL /client-portal. */
  }
  const title = data.title || 'Belwee Pet Clinic';
  const body = data.body || '';
  const url = data.url || '/client-portal';
  const tag = `belewee-ntf-${data.id || Date.now()}`;
  await self.registration.showNotification(title, {
    body,
    icon: '/icon-512.png',
    badge: '/icon-512.png',
    tag,
    data: { url, id: data.id, subId: self.registration.scope },
    lang: 'vi',
    dir: 'ltr',
  });
}

self.addEventListener('notificationclick', (event) => {
  event.preventDefault();
  const data = (event.notification.data || {}) || {};
  const url = data.url || '/client-portal';
  if (data.id) {
    try { new Image().src = `/api/notifications/track?id=${encodeURIComponent(data.id)}&action=click`; } catch { /* ignore */ }
  }
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((all) => {
      const sameOrigin = all.find((client) => new URL(client.url).origin === self.location.origin);
      if (sameOrigin) return sameOrigin.focus().then((client) => client.navigate(url));
      return self.clients.openWindow(url);
    })
  );
});

/* ─── Dev/spike channel (không phải sản phẩm — dùng cho giai đoạn thử nghiệm SW) ─── */
self.addEventListener('message', async (event) => {
  const msg = event.data;
  if (!msg || typeof msg !== 'object') return;
  if (msg.type === 'notify') {
    event.waitUntil(
      self.registration.showNotification(msg.title || 'NHẮC LỊCH', {
        body: msg.body || '',
        icon: msg.icon || '/icon-512.png',
        tag: msg.tag || `belewee-ntf-${Date.now()}`,
        data: { url: msg.url || '/client-portal', req: msg.req },
      })
    );
  } else if (msg.type === 'get-subscription') {
    const sub = await self.registration.pushManager.getSubscription();
    event.source?.postMessage({
      type: 'subscription',
      endpoint: sub?.endpoint ?? null,
      p256dh: sub?.keys?.p256dh ?? null,
      auth: sub?.keys?.auth ?? null,
    });
  }
});
