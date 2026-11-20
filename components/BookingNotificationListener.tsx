'use client';

// components/BookingNotificationListener.tsx
// Subscribes the signed-in customer to their private SSE channel and surfaces
// booking confirmations as persistent toasts.
//
// WHY THE SERVER-SIDE FLAG GATES THE SUBSCRIPTION
//   A customer who has not opted in should not have an open EventSource — it is
//   a socket the browser holds open and reopens on every reconnect, and the
//   clinic should not be pushing them events they declined. So the preference is
//   checked before subscribing at all, not just before rendering a toast.
//
// THE 60s POLL
//   SSE dies silently behind some corporate proxies and on mobile networks that
//   drop the connection without firing `error`. A customer who enabled
//   notifications and then hears nothing concludes the feature is broken. The
//   poll is the safety net; the toast's seen-set dedupes the overlap.

import { useCallback, useEffect, useMemo, useState } from 'react';
import BookingSuccessAlert, { type BookingAlertItem } from '@/components/BookingSuccessAlert';
import { userChannel } from '@/lib/channels';

const POLL_MS = 60_000;

interface RawNotification {
  id: string;
  kind: BookingAlertItem['kind'];
  title: string;
  body: string;
  staffName: string | null;
  staffAvatarUrl: string | null;
  createdAt: string;
}

function toAlertItem(n: RawNotification): BookingAlertItem {
  return {
    id: n.id,
    kind: n.kind,
    title: n.title,
    body: n.body,
    staffName: n.staffName,
    staffAvatarUrl: n.staffAvatarUrl,
    createdAt: n.createdAt,
  };
}

export default function BookingNotificationListener({ enabled }: { enabled: boolean }) {
  const [items, setItems] = useState<BookingAlertItem[]>([]);

  // The customer's email is hashed into the channel name by userChannel(), so
  // the address never appears in the EventSource URL — that URL lands in
  // browser history, proxy logs and server access logs.
  const channel = useMemo(() => userChannel('self'), []);

  const load = useCallback(async (markSeen: boolean) => {
    try {
      const res = await fetch('/api/bookings/notifications', { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as {
        notifications?: RawNotification[];
        unseenCount?: number;
      };
      setItems((data.notifications ?? []).map(toAlertItem));

      if (markSeen && (data.unseenCount ?? 0) > 0) {
        // Mark AFTER the count is read, otherwise the count is computed from an
        // already-mutated store and reads 0.
        await fetch('/api/bookings/notifications', { method: 'POST' });
      }
    } catch {
      /* offline or unauthenticated — the next tick retries */
    }
  }, []);

  // Mark-as-seen on open. Without this the unread badge would never clear and
  // the profile page would claim there are new updates forever.
  useEffect(() => {
    if (!enabled) return;
    void load(true);
  }, [enabled, load]);

  // Live subscription.
  useEffect(() => {
    if (!enabled) return;
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') return;

    const source = new EventSource(`/api/realtime/stream?channels=${encodeURIComponent(channel)}`);

    const onEvent = (event: MessageEvent<string>) => {
      try {
        const parsed = JSON.parse(event.data) as { data?: RawNotification };
        if (!parsed.data) return;
        const incoming = toAlertItem(parsed.data);
        setItems((current) =>
          current.some((item) => item.id === incoming.id) ? current : [incoming, ...current]
        );
      } catch {
        /* malformed frame — the poll reconciles */
      }
    };

    source.addEventListener('booking-status', onEvent as EventListener);
    // A failed subscribe (403, or the session cookie is not sent) must not leave
    // a reconnect loop hammering the endpoint.
    source.onerror = () => source.close();

    const poll = window.setInterval(() => void load(false), POLL_MS);
    const onVisible = () => {
      if (!document.hidden) void load(false);
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      source.removeEventListener('booking-status', onEvent as EventListener);
      source.close();
      window.clearInterval(poll);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled, channel, load]);

  const dismiss = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
    // The notification is still marked seen server-side (that happened on open);
    // this only controls the local stack, so a reload does not bring it back.
  }, []);

  return (
    <BookingSuccessAlert enabled={enabled} items={items} onDismiss={dismiss} />
  );
}

export { UnreadBadge } from '@/components/BookingSuccessAlert';