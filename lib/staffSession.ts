// lib/staffSession.ts
// Stateless signed session cookie for the staff portal.
//
// Cookie value: <base64url payload>.<hmac-sha256 signature>, signed with
// STAFF_SESSION_SECRET || NEXTAUTH_SECRET. Production requires one of those.
//
// The previous two-phase flow (email+password, then a step token for the PIN)
// is gone. There is exactly ONE credential now — the 6-digit PIN — so a step
// token would only add a replayable artefact to defend. Brute-force protection
// moved to the account itself (lib/staff-service.ts: 5 wrong PINs ⇒ 5-minute
// lock), which is stronger than a per-token counter because it also survives a
// server restart.
//
// ⚠ middleware.ts re-implements decode() with Web Crypto because it runs on the
// edge runtime (no node:crypto). Keep the two implementations in sync:
//   payload = JSON → base64url, sig = HMAC-SHA256(base64url, secret) → base64url

import crypto from 'crypto';
import { cookies, headers } from 'next/headers';
import {
  getStaffAuthSecret,
  findStaffById,
  sanitizeStaff,
  type StaffPublic,
} from '@/lib/staff-service';
import { roleCan, permissionDeniedMessage, type StaffAction } from '@/lib/staffPermissions';
import { STAFF_IDLE_TIMEOUT_MS } from '@/lib/session-policy';

export const STAFF_SESSION_COOKIE = 'belwee_staff_session';

interface SessionPayload {
  sid: string;         // staff id
  email: string;
  name: string;
  role: string;
  exp: number;         // epoch ms
  /** true ⇒ full session. A token without it is not a session. */
  pin?: boolean;
}

function sign(payloadB64: string): string {
  return crypto.createHmac('sha256', getStaffAuthSecret()).update(payloadB64).digest('base64url');
}

function encode(payload: SessionPayload): string {
  const b64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${b64}.${sign(b64)}`;
}

function decode(value: string): SessionPayload | null {
  if (!value) return null;
  const dot = value.indexOf('.');
  if (dot === -1) return null;
  const b64 = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  const expected = sign(b64);
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(b64, 'base64url').toString('utf-8')) as SessionPayload;
    if (!payload.sid || typeof payload.exp !== 'number' || payload.exp < Date.now()) return null;
    // `pin:true` is set ONLY after the 6-digit PIN was verified. middleware.ts
    // mirrors this check on the edge runtime.
    if (payload.pin !== true) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Full staff session token. */
export function createStaffToken(staff: { id: string; email: string; name: string; role: string }): string {
  return encode({
    sid: staff.id,
    email: staff.email,
    name: staff.name,
    role: staff.role,
    exp: Date.now() + STAFF_IDLE_TIMEOUT_MS,
    pin: true,
  });
}

/**
 * Decide the cookie `Secure` flag.
 * - STAFF_COOKIE_SECURE=true/false forces it explicitly.
 * - Otherwise: secure only when the request actually arrived over HTTPS
 *   (x-forwarded-proto). The old `NODE_ENV === 'production'` rule broke LAN
 *   deployments (`next start` on http://192.168.x.x) by silently dropping the
 *   cookie → instant 401 on every authenticated call after login.
 */
async function shouldUseSecureCookie(): Promise<boolean> {
  const forced = process.env.STAFF_COOKIE_SECURE;
  if (forced === 'true') return true;
  if (forced === 'false') return false;
  try {
    const h = (await headers()) as unknown;
    const get = (name: string): string | null => {
      const store = h as { get?: (n: string) => string | null };
      return typeof store.get === 'function' ? store.get(name) : null;
    };
    const proto = get('x-forwarded-proto');
    if (proto) return proto.split(',')[0].trim() === 'https';
  } catch {
    // headers() unavailable in this context — fall through to the safe default.
  }
  return false;
}

/** Read the current staff session from the request cookie. */
export async function getStaffSession(): Promise<{ staff: StaffPublic } | null> {
  const store = cookies();
  const value = store.get(STAFF_SESSION_COOKIE)?.value;
  if (!value) return null;
  const payload = decode(value);
  if (!payload) return null;
  // Re-read the record on every request rather than trusting the role baked
  // into the cookie: an admin demoted (or deactivated) mid-session must lose
  // access immediately, not when their 15-minute idle token expires.
  const staff = await findStaffById(payload.sid);
  if (!staff || !staff.isActive) return null;
  return { staff: sanitizeStaff(staff) };
}

export async function setStaffSessionCookie(staff: { id: string; email: string; name: string; role: string }) {
  const store = cookies();
  store.set(STAFF_SESSION_COOKIE, createStaffToken(staff), {
    httpOnly: true,
    // `strict` rather than the previous `lax`: nothing in the staff portal is
    // reached by an external link, and `lax` would forward the cookie on a
    // top-level cross-site GET — exactly the shape a CSRF-ish navigation
    // attack uses. `strict` means a staff member arriving from a bookmark
    // still works (the request itself is same-site), it is only the *cookie
    // attachment* on a cross-site-initiated navigation that is suppressed.
    sameSite: 'strict',
    secure: await shouldUseSecureCookie(),
    path: '/',
  });
}

export async function clearStaffSessionCookie() {
  const store = cookies();
  store.delete(STAFF_SESSION_COOKIE);
}

/** Convenience for route handlers: returns staff or sends 401. */
export async function requireStaff(): Promise<{ staff: StaffPublic } | { error: Response }> {
  const session = await getStaffSession();
  if (!session) {
    return {
      error: new Response(JSON.stringify({ success: false, message: '401 Unauthorized - Access Denied' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    };
  }
  return session;
}

/**
 * Authenticate AND authorise in one call.
 *
 * Returns 401 when there is no valid session, 403 when the role is not allowed
 * to perform `action`. Every mutating staff route must go through this instead
 * of `requireStaff()` — otherwise the role in data/staff.json stays decorative.
 * See lib/staffPermissions.ts for the matrix.
 */
export async function requireStaffAction(
  action: StaffAction
): Promise<{ staff: StaffPublic } | { error: Response }> {
  const session = await requireStaff();
  if ('error' in session) return session;
  if (roleCan(session.staff.role, action)) return session;
  return {
    error: new Response(
      JSON.stringify({ success: false, message: `403 Forbidden - ${permissionDeniedMessage(action)}` }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    ),
  };
}