// lib/auth-rate-limit.ts
// In-memory rate limiter for auth endpoints. Redis-ready: swap the store
// implementation without changing the public API.
//
// Limits:
//   - /login:           5 attempts per 15 min per IP+email
//   - /forgot-password: 3 attempts per 15 min per IP+email
//   - /reset-password:  5 attempts per 15 min per IP
//   - /change-password: 10 attempts per 15 min per user
//   - send-otp:         5 attempts per 1 hour per IP+email+type
//                      (cooldown 60s between sends ensured by a
//                       separate 1-request-per-60s window on the
//                       same key family)

interface RateLimitEntry {
  count: number;
  resetAt: number;
  lockedUntil: number;
}

const MAX_ENTRIES = 50_000;
const entries = new Map<string, RateLimitEntry>();

function cleanup(now: number): void {
  if (entries.size <= MAX_ENTRIES) {
    // Only sweep when over cap or periodically
    if (now % 60_000 > 1000) return;
  }
  for (const [key, entry] of entries) {
    if (entry.resetAt <= now && entry.lockedUntil <= now) entries.delete(key);
  }
  while (entries.size > MAX_ENTRIES) {
    const oldest = entries.keys().next();
    if (oldest.done) break;
    entries.delete(oldest.value);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
  remaining: number;
}

export function consumeRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  cleanup(now);

  const current = entries.get(key);
  if (!current || (current.resetAt <= now && current.lockedUntil <= now)) {
    entries.delete(key);
    entries.set(key, { count: 1, resetAt: now + windowMs, lockedUntil: 0 });
    return { allowed: true, retryAfterSeconds: 0, remaining: limit - 1 };
  }

  // Still locked?
  if (current.lockedUntil > now) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((current.lockedUntil - now) / 1000)),
      remaining: 0,
    };
  }

  current.count += 1;
  if (current.count <= limit) {
    return { allowed: true, retryAfterSeconds: 0, remaining: Math.max(0, limit - current.count) };
  }

  // Lock for the remainder of the window
  current.lockedUntil = current.resetAt;
  return {
    allowed: false,
    retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    remaining: 0,
  };
}

// ─── Convenience wrappers ────────────────────────────────────────────
const FIFTEEN_MIN = 15 * 60 * 1000;

export function rateLimitLogin(ip: string, email: string): RateLimitResult {
  return consumeRateLimit(`login:${ip}:${email.toLowerCase()}`, 5, FIFTEEN_MIN);
}

export function rateLimitForgotPassword(ip: string, email: string): RateLimitResult {
  return consumeRateLimit(`forgot:${ip}:${email.toLowerCase()}`, 3, FIFTEEN_MIN);
}

export function rateLimitResetPassword(ip: string): RateLimitResult {
  return consumeRateLimit(`reset:${ip}`, 5, FIFTEEN_MIN);
}

export function rateLimitChangePassword(userId: string): RateLimitResult {
  return consumeRateLimit(`change:${userId}`, 10, FIFTEEN_MIN);
}

export function rateLimitSendOtp(ip: string, email: string, type: string): RateLimitResult {
  const key = `send-otp:${ip}:${email.toLowerCase()}:${type}`;

  // Cooldown ngắn: chỉ cho phép 1 request mỗi 60 giây cho cùng key.
  const cooldown = consumeRateLimit(`${key}:cooldown`, 1, 60_000);
  if (!cooldown.allowed) {
    return cooldown;
  }

  // Giới hạn tổng: tối đa 5 request mỗi giờ cho cùng email+type.
  const hourly = consumeRateLimit(key, 5, 3600_000);
  if (!hourly.allowed) {
    return hourly;
  }

  return {
    allowed: true,
    retryAfterSeconds: 0,
    remaining: Math.min(cooldown.remaining, hourly.remaining),
  };
}

export function clearRateLimit(key: string): void {
  entries.delete(key);
}
