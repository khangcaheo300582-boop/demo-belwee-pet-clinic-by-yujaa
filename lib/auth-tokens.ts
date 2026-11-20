// lib/auth-tokens.ts
// JWT access/refresh token management using Node's built-in crypto (HMAC-SHA256).
// No external dependencies — keeps the bundle lean and avoids import issues.
//
// Token format:  <base64url(header)>.<base64url(payload)>.<base64url(signature)>
// Access token:  short-lived (15 min), used in Authorization: Bearer header.
// Refresh token: long-lived (7 days), stored in HttpOnly cookie (Web) or
//                Secure Storage (Mobile). Rotated on every refresh.

import crypto from 'crypto';

// ─── Configuration ──────────────────────────────────────────────────
const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000;       // 15 minutes
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || process.env.STAFF_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET / NEXTAUTH_SECRET must contain at least 32 characters.');
  }
  return secret;
}

// ─── Base64url helpers ───────────────────────────────────────────────
function base64UrlEncode(input: string | Buffer): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(input: string): Buffer {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((input.length + 3) % 4);
  return Buffer.from(padded, 'base64');
}

// ─── Types ───────────────────────────────────────────────────────────
export interface TokenPayload {
  sub: string;        // user id
  email: string;
  name: string;
  role?: string;
  type: 'access' | 'refresh';
  iat: number;        // issued at (epoch ms)
  exp: number;        // expires at (epoch ms)
  jti?: string;       // JWT ID (for refresh token rotation / revocation)
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;  // seconds until access token expires
}

// ─── Sign ────────────────────────────────────────────────────────────
type SignPayload = {
  sub?: string;
  id?: string;
  email: string;
  name: string;
  role?: string;
};

export function signAccessToken(payload: SignPayload): string {
  const now = Date.now();
  const full: TokenPayload = {
    sub: payload.sub ?? payload.id ?? '',
    email: payload.email,
    name: payload.name,
    role: payload.role,
    type: 'access',
    iat: now,
    exp: now + ACCESS_TOKEN_TTL_MS,
  };
  return signToken(full);
}

export function signRefreshToken(payload: SignPayload): string {
  const now = Date.now();
  const jti = crypto.randomUUID();
  const full: TokenPayload = {
    sub: payload.sub ?? payload.id ?? '',
    email: payload.email,
    name: payload.name,
    role: payload.role,
    type: 'refresh',
    iat: now,
    exp: now + REFRESH_TOKEN_TTL_MS,
    jti,
  };
  return signToken(full);
}

function signToken(payload: TokenPayload): string {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64UrlEncode(JSON.stringify(payload));
  const signature = base64UrlEncode(
    crypto.createHmac('sha256', getJwtSecret()).update(`${header}.${body}`).digest()
  );
  return `${header}.${body}.${signature}`;
}

// ─── Verify ──────────────────────────────────────────────────────────
export function verifyToken(token: string): TokenPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [header, body, signature] = parts;
  const expectedSig = base64UrlEncode(
    crypto.createHmac('sha256', getJwtSecret()).update(`${header}.${body}`).digest()
  );

  // Constant-time comparison to prevent timing attacks
  const sigBuf = Buffer.from(signature, 'utf8');
  const expBuf = Buffer.from(expectedSig, 'utf8');
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(body).toString('utf8')) as TokenPayload;
    if (!payload.sub || typeof payload.exp !== 'number') return null;
    if (payload.exp < Date.now()) return null; // expired
    return payload;
  } catch {
    return null;
  }
}

// ─── Issue pair ──────────────────────────────────────────────────────
export function issueTokenPair(user: { id: string; email: string; name: string; role?: string }): TokenPair {
  const base = { sub: user.id, email: user.email, name: user.name, role: user.role };
  return {
    accessToken: signAccessToken(base),
    refreshToken: signRefreshToken(base),
    expiresIn: Math.floor(ACCESS_TOKEN_TTL_MS / 1000),
  };
}

// ─── Extractors ──────────────────────────────────────────────────────
export function extractBearerToken(request: Request): string | null {
  const auth = request.headers.get('authorization');
  if (!auth) return null;
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

export function extractRefreshTokenFromCookie(request: Request): string | null {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/(?:^|;\s*)belwee_refresh_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export { ACCESS_TOKEN_TTL_MS, REFRESH_TOKEN_TTL_MS };
