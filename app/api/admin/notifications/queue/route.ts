// app/api/admin/notifications/queue/route.ts — Danh sách hàng đợi nhắc lịch + admin retry.
//   GET  → list (filter: status, type, email, scopeType, entityId, limit, offset)
//   POST → { id, action: 'retry' } → markRetryable

import { NextRequest, NextResponse } from 'next/server';
import { requireStaffAction } from '@/lib/staffSession';
import {
  dbNotificationQueue,
  type NotificationQueueStatus,
  type NotificationTypeCode,
  type NotificationScope,
} from '@/lib/notificationQueue';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<Response> {
  const session = await requireStaffAction('appointment:view');
  if ('error' in session) return session.error;

  const q = new URL(request.url).searchParams;
  const row = await dbNotificationQueue.list({
    status: (q.get('status') as NotificationQueueStatus | undefined) ?? undefined,
    type: (q.get('type') as NotificationTypeCode | undefined) ?? undefined,
    email: q.get('email') || undefined,
    scopeType: (q.get('scopeType') as NotificationScope['type'] | undefined) ?? undefined,
    entityId: q.get('entityId') || undefined,
    limit: q.get('limit') ? Number(q.get('limit')) : undefined,
    offset: q.get('offset') ? Number(q.get('offset')) : undefined,
  });
  return NextResponse.json({ rows: row });
}

export async function POST(request: NextRequest): Promise<Response> {
  const session = await requireStaffAction('appointment:view');
  if ('error' in session) return session.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Dữ liệu không hợp lệ' }, { status: 400 });
  }
  const { id, action } = body as { id?: string; action?: string };
  if (!id) return NextResponse.json({ ok: false, error: 'Thiếu id' }, { status: 400 });
  if (action === 'retry') {
    const retried = await dbNotificationQueue.markRetryable(id);
    return NextResponse.json({ ok: true, retried });
  }
  return NextResponse.json({ ok: false, error: 'Không rõ hành động' }, { status: 400 });
}
