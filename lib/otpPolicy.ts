import crypto from 'crypto';

/**
 * lib/otpPolicy.ts
 * Pure OTP policy: constants, hashing, resend cooldown and the verify state
 * machine. No database, no Mongoose, no Next.js — everything here is a plain
 * function of its arguments, so `scripts/verify-otp.ts` can exercise every
 * branch without a running MongoDB.
 *
 * `lib/dbOtp.ts` owns persistence and calls into this module for every decision.
 * Keeping the two apart is deliberate: the bugs this file guards against
 * (cooldown drift between client and server, an OTP for one purpose validating
 * another, attempts never locking out) are all pure-logic bugs that a
 * database-backed test cannot isolate.
 */

export type OtpPurpose = 'register' | 'reset' | 'staff-reset';

export const OTP_PURPOSES: readonly OtpPurpose[] = ['register', 'reset', 'staff-reset'] as const;

/** Resend window. A second code for the same email + purpose is refused until it lapses. */
export const OTP_COOLDOWN_MS = 5 * 60 * 1000;
/** Cooldown between two sends for the same email + purpose (set-reset flow). */
export const OTP_SEND_COOLDOWN_MS = 60 * 1000;
/** A code is valid for this long after it is issued. */
export const OTP_TTL_MS = 5 * 60 * 1000;
/** Seconds left on the send cooldown, or 0 when a new code may be sent. */
export const OTP_SEND_COOLDOWN_SECONDS = OTP_SEND_COOLDOWN_MS / 1000;
/** Wrong-code guesses allowed before the record is locked. */
export const MAX_VERIFY_ATTEMPTS = 5;
/** How long the lock holds once the attempt budget is spent. */
export const ATTEMPT_LOCKOUT_MS = 15 * 60 * 1000;

/**
 * Resend cooldown in whole seconds.
 *
 * Exported so the client "retry in" countdown uses the same number the server
 * enforces. They used to drift (the register form started a 120s timer against a
 * 300s server limit), which re-enabled the send button while the server still
 * answered 429.
 */
export const OTP_COOLDOWN_SECONDS = OTP_COOLDOWN_MS / 1000;

/** Development-only HMAC key so a fresh clone without .env.local can still send OTP. */
export const DEV_OTP_HASH_SECRET = 'belwee-development-only-otp-hash-secret';

/**
 * Resolve the HMAC key used to hash OTP codes.
 *
 * Production must configure OTP_HASH_SECRET (or NEXTAUTH_SECRET /
 * STAFF_SESSION_SECRET) with at least 32 characters. Development gets a fixed
 * local-only fallback so a fresh clone without .env.local can still exercise the
 * OTP flow instead of throwing on every send; the fallback is never used when a
 * real secret is present, and never in production.
 *
 * `env` is injectable so tests can prove each branch without mutating the
 * process-wide environment.
 */
export function getOtpHashSecret(env: NodeJS.ProcessEnv = process.env): string {
  const secret = env.OTP_HASH_SECRET || env.NEXTAUTH_SECRET || env.STAFF_SESSION_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (env.NODE_ENV === 'development') return DEV_OTP_HASH_SECRET;
  throw new Error('OTP_HASH_SECRET, NEXTAUTH_SECRET, or STAFF_SESSION_SECRET must contain at least 32 characters.');
}

export function hashOtpCode(value: string, secret: string = getOtpHashSecret()): string {
  return crypto.createHmac('sha256', secret).update(value).digest('hex');
}

/**
 * Constant-time comparison of a guess against a stored hash.
 *
 * `===` on two hex strings short-circuits on the first differing byte, so the
 * time to reject leaks how much of the code the caller guessed. Guard the
 * lengths first because `timingSafeEqual` throws on mismatched buffers (a
 * malformed `expectedHash` from a hand-edited record must not crash the route).
 */
export function matchesHash(value: string, expectedHash: string, secret?: string): boolean {
  const actual = Buffer.from(hashOtpCode(value, secret), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

/** A cryptographically random six-digit code, via the CSPRNG. */
export function generateOtpCode(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

/** The persisted timing/attempt fields the policy reasons about. */
export interface OtpTimingState {
  purpose: OtpPurpose;
  /** Epoch milliseconds. */
  expiresAt: number;
  /** Epoch milliseconds. */
  lastSentAt: number;
  /** Epoch milliseconds, or null when no attempt has failed. */
  lastFailedAt: number | null;
  attempts: number;
}

/**
 * Seconds left on the resend cooldown, or 0 when a new code may be sent.
 *
 * Cooldowns are per purpose: an outstanding registration code must not put a
 * password-reset request on the resend cooldown (or vice versa). Rounding up
 * means a client that counts this number down never re-enables the button while
 * the server would still answer 429.
 *
 * For send-otp we use `OTP_SEND_COOLDOWN_MS` (1 minute) instead of the longer
 * `OTP_COOLDOWN_MS` (5 minutes) so password-reset requests can be resubmitted
 * more quickly while still being rate-limited.
 */
export function cooldownRemainingSeconds(
  state: OtpTimingState | null | undefined,
  requestedPurpose: OtpPurpose,
  now: number,
  useSendCooldown = false
): number {
  if (!state) return 0;
  if (state.purpose !== requestedPurpose) return 0;
  const elapsed = now - state.lastSentAt;
  const windowMs = useSendCooldown ? OTP_SEND_COOLDOWN_MS : OTP_COOLDOWN_MS;
  if (elapsed >= windowMs) return 0;
  return Math.ceil((windowMs - elapsed) / 1000);
}

/**
 * Whether a new send may replace the outstanding record for this purpose.
 *
 * A request for a DIFFERENT purpose always wins immediately; a same-purpose
 * resend must wait out the cooldown. This is the check that lets a password
 * reset proceed even while a registration code is still live.
 */
export function canReplaceOtp(
  state: OtpTimingState | null | undefined,
  requestedPurpose: OtpPurpose,
  now: number
): boolean {
  if (!state) return true;
  if (state.purpose !== requestedPurpose) return true;
  return now - state.lastSentAt >= OTP_COOLDOWN_MS;
}

export type OtpVerifyDecision =
  | { kind: 'missing' }
  | { kind: 'wrong-purpose' }
  | { kind: 'locked'; remainingMs: number }
  | { kind: 'expired'; resetAttempts: boolean }
  | { kind: 'incorrect'; remainingAttempts: number; resetAttempts: boolean }
  | { kind: 'accept'; resetAttempts: boolean };

/**
 * Decide what a verify attempt should do, without touching the database.
 *
 * `codeMatches` is computed by the caller (it needs the hash secret). The
 * returned `resetAttempts` flag means the caller must persist an attempt
 * counter reset — this happens when the lock has elapsed but the code is still
 * live, so a staff member is not permanently stuck on an expired lock.
 */
export function evaluateVerify(
  state: OtpTimingState | null | undefined,
  requestedPurpose: OtpPurpose,
  now: number,
  codeMatches: boolean
): OtpVerifyDecision {
  if (!state) return { kind: 'missing' };
  if (state.purpose !== requestedPurpose) return { kind: 'wrong-purpose' };

  let attempts = state.attempts;
  let resetAttempts = false;

  if (attempts >= MAX_VERIFY_ATTEMPTS) {
    const lockoutStart = state.lastFailedAt ?? state.lastSentAt;
    const lockoutEnd = lockoutStart + ATTEMPT_LOCKOUT_MS;
    if (now < lockoutEnd) {
      return { kind: 'locked', remainingMs: lockoutEnd - now };
    }
    // Lock elapsed: the budget restarts, then the normal checks run.
    resetAttempts = true;
    attempts = 0;
  }

  if (now > state.expiresAt) {
    return { kind: 'expired', resetAttempts };
  }

  if (!codeMatches) {
    const remainingAttempts = Math.max(0, MAX_VERIFY_ATTEMPTS - attempts - 1);
    return { kind: 'incorrect', remainingAttempts, resetAttempts };
  }

  return { kind: 'accept', resetAttempts };
}
