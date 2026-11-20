// lib/dbResetToken.ts
// File-backed password reset tokens (data/reset-tokens.json).
//
// Only the HMAC of the token is stored, never the token itself, so a leaked
// copy of the file cannot be turned back into a working reset link. `create`
// replaces the previous ticket for the same email (one live ticket per
// account), and `verifyAndConsume` marks it used in the same atomic write that
// reads it — a second request with the same token cannot pass the check.

import crypto from 'crypto';
import { createAsyncJsonStore } from './jsonStore';

export interface ResetTokenRecord {
  email: string;
  token: string;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
}

interface StoredResetToken {
  email: string;
  tokenHash: string;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
}

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

export function hashResetToken(token: string): string {
  const secret = process.env.RESET_TOKEN_HASH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('RESET_TOKEN_HASH_SECRET or NEXTAUTH_SECRET must contain at least 32 characters.');
  }
  return crypto.createHmac('sha256', secret).update(token).digest('hex');
}

const resetTokenStore = createAsyncJsonStore<StoredResetToken>('reset-tokens.json', (raw) => {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((row): row is Record<string, unknown> => !!row && typeof row === 'object')
    .filter((row) => typeof row.email === 'string' && typeof row.tokenHash === 'string')
    .map((row) => ({
      email: (row.email as string).toLowerCase().trim(),
      tokenHash: row.tokenHash as string,
      expiresAt: typeof row.expiresAt === 'string' ? row.expiresAt : new Date(0).toISOString(),
      usedAt: typeof row.usedAt === 'string' ? row.usedAt : null,
      createdAt: typeof row.createdAt === 'string' ? row.createdAt : new Date(0).toISOString(),
    }));
});

export const dbResetToken = {
  generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  },

  async create(email: string): Promise<ResetTokenRecord> {
    const normalizedEmail = email.toLowerCase().trim();
    const token = this.generateToken();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + RESET_TOKEN_TTL_MS);

    await resetTokenStore.update((rows) => {
      const row: StoredResetToken = {
        email: normalizedEmail,
        tokenHash: hashResetToken(token),
        expiresAt: expiresAt.toISOString(),
        usedAt: null,
        createdAt: now.toISOString(),
      };
      const existing = rows.findIndex((candidate) => candidate.email === normalizedEmail);
      if (existing === -1) rows.push(row);
      else rows[existing] = row;
    });

    return {
      email: normalizedEmail,
      token,
      expiresAt: expiresAt.toISOString(),
      usedAt: null,
      createdAt: now.toISOString(),
    };
  },

  async verifyAndConsume(token: string): Promise<{ success: boolean; email?: string; error?: string }> {
    const tokenHash = hashResetToken(token);
    const now = new Date();

    return resetTokenStore.update((rows) => {
      const row = rows.find((candidate) => candidate.tokenHash === tokenHash);
      if (!row) return { success: false, error: 'Token đặt lại mật khẩu không tồn tại.' };
      if (row.usedAt !== null || new Date(row.expiresAt).getTime() <= now.getTime()) {
        return { success: false, error: 'Token đặt lại mật khẩu đã hết hạn hoặc đã được sử dụng.' };
      }
      row.usedAt = now.toISOString();
      return { success: true, email: row.email };
    });
  },
};
