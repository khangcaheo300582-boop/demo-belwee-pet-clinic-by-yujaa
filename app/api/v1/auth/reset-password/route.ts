import { NextResponse } from 'next/server';
import { RESET_PASSWORD_SCHEMA } from '@/lib/auth-schemas';
import { resetPassword } from '@/lib/auth-service';
import { rateLimitResetPassword } from '@/lib/auth-rate-limit';
import { clientIpFrom } from '@/security/audit';
import { requireEnv } from '@/lib/env-check';

export async function POST(request: Request) {
  const envError = requireEnv();
  if (envError) return envError;

  const ip = clientIpFrom(request);

  const rl = rateLimitResetPassword(ip);
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, message: `Quá nhiều lần thử. Vui lòng thử lại sau ${rl.retryAfterSeconds} giây.` },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: 'Dữ liệu gửi lên không hợp lệ.' }, { status: 400 });
  }

  const parsed = RESET_PASSWORD_SCHEMA.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: parsed.error.issues[0]?.message || 'Thông tin không hợp lệ.' },
      { status: 400 }
    );
  }

  const { token, otp, new_password } = parsed.data;

  const result = await resetPassword(token, otp, new_password);

  if (!result.ok) {
    return NextResponse.json({ success: false, message: result.error }, { status: 400 });
  }

  return NextResponse.json({ success: true, message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại.' });
}
