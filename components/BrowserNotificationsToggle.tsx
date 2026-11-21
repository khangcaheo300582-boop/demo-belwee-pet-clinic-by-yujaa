'use client';

/**
 * components/BrowserNotificationsToggle.tsx
 * Web Push (nhắc lịch điện thoại/iPad/laptop qua SW + push):
 *   - Yêu cầu: Service Worker (public/sw.js), VAPID public key (via /api/notification-config), session.
 *   - User gesture là việc bật switch — riêng iOS: SW nhận Web Push khi PWA đã "Add to Home Screen" (doc đã có i18n notify.iosHint).
 *   - State: 2-state, subscription granted/revoked/unsupported, + server prefs state.
 *   - Invariant: trạng thái "on" phải là thực sự có subscription — Web Push là kênh thứ 2 bên ngoài; không hiển thị toast sai khi hệ thống không có.
 */

import { useCallback, useEffect, useState } from 'react';
import { BellRing, Loader2 } from 'lucide-react';

type SubState = 'idle' | 'granted' | 'denied' | 'unsupported';

function mapPermission(permission: NotificationPermission): Exclude<SubState, 'idle'> {
  if (permission === 'granted') return 'granted';
  if (permission === 'denied') return 'denied';
  return 'unsupported';
}

interface PushSubscriptionLike {
  endpoint: string;
  keys?: { p256dh: string; auth: string } | null;
}

interface SubInfo {
  id: string;
  endpoint: string;
  deviceType: string | null;
}

function decodeVapidKey(vapidPublicKey: string): ArrayBuffer {
  // VAPID public key = base64url của 65-byte point P-256 — browser cần ArrayBuffer/TypedArray.
  const b64 = vapidPublicKey.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer as ArrayBuffer;
}

export default function BrowserNotificationsToggle() {
  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState<SubState>('idle');
  const [subs, setSubs] = useState<SubInfo[]>([]);
  const [vapidKey, setVapidKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    try {
      const [resSubs, cfg] = await Promise.all([
        fetch('/api/push/subscribe', { cache: 'no-store' }),
        fetch('/api/notification-config', { cache: 'no-store' }),
      ]);
      const data = await resSubs.json();
      const cfgData = await cfg.json();
      setSubs((data.subs ?? []).map((s: { id: string; endpoint: string; deviceType: string | null }) => ({ id: s.id, endpoint: s.endpoint, deviceType: s.deviceType })));
      setVapidKey(cfgData.vapidPublicKey ?? null);
      if (typeof Notification !== 'undefined') setStatus(mapPermission(Notification.permission));
    } catch {
      // ignore — retry next tick
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const start = async () => {
    setBusy(true);
    setNote('');
    if (typeof Notification === 'undefined') {
      setStatus('unsupported');
      setNote('Trình duyệt này không hỗ trợ Web Push cho thiết bị này (ví dụ bảng Safari tiếng Việt).');
      setBusy(false);
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      setStatus(mapPermission(permission));
      if (permission !== 'granted') {
        setNote(permission === 'denied' ? 'Đã từ chối quyền nhận thông báo — hãy tắt và bật lại trình duyệt.' : 'Quyền nhận thông báo không khả dụng.');
        return;
      }
      if (!vapidKey) {
        setNote('Chưa cấu hình VAPID key — vui lòng liên hệ phòng khám.');
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const subscription = (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeVapidKey(vapidKey),
      })) as PushSubscriptionLike;
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          p256dh: subscription.keys?.p256dh ?? null,
          auth: subscription.keys?.auth ?? null,
          deviceType: 'browser',
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      await load();
    } catch (error) {
      setNote('Đăng ký thông báo thất bập: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setBusy(false);
    }
  };

  const stop = async () => {
    setBusy(true);
    setNote('');
    for (const sub of subs) {
      await fetch(`/api/push/unsubscribe?subId=${encodeURIComponent(sub.id)}`).catch(() => null);
    }
    // Browser-side unsubscribe — server state là source of truth, cập nhật để các lượt nhận sau không còn.
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      await sub?.unsubscribe();
    } catch { /* offline — server state will catch up on next read */ }
    await load();
    setBusy(false);
  };

  // `enabled` được cập nhật bởi load() — tách để sinh UI cho status từ server prefs.
  useEffect(() => {
    setEnabled(subs.length > 0);
  }, [subs.length]);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <h4 className="flex items-center gap-2 text-sm font-bold text-[var(--pf-text)]">
        <BellRing className="size-4" /> Nhận thông báo qua Web Push (Điện thoại/iPad/Laptop)
      </h4>
      <p className="mt-1 text-xs text-[var(--pf-text-mute)]">
        Nhận tin nhắn đến nền mặc dù trình duyệt đóng. Dành cho khách đã đăng nhập.
      </p>

      <div className="mt-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-[var(--pf-text)]">Web Push</span>
        <button
          type="button"
          onClick={enabled ? () => void stop() : () => void start()}
          disabled={busy}
          className="grid h-6 w-11 place-items-center rounded-full border border-white/20 bg-white/10 text-[11px] text-white/60 transition disabled:opacity-50"
          role="switch"
          aria-checked={enabled}
          aria-label="Nhận thông báo qua Web Push"
        >
          {busy ? <Loader2 className="size-3 animate-spin" /> : enabled ? '✅' : '❌'}
        </button>
      </div>

      {status === 'unsupported' && (
        <p className="mt-2 text-xs text-amber-300">Trình duyệt này không hỗ trợ Web Push trên thiết bị này (iOS chỉ nhận khi cài phiên bản PWA).</p>
      )}
      {status === 'denied' && (
        <p className="mt-2 text-xs text-amber-300">Đã từ chối quyền nhận thông báo — hãy thay đổi ở trình duyệt.</p>
      )}
      {note && <p className="mt-2 text-xs text-amber-300">{note}</p>}
    </div>
  );
}
