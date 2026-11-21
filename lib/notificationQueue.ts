// lib/notificationQueue.ts
// Engine queue: data/notification-queue.json
//
// Extends the legacy dbReminderQueue concept: one row per "nhắc lịch" item with
// idempotencyKey = f(type, scope, dueAt). The engine guarantees at-most-one
// notification per (type, entity, dueAt) across ticks: enqueue() is idempotent,
// and cancelScope() runs when a booking is cancelled or a record is deleted.

import { createAsyncJsonStore } from './jsonStore';

export type NotificationQueueStatus = 'QUEUED' | 'SENT' | 'FAILED' | 'CANCELLED';
export type NotificationChannel = 'email' | 'desktop' | 'push';
export type NotificationTypeCode = 'appointment' | 'vaccination' | 'followUp' | 'payment' | 'care';

export interface NotificationScope {
  type: 'booking' | 'record' | 'careRegistration';
  entityId: string;
}

export interface NotificationQueueItem {
  id: string;
  type: NotificationTypeCode;
  scope: NotificationScope;
  ownerEmail: string;
  ownerName: string | null;
  petName: string;
  topic: string;
  dueAt: string; // mốc nhận mặc định (đầu khung giờ nhận đầu tiên)
  sendAt: string; // thời điểm dự kiến gửi đầu tiên
  status: NotificationQueueStatus;
  idempotencyKey: string;
  channels: NotificationChannel[]; // kênh dự kiến gửi (từ preferences)
  sentChannels: NotificationChannel[];
  attempts: number;
  lastError: string | null;
  createdAt: string;
  sentAt: string | null;
  updatedAt: string;
}

/**
 * Những hàng đã gửi thành công chưa nhận lại lần 2 (engine không gửi lặp lại
 * một item đã được markSent). FAILED giữ lại cải thiện thông tin cho operator.
 */
const CHANNEL_CODES = ['email', 'desktop', 'push'] as const;

function generateId(): string {
  return `NQ_${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
}

function normalizeScope(value: unknown): NotificationScope {
  const row = (value ?? {}) as Record<string, unknown>;
  const type = (['booking', 'record', 'careRegistration'] as const).find((t) => t === row.type) ?? 'booking';
  return { type, entityId: typeof row.entityId === 'string' ? row.entityId : '' };
}

function normalizeType(value: unknown): NotificationTypeCode {
  const found = ['appointment', 'vaccination', 'followUp', 'payment', 'care'].find((t) => t === value);
  return (found ?? 'appointment') as NotificationTypeCode;
}

const store = createAsyncJsonStore<NotificationQueueItem>('notification-queue.json', (raw) => {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((row): row is Record<string, unknown> => !!row && typeof row === 'object')
    .filter((row) => typeof row.id === 'string' && typeof row.idempotencyKey === 'string')
    .map((row) => ({
      id: row.id as string,
      type: normalizeType(row.type),
      scope: normalizeScope(row.scope),
      ownerEmail: String(row.ownerEmail ?? '').toLowerCase().trim(),
      ownerName: typeof row.ownerName === 'string' ? row.ownerName : null,
      petName: typeof row.petName === 'string' ? row.petName : '',
      topic: typeof row.topic === 'string' ? row.topic : '',
      dueAt: typeof row.dueAt === 'string' ? row.dueAt : new Date(0).toISOString(),
      sendAt: typeof row.sendAt === 'string' ? row.sendAt : new Date(0).toISOString(),
      status: (row.status === 'SENT' || row.status === 'CANCELLED' || row.status === 'FAILED') ? (row.status as NotificationQueueStatus) : 'QUEUED',
      idempotencyKey: String(row.idempotencyKey),
      channels: Array.isArray(row.channels) ? row.channels.filter((c): c is NotificationChannel => CHANNEL_CODES.includes(c as NotificationChannel)) : ['email'],
      sentChannels: Array.isArray(row.sentChannels) ? row.sentChannels.filter((c): c is NotificationChannel => CHANNEL_CODES.includes(c as NotificationChannel)) : [],
      attempts: Number.isInteger(row.attempts) ? Number(row.attempts) : 0,
      lastError: typeof row.lastError === 'string' ? row.lastError : null,
      createdAt: typeof row.createdAt === 'string' ? row.createdAt : new Date(0).toISOString(),
      sentAt: typeof row.sentAt === 'string' ? row.sentAt : null,
      updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt : new Date().toISOString(),
    }));
});

interface EnqueueInput {
  type: NotificationTypeCode;
  scope: NotificationScope;
  ownerEmail: string;
  ownerName?: string | null;
  petName: string;
  topic: string;
  dueAt: string;
  sendAt: string;
  channels?: NotificationChannel[];
}

export const dbNotificationQueue = {
  /**
   * Idempotent enqueue: nếu đã có dòng của (type, scope, dueAt) — trả dòng cũ
   * và cập nhật dữ liệu mới nhất từ caller (sendAt, channels...). Dòng đã
   * CANCELLED giữ nguyên — engine nhắc hoạt động dựa trên kết quả này.
   */
  async enqueue(input: EnqueueInput): Promise<{ item: NotificationQueueItem; created: boolean }> {
    const key = `${input.type}:${input.scope.type}:${input.scope.entityId}:${input.dueAt}`;
    return store.update((rows) => {
      const existing = rows.find((row) => row.idempotencyKey === key);
      if (existing) {
        if (existing.status !== 'SENT' && existing.status !== 'CANCELLED') {
          existing.status = 'QUEUED';
          existing.sendAt = input.sendAt;
          existing.channels = input.channels ?? existing.channels;
          existing.topic = input.topic;
          existing.petName = input.petName;
          existing.ownerName = input.ownerName ?? existing.ownerName;
          existing.updatedAt = new Date().toISOString();
        }
        return { item: { ...existing }, created: false };
      }

      const now = new Date().toISOString();
      const item: NotificationQueueItem = {
        id: generateId(),
        type: input.type,
        scope: { ...input.scope },
        ownerEmail: input.ownerEmail.toLowerCase().trim(),
        ownerName: input.ownerName ?? null,
        petName: input.petName,
        topic: input.topic,
        dueAt: input.dueAt,
        sendAt: input.sendAt,
        status: 'QUEUED',
        idempotencyKey: key,
        channels: input.channels?.length ? input.channels : ['email'],
        sentChannels: [],
        attempts: 0,
        lastError: null,
        createdAt: now,
        sentAt: null,
        updatedAt: now,
      };
      rows.push(item);
      return { item: { ...item }, created: true };
    });
  },

  async findById(id: string): Promise<NotificationQueueItem | undefined> {
    return (await store.read()).find((row) => row.id === id);
  },

  async markSent(id: string, channel: NotificationChannel): Promise<boolean> {
    return store.update((rows) => {
      const row = rows.find((candidate) => candidate.id === id && candidate.status === 'QUEUED');
      if (!row) return false;
      if (!row.sentChannels.includes(channel)) row.sentChannels.push(channel);
      row.updatedAt = new Date().toISOString();
      return true;
    });
  },

  /** Đóng row khi tất cả channels đã thành công. */
  async markComplete(id: string): Promise<boolean> {
    return store.update((rows) => {
      const row = rows.find((candidate) => candidate.id === id && candidate.status === 'QUEUED');
      if (!row) return false;
      if (row.channels.length > 0 && row.channels.every((c) => row.sentChannels.includes(c))) {
        row.status = 'SENT';
        row.sentAt = new Date().toISOString();
        row.lastError = null;
      }
      row.updatedAt = new Date().toISOString();
      return true;
    });
  },

  async markFailed(id: string, error: string): Promise<boolean> {
    return store.update((rows) => {
      const row = rows.find((candidate) => candidate.id === id && candidate.status === 'QUEUED');
      if (!row) return false;
      row.attempts += 1;
      row.lastError = error.slice(0, 500);
      if (row.attempts >= 8) {
        row.status = 'FAILED';
        row.updatedAt = new Date().toISOString();
        return true;
      }
      row.updatedAt = new Date().toISOString();
      return true;
    });
  },

  async list(options: {
    status?: NotificationQueueStatus | NotificationQueueStatus[];
    type?: NotificationTypeCode;
    scopeType?: NotificationScope['type'];
    entityId?: string;
    email?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<NotificationQueueItem[]> {
    const rows = (await store.read())
      .filter((row) => !options.status || (Array.isArray(options.status) ? options.status.includes(row.status) : row.status === options.status))
      .filter((row) => !options.type || row.type === options.type)
      .filter((row) => !options.scopeType || row.scope.type === options.scopeType)
      .filter((row) => !options.entityId || row.scope.entityId === options.entityId)
      .filter((row) => !options.email || row.ownerEmail === options.email.toLowerCase().trim())
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const offset = options.offset ?? 0;
    const limit = options.limit ?? 50;
    return rows.slice(offset, offset + limit);
  },

  /** Dòng đang mở (QUEUED) có sendAt <= now. */
  async listDue(now: string = new Date().toISOString()): Promise<NotificationQueueItem[]> {
    return (await store.read())
      .filter((row) => row.status === 'QUEUED' && row.sendAt <= now)
      .sort((a, b) => a.sendAt.localeCompare(b.sendAt));
  },

  async countByStatus(): Promise<Record<NotificationQueueStatus, number>> {
    const counts: Record<NotificationQueueStatus, number> = { QUEUED: 0, SENT: 0, FAILED: 0, CANCELLED: 0 };
    for (const row of await store.read()) counts[row.status] += 1;
    return counts;
  },

  /** Xoá lịch hẹn của scope: khi booking bị hủy/xóa hoặc bản ghi bị xóa. */
  async cancelScope(scope: NotificationScope): Promise<number> {
    return store.update((rows) => {
      let modified = 0;
      for (const row of rows) {
        if (row.scope.type === scope.type && row.scope.entityId === scope.entityId && row.status === 'QUEUED') {
          row.status = 'CANCELLED';
          row.updatedAt = new Date().toISOString();
          modified += 1;
        }
      }
      return modified;
    });
  },

  async summary(): Promise<{ total: number; queued: number; sent: number; cancelled: number; failed: number; sentByChannel: Record<string, number> }> {
    const rows = await store.read();
    const sentByChannel: Record<string, number> = {};
    for (const row of rows) {
      for (const channel of row.sentChannels) sentByChannel[channel] = (sentByChannel[channel] ?? 0) + 1;
    }
    const count = (status: NotificationQueueStatus) => rows.filter((row) => row.status === status).length;
    return {
      total: rows.length,
      queued: count('QUEUED'),
      sent: count('SENT'),
      cancelled: count('CANCELLED'),
      failed: count('FAILED'),
      sentByChannel,
    };
  },

  /** Admin: reset một row FAILED về QUEUED để admin có thể retry nó thủ công. */
  async markRetryable(id: string): Promise<boolean> {
    return store.update((rows) => {
      const row = rows.find((candidate) => candidate.id === id);
      if (!row) return false;
      row.status = 'QUEUED';
      row.attempts = 0;
      row.lastError = null;
      row.updatedAt = new Date().toISOString();
      return true;
    });
  },

  async retryAllFailed(): Promise<number> {
    return store.update((rows) => {
      let retried = 0;
      for (const row of rows) {
        if (row.status === 'FAILED') {
          row.status = 'QUEUED';
          row.attempts = 0;
          row.lastError = null;
          row.sendAt = new Date(row.sentAt ?? row.createdAt).getTime() > 0 ? row.sendAt : row.sendAt;
          row.updatedAt = new Date().toISOString();
          retried += 1;
        }
      }
      return retried;
    });
  },
};
