// app/api/customer/care/route.ts
// The customer side of customer-care assignment.
//
//   POST { }                       → create a session and offer it to the
//                                    first online staff member (staff:care)
//   GET  ?sessionId=SESS_…         → poll: waiting | accepted | busy + the
//                                    member on the other side, if any
//
// The GET is public (the customer page has no login) and therefore returns only
// what the customer is entitled to know: the status, their own label and the
// name/job of the member who accepted. Messages are NOT here — they live in
// /api/customer/chat under the same random sessionId, which doubles as the
// access token.

import { NextRequest, NextResponse } from 'next/server';
import { dbCare, WAITING_TTL_MS } from '@/lib/dbCare';
import { listAllStaff, sanitizeStaff } from '@/lib/staff-service';
import { listOnlineStaff, ONLINE_TTL_SECONDS } from '@/lib/dbPresence';
import { dbChat } from '@/lib/dbChat';
import { publish } from '@/lib/realtime';
import { STAFF_CARE_CHANNEL } from '@/lib/channels';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const LABEL_MAX = 60;

export async function POST(request: NextRequest) {
  try {
    let label = '';
    try {
      // An empty body is normal — the POST just creates the session.
      const body = (await request.json().catch(() => ({}))) as { label?: unknown };
      label = typeof body?.label === 'string' ? body.label : '';
    } catch {
      label = '';
    }

    const all = (await listAllStaff()).map(sanitizeStaff);
    const activeFilter = all.filter((staff) => staff.isActive !== false);
    const online = await listOnlineStaff(activeFilter);
    const onlineFlag = online.length > 0;

    const session = await dbCare.create(online, label.slice(0, LABEL_MAX));

    // Tell the offered member to show their card. When `offered` is null the
    // store already flipped the session to busy — the customer's first status
    // poll will report that.
    if (session.status === 'waiting' && session.offered) {
      publish(STAFF_CARE_CHANNEL, 'care:offered', {
        sessionId: session.sessionId,
        customerName: session.customerName,
        staffId: session.offered.id,
        createdAt: session.createdAt,
        waitsFor: WAITING_TTL_MS / 1000,
      });
    }

    return NextResponse.json(
      {
        sessionId: session.sessionId,
        customerName: session.customerName,
        status: session.status,
        staffOnline: onlineFlag,
        onlineCount: online.length,
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json({ error: 'Không tạo được yêu cầu trò chuyện.' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = (searchParams.get('sessionId') ?? '').trim();
  if (!sessionId) {
    return NextResponse.json({ error: 'Thiếu sessionId.' }, { status: 400 });
  }

  try {
    const view = await dbCare.publicView(sessionId, async (id) => {
      const rows = await dbChat.list(`customer:${id}`, 1);
      return rows.length > 0;
    });
    if (!view) {
      return NextResponse.json({ error: 'Không tìm thấy phiên.' }, { status: 404 });
    }
    return NextResponse.json({
      status: view.status,
      customerName: view.customerName,
      staff: view.status === 'accepted' ? view.staff : null,
      ttlSeconds: ONLINE_TTL_SECONDS,
    });
  } catch {
    return NextResponse.json({ error: 'Không đọc được trạng thái phiên.' }, { status: 500 });
  }
}
