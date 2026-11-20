// lib/portalData.ts
// Builds normalized view-models for /client-portal and /care-schedule.
// Blends the customer's real bookings (dbBooking) with completed diagnosis
// records (dbMedicalRecords); falls back to clearly-labelled demo content so
// both pages are fully usable before login.

import { dbBooking } from '@/lib/dbBooking';
import { dbMedicalRecords, ensureSeedMedicalRecords } from '@/lib/dbMedicalRecords';
import { normalizeDateInput } from '@/lib/dateInput';
import { normalizeBookingStatus } from '@/lib/bookingStatus';
import { buildBookingTimeline, type TimelineStep } from '@/lib/bookingTimeline';

const DEMO_EMAIL = 'demo@belwee.vn';

export type PortalStatus = 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';

export interface PortalItem {
  id: string;
  kind: 'booking' | 'record' | 'demo';
  petName: string;
  petType: string;
  service: string;
  status: PortalStatus;
  whenISO: string | null;
  diagnose?: string | null;
  treatment?: string | null;
  /** Người khám thật sự phụ trách. Với booking đây là người đã bấm xác nhận. */
  staffName?: string | null;
  /** Chi nhánh tiếp nhận. Trước đây bị gán nhầm vào `staffName`. */
  branchName?: string | null;
  files: { id: string; name: string; fileUrl: string; fileType: string; size: number }[];
  receipt?: { id: string; totalAmount: number; createdAt: string; itemCount: number } | null;
  note?: string | null;
  /** Chỉ có với `kind: 'booking'` — bệnh án hoàn thành không có mốc xác nhận. */
  timeline?: TimelineStep[];
}

export interface PortalData {
  demo: boolean;
  ownerEmail: string | null;
  ownerName: string | null;
  summary: { total: number; pending: number; confirmed: number; completed: number };
  items: PortalItem[];
}

/** Deterministic label for display. */
export function formatWhen(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('vi-VN', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function bookingToItem(b: { id: string; petName: string; petType?: string; serviceType: string; time: string; status: string; createdAt: string; confirmedAt?: string | null; confirmedBy?: { name?: string | null } | null; notes?: string; addressName?: string }): PortalItem {
  // KHÔNG ép kiểu `as PortalStatus` nữa. Dữ liệu cũ chứa status "ACCEPTED" mà
  // kiểu không có, nên ép kiểu khiến lịch đó rơi vào cả `pendingItems` lẫn
  // `doneItems` của PortalClient và biến mất khỏi cổng thông tin — trong khi
  // màn hình nhân viên vẫn thấy nó. Chuẩn hoá tập trung ở lib/bookingStatus.ts.
  const status = normalizeBookingStatus(b.status);
  return {
    id: b.id,
    kind: 'booking',
    petName: b.petName,
    petType: b.petType || 'Khác',
    service: b.serviceType,
    status,
    whenISO: normalizeDateInput(b.time) ?? b.createdAt,
    files: [],
    note: b.notes || null,
    // SỬA LỖI: trước đây `staffName` nhận giá trị của `addressName`. Đó là CHI
    // NHÁNH, không phải bác sĩ — và UI hiển thị nó cạnh tên thú cưng như thể là
    // người khám, khiến khách đi tìm nhầm người. Nay tách đúng hai trường.
    staffName: b.confirmedBy?.name ?? null,
    branchName: b.addressName || null,
    timeline: buildBookingTimeline({
      status,
      createdAt: b.createdAt,
      confirmedAt: b.confirmedAt ?? null,
      confirmedBy: b.confirmedBy ?? null,
      time: b.time,
      petName: b.petName,
      serviceType: b.serviceType,
    }),
  };
}

function recordToItem(r: { id: string; petName: string; petType: string; service: string; status: string; diagnose?: string | null; treatment?: string | null; staffName?: string | null; files: { id: string; name: string; fileUrl: string; fileType: string; size: number }[]; receipt?: { id: string; totalAmount: number; createdAt: string; items?: unknown[] } | null; scheduledAt?: string | null; createdAt: string }, kind: 'record' | 'demo'): PortalItem {
  return {
    id: r.id,
    kind,
    petName: r.petName,
    petType: r.petType,
    service: r.service,
    status: r.status as PortalStatus,
    whenISO: r.scheduledAt ?? r.createdAt,
    diagnose: r.diagnose ?? null,
    treatment: r.treatment ?? null,
    staffName: r.staffName ?? null,
    files: r.files,
    receipt: r.receipt
      ? {
          id: r.receipt.id,
          totalAmount: r.receipt.totalAmount,
          createdAt: r.receipt.createdAt,
          itemCount: Array.isArray(r.receipt.items) ? r.receipt.items.length : 0,
        }
      : null,
  };
}

/** Accepts ISO strings or Vietnamese "dd/MM/yyyy HH:mm" / "yyyy-MM-dd HH:mm" text. */
export { normalizeDateInput } from '@/lib/dateInput';

export async function buildPortalData(email: string | null, name: string | null): Promise<PortalData> {
  await ensureSeedMedicalRecords();
  const normalized = email?.toLowerCase().trim() || null;
  const records = await dbMedicalRecords.findByOwnerEmail(normalized ?? DEMO_EMAIL);
  const bookings = normalized ? (await dbBooking.findByEmail(normalized)).bookings : [];

  const items: PortalItem[] = [
    ...bookings.map(b => bookingToItem(b)),
    ...records.map(r => recordToItem(r, normalized ? 'record' : 'demo')),
  ];

  let demo = false;
  if (!normalized || items.length === 0) {
    // Nothing real to show → fall back to the labelled demo set (keeps UI explorable pre-login).
    demo = true;
    const demoRecords = await dbMedicalRecords.findByOwnerEmail(DEMO_EMAIL);
    const demoItems: PortalItem[] = demoRecords.map(r => recordToItem(r, 'demo'));
    if (!normalized) {
      items.length = 0;
      items.push(...demoItems);
    } else {
      // Real customer with no data yet – top up with demo items.
      const seen = new Set(items.map(i => i.id));
      demoItems.forEach(i => { if (!seen.has(i.id)) items.push(i); });
    }
  }

  const summary = {
    total: items.length,
    pending: items.filter(i => i.status === 'PENDING').length,
    confirmed: items.filter(i => i.status === 'CONFIRMED').length,
    completed: items.filter(i => i.status === 'COMPLETED').length,
  };

  return {
    demo,
    ownerEmail: normalized,
    ownerName: name,
    summary,
    items: items.sort((a, b) => ((b.whenISO || '') > (a.whenISO || '') ? 1 : -1)),
  };
}

// ─── Care schedule ──────────────────────────────────────────────────

export interface CareEvent {
  id: string;
  kind: 'booking' | 'record' | 'demo';
  petName: string;
  petType: string;
  service: string;
  status: PortalStatus;
  whenISO: string;
  milestone?: string | null;
  note?: string | null;
}

export interface CareData {
  demo: boolean;
  ownerEmail: string | null;
  tabs: { key: string; label: string; emoji: string; events: CareEvent[] }[];
}

const CATS: { key: string; label: string; emoji: string }[] = [
  { key: 'Cún', label: 'Cún', emoji: '🐶' },
  { key: 'Mèo', label: 'Mèo', emoji: '🐱' },
];

const DEMO_EVENTS: Array<Pick<CareEvent, 'kind' | 'petName' | 'petType' | 'service' | 'status' | 'milestone' | 'note'> & { dayOffset: number; hour: number }> = [
  { kind: 'demo', petName: 'Bông', petType: 'Cún', service: 'Spa & Grooming', status: 'CONFIRMED', milestone: 'Tắm & cắt tỉa lông', dayOffset: 1, hour: 10 },
  { kind: 'demo', petName: 'Milo', petType: 'Cún', service: 'Khám da liễu', status: 'PENDING', milestone: 'Chờ xác nhận lịch', dayOffset: 2, hour: 14 },
  { kind: 'demo', petName: 'Bông', petType: 'Cún', service: 'Tiêm phòng định kỳ', status: 'CONFIRMED', milestone: 'Vaccine 6 bệnh + dại', dayOffset: 8, hour: 9 },
  { kind: 'demo', petName: 'Miu', petType: 'Mèo', service: 'Khám tổng quát', status: 'COMPLETED', milestone: 'Đã hoàn thành', note: 'Khám định kỳ 6 tháng – kết quả tốt.', dayOffset: -6, hour: 15 },
  { kind: 'demo', petName: 'Miu', petType: 'Mèo', service: 'Spa & Grooming', status: 'CONFIRMED', milestone: 'Vệ sinh lông & móng', dayOffset: 3, hour: 16 },
  { kind: 'demo', petName: 'Bông', petType: 'Cún', service: 'Tái khám tổng quát', status: 'COMPLETED', milestone: 'Đã hoàn thành', note: 'Cân nặng chuẩn, không bất thường.', dayOffset: -14, hour: 9 },
];

function demoCareEvents(): CareEvent[] {
  return DEMO_EVENTS.map((e, i) => {
    const when = new Date();
    when.setDate(when.getDate() + e.dayOffset);
    when.setHours(e.hour, 0, 0, 0);
    return {
      id: `demo-${i}`,
      kind: 'demo',
      petName: e.petName,
      petType: e.petType,
      service: e.service,
      status: e.status,
      whenISO: when.toISOString(),
      milestone: e.milestone ?? null,
      note: e.note ?? null,
    };
  });
}

export async function buildCareData(email: string | null): Promise<CareData> {
  await ensureSeedMedicalRecords();
  const normalized = email?.toLowerCase().trim() || null;

  const events: CareEvent[] = [];
  if (normalized) {
    const bookings = (await dbBooking.findByEmail(normalized)).bookings;
    bookings.forEach(b => {
      const iso = normalizeDateInput(b.time);
      if (!iso) return;
      const when = new Date(iso);
      const min = Date.now() - 30 * 24 * 60 * 60 * 1000;
      if (when.getTime() < min) return; // keep the timeline focused on recent/upcoming
      events.push({
        id: b.id,
        kind: 'booking',
        petName: b.petName,
        petType: b.petType || 'Khác',
        service: b.serviceType,
        status: b.status as PortalStatus,
        whenISO: iso,
        milestone: b.status === 'CONFIRMED' ? 'Đã xác nhận' : b.status === 'PENDING' ? 'Chờ xác nhận' : 'Đã hoàn thành',
        note: b.notes || null,
      });
    });
    (await dbMedicalRecords.findByOwnerEmail(normalized)).forEach(r => {
      if (!r.scheduledAt) return;
      events.push({
        id: r.id,
        kind: 'record',
        petName: r.petName,
        petType: r.petType,
        service: r.service,
        status: r.status as PortalStatus,
        whenISO: r.scheduledAt,
        milestone: r.status === 'COMPLETED' ? 'Đã hoàn thành' : r.status === 'CONFIRMED' ? 'Đã xác nhận' : 'Chờ xác nhận',
        note: r.diagnose || null,
      });
    });
  }

  let demo = false;
  if (!normalized || events.length === 0) {
    demo = true;
    events.length = 0;
    events.push(...demoCareEvents());
  }

  const pickPetType = (e: CareEvent) => {
    const t = (e.petType || '').toLowerCase();
    if (t.includes('mèo') || t.includes('meo') || t.includes('cat')) return 'Mèo';
    if (t.includes('cún') || t.includes('cun') || t.includes('chó') || t.includes('dog')) return 'Cún';
    return 'Cún';
  };

  const tabs = CATS.map(cat => ({
    ...cat,
    events: events
      .filter(e => pickPetType(e) === cat.key)
      .sort((a, b) => (a.whenISO > b.whenISO ? 1 : -1)),
  }));

  return { demo, ownerEmail: normalized, tabs };
}
