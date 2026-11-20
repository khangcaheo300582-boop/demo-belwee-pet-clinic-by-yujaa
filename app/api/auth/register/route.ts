// app/api/auth/register/route.ts
// Deprecated: registration goes through OTP flow via /api/auth/send-otp + /api/auth/verify-otp

import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { error: 'Endpoint này không còn được sử dụng. Vui lòng đăng ký qua trang /dang-nhap.' },
    { status: 410 }
  );
}
