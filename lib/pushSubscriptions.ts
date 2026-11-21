// lib/pushSubscriptions.ts
// Push subscriptions: data/push-subscriptions.json
//
// Chỉ được subscribe khi khách hàng đã đăng nhập (session-gated) — bởi vì SW fetch
// cần xác minh session để trả lại nội dung cho của họ, mọi người không thể
// subscribe rồi nhận thông báo của người khác được.
//
// unsubscribeToken: mã ngẫu nhiên được lưu, dùng cho /api/push/unsubscribe?token=X
// (one-click unsubscribe pattern). subId: hash của endpoint — dùng cho
// /api/notifications/latest?subId=X (SW lấy nội dung nhắc mới nhất).

import { createAsyncJsonStore } from './jsonStore';
import crypto from 'crypto';

export type PushSubStatus = 'granted' | 'revoked' | 'expired';

export interface PushSubscription {
  id: string;
  email: string;
  endpoint: string;
  p256dh: string | null;
  auth: string | null;
  subId: string;
  deviceType: string | null;
  status: PushSubStatus;
  unsubscribeToken: string;
  createdAt: string;
  lastSuccessAt: string | null;
  lastError: string | null;
}

function generateId(): string {
  return `PS_${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
}

function generateUnsubscribeToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

function generateSubId(endpoint: string): string {
  return crypto.createHash('sha256').update(endpoint).digest('hex').slice(0, 16);
}

const store = createAsyncJsonStore<PushSubscription>('push-subscriptions.json', (raw) => {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((row): row is Record<string, unknown> => !!row && typeof row === 'object')
    .filter((row) => typeof row.id === 'string' && typeof row.endpoint === 'string')
    .map((row) => ({
      id: row.id as string,
      email: String(row.email ?? '').toLowerCase().trim(),
      endpoint: row.endpoint as string,
      p256dh: typeof row.p256dh === 'string' ? (row.p256dh as string) : null,
      auth: typeof row.auth === 'string' ? (row.auth as string) : null,
      subId: typeof row.subId === 'string' ? (row.subId as string) : generateSubId(row.endpoint as string),
      deviceType: typeof row.deviceType === 'string' ? (row.deviceType as string) : null,
      status: (row.status === 'revoked' || row.status === 'expired') ? (row.status as PushSubStatus) : 'granted',
      unsubscribeToken: typeof row.unsubscribeToken === 'string' ? (row.unsubscribeToken as string) : generateUnsubscribeToken(),
      createdAt: typeof row.createdAt === 'string' ? (row.createdAt as string) : new Date(0).toISOString(),
      lastSuccessAt: typeof row.lastSuccessAt === 'string' ? (row.lastSuccessAt as string) : null,
      lastError: typeof row.lastError === 'string' ? (row.lastError as string) : null,
    }));
});

export const dbPushSubscriptions = {
  /** Add hoặc update theo endpoint (re-subscribe: trả thông tin subscription hiện tại). */
  async upsert(input: {
    email: string;
    endpoint: string;
    p256dh?: string | null;
    auth?: string | null;
    deviceType?: string | null;
  }): Promise<PushSubscription> {
    const email = input.email.toLowerCase().trim();
    const endpoint = input.endpoint.trim();
    return store.update((rows) => {
      const existing = rows.find((row) => row.endpoint === endpoint);
      if (existing) {
        existing.email = email;
        existing.p256dh = input.p256dh ?? existing.p256dh;
        existing.auth = input.auth ?? existing.auth;
        existing.deviceType = input.deviceType ?? existing.deviceType;
        existing.status = 'granted';
        return { ...existing };
      }
      const sub: PushSubscription = {
        id: generateId(),
        email,
        endpoint,
        p256dh: input.p256dh ?? null,
        auth: input.auth ?? null,
        subId: generateSubId(endpoint),
        deviceType: input.deviceType ?? null,
        status: 'granted',
        unsubscribeToken: generateUnsubscribeToken(),
        createdAt: new Date().toISOString(),
        lastSuccessAt: null,
        lastError: null,
      };
      rows.push(sub);
      return { ...sub };
    });
  },

  /** List subscriptions of a customer (only status=granted như subscription dễ dùng). */
  async findByEmail(email: string): Promise<PushSubscription[]> {
    const target = email.toLowerCase().trim();
    return (await store.read())
      .filter((row) => row.email === target && row.status === 'granted')
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },

  async findBySubId(subId: string): Promise<PushSubscription | undefined> {
    return (await store.read()).find((row) => row.subId === subId && row.status === 'granted');
  },

  /** Revoke by unsubscribeToken → trả về số dòng đã xóa. */
  async removeByToken(token: string): Promise<number> {
    const trimmed = token.trim();
    if (!trimmed) return 0;
    return store.update((rows) => {
      const idx = rows.findIndex((row) => row.unsubscribeToken === trimmed);
      if (idx === -1) return 0;
      rows.splice(idx, 1);
      return 1;
    });
  },

  /** Xoá theo subId (unsubscribe từ trang khách có session). */
  async removeBySubId(subId: string): Promise<number> {
    return store.update((rows) => {
      const idx = rows.findIndex((row) => row.subId === subId && row.status === 'granted');
      if (idx === -1) return 0;
      rows.splice(idx, 1);
      return 1;
    });
  },

  async listAll(): Promise<PushSubscription[]> {
    return store.read();
  },

  /** Mark a subscription as error/expired (adapter hook). */
  async markFailed(endpoint: string, error: string): Promise<void> {
    await store.update((rows) => {
      const row = rows.find((candidate) => candidate.endpoint === endpoint && candidate.status === 'granted');
      if (row) {
        row.status = 'expired';
        row.lastError = error.slice(0, 500);
      }
    });
  },

  async markSuccess(endpoint: string): Promise<void> {
    await store.update((rows) => {
      const row = rows.find((candidate) => candidate.endpoint === endpoint && candidate.status === 'granted');
      if (row) {
        row.lastSuccessAt = new Date().toISOString();
        row.lastError = null;
      }
    });
  },
};
