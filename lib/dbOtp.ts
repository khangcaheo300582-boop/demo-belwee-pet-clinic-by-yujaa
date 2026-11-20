// lib/dbOtp.ts
// File-based OTP persistence – backed by the shared lib/jsonStore primitive.
// Keeps data across server restarts without requiring MongoDB.

import { createAsyncJsonStore } from './jsonStore';
import {
  MAX_VERIFY_ATTEMPTS,
  OTP_COOLDOWN_SECONDS,
  OTP_SEND_COOLDOWN_MS,
  OTP_SEND_COOLDOWN_SECONDS,
  OTP_TTL_MS,
  cooldownRemainingSeconds,
  evaluateVerify,
  generateOtpCode,
  hashOtpCode,
  matchesHash,
  type OtpPurpose,
  type OtpTimingState,
} from './otpPolicy';

// Re-exported so existing importers (`app/api/auth/send-otp`, the JSON→Mongo
// importer) keep their import path. The implementation lives in otpPolicy.
export { OTP_COOLDOWN_SECONDS, OTP_SEND_COOLDOWN_SECONDS, hashOtpCode };
export type { OtpPurpose };

export interface OtpRecord {
  email: string;
  purpose: OtpPurpose;
  expiresAt: string;
  lastSentAt: string;
  lastFailedAt: string | null;
  attempts: number;
  createdAt: string;
}

export class OtpCooldownError extends Error {
  constructor(readonly cooldownSeconds: number) {
    super('OTP resend cooldown is still active.');
    this.name = 'OtpCooldownError';
  }
}

function toTimingState(record: OtpRecord): OtpTimingState {
  return {
    purpose: record.purpose,
    expiresAt: new Date(record.expiresAt).getTime(),
    lastSentAt: new Date(record.lastSentAt).getTime(),
    lastFailedAt: record.lastFailedAt ? new Date(record.lastFailedAt).getTime() : null,
    attempts: record.attempts,
  };
}

// Internal storage row: carries codeHash (never exposed in OtpRecord).
interface OtpRow {
  email: string;
  codeHash: string;
  purpose: OtpPurpose;
  expiresAt: string;
  lastSentAt: string;
  lastFailedAt: string | null;
  attempts: number;
  createdAt: string;
}

const otpStore = createAsyncJsonStore<OtpRow>('otps.json');

function toRecord(row: OtpRow): OtpRecord {
  return {
    email: row.email,
    purpose: row.purpose,
    expiresAt: row.expiresAt,
    lastSentAt: row.lastSentAt,
    lastFailedAt: row.lastFailedAt,
    attempts: row.attempts,
    createdAt: row.createdAt,
  };
}

export const dbOtp = {
  generateCode(): string {
    return generateOtpCode();
  },

  /**
   * Load the outstanding record for an email. When `purpose` is given the lookup
   * is scoped to that flow, which is the normal case: registration, password
   * reset and staff PIN reset each keep their own record and never shadow one
   * another.
   */
  async findByEmail(email: string, purpose?: OtpPurpose): Promise<OtpRecord | undefined> {
    const rows = await otpStore.read();
    const normalizedEmail = email.toLowerCase().trim();
    const row = rows.find(
      (r) => r.email === normalizedEmail && (!purpose || r.purpose === purpose)
    );
    if (!row) return undefined;
    return toRecord(row);
  },

  async upsert(email: string, code: string, purpose: OtpPurpose = 'register'): Promise<OtpRecord> {
    const normalizedEmail = email.toLowerCase().trim();
    const now = new Date();
    const codeHash = hashOtpCode(code.trim());

    return otpStore.update((rows) => {
      // Find existing record for this email + purpose.
      const existingIdx = rows.findIndex(
        (r) => r.email === normalizedEmail && r.purpose === purpose
      );

      if (existingIdx !== -1) {
        const existing = rows[existingIdx];
        const lastSentAt = new Date(existing.lastSentAt).getTime();
        if (now.getTime() - lastSentAt < OTP_SEND_COOLDOWN_MS) {
          const cooldownSeconds = Math.max(
            0,
            Math.ceil((lastSentAt + OTP_SEND_COOLDOWN_MS - now.getTime()) / 1000)
          );
          if (cooldownSeconds > 0) throw new OtpCooldownError(cooldownSeconds);
        }
        // Overwrite existing record.
        rows[existingIdx] = {
          ...existing,
          codeHash,
          expiresAt: new Date(now.getTime() + OTP_TTL_MS).toISOString(),
          lastSentAt: now.toISOString(),
          lastFailedAt: null,
          attempts: 0,
        };
        return toRecord(rows[existingIdx]);
      }

      // Insert new record (one per email + purpose).
      const row: OtpRow = {
        email: normalizedEmail,
        codeHash,
        purpose,
        expiresAt: new Date(now.getTime() + OTP_TTL_MS).toISOString(),
        lastSentAt: now.toISOString(),
        lastFailedAt: null,
        attempts: 0,
        createdAt: now.toISOString(),
      };
      rows.push(row);
      return toRecord(row);
    });
  },

  async verify(
    email: string,
    otpCode: string,
    purpose: OtpPurpose = 'register'
  ): Promise<{ success: boolean; error?: string }> {
    const normalizedEmail = email.toLowerCase().trim();

    return otpStore.update((rows) => {
      const idx = rows.findIndex(
        (r) => r.email === normalizedEmail && r.purpose === purpose
      );
      if (idx === -1) {
        return { success: false, error: 'Mã OTP không tồn tại hoặc đã bị hủy. Vui lòng bấm gửi lại mã.' };
      }

      const record = toRecord(rows[idx]);
      const state: OtpTimingState = {
        purpose: record.purpose,
        expiresAt: new Date(record.expiresAt).getTime(),
        lastSentAt: new Date(record.lastSentAt).getTime(),
        lastFailedAt: record.lastFailedAt ? new Date(record.lastFailedAt).getTime() : null,
        attempts: record.attempts,
      };
      const now = Date.now();
      const codeMatches = matchesHash(otpCode.trim(), rows[idx].codeHash);
      const decision = evaluateVerify(state, purpose, now, codeMatches);

      switch (decision.kind) {
        case 'missing':
          return { success: false, error: 'Mã OTP không tồn tại hoặc đã bị hủy. Vui lòng bấm gửi lại mã.' };

        case 'wrong-purpose':
          return { success: false, error: 'Mã OTP không hợp lệ cho thao tác này. Vui lòng gửi lại mã.' };

        case 'locked': {
          const remainingMin = Math.ceil(decision.remainingMs / 60000);
          return { success: false, error: `Quá nhiều lần nhập sai. Vui lòng đợi ${remainingMin} phút nữa.` };
        }

        case 'expired':
          rows.splice(idx, 1);
          return { success: false, error: 'Mã OTP này đã hết hạn hiệu lực (quá 5 phút).' };

        case 'incorrect': {
          if (decision.resetAttempts) {
            rows[idx] = { ...rows[idx], attempts: 1, lastFailedAt: new Date(now).toISOString() };
          } else {
            rows[idx] = {
              ...rows[idx],
              attempts: rows[idx].attempts + 1,
              lastFailedAt: new Date(now).toISOString(),
            };
          }
          if (decision.remainingAttempts === 0) {
            return { success: false, error: `Bạn đã nhập sai quá ${MAX_VERIFY_ATTEMPTS} lần. Vui lòng gửi lại mã mới.` };
          }
          return {
            success: false,
            error: `Mã xác thực OTP không chính xác. Còn ${decision.remainingAttempts} lần thử.`,
          };
        }

        case 'accept':
          rows.splice(idx, 1);
          return { success: true };
      }
    });
  },

  async deleteByEmail(email: string, expectedCode?: string, purpose?: OtpPurpose): Promise<boolean> {
    const normalizedEmail = email.toLowerCase().trim();

    return otpStore.update((rows) => {
      const idx = rows.findIndex((r) => {
        if (r.email !== normalizedEmail) return false;
        if (purpose && r.purpose !== purpose) return false;
        if (expectedCode) {
          return r.codeHash === hashOtpCode(expectedCode.trim());
        }
        return true;
      });
      if (idx === -1) return false;
      rows.splice(idx, 1);
      return true;
    });
  },

  async getCooldownSeconds(email: string, purpose?: OtpPurpose): Promise<number> {
    const record = await this.findByEmail(email, purpose);
    if (!record) return 0;
    return cooldownRemainingSeconds(toTimingState(record), purpose ?? record.purpose, Date.now(), true);
  },
};
