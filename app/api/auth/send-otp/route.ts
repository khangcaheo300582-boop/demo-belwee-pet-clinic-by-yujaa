// app/api/auth/send-otp/route.ts
// FIXED: Uses real file-based OTP DB, proper rate limiting, validation

import { NextResponse } from 'next/server';
import { sendOtpEmail } from '@/app/lib/mail-service';
import { dbOtp, OtpCooldownError, OTP_COOLDOWN_SECONDS, OTP_SEND_COOLDOWN_SECONDS } from '@/lib/dbOtp';
import { rateLimitSendOtp } from '@/lib/auth-rate-limit';
import { validateEmail } from '@/lib/validators';
import { dbUser } from '@/lib/dbUser';
import { findStaffByEmail } from '@/lib/staff-service';
import { audit, clientIpFrom } from '@/security/audit';
import { z } from 'zod';
import { requireEnv } from '@/lib/env-check';

const SEND_OTP_SCHEMA = z.object({
  email: z.string().max(254),
  type: z.enum(['register', 'reset', 'staff-reset']),
});

function maskEmail(email: string): string {
  if (email.length <= 4) return '***';
  return email.slice(0, 2) + '***@' + email.split('@')[1];
}

function logOtpSending(targetEmail: string, type: string): void {
  console.log(`[send-otp] Preparing OTP: email=${maskEmail(targetEmail)} type=${type} to=${maskEmail(targetEmail)}`);
}

export async function POST(request: Request) {
  const ip = clientIpFrom(request);

  // Kiểm tra toàn bộ biến môi trường bắt buộc trước khi xử lý,
  // bao gồm EMAIL_USER, EMAIL_PASS, OTP_HASH_SECRET.
  const envError = requireEnv();
  if (envError) return envError;

  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { message: 'Dữ liệu yêu cầu không hợp lệ hoặc trống.' },
        { status: 400 }
      );
    }

    const parsedBody = SEND_OTP_SCHEMA.safeParse(body);
    if (!parsedBody.success) {
      return NextResponse.json(
        { message: parsedBody.error.issues[0]?.message || 'Loại yêu cầu OTP không hợp lệ.' },
        { status: 400 }
      );
    }
    const { email, type } = parsedBody.data;

    // 1. Validate email format
    const emailError = validateEmail(email);
    if (emailError) {
      return NextResponse.json(
        { message: emailError.message },
        { status: 400 }
      );
    }

    const targetEmail = email.toLowerCase().trim();

    if (type === 'register' && await dbUser.emailExists(targetEmail)) {
      return NextResponse.json(
        { message: 'Email này đã được đăng ký. Vui lòng chuyển sang đăng nhập.' },
        { status: 409 }
      );
    }

    let staffAccount;
    if (type === 'staff-reset') {
      staffAccount = await findStaffByEmail(targetEmail);
    }
    const accountExists = type === 'staff-reset'
      ? Boolean(staffAccount?.isActive)
      : await dbUser.emailExists(targetEmail);

    if (type !== 'register' && !accountExists) {
      if (type === 'staff-reset') {
        // staff-reset yêu cầu tài khoản nhân viên tồn tại và đang active.
        // Trả 404 rõ ràng thay vì 200 giả tạo (không gửi mail) như trước.
        return NextResponse.json(
          { message: 'Không tìm thấy tài khoản nhân viên active với email này.' },
          { status: 404 }
        );
      }

      // Theo yêu cầu sản phẩm: khách phải biết email chưa có tài khoản và được
      // chuyển sang trang đăng ký, thay vì báo "đã gửi" trong khi không gửi gì.
      // Đánh đổi có chủ đích: endpoint trở thành nơi kiểm tra email đã đăng ký
      // hay chưa (mất tính chống dò email). Nếu cần siết lại, đổi `code` thành
      // chuỗi trung tính và bỏ `status: 404`, phía UI sẽ tự quay về thông báo cũ.
      console.warn(
        `[send-otp] Không có tài khoản khách hàng cho email=${maskEmail(targetEmail)}. ` +
          'Trả 404 ACCOUNT_NOT_FOUND để trang quên mật khẩu chuyển sang đăng ký (không gửi thư).'
      );
      return NextResponse.json(
        {
          code: 'ACCOUNT_NOT_FOUND',
          message: 'Email này chưa được đăng ký tài khoản tại Belwee Pet Clinic.',
          registerUrl: '/dang-nhap?mode=register',
        },
        { status: 404 }
      );
    }

    // 2. Rate limit theo IP + email + type: cooldown 60s, tối đa 5 lần/giờ
    const rateLimitResult = rateLimitSendOtp(ip, targetEmail, type);
    if (!rateLimitResult.allowed) {
      const retryAfter = rateLimitResult.retryAfterSeconds > 0
        ? rateLimitResult.retryAfterSeconds
        : OTP_COOLDOWN_SECONDS;
      return new NextResponse(
        JSON.stringify({
          message: `Vui lòng đợi ${retryAfter} giây rồi thử lại.`,
          cooldownSeconds: retryAfter,
        }),
        {
          status: 429,
          headers: { 'Retry-After': String(retryAfter) },
        }
      );
    }

    // 3. Generate OTP and persist to DB (5-minute TTL)
    const otpCode = dbOtp.generateCode();
    try {
      await dbOtp.upsert(targetEmail, otpCode, type);
    } catch (error) {
      if (error instanceof OtpCooldownError) {
        const retryAfter = error.cooldownSeconds > 0 ? error.cooldownSeconds : OTP_COOLDOWN_SECONDS;
        return new NextResponse(
          JSON.stringify({
            message: `Vui lòng đợi ${retryAfter} giây rồi thử lại.`,
            cooldownSeconds: retryAfter,
          }),
          { status: 429, headers: { 'Retry-After': String(retryAfter) } }
        );
      }
      throw error;
    }

    // 4. Send email via SMTP
    logOtpSending(targetEmail, type);
    try {
      await sendOtpEmail(targetEmail, otpCode, type);
      console.log(`[send-otp] OTP sent OK to ${maskEmail(targetEmail)} (type=${type})`);
    } catch (mailError) {
      // Không nuốt lỗi gửi mail: log message/code để biết vì sao thư không đi,
      // và xoá bản ghi OTP vừa tạo để người dùng có thể thử lại ngay.
      const mailErr = mailError as { message?: string; code?: string; command?: string; responseCode?: number };
      console.error('[send-otp] Gửi email OTP thất bại:', {
        email: targetEmail,
        purpose: type,
        message: mailErr?.message ?? String(mailError),
        code: mailErr?.code ?? null,
        command: mailErr?.command ?? null,
        responseCode: mailErr?.responseCode ?? null,
      });
      await dbOtp.deleteByEmail(targetEmail, otpCode, type);
      return NextResponse.json(
        { message: 'Không thể gửi email OTP lúc này. Vui lòng thử lại sau ít phút.' },
        { status: 502 }
      );
    }

    await audit('OTP_SENT', { ip, email: targetEmail, detail: type });

    return NextResponse.json(
      { message: 'Mã xác thực OTP đã được gửi thành công vào email!', cooldownSeconds: OTP_SEND_COOLDOWN_SECONDS },
      { status: 200 }
    );

  } catch (error) {
    console.error('--- LỖI HỆ THỐNG API SEND-OTP ---:', error);
    return NextResponse.json(
      { message: 'Hệ thống gửi OTP gặp sự cố.' },
      { status: 500 }
    );
  }
}
