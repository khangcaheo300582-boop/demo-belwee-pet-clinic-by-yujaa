// app/api/booking/route.ts
// SINGLE booking endpoint — all booking forms POST here.
// (formerly 3 duplicate routes: /api/booking, /api/dat-lich, /api/send-email —
// all of them did the same thing: session email fallback + createBooking.)
//
// - Routes through unified bookingService (state machine: PENDING → CONFIRMED)
// - Nếu client không gửi email → lấy từ session đăng nhập (server-side, bảo mật)

import { NextResponse } from 'next/server';
import { createBooking, type RawBookingInput } from '@/lib/bookingService';
import { readJsonBody } from '@/lib/validators';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/authOptions';

export async function POST(request: Request) {
  // Parsed OUTSIDE the try below: `request.json()` throws on a malformed or
  // empty body, and letting that reach the generic catch turned a client-side
  // syntax error into a 500 "Lỗi server xử lý đặt lịch."
  const parsed = await readJsonBody<RawBookingInput>(request);
  if (!parsed.ok) {
    return NextResponse.json({ success: false, message: parsed.message }, { status: 400 });
  }

  try {
    const body = parsed.data;
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { success: false, message: 'Dữ liệu đặt lịch không hợp lệ.' },
        { status: 400 }
      );
    }

    // Nếu client không gửi email → lấy từ session đăng nhập (server-side, bảo mật)
    if (!body.customerEmail && !body.email) {
      try {
        const session = await getServerSession(authOptions);
        if (session?.user?.email) {
          body.customerEmail = session.user.email;
        }
      } catch { /* ignore session errors */ }
    }

    const result = await createBooking(body);

    if (!result.success) {
      // Trùng khung giờ → 409 Conflict để client phân biệt với lỗi validate
      // thường (400). Message tiếng Việt đã ở trong result.error.
      return NextResponse.json(
        { success: false, message: result.error, slotTaken: result.slotTaken },
        { status: result.slotTaken ? 409 : 400 }
      );
    }

    // Idempotent replay: request đã xử lý trước đó — trả 200 với booking cũ,
    // client hiển thị thành công bình thường. KHÔNG tạo booking mới, KHÔNG
    // gửi email lần 2.
    if (result.duplicate) {
      return NextResponse.json(
        {
          success: true,
          appointmentId: result.booking?.id,
          duplicate: true,
          message: 'Đặt lịch của bạn đã được ghi nhận trước đó.',
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        appointmentId: result.booking?.id,
        message: result.mailWarning
          ? 'Đã ghi nhận đặt lịch (email thông báo gửi không thành công).'
          : 'Đã ghi nhận đặt lịch và gửi email thông báo thành công!',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('❌ Lỗi API booking:', error);
    return NextResponse.json(
      { success: false, message: 'Lỗi server xử lý đặt lịch.' },
      { status: 500 }
    );
  }
}
