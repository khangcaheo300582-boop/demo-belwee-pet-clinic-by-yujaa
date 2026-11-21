// lib/deliveryLog.ts
// Delivery logs + analytics: data/delivery-logs.json
//
// Mỗi notification gửi/mở/click sẽ append row vào log → analytics (open rate
// email, click CTA, opt-out rate) và observability khi so sánh across channels.

import { createAsyncJsonStore } from './jsonStore';
import type { NotificationChannel, NotificationTypeCode, NotificationScope } from './notificationQueue';

export type DeliveryEvent = 'queued' | 'sent' | 'failed' | 'opened' | 'clicked' | 'unsubscribed';

export interface DeliveryLogEntry {
  id: string;
  itemId: string;
  queueId: string;
  ownerEmail: string;
  ownerName: string | null;
  petName: string;
  topic: string;
  type: NotificationTypeCode;
  scope: NotificationScope;
  channel: NotificationChannel;
  event: DeliveryEvent;
  at: string;
  detail?: string | null;
}

function generateId(): string {
  return `DL_${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
}

const store = createAsyncJsonStore<DeliveryLogEntry>('delivery-logs.json', (raw) => {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((row): row is Record<string, unknown> => !!row && typeof row === 'object')
    .filter((row) => typeof row.id === 'string' && typeof row.itemId === 'string')
    .map((row) => ({
      id: row.id as string,
      itemId: row.itemId as string,
      queueId: String(row.queueId ?? row.itemId),
      ownerEmail: String(row.ownerEmail ?? '').toLowerCase().trim(),
      ownerName: typeof row.ownerName === 'string' ? row.ownerName : null,
      petName: typeof row.petName === 'string' ? row.petName : '',
      topic: typeof row.topic === 'string' ? row.topic : '',
      type: (['appointment', 'vaccination', 'followUp', 'payment', 'care'] as const).find((t) => t === row.type) ?? 'appointment',
      scope: (() => {
        const row2 = row.scope as Record<string, unknown> | undefined;
        const type2 = ['booking', 'record', 'careRegistration'].find((t) => t === row2?.type) ?? 'booking';
        return { type: type2 as DeliveryLogEntry['scope']['type'], entityId: String(row2?.entityId ?? '') };
      })(),
      channel: (['email', 'desktop', 'push'] as const).find((c) => c === row.channel) ?? 'email',
      event: (['queued', 'sent', 'failed', 'opened', 'clicked', 'unsubscribed'] as const).find((e) => e === row.event) ?? 'queued',
      at: typeof row.at === 'string' ? row.at : new Date(0).toISOString(),
      detail: typeof row.detail === 'string' ? row.detail : null,
    }));
});

export const dbDeliveryLog = {
  async log(entry: Omit<DeliveryLogEntry, 'id'>): Promise<DeliveryLogEntry> {
    const row: DeliveryLogEntry = { ...entry, id: generateId() };
    return store.update((rows) => {
      rows.push(row);
      return { ...row };
    });
  },

  async list(options: {
    type?: NotificationTypeCode;
    channel?: NotificationChannel;
    event?: DeliveryEvent;
    ownerEmail?: string;
    since?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<DeliveryLogEntry[]> {
    const rows = (await store.read())
      .filter((row) => !options.type || row.type === options.type)
      .filter((row) => !options.channel || row.channel === options.channel)
      .filter((row) => !options.event || row.event === options.event)
      .filter((row) => !options.ownerEmail || row.ownerEmail === options.ownerEmail.toLowerCase().trim())
      .filter((row) => !options.since || row.at >= options.since)
      .sort((a, b) => b.at.localeCompare(a.at));
    const offset = options.offset ?? 0;
    return rows.slice(offset, offset + (options.limit ?? 50));
  },

  /** Đếm theo (type, channel, event) — cho analytics & quota cảnh báo. */
  async countBy(
    groupBy: 'type' | 'channel' | 'event' | 'type_channel',
    options: { since?: string; ownerEmail?: string } = {},
  ): Promise<Array<{ key: string; value: number }>> {
    const counts = new Map<string, number>();
    for (const row of await store.read()) {
      if (options.ownerEmail && row.ownerEmail !== options.ownerEmail.toLowerCase().trim()) continue;
      if (options.since && row.at < options.since) continue;
      const key = groupBy === 'type' ? row.type : groupBy === 'channel' ? row.channel : groupBy === 'event' ? row.event : `${row.type}:${row.channel}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([key, value]) => ({ key, value }));
  },

  async findByLogId(id: string): Promise<DeliveryLogEntry | undefined> {
    return (await store.read()).find((row) => row.id === id);
  },

  async markSent(logId: string): Promise<void> {
    await store.update((rows) => {
      const row = rows.find((candidate) => candidate.id === logId);
      if (row && row.event === 'queued') row.event = 'sent';
    });
  },

  async markOpened(logId: string): Promise<void> {
    await store.update((rows) => {
      const row = rows.find((candidate) => candidate.id === logId);
      if (row && (row.event === 'queued' || row.event === 'sent')) row.event = 'opened';
    });
  },

  async markClicked(logId: string): Promise<void> {
    await store.update((rows) => {
      const row = rows.find((candidate) => candidate.id === logId);
      if (row && ['queued', 'sent', 'opened'].includes(row.event)) row.event = 'clicked';
    });
  },

  /** Mở email — dùng tracking pixel (dựa id log unique per item+channel). */
  async findByQueueIdChannel(queueId: string, channel: NotificationChannel): Promise<DeliveryLogEntry | undefined> {
    return (await store.read())
      .filter((row) => row.queueId === queueId && row.channel === channel)
      .sort((a, b) => a.at.localeCompare(b.at))
      .at(-1);
  },

  async markFailed(logId: string, error: string): Promise<void> {
    await store.update((rows) => {
      const row = rows.find((candidate) => candidate.id === logId);
      if (row) {
        row.event = 'failed';
        row.detail = error.slice(0, 500);
      }
    });
  },

  async markUnsubscribed(logId: string): Promise<void> {
    await store.update((rows) => {
      const row = rows.find((candidate) => candidate.id === logId);
      if (row) row.event = 'unsubscribed';
    });
  },
};
