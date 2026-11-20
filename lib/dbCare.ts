// lib/dbCare.ts
// File-backed customer-care session store (data/customer-care.json).
//
// THE FLOW THIS IMPLEMENTS
//   A customer confirms the terms on /booking/cham-soc-khach-hang and asks for
//   support. The server walks a member list:
//
//   1. pick an ONLINE staff member (lib/dbPresence) and OFFER the request —
//      a liquid-glass card with the customer label appears on their screen;
//   2. that member either TIẾP NHẬN (accepted — they are routed to the care
//      chat with this customer) or LOẠI BỎ (declined — they are recorded in
//      `declined[id]` and the NEXT online member gets offered);
//   3. when nobody online is left un-asked the session turns BUSY and the
//      customer sees "Các bác sĩ đều bận, bạn liên hệ sau nhé! Belwee cảm ơn."
//
// WHY SESSION IDS ARE SERVER-MINTED RANDOM STRINGS
//   The status poll endpoint is public (the customer page has no login), so the
//   session id doubles as its access token. `SESS_<counter>` would let anyone
//   walk ids and read transcripts; 20 random hex chars make guessing pointless.

import crypto from 'crypto';
import { createAsyncJsonStore } from './jsonStore';
import type { StaffPublic } from './staff-service';

const STORE_FILE = 'customer-care.json';

/** A waiting customer stops being offered after this long without an accept. */
export const WAITING_TTL_MS = 10 * 60 * 1000;

/** Accepted transcripts older than this stop being readable. */
export const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export type CareStatus = 'waiting' | 'accepted' | 'busy' | 'closed';

export interface CareOfferedStaff {
  id: string;
  name: string;
  avatarUrl: string | null;
  jobTitle: string | null;
}

export interface CareSession {
  sessionId: string;
  /** Shown to staff on the request card. Never a real name. */
  customerName: string;
  status: CareStatus;
  /** The member currently being asked to accept (status = waiting). */
  offered: CareOfferedStaff | null;
  /** The member who pressed TIẾP NHẬN (status = accepted). */
  accepted: CareOfferedStaff | null;
  acceptedAt: string | null;
  /** staff ids that pressed LOẠI BỎ or timed out while being asked. */
  declined: string[];
  createdAt: string;
  updatedAt: string;
}

const store = createAsyncJsonStore<CareSession>(STORE_FILE, normalize);

function normalize(rows: unknown): CareSession[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((row): row is Record<string, unknown> => !!row && typeof row === 'object')
    .map((row) => {
      const declinedRaw = Array.isArray(row.declined) ? row.declined : [];
      return {
        sessionId: String(row.sessionId ?? ''),
        customerName: String(row.customerName ?? 'Khách hàng'),
        status: (row.status === 'accepted' || row.status === 'busy' || row.status === 'closed'
          ? row.status
          : row.status === 'waiting'
            ? 'waiting'
            : 'closed') as CareStatus,
        offered: isOffered(row.offered),
        accepted: isOffered(row.accepted),
        acceptedAt: typeof row.acceptedAt === 'string' ? row.acceptedAt : null,
        declined: declinedRaw.filter((id): id is string => typeof id === 'string'),
        createdAt: typeof row.createdAt === 'string' ? row.createdAt : new Date(0).toISOString(),
        updatedAt:
          typeof row.updatedAt === 'string'
            ? row.updatedAt
            : typeof row.createdAt === 'string'
              ? row.createdAt
              : new Date(0).toISOString(),
      };
    })
    .filter((row) => row.sessionId.length > 0);
}

function isOffered(value: unknown): CareOfferedStaff | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  if (typeof record.id !== 'string' || record.id.length === 0) return null;
  return {
    id: record.id,
    name: String(record.name ?? ''),
    avatarUrl: typeof record.avatarUrl === 'string' ? record.avatarUrl : null,
    jobTitle: typeof record.jobTitle === 'string' ? record.jobTitle : null,
  };
}

function nowIso(): string {
  return new Date().toISOString();
}

function generateSessionId(): string {
  const bytes = new Uint8Array(10);
  crypto.randomFillSync(bytes);
  return `SESS_${Buffer.from(bytes).toString('hex').toUpperCase()}`;
}

/** Public projection shared with the customers' poll endpoint. */
export interface CarePublicView {
  sessionId: string;
  customerName: string;
  status: CareStatus;
  staff: CareOfferedStaff | null;
  hasMessages: boolean;
}

export const dbCare = {
  /**
   * Create (idempotent) a care session for one customer and return it with the
   * first offer attached when someone is online.
   */
  async create(
    onlineStaff: StaffPublic[],
    label?: string
  ): Promise<CareSession> {
    const session = await store.update((rows) => {
      const created: CareSession = {
        sessionId: generateSessionId(),
        customerName: label && label.trim() ? label.trim().slice(0, 60) : 'Khách hàng',
        status: 'waiting',
        offered: null,
        accepted: null,
        acceptedAt: null,
        declined: [],
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      rows.push(created);
      return created;
    });
    // Offers mutate the stored row, so the first pick runs AFTER the insert.
    return (await dbCare.assignNext(session.sessionId, onlineStaff, [])) ?? session;
  },

  async find(sessionId: string): Promise<CareSession | undefined> {
    const rows = await store.read();
    return rows.find((row) => row.sessionId === sessionId);
  },

  /**
   * Offer the session to the next online member who has not already been asked.
   * Publishes the return value rather than the caller — this is the ONE place
   * where "who is being asked now" becomes an SSE fact.
   *
   * Returns the updated session (with any status it ended in) or undefined when
   * the session cannot be found any more.
   */
  async assignNext(
    sessionId: string,
    onlineStaff: StaffPublic[],
    alreadyTried: string[]
  ): Promise<CareSession | undefined> {
    const updated = await store.update((rows) => {
      const row = rows.find((candidate) => candidate.sessionId === sessionId);
      if (!row) return undefined; // never mutate without the row
      if (row.status === 'waiting') {
        /**
         * Hết hạn chờ phải CHOT CỔ ĐỊNH là 'busy', không được bỏ qua im lặng:
         * một decline rơi vào sau khi tam giác chờ 10 phút trôi qua từng để
         * phiên đứng ở 'waiting' mà không có `offered` nào — card biến mất nhưng
         * không có event care:busy nào được phát, phía khách và phía staff đều
         * nhìn thấy một máy treo mồ côi vài phút trước poll TTL tự đề xuất busy.
         */
        const expired = Date.now() - new Date(row.createdAt).getTime() > WAITING_TTL_MS;
        if (expired) {
          row.status = 'busy';
          row.offered = null;
          row.updatedAt = nowIso();
          return row;
        }
      }
      if (row.status !== 'waiting') return row;

      const tried = new Set([...row.declined, ...alreadyTried]);
      const next = onlineStaff.find((staff) => !tried.has(staff.id));
      if (!next) {
        row.status = 'busy';
        row.offered = null;
      } else {
        row.offered = {
          id: next.id,
          name: next.name,
          avatarUrl: next.avatarUrl ?? null,
          jobTitle: next.jobTitle ?? null,
        };
      }
      row.updatedAt = nowIso();
      return row;
    });
    return updated;
  },

  /** Record a LOẠI BỎ and offer to the next member (or flip to busy). */
  async decline(
    sessionId: string,
    staffId: string,
    onlineStaff: StaffPublic[]
  ): Promise<CareSession | undefined> {
    await store.update((rows) => {
      const row = rows.find((candidate) => candidate.sessionId === sessionId);
      if (!row || row.status !== 'waiting' || row.offered?.id !== staffId) return row;
      if (!row.declined.includes(staffId)) row.declined.push(staffId);
      row.offered = null;
      row.updatedAt = nowIso();
      return row;
    });
    return dbCare.assignNext(sessionId, onlineStaff, []);
  },

  /** Record a TIẾP NHẬN. Only the member being asked may accept. */
  async accept(sessionId: string, staff: StaffPublic): Promise<CareSession | undefined> {
    return store.update((rows) => {
      const row = rows.find((candidate) => candidate.sessionId === sessionId);
      if (!row || row.status !== 'waiting' || row.offered?.id !== staff.id) return row;
      /**
       * Hết hạn chờ ⇒ busy (giống assignNext): gọi sau deadline nhận về một
       * phiên 'busy' rõ ràng thay vì trạng thái 'waiting' đã hoăng mồ côi, để
       * responder publish care:busy và card phía staff được dọn.
       */
      if (Date.now() - new Date(row.createdAt).getTime() > WAITING_TTL_MS) {
        row.status = 'busy';
        row.offered = null;
        row.updatedAt = nowIso();
        return row;
      }

      row.status = 'accepted';
      row.accepted = {
        id: staff.id,
        name: staff.name,
        avatarUrl: staff.avatarUrl ?? null,
        jobTitle: staff.jobTitle ?? null,
      };
      row.acceptedAt = nowIso();
      row.offered = null;
      row.updatedAt = row.acceptedAt;
      return row;
    });
  },

  /** Public read for the customer's status poll + expiry bookkeeping. */
  async publicView(
    sessionId: string,
    hasMessages: (sessionId: string) => Promise<boolean>
  ): Promise<CarePublicView | undefined> {
    const row = await dbCare.find(sessionId);
    if (!row) return undefined;
    if (row.status === 'waiting' && Date.now() - new Date(row.createdAt).getTime() > WAITING_TTL_MS) {
      const expired = await store.update((rows) => {
        const target = rows.find((candidate) => candidate.sessionId === sessionId);
        if (!target || target.status !== 'waiting') return target;
        target.status = 'busy';
        target.offered = null;
        target.updatedAt = nowIso();
        return target;
      });
      if (expired && expired.status === 'busy') {
        return { sessionId: row.sessionId, customerName: row.customerName, status: 'busy', staff: null, hasMessages: false };
      }
    }
    const fresh = row.status === 'waiting' ? (await dbCare.find(sessionId)) ?? row : row;
    return {
      sessionId: fresh.sessionId,
      customerName: fresh.customerName,
      status: fresh.status,
      staff: fresh.status === 'accepted' ? fresh.accepted : fresh.offered,
      hasMessages: await hasMessages(sessionId),
    };
  },

  /** Which sessions currently involve one member (their card + accepted list). */
  async forStaff(staffId: string): Promise<{ offered: CareSession[]; accepted: CareSession[] }> {
    const rows = (await store.read()).filter(
      (row) =>
        (row.offered?.id === staffId && row.status === 'waiting') ||
        (row.accepted?.id === staffId && row.status === 'accepted')
    );
    return {
      offered: rows.filter((row) => row.offered?.id === staffId && row.status === 'waiting'),
      accepted: rows.filter((row) => row.accepted?.id === staffId && row.status === 'accepted'),
    };
  },
};
