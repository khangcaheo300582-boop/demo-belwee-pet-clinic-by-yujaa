import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { z } from 'zod';
import { dbOtp } from '@/lib/dbOtp';
import { findStaffByEmail, resetStaffPin, validateStaffPin, PIN_PATTERN } from '@/lib/staff-service';
import { audit, clientIpFrom } from '@/security/audit';
import { requireEnv } from '@/lib/env-check';

/**
 * Constant-time string comparison for the recovery code.
 *
 * `!==` short-circuits on the first differing character, so the time to reject
 * leaks how much of the code the caller guessed. Both sides are already
 * validated as six digits, so the lengths match; guard anyway to keep
 * timingSafeEqual from throwing on a malformed input.
 */
function timingSafeEqualStrings(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

/**
 * One generic sentence for every account/recovery failure.
 *
 * The recovery code is shared across every staff account, so a caller who can
 * tell "wrong recovery code" apart from "no such account" can brute-force the
 * shared secret against emails that do not even exist. Every failure that is not
 * about the caller's own OTP attempt count returns this exact string.
 */
const GENERIC_RESET_FAILURE = 'Email, mã OTP hoặc mã khôi phục không đúng.';

const SIX_DIGITS = /^\d{6}$/;

const RESET_SCHEMA = z
  .object({
    email: z.string().trim().email('Email không hợp lệ.').max(254),
    otpCode: z.string().trim().regex(SIX_DIGITS, 'Mã OTP phải gồm đúng 6 chữ số.'),
    // `recoveryCode` is the current field name; `employeeCode` is accepted as a
    // legacy alias so a page cached from before the rename does not 400.
    recoveryCode: z.string().trim().regex(SIX_DIGITS, 'Mã khôi phục phải gồm đúng 6 chữ số.').optional(),
    employeeCode: z.string().trim().regex(SIX_DIGITS, 'Mã khôi phục phải gồm đúng 6 chữ số.').optional(),
    pin: z.string().trim().regex(PIN_PATTERN, 'Mã PIN mới phải gồm đúng 6 chữ số.'),
  })
  .refine((data) => Boolean(data.recoveryCode || data.employeeCode), {
    message: 'Mã khôi phục phải gồm đúng 6 chữ số.',
    path: ['recoveryCode'],
  });

export async function POST(request: Request) {
  // Kiểm tra toàn bộ biến môi trường bắt buộc trước khi xử lý,
  // bao gồm STAFF_RECOVERY_CODE (gây 503 nếu thiếu).
  const envError = requireEnv();
  if (envError) return envError;

  // requireEnv() ở trên đã bắt lỗi nếu STAFF_RECOVERY_CODE thiếu. Gán '' để
  // làm hài TypeScript; giá trị thực luôn không rỗng khi đến đây.
  const expectedRecoveryCode = process.env.STAFF_RECOVERY_CODE?.trim() ?? '';

  const ip = clientIpFrom(request);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: 'Dữ liệu gửi lên không hợp lệ.' }, { status: 400 });
  }

  const parsed = RESET_SCHEMA.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: parsed.error.issues[0]?.message || 'Thông tin không hợp lệ.' },
      { status: 400 }
    );
  }

  const email = parsed.data.email.toLowerCase();
  const submittedCode = (parsed.data.recoveryCode ?? parsed.data.employeeCode) as string;

  // 1. Reject an obviously weak new PIN before touching the OTP, so a typo in the
  //    desired PIN does not burn the code.
  const pinError = validateStaffPin(parsed.data.pin);
  if (pinError) {
    return NextResponse.json(
      { success: false, message: pinError.replace('Mã PIN', 'Mã PIN mới') },
      { status: 400 }
    );
  }

  // 2. Verify the OTP FIRST. It is single-use, expires in five minutes and the
  //    send endpoint enforces a five-minute resend cooldown, so making it a
  //    precondition means each recovery-code guess costs the caller a fresh code.
  //    The old order compared the shared recovery code before any OTP check,
  //    which left the six-digit secret brute-forceable without proving control
  //    of the mailbox at all.
  let otp: Awaited<ReturnType<typeof dbOtp.verify>>;
  try {
    otp = await dbOtp.verify(email, parsed.data.otpCode, 'staff-reset');
  } catch (error) {
    console.error('[staff/reset-pin] không đọc được kho OTP:', error);
    return NextResponse.json(
      { success: false, message: 'Hệ thống cấp lại PIN đang bận. Vui lòng thử lại sau ít phút.' },
      { status: 503 }
    );
  }
  if (!otp.success) {
    await audit('OTP_VERIFY_FAILED', { ip, email });
    return NextResponse.json({ success: false, message: otp.error }, { status: 400 });
  }

  // 3. Only now does the account have to exist and be active.
  let staff: Awaited<ReturnType<typeof findStaffByEmail>>;
  try {
    staff = await findStaffByEmail(email);
  } catch (error) {
    console.error('[staff/reset-pin] không đọc được kho tài khoản nhân viên:', error);
    return NextResponse.json(
      { success: false, message: 'Hệ thống cấp lại PIN đang bận. Vui lòng thử lại sau ít phút.' },
      { status: 503 }
    );
  }
  if (!staff?.isActive) {
    return NextResponse.json({ success: false, message: GENERIC_RESET_FAILURE }, { status: 400 });
  }

  // 4. Compare the shared recovery code in constant time, and answer with the
  //    same generic sentence whether the code was wrong, so no message can be
  //    used as an oracle for the secret.
  if (!timingSafeEqualStrings(submittedCode, expectedRecoveryCode)) {
    await audit('STAFF_LOGIN_FAILED', { ip, email, detail: 'PIN reset rejected: invalid recovery code' });
    return NextResponse.json({ success: false, message: GENERIC_RESET_FAILURE }, { status: 400 });
  }

  let reset: Awaited<ReturnType<typeof resetStaffPin>>;
  try {
    reset = await resetStaffPin(email, parsed.data.pin);
  } catch (error) {
    console.error('[staff/reset-pin] không ghi được PIN mới:', error);
    return NextResponse.json(
      { success: false, message: 'Hệ thống cấp lại PIN đang bận. Vui lòng thử lại sau ít phút.' },
      { status: 503 }
    );
  }
  if (!reset.ok) {
    return NextResponse.json({ success: false, message: reset.error }, { status: 400 });
  }

  await audit('STAFF_PIN_RESET', { ip, email, staffId: reset.staff.id });
  return NextResponse.json({ success: true, message: 'Cấp lại mã PIN thành công. Vui lòng đăng nhập lại.' });
}
