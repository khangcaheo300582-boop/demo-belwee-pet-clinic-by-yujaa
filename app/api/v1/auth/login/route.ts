import { NextResponse } from 'next/server';
import { LOGIN_SCHEMA } from '@/lib/auth-schemas';
import { login } from '@/lib/auth-service';
import { rateLimitLogin } from '@/lib/auth-rate-limit';
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

  const parsed = LOGIN_SCHEMA.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: parsed.error.issues[0]?.message || 'Thông tin không hợp lệ.' },
      { status: 400 }
    );
  }

  const { identity, password, device_info } = parsed.data;
  const rl = rateLimitLogin(ip, identity);
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, message: `Quá nhiều lần thử. Vui lòng thử lại sau ${rl.retryAfterSeconds} giây.` },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
    );
  }

  const result = await login(identity, password);

  if (!result.ok) {
    return NextResponse.json(
      {
        success: false,
        message: result.error,
        locked: result.locked ?? false,
        retryAfterSeconds: result.retryAfterSeconds ?? 0,
      },
      { status: 401 }
    );
  }

  const isMobile = device_info?.device_type === 'mobile';

  // Set refresh token cookie for Web (PC)
  const response = NextResponse.json({
    success: true,
    user: result.user,
    accessToken: result.tokens!.accessToken,
    // Mobile gets refresh token in body; Web gets it via cookie
    ...(isMobile ? { refreshToken: result.tokens!.refreshToken } : {}),
    expiresIn: result.tokens!.expiresIn,
  });

  if (!isMobile) {
    response.cookies.set('belwee_refresh_token', result.tokens!.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });
  }

  return response;
}
