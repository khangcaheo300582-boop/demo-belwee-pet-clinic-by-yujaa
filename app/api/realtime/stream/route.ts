// app/api/realtime/stream/route.ts
// SSE endpoint. One connection per client, N channels per connection.
//
// AUTHENTICATION
//   Staff channels require the staff session cookie; a customer's private
//   notification channel requires a next-auth session whose email hashes to the
//   requested one. Both are checked here — before `subscribe()` — because the
//   channel name alone must never be enough to listen.
//
//   Edge case that matters: EventSource cannot send an Authorization header, so
//   the only credential available is the cookie. That is fine here (both are
//   httpOnly cookies sent automatically) but it is why `sameSite: strict` on
//   the staff cookie is load-bearing rather than cosmetic.
//
// HEARTBEAT
//   A comment line every 25s. Without it, every proxy between here and the
//   browser eventually drops the connection as idle and the client has to
//   notice and reconnect — which shows up to the user as chat that silently
//   stops receiving.

import { NextRequest } from 'next/server';
import { getStaffSession } from '@/lib/staffSession';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/authOptions';
import {
  subscribe,
  KEEPALIVE_INTERVAL_MS,
  STREAM_TIMEOUT_MS,
} from '@/lib/realtime';
import { streamChannelsForStaff, userChannel } from '@/lib/channels';

export const dynamic = 'force-dynamic';
// Node stream, not edge: needs the session helpers and crypto.
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const requested = (searchParams.get('channels') || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  const [staffSession, customerSession] = await Promise.all([
    getStaffSession(),
    getServerSession(authOptions),
  ]);

  const allowed = new Set<string>();
  if (staffSession) {
    for (const channel of streamChannelsForStaff(staffSession.staff.branchId)) allowed.add(channel);
  }
  if (customerSession?.user?.email) {
    allowed.add(userChannel(customerSession.user.email));
  }

  // A channel the requester is not entitled to is dropped rather than
  // rejecting the whole connection: the staff navbar opens chat while the
  // customer profile opens notifications, and both may race on first paint.
  const channels = requested.filter((channel) => allowed.has(channel));
  const denied = requested.length - channels.length;

  if (channels.length === 0) {
    return new Response(
      JSON.stringify({
        success: false,
        message: denied > 0 ? 'Không có quyền nghe kênh này.' : 'Thiếu tham số channels.',
      }),
      { status: denied > 0 ? 403 : 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      let keepalive: ReturnType<typeof setInterval> | null = null;
      const unsubscribes: Array<() => void> = [];

      const close = (reason: string) => {
        if (closed) return;
        closed = true;
        if (keepalive) clearInterval(keepalive);
        for (const off of unsubscribes) off();
        try {
          controller.enqueue(encoder.encode(`event: close\ndata: ${JSON.stringify({ reason })}\n\n`));
          controller.close();
        } catch {
          /* already closed by the client */
        }
      };

      const write = (payload: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(payload));
        } catch {
          close('write-failed');
        }
      };

      // Retry is a browser directive: how long to wait before reconnecting.
      write('retry: 3000\n\n');
      // Tell the client exactly which channels it actually got, so the UI can
      // show an honest "no access" state instead of silently listening to zero.
      write(
        `event: subscribed\ndata: ${JSON.stringify({
          channels,
          denied,
          isStaff: Boolean(staffSession),
        })}\n\n`
      );

      for (const channel of channels) {
        unsubscribes.push(
          subscribe(channel, (payload) => {
            const parsed = JSON.parse(payload) as { event: string };
            write(`event: ${parsed.event}\ndata: ${payload}\n\n`);
          })
        );
      }

      keepalive = setInterval(() => {
        if (closed) return;
        write(`: keepalive ${Date.now()}\n\n`);
      }, KEEPALIVE_INTERVAL_MS);

      // If the client vanishes without a clean close, `write` throws and closes
      // the stream; the timeout is the backstop for a half-open socket.
      const timeout = setTimeout(() => close('idle-timeout'), STREAM_TIMEOUT_MS);

      request.signal.addEventListener('abort', () => {
        clearTimeout(timeout);
        close('client-abort');
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // Nginx buffers text/event-stream by default, which holds every event
      // until the buffer fills. This header is what disables it.
      'X-Accel-Buffering': 'no',
    },
  });
}