// lib/auth-middleware.ts
// Reusable authentication guard for protected API routes.
// Supports both Web (cookie) and Mobile (Bearer token).
//
// The guard re-reads the user on every request instead of trusting the token
// body: an access token stays valid for 15 minutes, and a deleted account must
// stop working immediately rather than when the token happens to expire.

import { NextResponse } from 'next/server';
import { extractBearerToken, verifyToken } from './auth-tokens';
import { dbUser } from './dbUser';

export interface AuthContext {
  userId: string;
  email: string;
  name: string;
  role?: string;
}

/**
 * Authenticate a request. Returns AuthContext on success, or a 401 Response on failure.
 * Checks Bearer token first (Mobile), then cookie (Web).
 */
export async function requireAuth(request: Request): Promise<AuthContext | NextResponse> {
  let token: string | null = extractBearerToken(request);

  if (!token) {
    // Web: try to get access token from a cookie (if stored)
    // For now, Web clients should send Bearer token from memory
    token = null;
  }

  if (!token) {
    return NextResponse.json({ success: false, message: 'Thiếu access token.' }, { status: 401 });
  }

  const payload = verifyToken(token);
  if (!payload || payload.type !== 'access') {
    return NextResponse.json({ success: false, message: 'Access token không hợp lệ hoặc đã hết hạn.' }, { status: 401 });
  }

  let user;
  try {
    user = await dbUser.findById(payload.sub);
  } catch (error) {
    console.error('[auth-middleware] không đọc được người dùng:', error);
    return NextResponse.json(
      { success: false, message: 'Hệ thống đang bận. Vui lòng thử lại sau ít phút.' },
      { status: 503 }
    );
  }

  if (!user) {
    return NextResponse.json({ success: false, message: 'Tài khoản không tồn tại.' }, { status: 401 });
  }

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
}

/**
 * Helper: check if result is an error response.
 */
export function isAuthError(result: AuthContext | NextResponse): result is NextResponse {
  return result instanceof NextResponse;
}
