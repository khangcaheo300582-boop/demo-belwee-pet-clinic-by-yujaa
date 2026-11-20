// app/api/staff/login/route.ts
// Single-phase staff authentication (file-backed via lib/staff-service.ts):
//   POST { email, pin }  →  sets the staff session cookie
//
// PIN is the ONLY credential. The previous email+password step is removed
// outright — see lib/staff-service.ts for why a shared second factor did not
// identify anyone. Brute force is handled per-account inside the service
// (5 wrong PINs ⇒ 5-minute lock), not by a replayable step token.

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ensureSeedStaff, verifyStaffPin, sanitizeStaff, touchLastLogin, PIN_PATTERN } from '@/lib/staff-service';
import { setStaffSessionCookie } from '@/lib/staffSession';
import { audit, clientIpFrom } from '@/security/audit';

const LOGIN_SCHEMA = z.object({
  email: z.string().trim().min(1, 'Email không được để trống.').email('Email không hợp lệ.'),
  pin: z.string().regex(PIN_PATTERN, 'Mã PIN phải gồm đúng 6 chữ số.'),
});

export async function POST(request: NextRequest) {
  // Seeding is opt-in (ALLOW_STAFF_SEED) and must never block a real sign-in:
  // a read error here would otherwise surface as an opaque 500 before the
  // credentials were even checked.
  try {
    await ensureSeedStaff();
  } catch (error) {
    console.warn('[staff/login] bỏ qua bước seed do lỗi đọc kho dữ liệu:', error);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: 'Dữ liệu gửi lên không hợp lệ.' }, { status: 400 });
  }

  const parsed = LOGIN_SCHEMA.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      { success: false, message: first?.message || 'Thông tin đăng nhập không hợp lệ.' },
      { status: 400 }
    );
  }

  let check: Awaited<ReturnType<typeof verifyStaffPin>>;
  try {
    check = await verifyStaffPin(parsed.data.email, parsed.data.pin);
  } catch (error) {
    console.error('[staff/login] không đọc được kho tài khoản nhân viên:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Hệ thống đăng nhập đang bận. Vui lòng thử lại sau ít phút.',
      },
      { status: 503 }
    );
  }

  if (!check.ok) {
    await audit('STAFF_LOGIN_FAILED', {
      ip: clientIpFrom(request),
      email: parsed.data.email.toLowerCase().trim(),
      detail: check.locked ? 'pin locked' : 'pin phase',
    });
    return NextResponse.json(
      {
        success: false,
        message: check.error,
        locked: check.locked ?? false,
        retryAfterSeconds: check.retryAfterSeconds ?? 0,
      },
      { status: 401 }
    );
  }

  const staff = sanitizeStaff(check.staff);
  await setStaffSessionCookie(staff);
  // Best-effort bookkeeping: losing this timestamp must not fail a sign-in that
  // already succeeded, and an unhandled rejection would crash the worker.
  void touchLastLogin(staff.id).catch((error) => {
    console.warn('[staff/login] không cập nhật được lastLoginAt:', error);
  });
  await audit('STAFF_LOGIN_SUCCESS', {
    ip: clientIpFrom(request),
    email: staff.email,
    staffId: staff.id,
  });

  return NextResponse.json({
    success: true,
    ok: true,
    staff,
    message: `Xin chào ${staff.name}!`,
  });
}