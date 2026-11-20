// middleware.ts
// Route protection for the staff portal.
//
//   • /staff/**     → redirect to /staff/login when the staff cookie is
//                     missing / invalid / expired.
//   • /api/staff/** → 401 JSON { success:false, message } (never an HTML
//                     redirect — API consumers need JSON).
//   • /staff/login  → always public.
//
// Runs on the edge runtime, so node:crypto is unavailable — the HMAC-SHA256
// check is re-implemented with Web Crypto. It must stay byte-compatible with
// lib/staffSession.ts: payload = JSON → base64url, sig = HMAC-SHA256 → base64url.
// The secret fallback chain lives in lib/staff-service.ts (getStaffAuthSecret);
// it is duplicated here because edge middleware cannot import node:crypto modules.

import { NextRequest, NextResponse } from 'next/server';
import { MAX_API_BODY_BYTES, MAX_UPLOAD_BODY_BYTES } from './security/config';
import { applySecurityHeaders } from './security/headers';
import { getApiBucket, isMutatingMethod, originRejection } from './security/request';
import { csrfErrorForMutatingRequest } from './security/csrf';
import { consumeRateLimit, getClientIp } from './security/rate-limit';
import { auditEdge } from './security/audit-edge';

const STAFF_SESSION_COOKIE = 'belwee_staff_session';
const LOGIN_PATH = '/staff/login';
const FORGOT_PIN_PATH = '/staff/forgot-pin';
// /staff/register không còn là cổng công khai (G7). Route vẫn còn file nhưng
// tự chuyển hướng về /staff/login; API trả 410. Cố tình KHÔNG liệt kê ở đây:
// không có gì cần bảo vệ, và để nó rơi vào nhánh 401 chung là đủ.

function getStaffAuthSecret(): string {
  const secret = process.env.STAFF_SESSION_SECRET || process.env.NEXTAUTH_SECRET;
  // ⚠️ Keep this fallback chain byte-identical to getStaffAuthSecret() in
  // lib/staff-service.ts (the module that actually SIGNS the staff cookie) and
  // lib/staffSession.ts. The previous `|| ''` here made the edge middleware
  // fail closed with an EMPTY key in every environment where neither
  // STAFF_SESSION_SECRET nor NEXTAUTH_SECRET was configured (e.g. a fresh dev
  // checkout with only .env.example present). Meanwhile lib/staff-service.ts
  // fell back to the development-only secret, so sessions issued by the app
  // were accepted by the login page but ALWAYS rejected by the middleware →
  // /staff/dashboard bounced to /staff/login?next=/staff/dashboard → the login
  // page saw a valid session → redirected back to /staff/dashboard → infinite
  // redirect loop.
  if (!secret) {
    // Fail closed in production (no usable secret ⇒ no session can be trusted).
    // Outside production, mirror the lib fallback so both sides agree.
    if (process.env.NODE_ENV === 'production') return '';
    return 'belwee-development-only-staff-secret';
  }
  return secret;
}

function base64UrlToBuffer(value: string): Uint8Array<ArrayBuffer> {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function verifyStaffToken(value: string | undefined): Promise<boolean> {
  if (!value) return false;
  const secret = getStaffAuthSecret();
  if (!secret) return false;
  const dot = value.indexOf('.');
  if (dot === -1) return false;

  const b64 = value.slice(0, dot);
  const sig = value.slice(dot + 1);

  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      base64UrlToBuffer(sig),
      new TextEncoder().encode(b64)
    );
    if (!valid) return false;

    const payload = JSON.parse(
      new TextDecoder().decode(base64UrlToBuffer(b64))
    ) as { sid?: string; exp?: number; pin?: boolean };
    if (!payload.sid || typeof payload.exp !== 'number') return false;
    if (payload.exp < Date.now()) return false;
    // pin:true is set ONLY after the 6-digit PIN was verified. Kept byte-for-
    // byte compatible with decode() in lib/staffSession.ts.
    if (payload.pin !== true) return false;
    return true;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isApi = pathname.startsWith('/api/');

  if (isApi) {
    const sizeLimit = pathname === '/api/staff/upload'
      ? MAX_UPLOAD_BODY_BYTES
      : MAX_API_BODY_BYTES;
    const contentLength = Number(request.headers.get('content-length') || 0);
    if (contentLength > sizeLimit) {
      return applySecurityHeaders(
        NextResponse.json({ success: false, message: 'Yêu cầu vượt quá kích thước cho phép.' }, { status: 413 }),
        request,
      );
    }

    if (isMutatingMethod(request.method)) {
      // 1) Same-origin / trusted-origin check (browser Origin header).
      const originProblem = originRejection(request);
      if (originProblem) {
        auditEdge('CSRF_REJECTED', {
          ip: getClientIp(request),
          detail: `${originProblem} on ${pathname}`,
        });
        return applySecurityHeaders(
          NextResponse.json({ success: false, message: 'Nguồn yêu cầu không được phép.' }, { status: 403 }),
          request,
        );
      }
      // 2) Sec-Fetch-Site CSRF check (modern browsers, unforgeable by forms).
      const csrfError = csrfErrorForMutatingRequest(request);
      if (csrfError) {
        auditEdge('CSRF_REJECTED', {
          ip: getClientIp(request),
          detail: `sec-fetch-site on ${pathname}`,
        });
        return applySecurityHeaders(
          NextResponse.json({ success: false, message: csrfError }, { status: 403 }),
          request,
        );
      }
    }

    const globalLimit = consumeRateLimit(request, 'global');
    const routeLimit = consumeRateLimit(request, getApiBucket(pathname, request.method));
    if (!globalLimit.allowed || !routeLimit.allowed) {
      const retryAfter = Math.max(globalLimit.retryAfterSeconds, routeLimit.retryAfterSeconds);
      // RATE_LIMITED was declared in the AuditEvent union but nothing ever
      // emitted it — the one place that CAN see a throttle is this middleware.
      auditEdge('RATE_LIMITED', {
        ip: getClientIp(request),
        detail: `${pathname} retryAfter=${retryAfter}s`,
      });
      const response = NextResponse.json(
        { success: false, message: 'Bạn gửi quá nhiều yêu cầu. Vui lòng thử lại sau.' },
        { status: 429 },
      );
      response.headers.set('Retry-After', String(retryAfter));
      return applySecurityHeaders(response, request);
    }
  }

  // Always-public endpoints — short-circuit before any auth check.
  // The staff auth endpoints MUST stay reachable while unauthenticated, or
  // nobody could ever sign in. `/api/staff/register` is deliberately ABSENT:
  // self-registration was removed (G7), so it no longer needs to be reachable
  // without a session — the route answers 410 for every method anyway.
  const STAFF_PUBLIC_PAGES = [LOGIN_PATH, FORGOT_PIN_PATH];
  const STAFF_PUBLIC_APIS = [
    '/api/staff/login',
    '/api/staff/reset-pin',
    // v1 auth public endpoints
    '/api/v1/auth/login',
    '/api/v1/auth/forgot-password',
    '/api/v1/auth/reset-password',
    '/api/v1/auth/refresh',
    '/api/v1/auth/logout',
  ];
  // v1 auth protected endpoints (require valid access token)
  const V1_AUTH_PROTECTED_APIS = ['/api/v1/auth/change-password'];
  if (
    STAFF_PUBLIC_PAGES.includes(pathname) ||
    STAFF_PUBLIC_APIS.includes(pathname)
  ) {
    return applySecurityHeaders(NextResponse.next(), request);
  }

  // ── v1 auth protected API: require Bearer access token ────────────────
  if (V1_AUTH_PROTECTED_APIS.some((p) => pathname.startsWith(p))) {
    const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      return applySecurityHeaders(NextResponse.json(
        { success: false, message: 'Thiếu access token.' },
        { status: 401 }
      ), request);
    }
    // Verify with node:crypto is unavailable on edge; use Web Crypto with
    // the same HMAC-SHA256 as lib/auth-tokens.ts. The secret chain must
    // match: JWT_SECRET || NEXTAUTH_SECRET || STAFF_SESSION_SECRET.
    const secret = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || process.env.STAFF_SESSION_SECRET || '';
    let tokenValid = false;
    if (secret && token.includes('.')) {
      try {
        const dot = token.indexOf('.');
        const dot2 = token.indexOf('.', dot + 1);
        const header = token.slice(0, dot);
        const body = token.slice(dot + 1, dot2);
        const sig = token.slice(dot2 + 1);
        const key = await crypto.subtle.importKey(
          'raw',
          new TextEncoder().encode(secret),
          { name: 'HMAC', hash: 'SHA-256' },
          false,
          ['verify']
        );
        const valid = await crypto.subtle.verify(
          'HMAC',
          key,
          base64UrlToBuffer(sig),
          new TextEncoder().encode(`${header}.${body}`)
        );
        if (valid) {
          const payload = JSON.parse(
            new TextDecoder().decode(base64UrlToBuffer(body))
          ) as { type?: string; exp?: number; sub?: string };
          if (payload.type === 'access' && typeof payload.exp === 'number' && payload.exp > Date.now()) {
            tokenValid = true;
          }
        }
      } catch {
        tokenValid = false;
      }
    }
    if (!tokenValid) {
      return applySecurityHeaders(NextResponse.json(
        { success: false, message: 'Access token không hợp lệ hoặc đã hết hạn.' },
        { status: 401 }
      ), request);
    }
    return applySecurityHeaders(NextResponse.next(), request);
  }

  // PERF: verifyStaffToken costs an async Web Crypto HMAC verify. Only the two
  // prefixes below actually gate on the staff cookie — every other page
  // (homepage, booking, blog, contact, customer portal) ignores the result.
  // Deciding that up front means public traffic never pays for the crypto, and
  // it also stops the promise from being created at all on the common path.
  const needsStaffAuth =
    pathname.startsWith('/staff/') ||
    (pathname.startsWith('/api/staff/') && !pathname.startsWith('/api/staff/files/'));

  const authed = needsStaffAuth
    ? await verifyStaffToken(request.cookies.get(STAFF_SESSION_COOKIE)?.value)
    : false;

  // ── API routes: JSON 401, never a redirect ──────────────────────────
  // Exception: /api/staff/files/<name> intentionally allows BOTH staff and
  // signed-in customers (medical-record attachments shown in the customer
  // portal). The route enforces that itself with getStaffSession() +
  // getServerSession(authOptions), so don't gate it on the staff cookie here.
  if (pathname.startsWith('/api/staff/') && !pathname.startsWith('/api/staff/files/')) {
    if (authed) return applySecurityHeaders(NextResponse.next(), request);
    return applySecurityHeaders(NextResponse.json(
      { success: false, message: '401 Unauthorized - Access Denied' },
      { status: 401 }
    ), request);
  }

  // ── Staff pages: bounce to login, preserving the original destination ─
  // Only /staff/** pages are protected. Every other page (homepage, booking,
  // auth, public content) is public and simply gets security headers applied.
  if (pathname.startsWith('/staff/')) {
    if (!authed) {
      const loginUrl = new URL(LOGIN_PATH, request.url);
      loginUrl.searchParams.set('next', pathname);
      return applySecurityHeaders(NextResponse.redirect(loginUrl), request);
    }
  }

  return applySecurityHeaders(NextResponse.next(), request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
