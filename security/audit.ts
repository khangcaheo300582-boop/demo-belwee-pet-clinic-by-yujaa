// security/audit.ts
// Lightweight audit logging for security-relevant events.
//
// ⚠️ Node runtime only (uses fs). Do NOT import from middleware.ts (edge).
// Writes append-only JSON lines to data/logs/audit-<YYYY-MM-DD>.log. The
// /data/ directory is gitignored, so no credentials ever reach the repo.
//
// Enable with SECURITY_AUDIT=true (default false) to avoid disk I/O on every
// request in high-traffic deployments. Even when disabled, events are
// still logged with console.warn so they surface in the runtime logs.

import { promises as fsp } from 'fs';
import path from 'path';
import type { IncomingMessage } from 'http';

export type AuditEvent =
  | 'STAFF_LOGIN_SUCCESS'
  | 'STAFF_LOGIN_FAILED'
  | 'STAFF_LOGOUT'
  // An individual staff account was created. Separate from STAFF_LOGIN_FAILED
  // because "a new account appeared" and "someone failed to sign in" are very
  // different signals in a log review.
  | 'STAFF_REGISTERED'
  | 'STAFF_PIN_CHANGED'
  | 'STAFF_PIN_RESET'
  | 'STAFF_RULES_ACKNOWLEDGED'
  | 'STAFF_ACCESS_DENIED'
  | 'STAFF_APPOINTMENT_CONFIRMED'
  | 'STAFF_APPOINTMENT_CANCELLED'
  | 'STAFF_APPOINTMENT_COMPLETED'
  | 'STAFF_DIAGNOSIS_SAVED'
  | 'STAFF_RECEIPT_CREATED'
  // Internal chat + notifications. Logged as counts and sizes only — a chat log
  // is full of customer names and clinical detail, and copying the content into
  // a second log doubles where that data lives.
  | 'STAFF_CHAT_MESSAGE'
  | 'STAFF_CHAT_MUTATED'
  | 'BOOKING_CONFIRMED'
  | 'BOOKING_CANCELLED'
  | 'OTP_SENT'
  | 'OTP_VERIFY_SUCCESS'
  | 'OTP_VERIFY_FAILED'
  | 'PASSWORD_RESET'
  | 'REGISTER'
  // Customer-facing auth events. The STAFF_* events above belong to /staff;
  // these are the customer portal (/dang-nhap, /cap-lai-mat-khau, /doi-mat-khau).
  // Kept separate so a log review can answer "what happened to a customer
  // account?" without filtering staff noise out of the same event names.
  | 'CUSTOMER_LOGIN_SUCCESS'
  | 'CUSTOMER_LOGIN_FAILED'
  | 'CUSTOMER_LOGOUT'
  | 'CUSTOMER_REGISTERED'
  | 'CUSTOMER_PASSWORD_RESET_REQUESTED'
  | 'CUSTOMER_PASSWORD_RESET'
  | 'CUSTOMER_PASSWORD_CHANGED'
  | 'CUSTOMER_SESSION_REVOKED'
  | 'UPLOAD'
  | 'RATE_LIMITED'
  | 'CSRF_REJECTED';

export interface AuditFields {
  ip?: string;
  email?: string;
  staffId?: string;
  /** Customer account id (`users.json`). Distinct from `staffId`. */
  userId?: string;
  detail?: string;
}

interface AuditEntry extends AuditFields {
  ts: string;
  event: AuditEvent;
}

const LOG_DIR = path.join(process.cwd(), 'data', 'logs');

/** Extract a plausible client IP from the request headers. */
export function clientIpFrom(req: { headers: Headers | IncomingMessage['headers'] }): string {
  try {
    const h = req.headers as Headers & Record<string, string | undefined>;
    const get = (name: string): string | null => {
      const v = (h as { get?: (n: string) => string | null }).get?.call(h, name);
      return v ?? h[String(name).toLowerCase()] ?? h[String(name)] ?? null;
    };
    const forwarded = get('x-forwarded-for');
    if (forwarded) return forwarded.split(',')[0].trim() || 'unknown';
    return get('x-real-ip') || 'unknown';
  } catch {
    return 'unknown';
  }
}

export async function audit(
  event: AuditEvent,
  opts: AuditFields = {},
): Promise<void> {
  const entry: AuditEntry = {
    ts: new Date().toISOString(),
    event,
    ...(opts.ip ? { ip: opts.ip } : {}),
    ...(opts.email ? { email: opts.email } : {}),
    ...(opts.staffId ? { staffId: opts.staffId } : {}),
    ...(opts.userId ? { userId: opts.userId } : {}),
    ...(opts.detail ? { detail: opts.detail } : {}),
  };

  const line = JSON.stringify(entry);

  if (process.env.SECURITY_AUDIT !== 'true') {
    // Surface the event even when disk audit is disabled.
    console.warn(`[audit] ${line}`);
    return;
  }

  try {
    const date = new Date().toISOString().slice(0, 10);
    await fsp.mkdir(LOG_DIR, { recursive: true });
    const file = path.join(LOG_DIR, `audit-${date}.log`);
    await fsp.appendFile(file, line + '\n', 'utf-8');
  } catch (err) {
    console.error('[audit] Không ghi được audit log:', err);
  }
}
