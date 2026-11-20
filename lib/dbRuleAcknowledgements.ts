// lib/dbRuleAcknowledgements.ts
// File-backed staff rule acknowledgements (data/rule-acknowledgements.json).
//
// One row per (staffId, version). Creating an acknowledgement that already
// exists must return the existing row rather than fail — two tabs clicking
// "Tôi đã đọc" at once is normal, not an error.

import { createAsyncJsonStore } from './jsonStore';

export interface RuleAcknowledgement {
  id: string;
  staffId: string;
  staffName: string;
  version: number;
  acknowledgedAt: string;
}

function generateId(): string {
  return `ACK_${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
}

const acknowledgementStore = createAsyncJsonStore<RuleAcknowledgement>('rule-acknowledgements.json', (raw) => {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((row): row is Record<string, unknown> => !!row && typeof row === 'object')
    .filter((row) => typeof row.id === 'string' && typeof row.staffId === 'string')
    .map((row) => ({
      id: row.id as string,
      staffId: row.staffId as string,
      staffName: typeof row.staffName === 'string' ? row.staffName : '',
      version: Number.isInteger(row.version) ? Number(row.version) : 0,
      acknowledgedAt: typeof row.acknowledgedAt === 'string' ? row.acknowledgedAt : new Date(0).toISOString(),
    }));
});

export const dbRuleAcknowledgements = {
  async listForStaff(staffId: string): Promise<RuleAcknowledgement[]> {
    return (await acknowledgementStore.read())
      .filter((row) => row.staffId === staffId)
      .sort((a, b) => b.version - a.version);
  },

  async find(staffId: string, version: number): Promise<RuleAcknowledgement | undefined> {
    return (await acknowledgementStore.read()).find(
      (row) => row.staffId === staffId && row.version === version
    );
  },

  async create(data: Omit<RuleAcknowledgement, 'id'>): Promise<RuleAcknowledgement> {
    return acknowledgementStore.update((rows) => {
      const existing = rows.find(
        (row) => row.staffId === data.staffId && row.version === data.version
      );
      if (existing) return { ...existing };

      const row: RuleAcknowledgement = { id: generateId(), ...data };
      rows.push(row);
      return { ...row };
    });
  },

  async listForVersion(version: number): Promise<RuleAcknowledgement[]> {
    return (await acknowledgementStore.read()).filter((row) => row.version === version);
  },

  async count(): Promise<number> {
    return (await acknowledgementStore.read()).length;
  },
};
