import type { NextRequest } from 'next/server';
import { SECURITY_LIMITS, type SecurityBucket } from './config';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

/**
 * Hard ceiling on tracked keys.
 *
 * The key contains the client IP, and that IP comes from X-Forwarded-For,
 * which a caller controls. Without a cap, a loop sending a fresh
 * `X-Forwarded-For` on every request would add one map entry per request and
 * grow this module for the lifetime of the process — every middleware pass
 * then pays for the walk in cleanup() below. This is a memory-exhaustion guard,
 * not a tuning knob: it is deliberately far above any real client count.
 */
const MAX_ENTRIES = 10_000;

const entries = new Map<string, RateLimitEntry>();
let lastCleanup = 0;

function cleanup(now: number): void {
  if (now - lastCleanup < 60_000 && entries.size <= MAX_ENTRIES) return;
  lastCleanup = now;
  for (const [key, entry] of entries) {
    if (entry.resetAt <= now) entries.delete(key);
  }
  // Still over the cap: drop the oldest entries. Map preserves insertion
  // order, and a re-inserted key moves to the end, so this evicts the least
  // recently seen — the cheapest useful approximation of LRU.
  while (entries.size > MAX_ENTRIES) {
    const oldest = entries.keys().next();
    if (oldest.done) break;
    entries.delete(oldest.value);
  }
}

export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim() || 'unknown';
  return request.headers.get('x-real-ip') || 'unknown';
}

export function consumeRateLimit(
  request: NextRequest,
  bucket: SecurityBucket,
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  cleanup(now);

  const policy = SECURITY_LIMITS[bucket];
  const key = `${bucket}:${getClientIp(request)}`;
  const current = entries.get(key);

  if (!current || current.resetAt <= now) {
    // delete-then-set so a recycled key moves to the end of the insertion
    // order, which is what makes the oldest-first eviction in cleanup() sound.
    entries.delete(key);
    entries.set(key, { count: 1, resetAt: now + policy.windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  current.count += 1;
  if (current.count <= policy.limit) {
    return { allowed: true, retryAfterSeconds: 0 };
  }

  return {
    allowed: false,
    retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
  };
}
