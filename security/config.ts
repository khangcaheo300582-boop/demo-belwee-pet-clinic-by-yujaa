// security/config.ts
// Tunables for the edge guards used by middleware.ts.

export type SecurityBucket = 'global' | 'auth' | 'session' | 'otp' | 'booking' | 'upload';

export const SECURITY_LIMITS: Record<
  SecurityBucket,
  { limit: number; windowMs: number }
> = {
  // Every /api/* request also consumes this bucket, so it is the real ceiling
  // for a single IP. It was 120/min, which a dev session (on-demand compiles +
  // RSC prefetch + HMR pings + session polling) could brush against on its
  // own, producing 429s that had nothing to do with abuse.
  global: { limit: 300, windowMs: 60_000 },

  // Passive, credential-free reads the browser issues on its own:
  // /api/auth/session (SessionProvider mount + window focus + visibility),
  // /api/auth/csrf, /api/auth/providers and the /api/auth/_log beacon.
  //
  // BUGFIX: these used to fall into the `auth` bucket below (12/min), which is
  // sized for password submissions. The site has 3 useSession() consumers, so
  // one page load costs several /api/auth/session calls, React 18 StrictMode
  // doubles mount effects in dev, and every alt-tab back to the browser
  // refetches. That blew the 12/min budget in normal use, so clients got 429
  // on their own session. Kept its own, generous bucket instead.
  session: { limit: 240, windowMs: 60_000 },

  // Credential submissions only: staff login, register, password reset and
  // next-auth's own signin / signout / callback.
  auth: { limit: 12, windowMs: 60_000 },

  otp: { limit: 5, windowMs: 10 * 60_000 },
  booking: { limit: 20, windowMs: 60_000 },
  upload: { limit: 30, windowMs: 60_000 },
};

export const MAX_API_BODY_BYTES = 1 * 1024 * 1024;
export const MAX_UPLOAD_BODY_BYTES = 12 * 1024 * 1024;

/** Strip trailing slashes so `https://x/` and `https://x` compare equal. */
function normalizeOrigin(value: string | undefined | null): string | null {
  if (!value) return null;
  const trimmed = value.trim().replace(/\/+$/, '');
  return trimmed || null;
}

/**
 * Read an env var from the edge bundle.
 *
 * Next.js inlines `process.env.X` references in middleware at build time, but
 * the edge shim does not carry every key, so a bare `process.env.NEXTAUTH_URL`
 * can resolve to undefined (or throw on a missing shim). Going through this
 * helper keeps the guard total.
 */
function readEnv(name: string): string | undefined {
  try {
    return process.env?.[name];
  } catch {
    return undefined;
  }
}

export function getTrustedOrigins(): string[] {
  return (readEnv('SECURITY_TRUSTED_ORIGINS') || '')
    .split(',')
    .map(origin => normalizeOrigin(origin))
    .filter((origin): origin is string => origin !== null);
}

/**
 * Every public origin this deployment legitimately answers on.
 *
 * BUGFIX (CSRF false positives): the Origin check used to compare the browser
 * Origin against `new URL(request.url).origin` only. That single guess is
 * wrong the moment anything sits in front of the app — a TLS-terminating
 * proxy, ngrok/cloudflared, a local HTTPS front-end, or a dev proxy that adds
 * X-Forwarded-*. The browser then legitimately sent `https://belwee.vn` while
 * the app saw `http://localhost:3001`, every mutating request was rejected as
 * "untrusted origin", and next-auth's client log beacon (/api/auth/_log) was
 * rejected with it. Feeding the configured public URLs into the same
 * comparison removes those false negatives without opening the check up: an
 * attacker's page still presents its own origin and is still rejected.
 */
export function getConfiguredOrigins(): string[] {
  return [
    ...getTrustedOrigins(),
    readEnv('NEXTAUTH_URL'),
    readEnv('NEXT_PUBLIC_BASE_URL'),
  ]
    .map(origin => normalizeOrigin(origin))
    .filter((origin): origin is string => origin !== null);
}
