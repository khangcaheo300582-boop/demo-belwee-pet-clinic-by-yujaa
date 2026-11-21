// lib/careRegistrations.ts
// Registration of customers for ongoing care reminders (from app/actions/care-reminder.ts).
//
// Invariant 6: every channel must have an unsubscribe path. Care reminder has
// consent (from form checkbox — undetermined yet, see care-reminder.ts) and
// unsubscribeToken (one-click GET /api/notifications/unsubscribe?token=...).

import { createAsyncJsonStore } from './jsonStore';
import crypto from 'crypto';

export const CARE_REPEAT_EVERY_MS = 14 * 24 * 60 * 60 * 1000; // 2 tuần/lần

export interface CareRegistration {
  id: string;
  name: string;
  email: string;
  pet: string;
  consent: boolean;
  registeredAt: string;
  nextDueAt: string;
  repeatEveryMs: number;
  alreadyNotified: boolean;
  unsubscribeToken: string;
}

const store = createAsyncJsonStore<CareRegistration>('reminder-sources-extra.json', (raw) => {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((row): row is Record<string, unknown> => !!row && typeof row === 'object')
    .filter((row) => typeof row.email === 'string')
    .map((row) => ({
      id: String(row.id ?? generateId()),
      name: typeof row.name === 'string' ? row.name : '',
      email: (row.email as string).toLowerCase().trim(),
      pet: typeof row.pet === 'string' ? row.pet : '',
      consent: row.consent === true,
      registeredAt: typeof row.registeredAt === 'string' ? row.registeredAt : new Date().toISOString(),
      nextDueAt: typeof row.nextDueAt === 'string' ? row.nextDueAt : new Date().toISOString(),
      repeatEveryMs: Number.isFinite(row.repeatEveryMs) ? (row.repeatEveryMs as number) : CARE_REPEAT_EVERY_MS,
      alreadyNotified: row.alreadyNotified === true,
      unsubscribeToken: typeof row.unsubscribeToken === 'string' && row.unsubscribeToken ? (row.unsubscribeToken as string) : generateUnsubscribeToken(),
    }));
});

function generateId(): string {
  return `CR_${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
}

function generateUnsubscribeToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export const dbCareRegistrations = {
  async add(input: Omit<CareRegistration, 'id' | 'registeredAt' | 'unsubscribeToken'>): Promise<CareRegistration> {
    return store.update((rows) => {
      const row: CareRegistration = {
        ...input,
        id: generateId(),
        email: input.email.toLowerCase().trim(),
        registeredAt: new Date().toISOString(),
        unsubscribeToken: generateUnsubscribeToken(),
        alreadyNotified: false,
      };
      rows.push(row);
      return { ...row };
    });
  },

  async markNotified(id: string): Promise<void> {
    await store.update((rows) => {
      const row = rows.find((candidate) => candidate.id === id);
      if (!row) return;
      row.alreadyNotified = true;
      row.nextDueAt = new Date(Date.now() + row.repeatEveryMs).toISOString();
    });
  },

  async findById(id: string): Promise<CareRegistration | undefined> {
    return (await store.read()).find((row) => row.id === id);
  },

  /** Dòng có consent bật, đang chờ (hoặc chờ lần nhận đầu) và do đến hạn nhắc. */
  async listDue(now: string = new Date().toISOString()): Promise<CareRegistration[]> {
    return (await store.read()).filter((row) => row.consent && !row.alreadyNotified && row.nextDueAt <= now);
  },

  /** Toàn bộ dòng có consent bật. */
  async listEnabled(): Promise<CareRegistration[]> {
    return (await store.read()).filter((row) => row.consent);
  },

  /** Xoá theo token (one-click unsubscribe). */
  async removeByToken(token: string): Promise<boolean> {
    return store.update((rows) => {
      const idx = rows.findIndex((row) => row.unsubscribeToken === token);
      if (idx === -1) return false;
      rows.splice(idx, 1);
      return true;
    });
  },
};
