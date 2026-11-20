// lib/dbPresence.ts
// File-backed staff "online" presence (data/presence.json).
//
// WHY A FILE, NOT THE SSE HUB
//   The realtime hub (lib/realtime.ts) knows which sockets are open, but it has
//   no idea WHO is behind them and it dies with the process. Presence written
//   through a heartbeat and stored in a JSON file survives restarts, works with
//   plain page loads, and can be audited — and the assignment decision ("which
//   staff member may be offered this customer") must be consistent with what
//   any future multi-process deployment would see.
//
// ONLINE = a heartbeat within ONLINE_TTL_SECONDS. The staff chrome (every
// /staff page except login) pings POST /api/staff/presence every heartbeat.

import { createAsyncJsonStore } from './jsonStore';
import { roleCan } from './staffPermissions';
import type { StaffPublic } from './staff-service';

const STORE_FILE = 'presence.json';

/** Deemed offline after this many seconds without a heartbeat. */
export const ONLINE_TTL_SECONDS = 90;

/** Interval the client sends at — comfortably inside the TTL. */
export const HEARTBEAT_INTERVAL_MS = 30_000;

interface PresenceRecord {
  staffId: string;
  name: string;
  lastSeenAt: string; // ISO
}

const store = createAsyncJsonStore<PresenceRecord>(STORE_FILE, normalize);

function normalize(rows: unknown): PresenceRecord[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((row): row is Record<string, unknown> => !!row && typeof row === 'object')
    .map((row) => ({
      staffId: String(row.staffId ?? ''),
      name: String(row.name ?? ''),
      lastSeenAt: typeof row.lastSeenAt === 'string' ? row.lastSeenAt : new Date(0).toISOString(),
    }))
    .filter((row) => row.staffId.length > 0);
}

/** Record a heartbeat for one staff member. */
export async function touch(staff: StaffPublic): Promise<void> {
  const now = new Date().toISOString();
  await store.update((rows) => {
    const row = rows.find((r) => r.staffId === staff.id);
    if (row) {
      row.lastSeenAt = now;
      row.name = staff.name;
    } else {
      rows.push({ staffId: staff.id, name: staff.name, lastSeenAt: now });
    }
  });
}

/**
 * All staff members currently online.
 *
 * `allStaff` is the authoritative roster (lib/staff-service listAllStaff) —
 * presence only says WHO was recently active, the roster decides WHO exists and
 * whether their role is even allowed to chat a customer. An intern who pings
 * the heartbeat is never offered a customer because they cannot accept one.
 */
export async function listOnlineStaff(
  allStaff: StaffPublic[],
  ttlSeconds = ONLINE_TTL_SECONDS
): Promise<StaffPublic[]> {
  const cut = Date.now() - ttlSeconds * 1000;
  const rows = await store.read(true);
  const fresh = new Set(rows.filter((r) => new Date(r.lastSeenAt).getTime() >= cut).map((r) => r.staffId));
  return allStaff.filter(
    (staff) => staff.isActive !== false && fresh.has(staff.id) && roleCan(staff.role, 'staff:chat')
  );
}

/** True when the given member has heartbeated inside the TTL window. */
export async function isOnline(staffId: string, ttlSeconds = ONLINE_TTL_SECONDS): Promise<boolean> {
  const rows = await store.read(true);
  const row = rows.find((r) => r.staffId === staffId);
  return Boolean(row && new Date(row.lastSeenAt).getTime() >= Date.now() - ttlSeconds * 1000);
}

/** Drop records older than 30 days so the file cannot grow without bound. */
export async function prune(): Promise<void> {
  const cut = Date.now() - 30 * 24 * 3600 * 1000;
  await store.update((rows) => {
    const keep = rows.filter((r) => new Date(r.lastSeenAt).getTime() >= cut);
    if (keep.length === rows.length) return rows.length;
    rows.length = 0;
    rows.push(...keep);
    return keep.length;
  });
}
