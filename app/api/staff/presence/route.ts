// app/api/staff/presence/route.ts
// POST — staff heartbeat. Every protected /staff page (components/staff/
// StaffPresenceHeartbeat) pings this every HEARTBEAT_INTERVAL_MS; a member
// counts as online only while the last beat is inside ONLINE_TTL_SECONDS.
//
// WHY A HEARTBEAT AND NOT "SSE CONNECTED"
//   The SSE hub identifies channels, not members, and resets on every deploy.
//   A file-backed beat survives restarts, works on pages without an SSE
//   subscription, and gives care assignment a stable "who is at their desk"
//   answer — which is exactly what "chọn 1 bác sĩ đang online" needs.

import { NextResponse } from 'next/server';
import { requireStaffAction } from '@/lib/staffSession';
import { touch, prune, ONLINE_TTL_SECONDS, HEARTBEAT_INTERVAL_MS } from '@/lib/dbPresence';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST() {
  const session = await requireStaffAction('staff:chat');
  if ('error' in session) return session.error;

  try {
    await touch(session.staff);
    // Cheap, idempotent housekeeping piggybacked on the beat.
    void prune().catch(() => undefined);
    return NextResponse.json({
      success: true,
      online: true,
      ttlSeconds: ONLINE_TTL_SECONDS,
      intervalMs: HEARTBEAT_INTERVAL_MS,
    });
  } catch {
    return NextResponse.json({ success: false, message: 'Không ghi được heartbeat.' }, { status: 500 });
  }
}
