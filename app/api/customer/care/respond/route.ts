// app/api/customer/care/respond/route.ts
// The staff side of customer-care.
//
//   GET                     → what is currently on MY screen: sessions offered
//                             to me (waiting) and accepted by me (active)
//   POST { sessionId, action: 'accept' | 'decline' }
//                           → TIẾP NHẬN / LOẠI BỎ the request card
//
// Every transition publishes on the `staff:care` channel so every other
// member's card disappears the moment one of us answers, and the declining
// member's "next in line" offer reaches the right screen without anyone
// reloading.

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireStaffAction } from '@/lib/staffSession';
import { dbCare } from '@/lib/dbCare';
import { listAllStaff, sanitizeStaff } from '@/lib/staff-service';
import { listOnlineStaff } from '@/lib/dbPresence';
import { publish } from '@/lib/realtime';
import { STAFF_CARE_CHANNEL } from '@/lib/channels';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ACTION_SCHEMA = z.object({
  sessionId: z.string().min(8).max(40),
  action: z.enum(['accept', 'decline']),
});

export async function GET() {
  const session = await requireStaffAction('staff:chat');
  if ('error' in session) return session.error;

  try {
    const { offered, accepted } = await dbCare.forStaff(session.staff.id);
    return NextResponse.json({
      offered: offered.map((row) => ({
        sessionId: row.sessionId,
        customerName: row.customerName,
        createdAt: row.createdAt,
      })),
      accepted: accepted.map((row) => ({
        sessionId: row.sessionId,
        customerName: row.customerName,
        acceptedAt: row.acceptedAt,
      })),
    });
  } catch {
    return NextResponse.json({ error: 'Không đọc được yêu cầu.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await requireStaffAction('staff:chat');
  if ('error' in session) return session.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Dữ liệu gửi lên không hợp lệ.' }, { status: 400 });
  }

  const parsed = ACTION_SCHEMA.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Dữ liệu không hợp lệ.' }, { status: 400 });
  }

  const { sessionId, action } = parsed.data;
  const me = session.staff;

  try {
    if (action === 'accept') {
      const row = await dbCare.accept(sessionId, me);
      if (row && row.status === 'busy') {
        // Phiên đã hết hạn chờ ⇒ dọn card đang hiển thị trên màn người nhận.
        publish(STAFF_CARE_CHANNEL, 'care:busy', { sessionId, customerName: row.customerName });
      }
      if (!row || row.status !== 'accepted') {
        return NextResponse.json(
          { error: 'Yêu cầu đã được người khác xử lý hoặc không còn hiệu lực.' },
          { status: 409 }
        );
      }
      publish(STAFF_CARE_CHANNEL, 'care:accepted', {
        sessionId,
        staffId: me.id,
        customerName: row.customerName,
      });
      return NextResponse.json({
        status: 'accepted',
        sessionId,
        customerName: row.customerName,
        chatUrl: `/staff/customer-care?session=${encodeURIComponent(sessionId)}`,
      });
    }

    // ── decline ──────────────────────────────────────────────────────────
    const all = (await listAllStaff()).map(sanitizeStaff);
    const online = await listOnlineStaff(all.filter((staff) => staff.isActive !== false));
    const row = await dbCare.decline(sessionId, me.id, online);
    if (!row) {
      return NextResponse.json({ error: 'Không tìm thấy phiên yêu cầu.' }, { status: 404 });
    }

    if (row.status === 'waiting' && row.offered) {
      publish(STAFF_CARE_CHANNEL, 'care:offered', {
        sessionId,
        customerName: row.customerName,
        staffId: row.offered.id,
        createdAt: row.createdAt,
      });
      return NextResponse.json({ status: 'waiting', reofferedTo: row.offered.id, sessionId });
    }

    if (row.status === 'busy') {
      publish(STAFF_CARE_CHANNEL, 'care:busy', { sessionId, customerName: row.customerName });
      publish('customer:requests', 'customer:request', {
        sessionId,
        event: 'busy',
        message: 'Các bác sĩ đều bận, bạn liên hệ sau nhé! Belwee cảm ơn.',
        time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      });
      return NextResponse.json({ status: 'busy', sessionId });
    }

    return NextResponse.json({ status: row.status, sessionId });
  } catch {
    return NextResponse.json({ error: 'Không xử lý được yêu cầu.' }, { status: 500 });
  }
}
