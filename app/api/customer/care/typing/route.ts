// app/api/customer/care/typing/route.ts
// "Đang nhập" (typing) của phiên chăm sóc khách hàng.
//
//   POST { sessionId, typing, role? }
//     role = 'customer' → khách đang gõ; publish `care:typing` trên `staff:care`
//                         để màn nhân viên hiện bong bóng "Khách đang nhập…".
//     role = 'staff'    → nhân viên đang gõ; chỉ yêu cầu cookie nhân viên và
//                         đúng người đã TIẾP NHẬN phiên. Khách đọc qua
//                         GET /api/customer/chat (`staffTyping`).
//
// Tại sao không luôn suy ra role từ cookie: trình duyệt của nhân viên có thể
// đang mở song song trang khách để kiểm thử; khi đó cookie nhân viên cũng được
// gửi kèm. Client khai báo vai trò, server vẫn xác thực quyền của vai trò đó —
// khai báo 'staff' mà không có cookie/không phải người nhận phiên sẽ bị 403.

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbCare } from '@/lib/dbCare';
import { getStaffSession } from '@/lib/staffSession';
import { markTyping, clearTyping } from '@/lib/typingState';
import { publish } from '@/lib/realtime';
import { STAFF_CARE_CHANNEL } from '@/lib/channels';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BODY_SCHEMA = z.object({
  sessionId: z.string().regex(/^SESS_[0-9A-F]{20}$/),
  typing: z.boolean(),
  role: z.enum(['customer', 'staff']).optional(),
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Dữ liệu gửi lên không hợp lệ.' }, { status: 400 });
  }

  const parsed = BODY_SCHEMA.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dữ liệu không hợp lệ.' }, { status: 400 });
  }

  const { sessionId, typing, role: claimedRole } = parsed.data;

  try {
    const care = await dbCare.find(sessionId);
    if (!care) return NextResponse.json({ error: 'Không tìm thấy phiên chat.' }, { status: 404 });

    const staffSession = await getStaffSession();
    const acceptedStaffId = care.status === 'accepted' ? care.accepted?.id ?? null : null;
    const staffIsAccepted = !!staffSession && acceptedStaffId === staffSession.staff.id;

    let role: 'customer' | 'staff';
    if (claimedRole === 'staff') {
      if (!staffIsAccepted) {
        return NextResponse.json({ error: 'Bạn không phải người nhận phiên này.' }, { status: 403 });
      }
      role = 'staff';
    } else if (claimedRole === 'customer') {
      role = 'customer';
    } else {
      role = staffIsAccepted ? 'staff' : 'customer';
    }

    if (typing) {
      markTyping(sessionId, role, role === 'staff' ? staffSession?.staff.name ?? '' : care.customerName);
    } else {
      clearTyping(sessionId, role);
    }

    // Chỉ chiều khách → nhân viên cần realtime; chiều ngược lại đi qua poll
    // GET /api/customer/chat mà trang khách đã chạy sẵn mỗi 3 giây.
    if (role === 'customer') {
      publish(STAFF_CARE_CHANNEL, 'care:typing', {
        sessionId,
        role,
        name: care.customerName,
        typing,
      });
    }

    return NextResponse.json({ success: true, role, typing });
  } catch {
    return NextResponse.json({ error: 'Không cập nhật được trạng thái đang nhập.' }, { status: 500 });
  }
}
