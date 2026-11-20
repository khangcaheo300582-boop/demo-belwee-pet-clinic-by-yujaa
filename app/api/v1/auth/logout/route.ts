import { NextResponse } from 'next/server';
import { logout } from '@/lib/auth-service';
import { extractRefreshTokenFromCookie, extractBearerToken, verifyToken } from '@/lib/auth-tokens';

export async function POST(request: Request) {
  const refreshToken: string | null = extractRefreshTokenFromCookie(request);

  if (!refreshToken) {
    const token = extractBearerToken(request);
    if (token) {
      void verifyToken(token);
      // If access token is valid, we can't revoke by jti (access tokens don't have jti in our impl)
      // Just clear the cookie
    }
  }

  if (refreshToken) {
    await logout(refreshToken);
  }

  const response = NextResponse.json({ success: true, message: 'Đăng xuất thành công.' });
  response.cookies.delete('belwee_refresh_token');

  return response;
}
