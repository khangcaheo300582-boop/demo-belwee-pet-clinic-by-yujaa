// lib/dbPasswordReset.ts
// File-backed, single-use password reset tickets.
//
// Only a SHA-256 hash of the token/OTP is stored, so a leaked copy of
// data/password-reset-tokens.json cannot be turned back into a working reset
// link. `consume()` performs the used/expired check and the write inside one
// store transaction, which is what makes "single use" true even when two
// requests arrive with the same token at the same moment — reading the row in
// the route handler and writing later would let both pass the check.

import crypto from 'crypto';
import { createAsyncJsonStore } from './jsonStore';

export type PasswordResetKind = 'token' | 'otp';

export interface PasswordResetToken {
  id: string;
  userId: string;
  email: string;
  tokenHash: string;
  type: PasswordResetKind;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
}

export type ConsumeResult = 'consumed' | 'expired' | 'used' | 'missing';

const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

const resetStore = createAsyncJsonStore<PasswordResetToken>('password-reset-tokens.json');

function toIso(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error('Thời điểm hết hạn của mã đặt lại mật khẩu không hợp lệ.');
  }
  return date.toISOString();
}

export const dbPasswordReset = {
  /**
   * Issue a new ticket. Any ticket the user still has outstanding is closed
   * first — asking for a second email must not leave the first link live.
   */
  async create(data: {
    userId: string;
    email: string;
    tokenHash: string;
    type: PasswordResetKind;
    expiresAt: Date | string;
  }): Promise<PasswordResetToken> {
    const now = new Date();
    const nowIso = now.toISOString();
    const record: PasswordResetToken = {
      id: `PRT_${crypto.randomUUID()}`,
      userId: data.userId,
      email: data.email.toLowerCase().trim(),
      tokenHash: data.tokenHash,
      type: data.type,
      expiresAt: toIso(data.expiresAt),
      usedAt: null,
      createdAt: nowIso,
    };

    await resetStore.update((rows) => {
      // Close outstanding tickets for this user.
      for (const row of rows) {
        if (row.userId === data.userId && row.usedAt === null) row.usedAt = nowIso;
      }

      // Keep the file bounded: drop tickets that ended over a week ago.
      for (let i = rows.length - 1; i >= 0; i -= 1) {
        const endedAt = rows[i].usedAt ? Date.parse(rows[i].usedAt!) : Date.parse(rows[i].expiresAt);
        if (Number.isNaN(endedAt) || now.getTime() - endedAt > RETENTION_MS) rows.splice(i, 1);
      }

      rows.push(record);
    });

    return record;
  },

  async findByHash(tokenHash: string): Promise<PasswordResetToken | undefined> {
    const rows = await resetStore.read();
    return rows.find((row) => row.tokenHash === tokenHash);
  },

  /**
   * Atomically mark a ticket used. The winner of a concurrent race gets
   * 'consumed'; everyone else learns why they lost.
   */
  async consume(id: string, now = new Date()): Promise<ConsumeResult> {
    const nowIso = now.toISOString();
    const nowMs = now.getTime();

    return resetStore.update((rows) => {
      const row = rows.find((candidate) => candidate.id === id);
      if (!row) return 'missing' as ConsumeResult;
      if (row.usedAt) return 'used' as ConsumeResult;

      const expiresAt = Date.parse(row.expiresAt);
      row.usedAt = nowIso;
      if (Number.isNaN(expiresAt) || expiresAt <= nowMs) return 'expired' as ConsumeResult;
      return 'consumed' as ConsumeResult;
    });
  },
};
