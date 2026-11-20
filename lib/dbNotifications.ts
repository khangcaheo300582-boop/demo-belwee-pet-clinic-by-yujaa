// lib/dbNotifications.ts
// File-backed staff notification inbox (data/notifications.json).
//
// A notification is small, written once and read a handful of times; it never
// needed a database. Moving it onto lib/jsonStore removes the last reason the
// dashboard had to wait on Atlas just to render the bell icon.

import { createAsyncJsonStore } from './jsonStore';

export type NotificationKind = 'booking-confirmed' | 'booking-cancelled' | 'booking-completed';

export interface StaffNotification {
  id: string;
  email: string;
  kind: NotificationKind;
  bookingId: string;
  title: string;
  body: string;
  staffName: string | null;
  staffAvatarUrl: string | null;
  createdAt: string;
  seenAt: string | null;
}

export interface CreateNotificationInput {
  email: string;
  kind: NotificationKind;
  bookingId: string;
  title: string;
  body: string;
  staffName?: string | null;
  staffAvatarUrl?: string | null;
}

function generateId(): string {
  return `NTF_${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
}

function normalizeKind(value: unknown): NotificationKind {
  return value === 'booking-cancelled' || value === 'booking-completed'
    ? value
    : 'booking-confirmed';
}

const notificationStore = createAsyncJsonStore<StaffNotification>('notifications.json', (raw) => {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((row): row is Record<string, unknown> => !!row && typeof row === 'object')
    .filter((row) => typeof row.id === 'string' && typeof row.email === 'string')
    .map((row) => ({
      id: row.id as string,
      email: (row.email as string).toLowerCase().trim(),
      kind: normalizeKind(row.kind),
      bookingId: typeof row.bookingId === 'string' ? row.bookingId : '',
      title: typeof row.title === 'string' ? row.title : '',
      body: typeof row.body === 'string' ? row.body : '',
      staffName: typeof row.staffName === 'string' ? row.staffName : null,
      staffAvatarUrl: typeof row.staffAvatarUrl === 'string' ? row.staffAvatarUrl : null,
      createdAt: typeof row.createdAt === 'string' ? row.createdAt : new Date(0).toISOString(),
      seenAt: typeof row.seenAt === 'string' ? row.seenAt : null,
    }));
});

export const dbNotifications = {
  async create(input: CreateNotificationInput): Promise<StaffNotification> {
    return notificationStore.update((rows) => {
      const notification: StaffNotification = {
        id: generateId(),
        email: input.email.toLowerCase().trim(),
        kind: input.kind,
        bookingId: input.bookingId,
        title: input.title,
        body: input.body,
        staffName: input.staffName ?? null,
        staffAvatarUrl: input.staffAvatarUrl ?? null,
        createdAt: new Date().toISOString(),
        seenAt: null,
      };
      rows.push(notification);
      return { ...notification };
    });
  },

  async listForEmail(email: string, limit = 50): Promise<StaffNotification[]> {
    const target = email.toLowerCase().trim();
    return (await notificationStore.read())
      .filter((row) => row.email === target)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, Math.max(1, Math.min(100, limit)));
  },

  async listUnseenForEmail(email: string, limit = 100): Promise<StaffNotification[]> {
    const target = email.toLowerCase().trim();
    return (await notificationStore.read())
      .filter((row) => row.email === target && row.seenAt === null)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, Math.max(1, Math.min(100, limit)));
  },

  async markSeenForEmail(email: string): Promise<number> {
    const target = email.toLowerCase().trim();
    // Fast path: marking an already-read inbox must not rewrite the file.
    const unseen = (await notificationStore.read()).some(
      (row) => row.email === target && row.seenAt === null
    );
    if (!unseen) return 0;

    return notificationStore.update((rows) => {
      const seenAt = new Date().toISOString();
      let modified = 0;
      for (const row of rows) {
        if (row.email !== target || row.seenAt !== null) continue;
        row.seenAt = seenAt;
        modified += 1;
      }
      return modified;
    });
  },

  async findById(id: string): Promise<StaffNotification | undefined> {
    return (await notificationStore.read()).find((row) => row.id === id);
  },

  async count(): Promise<number> {
    return (await notificationStore.read()).length;
  },
};

export const NOTIFICATION_COPY: Record<NotificationKind, { title: string; body: (detail: string) => string }> = {
  'booking-confirmed': {
    title: 'Xác nhận đặt lịch thành công!!',
    body: (detail) => detail,
  },
  'booking-cancelled': {
    title: 'Lịch hẹn đã được huỷ',
    body: (detail) => detail,
  },
  'booking-completed': {
    title: 'Lịch hẹn đã hoàn tất',
    body: (detail) => detail,
  },
};

export function bookingNotificationDetail(petName: string, time: string, staffName: string | null): string {
  const parts = [petName, time].filter(Boolean);
  const base = parts.join(' · ');
  return staffName ? `${base} · ${staffName}` : base;
}
