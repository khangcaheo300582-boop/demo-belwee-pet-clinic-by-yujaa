import { NextResponse } from 'next/server';
import { CHANGE_PASSWORD_SCHEMA } from '@/lib/auth-schemas';
import { changePassword } from '@/lib/auth-service';
import { rateLimitChangePassword } from '@/lib/auth-rate-limit';
import { extractBearerToken, verifyToken } from '@/lib/auth-tokens';
import { requireEnv } from '@/lib/env-check';

export async function POST(request: Request) {
  const envError = requireEnv();
  if (envError) return envError;

  const token = extractBearerToken(request);
  if (!token) {
    return NextResponse.json({ success: false, message: 'Thiếu access token.' }, { status: 401 });
  }

  const payload = verifyToken(token);
  if (!payload || payload.type !== 'access') {
    return NextResponse.json({ success: false, message: 'Access token không hợp lệ hoặc đã hết hạn.' }, { status: 401 });
  }

  const rl = rateLimitChangePassword(payload.sub);
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

  const parsed = CHANGE_PASSWORD_SCHEMA.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: parsed.error.issues[0]?.message || 'Thông tin không hợp lệ.' },
      { status: 400 }
    );
  }

  const { current_password, new_password, revoke_other_sessions } = parsed.data;

  const result = await changePassword(payload.sub, current_password, new_password, revoke_other_sessions);

  if (!result.ok) {
    return NextResponse.json({ success: false, message: result.error }, { status: 400 });
  }

  return NextResponse.json({ success: true, message: 'Đổi mật khẩu thành công.' });
}
