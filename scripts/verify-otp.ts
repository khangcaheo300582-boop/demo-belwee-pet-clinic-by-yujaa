/**
 * scripts/verify-otp.ts
 *
 * Proves the OTP policy invariants that caused real login bugs and that are
 * invisible without a test: the client countdown matches the server cooldown,
 * a code issued for one purpose never validates another, a wrong code cannot be
 * guessed without eventually locking, and the hash secret is required in
 * production but has a safe development fallback.
 *
 * Run with:  npm run test:otp
 *
 * Everything here is a pure function of its arguments (see lib/otpPolicy.ts), so
 * it runs without MongoDB or a network. The persistence layer in lib/dbOtp.ts is
 * a thin shell over exactly these decisions.
 */

import {
  ATTEMPT_LOCKOUT_MS,
  DEV_OTP_HASH_SECRET,
  MAX_VERIFY_ATTEMPTS,
  OTP_COOLDOWN_MS,
  OTP_COOLDOWN_SECONDS,
  OTP_PURPOSES,
  OTP_TTL_MS,
  canReplaceOtp,
  cooldownRemainingSeconds,
  evaluateVerify,
  generateOtpCode,
  getOtpHashSecret,
  hashOtpCode,
  matchesHash,
  type OtpTimingState,
} from '../lib/otpPolicy';

let passed = 0;
let failed = 0;

function check(name: string, ok: boolean, detail = ''): void {
  if (ok) {
    passed += 1;
    console.log(`  ✓ ${name}`);
    return;
  }
  failed += 1;
  console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
}

const NOW = Date.UTC(2026, 0, 1, 12, 0, 0);

function state(overrides: Partial<OtpTimingState> = {}): OtpTimingState {
  return {
    purpose: 'register',
    expiresAt: NOW + OTP_TTL_MS,
    lastSentAt: NOW,
    lastFailedAt: null,
    attempts: 0,
    ...overrides,
  };
}

// ─── 1. Constants stay in sync ────────────────────────────────────────
console.log('\n1. Constants');

check('cooldown is 5 minutes', OTP_COOLDOWN_MS === 5 * 60 * 1000, `got ${OTP_COOLDOWN_MS}`);
check('cooldown seconds matches ms', OTP_COOLDOWN_SECONDS === OTP_COOLDOWN_MS / 1000);
check('cooldown seconds is exported as 300', OTP_COOLDOWN_SECONDS === 300, `got ${OTP_COOLDOWN_SECONDS}`);
check('five wrong guesses allowed', MAX_VERIFY_ATTEMPTS === 5, `got ${MAX_VERIFY_ATTEMPTS}`);
check('lockout is 15 minutes', ATTEMPT_LOCKOUT_MS === 15 * 60 * 1000);
check('TTL equals cooldown', OTP_TTL_MS === OTP_COOLDOWN_MS);
check('three purposes known', OTP_PURPOSES.length === 3 && OTP_PURPOSES.includes('staff-reset'));

// ─── 2. Hashing ───────────────────────────────────────────────────────
console.log('\n2. Code hashing');

const secretA = 'a'.repeat(32);
const secretB = 'b'.repeat(32);
const code = '123456';

check('hash is a 64-char hex digest', /^[0-9a-f]{64}$/.test(hashOtpCode(code, secretA)));
check('hash is deterministic', hashOtpCode(code, secretA) === hashOtpCode(code, secretA));
check('different secret → different hash', hashOtpCode(code, secretA) !== hashOtpCode(code, secretB));
check('different code → different hash', hashOtpCode('123457', secretA) !== hashOtpCode('123456', secretA));
check('plaintext code never appears in the hash', !hashOtpCode(code, secretA).includes(code));
check('matchesHash accepts the right code', matchesHash(code, hashOtpCode(code, secretA), secretA));
check('matchesHash rejects the wrong code', !matchesHash('654321', hashOtpCode(code, secretA), secretA));
check(
  'matchesHash survives a malformed stored hash (no throw)',
  matchesHash(code, 'not-a-hex-digest', secretA) === false
);

// ─── 3. Hash secret resolution ────────────────────────────────────────
console.log('\n3. Hash secret resolution');

const longSecret = 'S'.repeat(40);
check(
  'uses OTP_HASH_SECRET when long enough',
  getOtpHashSecret({ OTP_HASH_SECRET: longSecret } as unknown as NodeJS.ProcessEnv) === longSecret
);
check(
  'falls back to NEXTAUTH_SECRET',
  getOtpHashSecret({ NEXTAUTH_SECRET: longSecret } as unknown as NodeJS.ProcessEnv) === longSecret
);
check(
  'falls back to STAFF_SESSION_SECRET',
  getOtpHashSecret({ STAFF_SESSION_SECRET: longSecret } as unknown as NodeJS.ProcessEnv) === longSecret
);
check(
  'a short secret is not trusted',
  getOtpHashSecret({ OTP_HASH_SECRET: 'short', NODE_ENV: 'development' } as unknown as NodeJS.ProcessEnv) ===
    DEV_OTP_HASH_SECRET
);
check(
  'development without a secret uses the dev fallback',
  getOtpHashSecret({ NODE_ENV: 'development' } as unknown as NodeJS.ProcessEnv) === DEV_OTP_HASH_SECRET
);
check('dev fallback is at least 32 chars', DEV_OTP_HASH_SECRET.length >= 32);

let threwInProduction = false;
try {
  getOtpHashSecret({ NODE_ENV: 'production' } as unknown as NodeJS.ProcessEnv);
} catch {
  threwInProduction = true;
}
check('production without a secret throws', threwInProduction);

// ─── 4. Code generation ───────────────────────────────────────────────
console.log('\n4. Code generation');

let allSixDigits = true;
let allInRange = true;
const seen = new Set<string>();
for (let i = 0; i < 5000; i += 1) {
  const generated = generateOtpCode();
  if (!/^\d{6}$/.test(generated)) allSixDigits = false;
  const n = Number(generated);
  if (n < 100000 || n > 999999) allInRange = false;
  seen.add(generated);
}
check('every generated code is exactly six digits', allSixDigits);
check('every generated code is in [100000, 999999]', allInRange);
check('generation is not constant', seen.size > 1000, `unique=${seen.size}`);

// ─── 5. Resend cooldown ───────────────────────────────────────────────
console.log('\n5. Resend cooldown');

check('no record → no cooldown', cooldownRemainingSeconds(null, 'register', NOW) === 0);
check(
  'just-sent same purpose → full cooldown',
  cooldownRemainingSeconds(state(), 'register', NOW) === OTP_COOLDOWN_SECONDS
);
check(
  'rounds up partway through the window',
  cooldownRemainingSeconds(state(), 'register', NOW + 1000) === OTP_COOLDOWN_SECONDS - 1
);
check(
  'exactly at the boundary → free',
  cooldownRemainingSeconds(state(), 'register', NOW + OTP_COOLDOWN_MS) === 0
);
check(
  'past the window → free',
  cooldownRemainingSeconds(state(), 'register', NOW + OTP_COOLDOWN_MS + 1) === 0
);
check(
  'a different purpose is never on the cooldown',
  cooldownRemainingSeconds(state({ purpose: 'register' }), 'reset', NOW) === 0
);

// ─── 6. Replacement rule (the A1 bug) ─────────────────────────────────
console.log('\n6. Replacement across purposes');

check('no record → may send', canReplaceOtp(null, 'register', NOW));
check('same purpose inside the window → blocked', !canReplaceOtp(state(), 'register', NOW));
check('same purpose after the window → allowed', canReplaceOtp(state(), 'register', NOW + OTP_COOLDOWN_MS));
check(
  'a new purpose replaces an outstanding code immediately',
  canReplaceOtp(state({ purpose: 'register' }), 'reset', NOW)
);
check(
  'registration after a live reset code is allowed',
  canReplaceOtp(state({ purpose: 'reset' }), 'register', NOW)
);

// ─── 7. Verify state machine ──────────────────────────────────────────
console.log('\n7. Verify decisions');

check('no record → missing', evaluateVerify(null, 'register', NOW, true).kind === 'missing');
check(
  'stored purpose ≠ requested → wrong-purpose',
  evaluateVerify(state({ purpose: 'register' }), 'reset', NOW, true).kind === 'wrong-purpose'
);
check('correct code in window → accept', evaluateVerify(state(), 'register', NOW, true).kind === 'accept');

const incorrect = evaluateVerify(state(), 'register', NOW, false);
check('wrong code → incorrect', incorrect.kind === 'incorrect');
check(
  'wrong code reports remaining attempts',
  incorrect.kind === 'incorrect' && incorrect.remainingAttempts === MAX_VERIFY_ATTEMPTS - 1
);

const lastChance = evaluateVerify(state({ attempts: MAX_VERIFY_ATTEMPTS - 1 }), 'register', NOW, false);
check(
  'final wrong guess reports zero remaining',
  lastChance.kind === 'incorrect' && lastChance.remainingAttempts === 0
);

// Locked: attempts spent and the lock window is still open — even a CORRECT
// code must be refused, otherwise an attacker waits out the guesses.
const locked = evaluateVerify(
  state({ attempts: MAX_VERIFY_ATTEMPTS, lastFailedAt: NOW }),
  'register',
  NOW + 1000,
  true
);
check('spent attempts + live lock → locked (even for the right code)', locked.kind === 'locked');
check('lock reports time remaining', locked.kind === 'locked' && locked.remainingMs > 0);

// Lock elapsed → the budget restarts and the code is judged normally.
// The lock (15 min) outlives the code's TTL (5 min), so for the code to still be
// live when the lock lapses the expiry has to be pushed out; otherwise the
// expired branch would always win. This proves the reset path works.
const longLived = { expiresAt: NOW + 20 * 60 * 1000 };
const afterLock = evaluateVerify(
  state({ attempts: MAX_VERIFY_ATTEMPTS, lastFailedAt: NOW, ...longLived }),
  'register',
  NOW + ATTEMPT_LOCKOUT_MS + 1,
  true
);
check('lock elapsed → accept', afterLock.kind === 'accept');
check('lock elapsed → asks for an attempt reset', afterLock.kind === 'accept' && afterLock.resetAttempts);
const normalAccept = evaluateVerify(state(), 'register', NOW, true);
check('a normal accept does NOT ask for a reset', normalAccept.kind === 'accept' && !normalAccept.resetAttempts);

const afterLockWrong = evaluateVerify(
  state({ attempts: MAX_VERIFY_ATTEMPTS, lastFailedAt: NOW, ...longLived }),
  'register',
  NOW + ATTEMPT_LOCKOUT_MS + 1,
  false
);
check('lock elapsed + wrong code → incorrect with reset', afterLockWrong.kind === 'incorrect' && afterLockWrong.resetAttempts);

// The realistic case: the code has expired by the time the lock lapses, so the
// lock cannot be waited out into a usable code — the record is cleaned up.
const expiredAfterLock = evaluateVerify(
  state({ attempts: MAX_VERIFY_ATTEMPTS, lastFailedAt: NOW }),
  'register',
  NOW + ATTEMPT_LOCKOUT_MS + 1,
  true
);
check('lock elapsed but code expired → expired (not accepted)', expiredAfterLock.kind === 'expired');

// Lock start falls back to lastSentAt when no failure was recorded.
const lockedFromSent = evaluateVerify(
  state({ attempts: MAX_VERIFY_ATTEMPTS, lastFailedAt: null, lastSentAt: NOW }),
  'register',
  NOW + 1000,
  false
);
check('lock without lastFailedAt uses lastSentAt', lockedFromSent.kind === 'locked');

// Expiry is judged after the lock check but before the code check.
const expired = evaluateVerify(
  state({ expiresAt: NOW - 1 }),
  'register',
  NOW,
  true
);
check('past TTL → expired (even for the right code)', expired.kind === 'expired');

// ─── Summary ──────────────────────────────────────────────────────────
console.log(`\notp-policy: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
