// lib/dbNotificationPreference.ts
// File-backed booking notification opt-in (data/notification-preferences.json).
//
// One row per email. The route that writes it is a plain toggle, so a single
// atomic read-modify-write is all the concurrency control it needs — the old
// mongoose upsert was doing the same job with a network round trip.

import { createAsyncJsonStore } from './jsonStore';

export interface NotificationPreference {
  email: string;
  enabled: boolean;
  updatedAt: string;
  browserPermission: 'granted' | 'denied' | 'default' | 'unsupported';
}

function currentBrowserPermission(): NotificationPreference['browserPermission'] {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission;
}

const preferenceStore = createAsyncJsonStore<NotificationPreference>('notification-preferences.json', (raw) => {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((row): row is Record<string, unknown> => !!row && typeof row === 'object')
    .filter((row) => typeof row.email === 'string')
    .map((row) => ({
      email: (row.email as string).toLowerCase().trim(),
      enabled: row.enabled === true,
      updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt : new Date(0).toISOString(),
      browserPermission:
        row.browserPermission === 'granted' ||
        row.browserPermission === 'denied' ||
        row.browserPermission === 'default'
          ? row.browserPermission
          : 'unsupported',
    }));
});

export const dbNotificationPreference = {
  async read(email: string): Promise<{ enabled: boolean; updatedAt: string | null }> {
    const normalized = email.toLowerCase().trim();
    const row = (await preferenceStore.read()).find((candidate) => candidate.email === normalized);
    return { enabled: row?.enabled === true, updatedAt: row?.updatedAt ?? null };
  },

  async write(email: string, enabled: boolean): Promise<NotificationPreference> {
    const normalized = email.toLowerCase().trim();
    return preferenceStore.update((rows) => {
      const updatedAt = new Date().toISOString();
      const permission = currentBrowserPermission();
      const existing = rows.find((row) => row.email === normalized);
      if (existing) {
        existing.enabled = enabled;
        existing.updatedAt = updatedAt;
        existing.browserPermission = permission;
        return { ...existing };
      }
      const created: NotificationPreference = {
        email: normalized,
        enabled,
        updatedAt,
        browserPermission: permission,
      };
      rows.push(created);
      return { ...created };
    });
  },
};
