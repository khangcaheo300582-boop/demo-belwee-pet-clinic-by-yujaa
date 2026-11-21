// lib/customerNotificationPreferences.ts
// Per-customer notification preferences: data/customer-notification-preferences.json
//
// Kênh được hỗ trợ (tiềm năng — Zalo/WhatsApp/LINE/Telegram sẽ được thêm sau):
// email | desktop | push. Master switch: master. Khách tắt kênh bất kỳ → nhắc
// đó không gửi tới (invariant: "không nhắc người đã từ chừa/tắt thông báo").
//
// Mọi kênh của mỗi loại thông báo đều có cách hủy (unsubscribe link trong email
// → /api/notifications/unsubscribe; toggle kênh ở trang cá nhân / desktop &
// push unsubscribe flow; push_unsubscribe token cho API nhắc theo new channel).

import { createAsyncJsonStore } from './jsonStore';
import { createHash, timingSafeEqual } from 'crypto';

export type ChannelCode = 'email' | 'desktop' | 'push' | 'zalo' | 'whatsapp' | 'line' | 'telegram';
export type NotificationTypeCode = 'appointment' | 'vaccination' | 'followUp' | 'payment' | 'care';
export type EngineChannel = 'email' | 'desktop' | 'push';

export interface CustomerNotificationPreferences {
  email: string;
  /** Switch chủ đạo. */
  master: boolean;
  /** Kênh đã bật riêng lẻ (absent = dùng master). */
  channels: Partial<Record<EngineChannel, boolean>>;
  /** Loại nhắc đã đăng ký riêng lẻ (absent = còn bật). */
  types: Partial<Record<NotificationTypeCode, boolean>>;
  /** Khung giờ nhận nhắc (hòa lẹc: gửi đầu khung giờ bắt đầu, không gửi trước/sau hòa lẹc). */
  sendWindow: { start: string; end: string };
  /** Múi giờ khách hàng (V8: tất cả default = server local timezone nếu null). */
  timezone: string | null;
  /** Quy tắc đồng ý theo invariant 6 (invariant-6). */
  consent: {
    givenAt: string;
    withdrawnAt: string | null;
    channels: ChannelCode[];
  } | null;
  updatedAt: string;
}

function defaultPreferences(email: string): CustomerNotificationPreferences {
  return {
    email: email.toLowerCase().trim(),
    master: true,
    channels: { email: true },
    types: {
      appointment: true,
      vaccination: true,
      followUp: true,
      payment: true,
      care: true,
    },
    sendWindow: { start: '09:00', end: '22:00' },
    timezone: null,
    consent: null,
    updatedAt: new Date().toISOString(),
  };
}

const store = createAsyncJsonStore<CustomerNotificationPreferences>('customer-notification-preferences.json', (raw) => {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((row): row is Record<string, unknown> => !!row && typeof row === 'object')
    .filter((row) => typeof row.email === 'string' && row.email.length > 0)
    .map((row) => ({
      email: row.email as string,
      master: typeof row.master === 'boolean' ? (row.master as boolean) : true,
      channels: normalizeChannelMap(row.channels),
      types: normalizeTypeMap(row.types),
      sendWindow: normalizeSendWindow(row.sendWindow),
      timezone: typeof row.timezone === 'string' && row.timezone ? (row.timezone as string) : null,
      consent: normalizeConsent(row.consent),
      updatedAt: typeof row.updatedAt === 'string' ? (row.updatedAt as string) : new Date(0).toISOString(),
    }));
});

function normalizeChannelMap(value: unknown): Partial<Record<EngineChannel, boolean>> {
  if (!value || typeof value !== 'object') return {};
  const out: Partial<Record<EngineChannel, boolean>> = {};
  for (const key of ['email', 'desktop', 'push'] as const) {
    const v = (value as Record<string, unknown>)[key];
    if (typeof v === 'boolean') out[key] = v;
  }
  return out;
}

function normalizeTypeMap(value: unknown): Partial<Record<NotificationTypeCode, boolean>> {
  if (!value || typeof value !== 'object') return {};
  const out: Partial<Record<NotificationTypeCode, boolean>> = {};
  for (const key of ['appointment', 'vaccination', 'followUp', 'payment', 'care'] as const) {
    const v = (value as Record<string, unknown>)[key];
    if (typeof v === 'boolean') out[key] = v;
  }
  return out;
}

function normalizeSendWindow(value: unknown): { start: string; end: string } {
  const row = value as { start?: unknown; end?: unknown } | null;
  const start = typeof row?.start === 'string' && row.start.length === 5 ? row.start : '09:00';
  const end = typeof row?.end === 'string' && row.end.length === 5 ? row.end : '22:00';
  return { start, end };
}

function normalizeConsent(value: unknown): CustomerNotificationPreferences['consent'] {
  const row = (value ?? null) as { givenAt?: unknown; withdrawnAt?: unknown; channels?: unknown } | null;
  if (!row) return null;
  const givenAt = typeof row.givenAt === 'string' ? row.givenAt : null;
  if (!givenAt) return null;
  const channels: ChannelCode[] = Array.isArray(row.channels)
    ? row.channels.filter((c): c is ChannelCode => (['email', 'desktop', 'push', 'zalo', 'whatsapp', 'line', 'telegram'] as const).includes(c as ChannelCode))
    : ['email'];
  const withdrawnAt = typeof row.withdrawnAt === 'string' && row.withdrawnAt ? row.withdrawnAt : null;
  return { givenAt, withdrawnAt, channels };
}

/**
 * Migration lazy-first-read: nếu file mới rỗng, cố đọc file cũ (`notification-preferences.json`)
 * và chuyển thành dòng mới. Không xoá file cũ (không phá dữ liệu khách).
 */
async function migrateLegacy(): Promise<void> {
  const rows = await store.read();
  if (rows.length > 0) return;
  const legacyFile = 'notification-preferences.json';
  try {
    const fs = (await import('fs')).promises;
    const path = (await import('path')).join(process.cwd(), 'data', legacyFile);
    const raw = await fs.readFile(path, 'utf-8');
    const legacy = JSON.parse(raw) as Array<{ email: string; enabled?: boolean }>;
    const migrated = legacy
      .filter((row) => typeof row?.email === 'string')
      .map((row) => {
        const prefs = defaultPreferences(row.email);
        const enabled = row.enabled !== false;
        prefs.master = enabled;
        prefs.channels = { email: enabled };
        return prefs;
      });
    if (migrated.length > 0) {
      await store.write(migrated);
    }
  } catch {
    // Không có file cũ hoặc không đọc được → giữ nguyên file mới vừa tạo (default)
  }
}

export const dbCustomerNotificationPreferences = {
  /** Đọc prefs cho email. Không có → mặc định enable cho email (không tạo file). */
  async read(email: string): Promise<CustomerNotificationPreferences | null> {
    await migrateLegacy();
    const row = (await store.read()).find((candidate) => candidate.email === email.toLowerCase().trim());
    return row ? { ...row, channels: { ...row.channels }, types: { ...row.types } } : null;
  },

  async write(email: string, patch: Partial<Omit<CustomerNotificationPreferences, 'email' | 'consent' | 'updatedAt'>> & { consent?: CustomerNotificationPreferences['consent'] }): Promise<CustomerNotificationPreferences> {
    await migrateLegacy();
    const target = email.toLowerCase().trim();
    const existing = (await store.read()).find((row) => row.email === target);
    const base: CustomerNotificationPreferences = existing ?? defaultPreferences(target);
    const next: CustomerNotificationPreferences = {
      ...base,
      ...patch,
      email: target,
      updatedAt: new Date().toISOString(),
    };
    if ('channels' in patch) next.channels = { ...next.channels };
    if ('types' in patch) next.types = { ...next.types };
    const rows = await store.read();
    const idx = rows.findIndex((row) => row.email === target);
    if (idx === -1) rows.push(next);
    else rows[idx] = next;
    await store.write(rows);
    return { ...next, channels: { ...next.channels }, types: { ...next.types } };
  },

  /** Unsubscribe kênh cho email (thường dùng từ links unsubscribe). */
  async unsubscribe(email: string, channel: EngineChannel): Promise<void> {
    await this.write(email, { channels: { [channel]: false } });
  },

  async withdrawConsent(email: string): Promise<void> {
    await this.write(email, { consent: { withdrawnAt: new Date().toISOString(), givenAt: new Date().toISOString(), channels: ['email'] } });
  },

  /** List lại prefs cho staff/admin */
  async list(): Promise<CustomerNotificationPreferences[]> {
    await migrateLegacy();
    return (await store.read()).map((row) => ({ ...row, channels: { ...row.channels }, types: { ...row.types } }));
  },
};

export function timingSafeStringEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function digestEmail(email: string): string {
  return createHash('sha256').update(email.toLowerCase().trim()).digest('hex').slice(0, 20);
}

/** Cryptographically random unsubscribe token (256-bit base64url). */
export function generateUnsubscribeToken(): string {
  return createHash('sha256').update(`ntf-unsub-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`).digest('base64url');
}
