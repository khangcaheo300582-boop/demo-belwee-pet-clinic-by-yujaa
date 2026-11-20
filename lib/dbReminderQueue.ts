// lib/dbReminderQueue.ts
// File-backed care-reminder queue (data/reminder-queue.json).
//
// The queue is a small, append-mostly list keyed by bookingId. Its whole job is
// to survive a restart between "a reminder is due" and "the reminder was sent",
// which a JSON file with atomic writes does perfectly well without a database
// connection in the middle of the scheduler loop.

import { createAsyncJsonStore } from './jsonStore';

export type QueueStatus = 'PENDING' | 'SENT' | 'CANCELLED';

export interface ReminderQueueItem {
  id: string;
  bookingId: string;
  petName: string;
  petType?: string;
  userEmail: string;
  service: string;
  remindDate: string;
  status: QueueStatus;
  createdAt: string;
  sentAt?: string | null;
  attempts?: number;
  lastAttemptAt?: string | null;
  lastError?: string | null;
}

function generateId(): string {
  return `RM_${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
}

const reminderStore = createAsyncJsonStore<ReminderQueueItem>('reminder-queue.json', (raw) => {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((row): row is Record<string, unknown> => !!row && typeof row === 'object')
    .filter((row) => typeof row.id === 'string' && typeof row.bookingId === 'string')
    .map((row) => ({
      id: row.id as string,
      bookingId: row.bookingId as string,
      petName: typeof row.petName === 'string' ? row.petName : '',
      petType: typeof row.petType === 'string' ? row.petType : undefined,
      userEmail: typeof row.userEmail === 'string' ? row.userEmail : '',
      service: typeof row.service === 'string' ? row.service : '',
      remindDate: typeof row.remindDate === 'string' ? row.remindDate : new Date(0).toISOString(),
      status: row.status === 'SENT' ? 'SENT' : row.status === 'CANCELLED' ? 'CANCELLED' : 'PENDING',
      createdAt: typeof row.createdAt === 'string' ? row.createdAt : new Date(0).toISOString(),
      sentAt: typeof row.sentAt === 'string' ? row.sentAt : null,
      attempts: Number.isInteger(row.attempts) ? Number(row.attempts) : 0,
      lastAttemptAt: typeof row.lastAttemptAt === 'string' ? row.lastAttemptAt : null,
      lastError: typeof row.lastError === 'string' ? row.lastError : null,
    }));
});

function paginate(rows: ReminderQueueItem[], options: { page?: number; limit?: number }): ReminderQueueItem[] {
  const page = Math.max(1, options.page ?? 1);
  const limit = Math.max(1, Math.min(100, options.limit ?? 100));
  return rows.slice((page - 1) * limit, page * limit);
}

export const dbReminderQueue = {
  async existsByBookingId(bookingId: string): Promise<boolean> {
    return (await reminderStore.read()).some((row) => row.bookingId === bookingId && row.status === 'SENT');
  },

  async findByBookingId(bookingId: string): Promise<ReminderQueueItem | undefined> {
    return (await reminderStore.read()).find((row) => row.bookingId === bookingId);
  },

  async list(options: { page?: number; limit?: number } = {}): Promise<ReminderQueueItem[]> {
    const rows = (await reminderStore.read()).sort((a, b) => a.remindDate.localeCompare(b.remindDate));
    return paginate(rows, options);
  },

  async listPending(options: { page?: number; limit?: number } = {}): Promise<ReminderQueueItem[]> {
    const rows = (await reminderStore.read())
      .filter((row) => row.status === 'PENDING')
      .sort((a, b) => a.remindDate.localeCompare(b.remindDate));
    return paginate(rows, options);
  },

  async enqueue(data: Omit<ReminderQueueItem, 'id' | 'status' | 'createdAt' | 'sentAt' | 'attempts' | 'lastAttemptAt' | 'lastError'>): Promise<ReminderQueueItem> {
    return reminderStore.update((rows) => {
      const current = rows.find((row) => row.bookingId === data.bookingId);
      if (current) {
        if (current.status !== 'PENDING') return { ...current };
        Object.assign(current, data);
        return { ...current };
      }

      const item: ReminderQueueItem = {
        ...data,
        id: generateId(),
        status: 'PENDING',
        createdAt: new Date().toISOString(),
        sentAt: null,
        attempts: 0,
        lastAttemptAt: null,
        lastError: null,
      };
      rows.push(item);
      return { ...item };
    });
  },

  async markFailed(id: string, error: string): Promise<boolean> {
    return reminderStore.update((rows) => {
      const item = rows.find((row) => row.id === id && row.status === 'PENDING');
      if (!item) return false;
      item.attempts = (item.attempts ?? 0) + 1;
      item.lastAttemptAt = new Date().toISOString();
      item.lastError = error.slice(0, 500);
      return true;
    });
  },

  async markSent(id: string): Promise<boolean> {
    return reminderStore.update((rows) => {
      const item = rows.find((row) => row.id === id && row.status === 'PENDING');
      if (!item) return false;
      item.status = 'SENT';
      item.sentAt = new Date().toISOString();
      item.lastError = null;
      return true;
    });
  },

  async cancel(bookingId: string): Promise<boolean> {
    // Fast path: cancelling a booking with no pending reminder must not write.
    const pending = (await reminderStore.read()).some(
      (row) => row.bookingId === bookingId && row.status === 'PENDING'
    );
    if (!pending) return false;

    return reminderStore.update((rows) => {
      let modified = 0;
      for (const row of rows) {
        if (row.bookingId !== bookingId || row.status !== 'PENDING') continue;
        row.status = 'CANCELLED';
        modified += 1;
      }
      return modified > 0;
    });
  },
};
