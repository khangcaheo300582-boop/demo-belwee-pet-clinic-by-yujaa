// lib/auth-service.ts
// Core authentication service for Web (PC) + Mobile.
//
// Responsibilities:
//   1. Login — verify credentials, issue access/refresh token pair, track session.
//   2. Change password — verify current, enforce policy + history, revoke sessions.
//   3. Forgot password — generate single-use reset token (web) or OTP (mobile).
//   4. Reset password — verify token/OTP, update password, invalidate token.
//   5. Refresh token — rotate refresh token, issue new access token.
//   6. Logout — revoke refresh token.
//
// Storage: the file-backed stores in lib/dbUser.ts, lib/dbAuthSession.ts and
// lib/dbPasswordReset.ts. This module used to talk to MongoDB, which made every
// login and password reset depend on a cluster the deployment could not reach:
// a 10-second server-selection timeout, then a 500 for the user. The credential
// data lives in data/*.json now, next to the rest of the app's stores.

import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { dbUser, type User } from './dbUser';
import { dbAuthSession } from './dbAuthSession';
import { dbPasswordReset } from './dbPasswordReset';
import { issueTokenPair, verifyToken } from './auth-tokens';
import { sendOtpEmail, sendPasswordResetEmail } from '@/app/lib/mail-service';

// ─── Types ──────────────────────────────────────────────────────────
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role?: string;
  provider: 'credentials' | 'google';
}

export interface LoginResult {
  ok: boolean;
  user?: AuthUser;
  tokens?: { accessToken: string; refreshToken: string; expiresIn: number };
  error?: string;
  locked?: boolean;
  retryAfterSeconds?: number;
}

export interface AuthResult {
  ok: boolean;
  error?: string;
}

// ─── Brute-force guard (per email, in-memory) ───────────────────────
const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000;
const loginLocks = new Map<string, { fails: number; lockedUntil: number; lastFailAt: number }>();

function pruneLocks(now: number): void {
  for (const [key, lock] of loginLocks) {
    if (lock.lockedUntil <= now && now - lock.lastFailAt > LOCK_MS * 2) loginLocks.delete(key);
  }
}

function getLoginLockState(email: string): { locked: boolean; retryAfterSeconds: number; remaining: number } {
  const now = Date.now();
  pruneLocks(now);
  const lock = loginLocks.get(email.toLowerCase().trim());
  if (!lock) return { locked: false, retryAfterSeconds: 0, remaining: MAX_LOGIN_ATTEMPTS };
  if (lock.lockedUntil > now) {
    return { locked: true, retryAfterSeconds: Math.max(1, Math.ceil((lock.lockedUntil - now) / 1000)), remaining: 0 };
  }
  if (lock.fails >= MAX_LOGIN_ATTEMPTS) {
    return { locked: true, retryAfterSeconds: Math.max(1, Math.ceil((lock.lastFailAt + LOCK_MS - now) / 1000)), remaining: 0 };
  }
  return { locked: false, retryAfterSeconds: 0, remaining: Math.max(0, MAX_LOGIN_ATTEMPTS - lock.fails) };
}

function recordLoginFailure(email: string): void {
  const key = email.toLowerCase().trim();
  const now = Date.now();
  pruneLocks(now);
  const lock = loginLocks.get(key) ?? { fails: 0, lockedUntil: 0, lastFailAt: now };
  lock.fails += 1;
  lock.lastFailAt = now;
  if (lock.fails >= MAX_LOGIN_ATTEMPTS) {
    lock.lockedUntil = now + LOCK_MS;
    lock.fails = 0;
  }
  loginLocks.set(key, lock);
}

function clearLoginLock(email: string): void {
  loginLocks.delete(email.toLowerCase().trim());
}

// ─── Constants / helpers ────────────────────────────────────────────
const PASSWORD_HISTORY_SIZE = 3;
const BCRYPT_ROUNDS = 12;
const RESET_TTL_MS = 15 * 60 * 1000;

/**
 * A syntactically valid bcrypt hash compared against when the email does not
 * exist, so a missing account and a wrong password take the same time. Without
 * it the "email không tồn tại" case returns before bcrypt and is measurable.
 */
const DUMMY_HASH = '$2b$12$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

/** Response used for every store failure, so an I/O problem never becomes a 500 page. */
const BUSY_MESSAGE = 'Hệ thống đang bận. Vui lòng thử lại sau ít phút.';

function toAuthUser(user: User): AuthUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    provider: user.provider,
  };
}

/**
 * Ticket lookup key. The web token is 256 bits of randomness, but the mobile
 * OTP is only six digits; hashing it with a server secret means a leaked copy
 * of data/password-reset-tokens.json cannot be brute-forced offline.
 */
function hashTicket(value: string): string {
  const secret = process.env.OTP_HASH_SECRET || process.env.NEXTAUTH_SECRET;
  if (secret) return crypto.createHmac('sha256', secret).update(value).digest('hex');
  return crypto.createHash('sha256').update(value).digest('hex');
}

function resetLinkBase(): string {
  const configured = process.env.NEXT_PUBLIC_BASE_URL?.trim();
  const base = configured && configured.length > 0 ? configured : 'http://localhost:3000';
  return base.replace(/\/+$/, '');
}

const GENERIC_FORGOT_MESSAGE = 'Nếu email tồn tại, hướng dẫn đặt lại mật khẩu sẽ được gửi.';

/** Record the refresh token's jti so it can be revoked before its TTL expires. */
async function persistRefreshToken(userId: string, refreshToken: string): Promise<void> {
  const payload = verifyToken(refreshToken);
  if (!payload?.jti) throw new Error('Refresh token vừa phát hành không có jti.');
  await dbAuthSession.store({
    jti: payload.jti,
    userId,
    expiresAt: new Date(payload.exp),
  });
}

// ─── Login ──────────────────────────────────────────────────────────
export async function login(identity: string, password: string): Promise<LoginResult> {
  const normalizedEmail = identity.toLowerCase().trim();
  const state = getLoginLockState(normalizedEmail);
  if (state.locked) {
    return {
      ok: false,
      error: `Tài khoản tạm khoá. Vui lòng thử lại sau ${state.retryAfterSeconds} giây.`,
      locked: true,
      retryAfterSeconds: state.retryAfterSeconds,
    };
  }

  try {
    const user = await dbUser.findByEmail(normalizedEmail);

    // Google-only accounts have no password hash. Compare against the dummy
    // anyway so the timing does not reveal that, then explain the real reason.
    const isGoogleOnly = Boolean(user && user.provider === 'google' && !user.password);
    const storedHash = user?.password ? user.password : DUMMY_HASH;
    const passwordOk = await bcrypt.compare(password, storedHash);

    if (isGoogleOnly) {
      return { ok: false, error: 'Tài khoản này đăng nhập bằng Google. Vui lòng dùng Google Sign-In.' };
    }

    if (!user || !passwordOk) {
      recordLoginFailure(normalizedEmail);
      const next = getLoginLockState(normalizedEmail);
      if (next.locked) {
        return {
          ok: false,
          error: `Bạn đã nhập sai quá ${MAX_LOGIN_ATTEMPTS} lần. Tài khoản tạm khoá ${Math.round(LOCK_MS / 60000)} phút.`,
          locked: true,
          retryAfterSeconds: next.retryAfterSeconds,
        };
      }
      return {
        ok: false,
        error: `Email hoặc mật khẩu không chính xác. Còn ${next.remaining} lần thử.`,
      };
    }

    clearLoginLock(normalizedEmail);

    const authUser = toAuthUser(user);
    const tokens = issueTokenPair(authUser);
    await persistRefreshToken(user.id, tokens.refreshToken);

    return { ok: true, user: authUser, tokens };
  } catch (error) {
    console.error('[auth] login thất bại:', error);
    return { ok: false, error: BUSY_MESSAGE };
  }
}

// ─── Change Password ────────────────────────────────────────────────
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
  revokeOtherSessions: boolean
): Promise<AuthResult> {
  try {
    const user = await dbUser.findById(userId);
    if (!user) return { ok: false, error: 'Không tìm thấy tài khoản.' };

    if (!user.password) {
      return { ok: false, error: 'Tài khoản này không có mật khẩu (đăng nhập bằng Google).' };
    }

    const currentOk = await bcrypt.compare(currentPassword, user.password);
    if (!currentOk) {
      return { ok: false, error: 'Mật khẩu hiện tại không chính xác.' };
    }

    for (const oldHash of user.passwordHistory ?? []) {
      if (await bcrypt.compare(newPassword, oldHash)) {
        return { ok: false, error: 'Mật khẩu mới không được trùng với 3 mật khẩu gần nhất.' };
      }
    }

    const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    const updated = await dbUser.rotatePassword(userId, newHash, PASSWORD_HISTORY_SIZE);
    if (!updated) return { ok: false, error: 'Không tìm thấy tài khoản.' };

    if (revokeOtherSessions) {
      await dbAuthSession.revokeAllForUser(userId);
    }

    return { ok: true };
  } catch (error) {
    console.error('[auth] changePassword thất bại:', error);
    return { ok: false, error: BUSY_MESSAGE };
  }
}

// ─── Forgot Password ────────────────────────────────────────────────
export async function forgotPassword(
  identity: string,
  platform: 'web' | 'mobile'
): Promise<{ ok: boolean; message: string }> {
  const normalizedEmail = identity.toLowerCase().trim();

  try {
    const user = await dbUser.findByEmail(normalizedEmail);

    // Same response whether or not the account exists: this endpoint must not
    // be usable to enumerate registered customers.
    if (!user) {
      return { ok: true, message: GENERIC_FORGOT_MESSAGE };
    }

    if (platform === 'web') {
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + RESET_TTL_MS);

      await dbPasswordReset.create({
        userId: user.id,
        email: normalizedEmail,
        tokenHash: hashTicket(token),
        type: 'token',
        expiresAt,
      });

      const resetUrl = `${resetLinkBase()}/auth/reset-password?token=${encodeURIComponent(token)}`;
      try {
        await sendPasswordResetEmail(normalizedEmail, resetUrl);
      } catch (error) {
        // Still return the generic response — telling the caller the mail
        // failed would confirm the address is registered.
        console.error('[auth] gửi email đặt lại mật khẩu thất bại:', error);
      }
    } else {
      const otpCode = crypto.randomInt(100000, 1000000).toString();
      const expiresAt = new Date(Date.now() + RESET_TTL_MS);

      await dbPasswordReset.create({
        userId: user.id,
        email: normalizedEmail,
        tokenHash: hashTicket(otpCode),
        type: 'otp',
        expiresAt,
      });

      try {
        await sendOtpEmail(normalizedEmail, otpCode, 'reset');
      } catch (error) {
        console.error('[auth] gửi OTP đặt lại mật khẩu thất bại:', error);
      }
    }

    return { ok: true, message: GENERIC_FORGOT_MESSAGE };
  } catch (error) {
    console.error('[auth] forgotPassword thất bại:', error);
    return { ok: true, message: GENERIC_FORGOT_MESSAGE };
  }
}

// ─── Reset Password ─────────────────────────────────────────────────
export async function resetPassword(
  token: string | undefined,
  otp: string | undefined,
  newPassword: string
): Promise<AuthResult> {
  const rawTicket = token?.trim() || otp?.trim();
  if (!rawTicket) {
    return { ok: false, error: 'Thiếu token hoặc mã OTP.' };
  }

  const expectedType = token?.trim() ? 'token' : 'otp';
  const invalidMessage = 'Token hoặc mã OTP không hợp lệ hoặc đã hết hạn.';

  try {
    const record = await dbPasswordReset.findByHash(hashTicket(rawTicket));
    if (!record || record.type !== expectedType) {
      return { ok: false, error: invalidMessage };
    }

    if (record.usedAt) {
      return { ok: false, error: 'Token hoặc mã OTP đã được sử dụng.' };
    }

    if (Date.parse(record.expiresAt) <= Date.now()) {
      // Mark it used so it is pruned instead of lingering forever.
      await dbPasswordReset.consume(record.id);
      return { ok: false, error: 'Token hoặc mã OTP đã hết hạn.' };
    }

    const user = await dbUser.findById(record.userId);
    if (!user) {
      await dbPasswordReset.consume(record.id);
      return { ok: false, error: 'Không tìm thấy tài khoản.' };
    }

    // Claim the ticket BEFORE touching the password. Two requests racing with
    // the same link both reach this line; only one gets 'consumed'.
    const consumed = await dbPasswordReset.consume(record.id);
    if (consumed !== 'consumed') {
      return {
        ok: false,
        error:
          consumed === 'used'
            ? 'Token hoặc mã OTP đã được sử dụng.'
            : invalidMessage,
      };
    }

    const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    const updated = await dbUser.rotatePassword(record.userId, newHash, PASSWORD_HISTORY_SIZE);
    if (!updated) {
      return { ok: false, error: 'Không tìm thấy tài khoản.' };
    }

    // A password reset signs every device out; that is the whole point of
    // resetting a password you believe someone else has.
    await dbAuthSession.revokeAllForUser(record.userId);

    return { ok: true };
  } catch (error) {
    console.error('[auth] resetPassword thất bại:', error);
    return { ok: false, error: BUSY_MESSAGE };
  }
}

// ─── Refresh Token ──────────────────────────────────────────────────
export async function refreshAccessToken(refreshToken: string): Promise<{
  ok: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  error?: string;
}> {
  const payload = verifyToken(refreshToken);
  if (!payload || payload.type !== 'refresh' || !payload.jti) {
    return { ok: false, error: 'Refresh token không hợp lệ.' };
  }

  try {
    const isActive = await dbAuthSession.isActive(payload.jti);
    if (!isActive) {
      return { ok: false, error: 'Refresh token đã bị thu hồi.' };
    }

    const user = await dbUser.findById(payload.sub);
    if (!user) return { ok: false, error: 'Tài khoản không tồn tại.' };

    // Rotation: the old jti dies with this request, so a copied refresh token
    // is useless the moment the real client refreshes.
    await dbAuthSession.revoke(payload.jti);

    const tokens = issueTokenPair(toAuthUser(user));
    await persistRefreshToken(user.id, tokens.refreshToken);

    return {
      ok: true,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
    };
  } catch (error) {
    console.error('[auth] refreshAccessToken thất bại:', error);
    return { ok: false, error: BUSY_MESSAGE };
  }
}

// ─── Logout ─────────────────────────────────────────────────────────
export async function logout(refreshToken: string): Promise<void> {
  const payload = verifyToken(refreshToken);
  if (!payload?.jti) return;
  try {
    await dbAuthSession.revoke(payload.jti);
  } catch (error) {
    // Logout is best-effort: the cookie is cleared by the route either way,
    // and a revoked-token write failure must not turn into a 500.
    console.error('[auth] logout không thu hồi được refresh token:', error);
  }
}
