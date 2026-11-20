// app/api/auth/verify-otp/route.ts
// Real OTP verification → User creation with hashed password → Auto-login ready

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { dbOtp } from '@/lib/dbOtp';
import { dbUser } from '@/lib/dbUser';
import { validateEmail, validatePassword, validateOtpCode, validateName } from '@/lib/validators';
import { audit, clientIpFrom } from '@/security/audit';
import { isDuplicateUserError } from '@/lib/dbUser';

const VERIFY_OTP_SCHEMA = z.object({
  email: z.string().max(254),
  otpCode: z.string().max(16),
  password: z.string().max(128),
  name: z.string().max(100).optional(),
});

export async function POST(request: Request) {
  const ip = clientIpFrom(request);
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ message: 'Dữ liệu không hợp lệ.' }, { status: 400 });
    }

    const parsedBody = VERIFY_OTP_SCHEMA.safeParse(body);
    if (!parsedBody.success) {
      return NextResponse.json(
        { message: parsedBody.error.issues[0]?.message || 'Dữ liệu không hợp lệ.' },
        { status: 400 }
      );
    }
    const { email, otpCode, password, name } = parsedBody.data;

    // 1. Validate all fields
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

    if (name && name.trim().length > 0) {
      const nameError = validateName(name);
      if (nameError) {
        return NextResponse.json({ message: nameError.message }, { status: 400 });
      }
    }

    const targetEmail = email.toLowerCase().trim();

    // 2. Check if the user already exists BEFORE verifying the OTP.
    const existingUser = await dbUser.findByEmail(targetEmail);
    if (existingUser) {
      if (existingUser.provider === 'google' && !existingUser.password) {
        return NextResponse.json(
          { message: 'Email này đã được đăng ký bằng Google. Vui lòng đăng nhập bằng nút Google.' },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { message: 'Email này đã được đăng ký. Vui lòng chuyển sang tab đăng nhập.' },
        { status: 409 }
      );
    }

    // 3. Verify OTP (handles expiration, max attempts, code match)
    const otpResult = await dbOtp.verify(targetEmail, otpCode, 'register');
    if (!otpResult.success) {
      await audit('OTP_VERIFY_FAILED', { ip, email: targetEmail });
      return NextResponse.json({ message: otpResult.error }, { status: 400 });
    }

    // 4. Create user with bcrypt-hashed password
    let user;
    try {
      user = await dbUser.create({
        email: targetEmail,
        password,
        name: (name && name.trim()) || targetEmail.split('@')[0],
        provider: 'credentials',
      });
    } catch (error) {
      if (isDuplicateUserError(error)) {
        return NextResponse.json(
          { message: 'Email này đã được đăng ký. Vui lòng chuyển sang tab đăng nhập.' },
          { status: 409 }
        );
      }
      throw error;
    }

    await audit('REGISTER', { ip, email: targetEmail, staffId: user.id });
    await audit('OTP_VERIFY_SUCCESS', { ip, email: targetEmail });

    return NextResponse.json(
      {
        message: 'Tài khoản đã được khởi tạo thành công!',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('--- LỖI HỆ THỐNG API VERIFY-OTP ---:', error);
    return NextResponse.json({ message: 'Lỗi hệ thống xác thực.' }, { status: 500 });
  }
}
