// lib/staffAppointments.ts
// Staff-facing view model over the REAL booking store (data/bookings.json).
// The admin dashboard no longer renders seeded demo records – it renders every
// customer booking, enriched with the linked medical record (diagnosis, files,
// receipt) that staff build up while working the queue.

import type { Booking, ConfirmedBy } from './dbBooking';
import { dbMedicalRecords, DuplicateMedicalRecordError, type MedicalRecord } from './dbMedicalRecords';
import type { StaffPublic } from './staff-service';
// Ngày đọc từ lib/dateInput chứ không phải từ portalData: portalData giờ cần
// ngược lại normalizeBookingStatus từ đây, nên import qua portalData sẽ tạo vòng.
import { normalizeDateInput } from './dateInput';
import { normalizeBookingStatus } from './bookingStatus';

/**
 * Tên trạng thái lịch hẹn — alias của kiểu chuẩn ở lib/bookingStatus.ts.
 *
 * Giữ tên riêng vì hàng chục chỗ trong phía nhân viên dùng nó, và "Appointment"
 * đọc đúng ngữ cảnh hơn "Booking" ở tầng hàng đợi lịch.
 */
export type AppointmentStatus = import('./bookingStatus').BookingStatus;

/**
 * Re-export, không phải bản sao.
 *
 * Bản cũ ở đây chỉ lạp ẩn ACCEPTED và fallback về CONFIRMED cho MỌI giá trị
 * lạ — nghĩa là dữ liệu bẩn bị đọc thành "đã xác nhận". Bản dùng chung nhận diện
 * đủ mọi từ vựng lịch sử (kể cả nhãn tiếng Việt) và chỉ fallback về PENDING khi
 * thực sự không biết. Xem lib/bookingStatus.ts.
 */
export { normalizeBookingStatus } from './bookingStatus';

/**
 * Single source of truth for the appointment state machine.
 *
 * Both mutation entry points MUST go through `canTransition`:
 *   • PATCH /api/staff/appointments/[id]
 *   • POST  /api/staff/receipts  (issuing a receipt completes the booking)
 *
 * Previously each route carried its own copy of the ALLOWED map, and the
 * receipts route had none at all — so a CANCELLED booking that still had a
 * medical record could be flipped straight back to COMPLETED, bypassing the
 * terminal-state rule. COMPLETED and CANCELLED are terminal.
 */
export const APPOINTMENT_TRANSITIONS: Record<AppointmentStatus, readonly AppointmentStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

/** Re-entering the same status is always allowed (treated as a no-op). */
export function canTransition(from: AppointmentStatus, to: AppointmentStatus): boolean {
  if (from === to) return true;
  return APPOINTMENT_TRANSITIONS[from].includes(to);
}

/** A Vietnamese label for a status, used in API error messages. */
export const STATUS_LABELS: Record<AppointmentStatus, string> = {
  PENDING: 'chờ xác nhận',
  CONFIRMED: 'đã xác nhận',
  COMPLETED: 'hoàn thành',
  CANCELLED: 'đã huỷ',
};

export interface StaffAppointment {
  id: string;
  petName: string;
  petType: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  service: string;
  time: string;
  notes: string | null;
  addressName: string | null;
  status: AppointmentStatus;
  /** Tổng hoá đơn khi đã xuất hoá đơn, ngược lại null. */
  price: number | null;
  createdAt: string;
  confirmedAt: string | null;
  /** Nhân viên đã xác nhận (tên + avatar) — null khi chưa ai xác nhận. */
  confirmedBy: ConfirmedBy | null;
  /** ISO chuẩn hoá của `time` (dùng để sắp xếp). */
  scheduledAt: string;
  /** Bệnh án liên kết – chứa chẩn đoán, file, hoá đơn (null khi chưa xác nhận). */
  record: MedicalRecord | null;
}

/**
 * Map a raw booking (with its linked medical record, if any) to the
 * shape consumed by the staff dashboard.
 */
export function toStaffAppointment(booking: Booking, record: MedicalRecord | null): StaffAppointment {
  return {
    id: booking.id,
    petName: booking.petName,
    petType: booking.petType || 'Khác',
    ownerName: booking.customerName,
    ownerEmail: booking.customerEmail,
    ownerPhone: booking.customerPhone,
    service: booking.serviceType,
    time: booking.time,
    notes: booking.notes || null,
    addressName: booking.addressName || null,
    status: normalizeBookingStatus(booking.status),
    price: record?.receipt?.totalAmount ?? null,
    createdAt: booking.createdAt,
    confirmedAt: booking.confirmedAt,
    confirmedBy: booking.confirmedBy ?? null,
    scheduledAt: normalizeDateInput(booking.time) ?? booking.createdAt,
    record,
  };
}

/**
 * The ConfirmedBy triple for a booking row.
 *
 * `staff` is optional so the email confirmation link (`/api/xac-nhan`, which has
 * no signed-in staff identity) can still record a timestamp without inventing
 * a person — it passes null and the booking simply has no `confirmedBy`.
 */
export function toConfirmedBy(
  staff: { id: string; name: string; avatarUrl: string | null } | null | undefined
): ConfirmedBy | null {
  if (!staff) return null;
  return { staffId: staff.id, name: staff.name, avatarUrl: staff.avatarUrl ?? null };
}

/**
 * Ensure a booking that is being worked on (CONFIRMED / COMPLETED) has a
 * linked medical record to hold diagnosis, files and the receipt.
 * Idempotent – returns the existing record when one is already linked.
 * Returns null for bookings that aren't actionable (PENDING / CANCELLED).
 */
export async function ensureLinkedRecord(booking: Booking, staff?: StaffPublic): Promise<MedicalRecord | null> {
  const status = normalizeBookingStatus(booking.status);
  if (status !== 'CONFIRMED' && status !== 'COMPLETED') return null;

  const existing = await dbMedicalRecords.findByBookingId(booking.id);
  if (existing) return existing;

  try {
    return await dbMedicalRecords.create({
      bookingId: booking.id,
      petName: booking.petName,
      petType: booking.petType || 'Khác',
      ownerEmail: booking.customerEmail,
      ownerName: booking.customerName,
      service: booking.serviceType,
      status: status === 'COMPLETED' ? 'COMPLETED' : 'CONFIRMED',
      staffId: staff?.id ?? null,
      staffName: staff?.name ?? null,
      scheduledAt: normalizeDateInput(booking.time) ?? booking.createdAt,
    });
  } catch (error) {
    if (!(error instanceof DuplicateMedicalRecordError)) throw error;
    return (await dbMedicalRecords.findByBookingId(booking.id)) ?? null;
  }
}