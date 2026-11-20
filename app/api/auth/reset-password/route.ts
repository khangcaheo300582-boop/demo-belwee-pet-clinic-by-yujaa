import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { dbOtp } from '@/lib/dbOtp';
import { dbUser } from '@/lib/dbUser';
import { dbAuthSession } from '@/lib/dbAuthSession';
import { validateEmail, validateOtpCode, validatePassword } from '@/lib/validators';
import { audit, clientIpFrom } from '@/security/audit';
import { z } from 'zod';

const RESET_PASSWORD_SCHEMA = z.object({
  email: z.string().max(254),
  otpCode: z.string().max(16),
  password: z.string().max(128),
});

const PASSWORD_HISTORY_SIZE = 3;
const BCRYPT_ROUNDS = 12;

export async function POST(request: Request) {
  const ip = clientIpFrom(request);
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ message: 'Dữ liệu không hợp lệ hoặc hệ thống gặp sự cố.' }, { status: 400 });
    }

    const parsedBody = RESET_PASSWORD_SCHEMA.safeParse(body);
    if (!parsedBody.success) {
      return NextResponse.json(
        { message: parsedBody.error.issues[0]?.message || 'Dữ liệu không hợp lệ.' },
        { status: 400 }
      );
    }
    const { email, otpCode, password } = parsedBody.data;

    const emailError = validateEmail(email);
    if (emailError) {
      return NextResponse.json({ message: emailError.message }, { status: 400 });
    }
    const otpError = validateOtpCode(otpCode);
    if (otpError) {
      return NextResponse.json({ message: otpError.message }, { status: 400 });
    }
    const passwordError = validatePassword(password);
    if (passwordError) {
      return NextResponse.json({ message: passwordError.message }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await dbUser.findByEmail(normalizedEmail);
    if (!user) {
      return NextResponse.json({ message: 'Email hoặc mã OTP không hợp lệ.' }, { status: 400 });
    }

    const otpResult = await dbOtp.verify(normalizedEmail, otpCode.trim(), 'reset');
    if (!otpResult.success) {
      await audit('OTP_VERIFY_FAILED', { ip, email: normalizedEmail });
      return NextResponse.json({ message: otpResult.error }, { status: 400 });
    }

    for (const oldHash of user.passwordHistory ?? []) {
      if (await bcrypt.compare(password, oldHash)) {
        return NextResponse.json({ message: 'Mật khẩu mới không được trùng với 3 mật khẩu gần nhất.' }, { status: 400 });
      }
    }

    const newHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const updated = await dbUser.rotatePassword(user.id, newHash, PASSWORD_HISTORY_SIZE);
    if (!updated) {
      return NextResponse.json({ message: 'Không thể cập nhật mật khẩu. Vui lòng thử lại.' }, { status: 500 });
    }

    await dbAuthSession.revokeAllForUser(user.id);

    await audit('PASSWORD_RESET', { ip, email: normalizedEmail });

    return NextResponse.json({
      message: 'Đặt lại mật khẩu thành công.',
      sessionReady: true,
      user: { id: user.id, email: user.email, name: user.name },
    });
  } catch (error) {
    console.error('--- LỖI HỆ THỐNG API RESET-PASSWORD ---:', error);
    return NextResponse.json({ message: 'Dữ liệu không hợp lệ hoặc hệ thống gặp sự cố.' }, { status: 400 });
  }
}
