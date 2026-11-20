import { NextResponse } from 'next/server';
import { FORGOT_PASSWORD_SCHEMA } from '@/lib/auth-schemas';
import { forgotPassword } from '@/lib/auth-service';
import { rateLimitForgotPassword } from '@/lib/auth-rate-limit';
import { clientIpFrom } from '@/security/audit';
import { requireEnv } from '@/lib/env-check';

export async function POST(request: Request) {
  const envError = requireEnv();
  if (envError) return envError;

  const ip = clientIpFrom(request);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: 'Dữ liệu gửi lên không hợp lệ.' }, { status: 400 });
  }

  const parsed = FORGOT_PASSWORD_SCHEMA.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: parsed.error.issues[0]?.message || 'Thông tin không hợp lệ.' },
      { status: 400 }
    );
  }

  const { identity, platform } = parsed.data;
  const rl = rateLimitForgotPassword(ip, identity);
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, message: `Quá nhiều lần thử. Vui lòng thử lại sau ${rl.retryAfterSeconds} giây.` },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
    );
  }

  const result = await forgotPassword(identity, platform);

  return NextResponse.json({ success: result.ok, message: result.message });
}
