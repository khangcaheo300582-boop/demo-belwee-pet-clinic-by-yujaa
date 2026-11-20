// lib/dbAuthSession.ts
// File-backed registry of issued refresh tokens (one row per token id / jti).
//
// The refresh JWT itself is self-contained and signed, so why keep a row at
// all? Because a signature proves a token was minted by us, not that it is
// still allowed. This table is what makes "log out", "revoke other sessions"
// and refresh-token rotation actually take effect before the 7-day TTL runs
// out. Losing it would silently turn every logout into a no-op, which is why
// it lives in the same durable JSON store as the rest of the auth data rather
// than in process memory.
//
// Rows are kept for one day past expiry (or past revocation) so an operator
// can see what happened, then pruned on the next login. Without that pruning
// the file grows forever and every read gets slower.

import { createAsyncJsonStore } from './jsonStore';

export interface AuthSession {
  jti: string;
  userId: string;
  /** ISO timestamp — the refresh token's own `exp`. */
  expiresAt: string;
  revoked: boolean;
  revokedAt: string | null;
  createdAt: string;
}

const RETENTION_MS = 24 * 60 * 60 * 1000;

const sessionStore = createAsyncJsonStore<AuthSession>('auth-sessions.json');

function toIso(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error('Thời điểm hết hạn của phiên đăng nhập không hợp lệ.');
  }
  return date.toISOString();
}

function isExpired(session: AuthSession, now: number): boolean {
  const expiry = Date.parse(session.expiresAt);
  return Number.isNaN(expiry) || expiry <= now;
}

export const dbAuthSession = {
  /**
   * Record a freshly issued refresh token. Also prunes rows that expired (or
   * were revoked) more than a day ago, so the file stays bounded without a
   * separate cron job.
   */
  async store(data: { jti: string; userId: string; expiresAt: Date | string }): Promise<void> {
    const now = Date.now();
    const record: AuthSession = {
      jti: data.jti,
      userId: data.userId,
      expiresAt: toIso(data.expiresAt),
      revoked: false,
      revokedAt: null,
      createdAt: new Date(now).toISOString(),
    };

    await sessionStore.update((rows) => {
      // Drop anything past its retention window…
      for (let i = rows.length - 1; i >= 0; i -= 1) {
        const row = rows[i];
        const expired = isExpired(row, now);
        const stale = expired || row.revoked;
        if (!stale) continue;
        const endedAt = row.revokedAt ? Date.parse(row.revokedAt) : Date.parse(row.expiresAt);
        if (!Number.isNaN(endedAt) && now - endedAt > RETENTION_MS) rows.splice(i, 1);
      }

      // …and make the write idempotent if the same jti is somehow replayed.
      const duplicate = rows.findIndex((row) => row.jti === record.jti);
      if (duplicate !== -1) rows.splice(duplicate, 1);

      rows.push(record);
    });
  },

  /** True only for a token that was issued, is not revoked, and has not expired. */
  async isActive(jti: string): Promise<boolean> {
    const now = Date.now();
    const rows = await sessionStore.read();
    const row = rows.find((session) => session.jti === jti);
    return Boolean(row && !row.revoked && !isExpired(row, now));
  },

  async revoke(jti: string): Promise<void> {
    const revokedAt = new Date().toISOString();
    await sessionStore.update((rows) => {
      const row = rows.find((session) => session.jti === jti);
      if (!row || row.revoked) return;
      row.revoked = true;
      row.revokedAt = revokedAt;
    });
  },

  /** Used after a password change/reset: every existing device is signed out. */
  async revokeAllForUser(userId: string): Promise<void> {
    const revokedAt = new Date().toISOString();
    await sessionStore.update((rows) => {
      for (const row of rows) {
        if (row.userId !== userId || row.revoked) continue;
        row.revoked = true;
        row.revokedAt = revokedAt;
      }
    });
  },
};
