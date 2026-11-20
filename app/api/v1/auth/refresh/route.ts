import { NextResponse } from 'next/server';
import { REFRESH_TOKEN_SCHEMA } from '@/lib/auth-schemas';
import { refreshAccessToken } from '@/lib/auth-service';
import { extractRefreshTokenFromCookie } from '@/lib/auth-tokens';
import { requireEnv } from '@/lib/env-check';

export async function POST(request: Request) {
  const envError = requireEnv();
  if (envError) return envError;

  let refreshToken: string | null = null;

  // Mobile: refresh token in body
  try {
    const body = await request.json();
    const parsed = REFRESH_TOKEN_SCHEMA.safeParse(body);
    if (parsed.success && parsed.data.refresh_token) {
      refreshToken = parsed.data.refresh_token;
    }
  } catch {
    // No body or invalid JSON — try cookie
  }

  // Web: refresh token in HttpOnly cookie
  if (!refreshToken) {
    refreshToken = extractRefreshTokenFromCookie(request);
  }

  if (!refreshToken) {
    return NextResponse.json({ success: false, message: 'Thiếu refresh token.' }, { status: 401 });
  }

  const result = await refreshAccessToken(refreshToken);

  if (!result.ok) {
    return NextResponse.json({ success: false, message: result.error }, { status: 401 });
  }

  // Rotate cookie for Web
  const response = NextResponse.json({
    success: true,
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    expiresIn: result.expiresIn,
  });

  response.cookies.set('belwee_refresh_token', result.refreshToken!, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 7 * 24 * 60 * 60,
  });

  return response;
}
