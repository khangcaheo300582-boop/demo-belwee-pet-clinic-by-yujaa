import type { NextRequest } from 'next/server';
import { getConfiguredOrigins, type SecurityBucket } from './config';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Loopback spellings that all mean "this machine". */
const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
const IS_DEV = process.env.NODE_ENV !== 'production';

export function isMutatingMethod(method: string): boolean {
  return MUTATING_METHODS.has(method.toUpperCase());
}

function parseOrigin(value: string | null | undefined): URL | null {
  if (!value) return null;
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

/**
 * The origin the browser most likely used, recovered from reverse-proxy
 * headers. A proxy that terminates TLS and forwards to this app usually sends
 * X-Forwarded-Proto/X-Forwarded-Host; without them the app can only see its own
 * internal address and will misjudge its own traffic.
 */
function proxiedOrigin(request: NextRequest): URL | null {
  const host =
    request.headers.get('x-forwarded-host') || request.headers.get('x-forwarded-server');
  if (!host) return null;
  const proto = (request.headers.get('x-forwarded-proto') || '').split(',')[0].trim();
  return parseOrigin(`${proto || 'https'}://${host.split(',')[0].trim()}`);
}

/**
 * True when two origins address the same site even though the scheme or the
 * port differs because a proxy rewrote one of them.
 *
 * Deliberately narrow: the hostname must be identical and the ports must be
 * either identical or one of them being that scheme's default. That admits
 * `https://belwee.vn` ↔ `http://belwee.vn:3001` (the TLS-terminating proxy
 * case) without admitting an unrelated app on a sibling port of the same host.
 */
function isSameSiteThroughProxy(a: URL, b: URL): boolean {
  if (a.hostname !== b.hostname) return false;
  if (a.port === b.port) return true;
  const defaults = new Set(['80', '443', '']);
  return defaults.has(a.port) || defaults.has(b.port);
}

/**
 * True when the Origin belongs to this site.
 *
 * Strict on purpose, and identical in development and production: exact match
 * on the origin the request arrived on, on a configured public origin, or on
 * the same site recovered from proxy headers. No development allowances live
 * here — they are applied one layer up, in originRejection(), where the
 * browser's Sec-Fetch-Site verdict is available to constrain them. Keeping
 * them apart is what stops a "be lenient while developing" rule from
 * overriding an explicit cross-site signal.
 */
export function hasTrustedOrigin(request: NextRequest): boolean {
  const originHeader = request.headers.get('origin');
  if (!originHeader) return true;

  const sent = parseOrigin(originHeader);
  if (!sent) return false; // malformed Origin → refuse.

  const own = new URL(request.url);
  if (sent.origin === own.origin) return true;
  if (getConfiguredOrigins().includes(sent.origin)) return true;

  const proxied = proxiedOrigin(request);
  if (proxied && isSameSiteThroughProxy(sent, proxied)) return true;
  if (isSameSiteThroughProxy(sent, own)) return true;

  return false;
}

/**
 * Decide whether to reject a mutating request on Origin grounds.
 *
 * Returns null when the request may proceed, or a human-readable reason when it
 * must not. The reason is deliberately specific: a bare "untrusted origin" left
 * the operator no way to tell a real attack from a local proxy that renames
 * the origin, which is the difference between a five-minute fix and an
 * afternoon of guessing.
 */
export function originRejection(request: NextRequest): string | null {
  const originHeader = request.headers.get('origin');
  if (!originHeader) return null; // non-browser caller; Sec-Fetch-Site covers browsers.
  if (hasTrustedOrigin(request)) return null;

  const describe = () =>
    `origin ${originHeader} not in allowlist (host ${request.headers.get('host') || 'unknown'})`;

  if (!IS_DEV) return describe();

  // Development only. Sec-Fetch-Site is the control that actually decides
  // CSRF, and it cannot be forged by a form or a scripted request from another
  // site — so a browser that labels the request same-origin/same-site is
  // telling us it is not a forgery, and a mismatched Origin string is a
  // configuration gap rather than an attack. This is the case a local proxy or
  // tunnel produces: the browser's origin is the tunnel's public name while
  // this process only ever sees its own internal address, often with
  // X-Real-IP set and X-Forwarded-Host absent.
  //
  // An explicit `cross-site` is refused before any of this, in every mode.
  const site = request.headers.get('sec-fetch-site');
  if (site === 'cross-site') return describe();
  if (site === 'same-origin' || site === 'same-site' || site === 'none') return null;

  // No Sec-Fetch-Site at all: a hand-rolled client rather than a browser.
  // Keep manual testing (curl, Postman) working across the loopback aliases —
  // localhost, 127.0.0.1 and [::1] on our own port are the same machine — while
  // leaving a *different* loopback port to the strict allowlist above, since a
  // different port is a different origin.
  const sent = parseOrigin(originHeader);
  if (sent && LOOPBACK_HOSTNAMES.has(sent.hostname) && sent.port === new URL(request.url).port) {
    return null;
  }

  return describe();
}

/**
 * NextAuth's read-only surface. The browser calls all of these unprompted —
 * /api/auth/session on every SessionProvider mount, window focus and tab
 * visibility change, /api/auth/csrf and /api/auth/providers for the sign-in
 * form, and /api/auth/_log as a sendBeacon() whenever the client-side logger
 * fires. None of them submit credentials, so they get the `session` bucket
 * instead of the 12/min `auth` one.
 */
const NEXTAUTH_READ_ONLY = new Set(['session', 'csrf', 'providers', 'error', '_log']);

/**
 * Staff endpoints that submit a credential and therefore keep the strict
 * `auth` budget. `/staff/login` checks a PIN; `/staff/register` accepts an
 * optional admin `managerPin`; `/staff/reset-pin` compares a recovery code and
 * verifies an OTP. All three were previously bucketed as `global` (300/min),
 * which left the two secret-comparison endpoints brute-forceable at 300
 * requests/minute per IP.
 */
const STAFF_CREDENTIAL_PATHS = new Set([
  '/api/staff/login',
  '/api/staff/register',
  '/api/staff/reset-pin',
]);

/** Endpoints that do submit credentials, and so keep the strict budget. */
const CREDENTIAL_ACTIONS = new Set([
  'signin',
  'signout',
  'callback',
  'register',
  'reset-password',
]);

/**
 * Pick the rate-limit bucket for a request.
 *
 * Only `session` is method-dependent: GET is a read the browser makes
 * unprompted (every mount, focus and visibility change) while POST is
 * `useSession().update()`, which rewrites the caller's own JWT. Reads and writes
 * to the same path must not share a budget, or the generous read limit would
 * quietly become the limit on writes too.
 *
 * The rest of the read-only surface keeps the `session` budget whatever the
 * method. `_log` in particular is a `sendBeacon()` POST, so treating every POST
 * here as a write would put the client's own log sink back on the 12/min
 * credential budget and reproduce the cascade this split exists to stop: a
 * 429 makes next-auth log `CLIENT_FETCH_ERROR`, which beacons to `/_log`, which
 * 429s in turn and emits more noise.
 */
export function getApiBucket(pathname: string, method = 'GET'): SecurityBucket {
  if (pathname.startsWith('/api/auth/')) {
    const action = pathname.slice('/api/auth/'.length).split('/')[0];

    if (action.includes('otp')) return 'otp';
    if (CREDENTIAL_ACTIONS.has(action)) return 'auth';
    if (NEXTAUTH_READ_ONLY.has(action)) {
      if (action === 'session' && isMutatingMethod(method)) return 'auth';
      return 'session';
    }
    return 'auth'; // unknown /api/auth/* → fail closed onto the strict bucket.
  }

  if (STAFF_CREDENTIAL_PATHS.has(pathname)) return 'auth';
  if (pathname === '/api/booking') return 'booking';
  if (pathname === '/api/staff/upload') return 'upload';
  return 'global';
}
