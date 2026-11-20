// lib/realtime.ts
// Server-Sent Events hub — the transport for both staff chat and booking
// notifications.
//
// WHY SSE AND NOT PUSHER / SUPABASE / SOCKET.IO
//   The deployment target is a single Next.js process (data/ is a JSON file — see
//   lib/jsonStore.ts, which documents that cross-process mutual exclusion is
//   explicitly out of scope). A hosted realtime vendor would add credentials, a
//   second network hop and a bill for something the current topology cannot use
//   across processes anyway. SSE needs none of that: it is a plain HTTP
//   response that stays open, it reconnects on its own, and it works through
//   every proxy in front of the app.
//
//   Both features (chat + booking notifications) are then just channels over
//   this one hub, so adding a third later costs a publish() call.
//
// SCOPE, STATED HONESTLY
//   In-memory, per process. Two Node processes behind a load balancer would each
//   hold a different subscriber set, so a message published on process A never
//   reaches a client parked on process B. That is acceptable here for the same
//   reason the JSON store is: the app is deployed as one process. Migrating to
//   Redis pub/sub (or Pusher) means replacing `publish` and nothing else.
//
// WHY THE STATE LIVES ON globalThis
//   Next.js bundles every route handler with its own embedded copy of this
//   module (visible in .next-dev/server/app/**/route.js — each file carried the
//   full lib/realtime source). Two module instances means two subscriber maps:
//   the chat POST route published into map A while the stream route subscribed
//   to map B — every SSE event silently vanished, for the internal chat AND the
//   customer-care card. Anchoring the hub to globalThis gives every copy the
//   SAME Map objects regardless of how many bundles embed the source.

export interface RealtimeEvent<T = unknown> {
  channel: string;
  event: string;
  /** Monotonic per-channel sequence, so a client can detect a gap. */
  seq: number;
  data: T;
}

type Subscriber = {
  channel: string;
  send: (payload: string) => void;
};

interface RealtimeHub {
  subscribers: Map<string, Set<Subscriber>>;
  channelSeq: Map<string, number>;
}

const globalForHub = globalThis as typeof globalThis & {
  __belweeRealtimeHub?: RealtimeHub;
};

const hub: RealtimeHub = (globalForHub.__belweeRealtimeHub ??= {
  subscribers: new Map<string, Set<Subscriber>>(),
  channelSeq: new Map<string, number>(),
});

/** Heartbeat interval. Proxies commonly drop idle connections at 60s. */
const KEEPALIVE_MS = 25_000;

/** How long a client may wait before we give up on a dead connection. */
const CLIENT_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Publish an event to every subscriber of `channel`.
 *
 * `seq` is per-channel and monotonic. A client that sees a jump knows it missed
 * something and can refetch, which is the whole reason a plain string payload
 * would not be enough.
 */
export function publish<T>(channel: string, event: string, data: T): void {
  const { subscribers, channelSeq } = hub;
  const set = subscribers.get(channel);
  if (!set || set.size === 0) {
    // Still bump the sequence so a client that connects after this event does
    // not later mistake the gap for a missed live message.
    channelSeq.set(channel, (channelSeq.get(channel) ?? 0) + 1);
    return;
  }

  const seq = (channelSeq.get(channel) ?? 0) + 1;
  channelSeq.set(channel, seq);
  const payload = JSON.stringify({ channel, event, seq, data } satisfies RealtimeEvent<T>);

  for (const subscriber of set) {
    try {
      subscriber.send(payload);
    } catch {
      // A broken connection is cleaned up by its own stream's error handler;
      // one bad subscriber must not stop delivery to the rest.
      set.delete(subscriber);
    }
  }
}

/** Subscribe a connection to one channel. Returns the unsubscribe function. */
export function subscribe(channel: string, send: Subscriber['send']): () => void {
  const { subscribers } = hub;
  const subscriber: Subscriber = { channel, send };
  let set = subscribers.get(channel);
  if (!set) {
    set = new Set();
    subscribers.set(channel, set);
  }
  set.add(subscriber);

  return () => {
    const current = hub.subscribers.get(channel);
    if (!current) return;
    current.delete(subscriber);
    if (current.size === 0) hub.subscribers.delete(channel);
  };
}

/** Subscriber count for a channel — surfaced in /api/realtime/health. */
export function channelSize(channel: string): number {
  return hub.subscribers.get(channel)?.size ?? 0;
}

/** Every channel that currently has at least one subscriber. */
export function activeChannels(): Array<{ channel: string; subscribers: number }> {
  return Array.from(hub.subscribers.entries()).map(([channel, set]) => ({
    channel,
    subscribers: set.size,
  }));
}

export const KEEPALIVE_INTERVAL_MS = KEEPALIVE_MS;
export const STREAM_TIMEOUT_MS = CLIENT_TIMEOUT_MS;