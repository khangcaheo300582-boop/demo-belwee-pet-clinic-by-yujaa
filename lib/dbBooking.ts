// lib/dbBooking.ts
// File-backed booking persistence (data/bookings.json).
//
// WHY FILE-BACKED: this module used to talk to MongoDB, so every booking read
// waited on an external Atlas cluster. When the cluster was paused or the host
// IP was not whitelisted, mongoose sat for 10 seconds and then threw — the
// booking form answered 500 for a problem the customer cannot act on. The same
// data already exists in data/bookings.json, and lib/jsonStore gives that file
// atomic writes plus in-process serialisation, which is what the state machine
// below actually needs.

import crypto from 'crypto';
import { createAsyncJsonStore } from './jsonStore';
import { normalizeBookingStatus, type BookingStatus } from './bookingStatus';

// ─── Kiểu dữ liệu ───────────────────────────────────────────────
// Kiểu BookingStatus khai báo ở lib/bookingStatus.ts cùng bảng alias của mọi
// từ vựng lịch sử. Ở đây chỉ re-export để các import cũ vẫn chạy — tránh
// phải sửa hàng chục dòng import chỉ vì dời một khai báo kiểu.
export type { BookingStatus } from './bookingStatus';

/** Người nhân viên đã xác nhận lịch hẹn. */
export interface ConfirmedBy {
  staffId: string;
  name: string;
  avatarUrl: string | null;
}

export interface Booking {
  id: string;
  customerEmail: string;
  customerName: string;
  customerPhone: string;
  petName: string;
  petType?: string;
  serviceType: string;
  time: string;
  notes?: string;
  addressName?: string;
  status: BookingStatus;
  confirmToken: string | null;   // Token dùng 1 lần để xác nhận qua email
  confirmedAt: string | null;    // ISO datetime khi admin xác nhận
  /**
   * Nhân viên đã xác nhận — id + tên + avatar.
   *
   * Added because "Đã xác nhận" without a name is useless to the customer: they
   * need to know WHO is coming, and the dashboard needs to know which queue the
   * appointment was picked up from. Kept as one triple rather than three
   * parallel optional fields so the shape is always coherent — a record either
   * carries a complete `confirmedBy` or none at all.
   */
  confirmedBy?: ConfirmedBy | null;
  createdAt: string;             // ISO datetime khi tạo
  tokenExpiresAt?: string | null; // ISO datetime – token TTL
  /**
   * Idempotency key do client sinh (clientRequestId). Chống tạo trùng booking
   * khi người dùng bấm nút nhiều lần / mạng retry request. Dùng 1 lần rồi
   * KHÔNG xoá — mãi mãi chặn re-submit cùng key.
   */
  clientRequestId?: string;
}

// ─── Config ──────────────────────────────────────────────────────
const CONFIRM_TOKEN_TTL_MS = 72 * 60 * 60 * 1000; // 72 hours

/**
 * Khoảng thời gian coi 2 booking là "cùng khung giờ" — 2 người đặt cùng chi
 * nhánh, cùng ngày giờ (±5 phút do format thời gian giữa các form không đồng
 * nhất: "2026-01-15 09:00" vs "2026-01-15T09:00").
 */
const SLOT_TOLERANCE_MS = 5 * 60 * 1000;

// ─── Store ───────────────────────────────────────────────────────
/**
 * Rows are normalised on read, not trusted blindly: data/bookings.json is
 * hand-editable and carries legacy vocabulary (`ACCEPTED`, Vietnamese labels).
 * Normalising here means every caller sees the same four states.
 */
const bookingStore = createAsyncJsonStore<Booking>('bookings.json', (raw) => {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((row): row is Record<string, unknown> => !!row && typeof row === 'object')
    .filter((row) => typeof row.id === 'string' && typeof row.customerEmail === 'string')
    .map((row) => {
      const booking = { ...row } as unknown as Booking;
      // Internal Mongo-era fields never belong in the file-backed shape.
      delete (booking as unknown as Record<string, unknown>)._id;
      delete (booking as unknown as Record<string, unknown>).__v;
      delete (booking as unknown as Record<string, unknown>).activeSlotKey;
      booking.status = normalizeBookingStatus(booking.status as unknown as string);
      booking.confirmToken = typeof booking.confirmToken === 'string' ? booking.confirmToken : null;
      booking.confirmedAt = typeof booking.confirmedAt === 'string' ? booking.confirmedAt : null;
      booking.tokenExpiresAt = typeof booking.tokenExpiresAt === 'string' ? booking.tokenExpiresAt : null;
      return booking;
    });
});

// ─── Tạo Secure Token (64 hex chars, duy nhất cho mỗi booking) ──
export function generateConfirmToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// ─── Tạo mã booking ID ──────────────────────────────────────────
export function generateBookingId(): string {
  return `BW_${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
}

// ─── Helper: chuẩn hoá chuỗi thời gian tự do → Date ─────────────
// Các form gửi "2026-01-15 09:00", "2026-01-15T09:00", "15/01/2026 09:00"...
// Cố gắng parse hết; trả về null nếu không hiểu được.
function parseLooseDateTime(input: string): Date | null {
  if (!input) return null;
  const normalized = input.trim().replace(/^"|"$/g, '');
  // Thử ISO / datetime-local trước
  let d = new Date(normalized.replace(' ', 'T'));
  if (!Number.isNaN(d.getTime())) return d;
  // Thử dd/mm/yyyy hh:mm ( VN format )
  const m = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})[ T]?(\d{1,2}):(\d{2})?$/);
  if (m) {
    d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), Number(m[4]), Number(m[5] || '0'));
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

/**
 * So sánh 2 chuỗi thời gian tự do có cùng khung giờ không (±SLOT_TOLERANCE_MS).
 * Nếu không parse được cả hai → so sánh chuỗi thường.
 */
function isSameSlot(a: string, b: string): boolean {
  const da = parseLooseDateTime(a);
  const db = parseLooseDateTime(b);
  if (da && db) {
    return Math.abs(da.getTime() - db.getTime()) <= SLOT_TOLERANCE_MS;
  }
  return a.trim() === b.trim();
}

function isActive(status: BookingStatus): boolean {
  return status === 'PENDING' || status === 'CONFIRMED';
}

// ─── CRUD Operations ────────────────────────────────────────────
export const dbBooking = {
  /**
   * Tạo booking mới với chống trùng lặp — chạy trong 1 khối update() đồng bộ
   * nên 2 request chạm đến cùng lúc sẽ tuần tự hoá, không thể "lọt" qua nhau.
   *
   * TRẢ VỀ:
   * - { created: true, booking }                 → thành công
   * - { created: false, reason: 'duplicate', booking } → idempotent replay:
   *   cùng clientRequestId đã tồn tại → trả lại booking gốc (không tạo mới,
   *   KHÔNG gửi email lần 2).
   * - { created: false, reason: 'slot-taken', booking } → người khác (hoặc
   *   chính khách này ở lần đặt trước) đã giữ khung giờ cùng chi nhánh.
   *
   * createOptions (tùy chọn):
   * - clientRequestId: idempotency key từ form.
   * - duplicateSlotCheck: true để bật kiểm tra trùng khung giờ.
   */
  async create(
    data: Omit<Booking, 'id' | 'status' | 'confirmToken' | 'confirmedAt' | 'createdAt' | 'tokenExpiresAt'>,
    options?: {
      clientRequestId?: string;
      duplicateSlotCheck?: boolean;
    }
  ): Promise<{ created: boolean; reason?: 'duplicate' | 'slot-taken'; booking: Booking }> {
    const now = new Date();
    const record: Booking = {
      ...data,
      id: generateBookingId(),
      status: 'PENDING',
      confirmToken: generateConfirmToken(),
      confirmedAt: null,
      createdAt: now.toISOString(),
      tokenExpiresAt: new Date(now.getTime() + CONFIRM_TOKEN_TTL_MS).toISOString(),
      ...(options?.clientRequestId ? { clientRequestId: options.clientRequestId } : {}),
    };

    return bookingStore.update((rows) => {
      if (options?.clientRequestId) {
        const existing = rows.find((row) => row.clientRequestId === options.clientRequestId);
        if (existing) return { created: false, reason: 'duplicate' as const, booking: { ...existing } };
      }

      if (options?.duplicateSlotCheck && data.time && data.addressName) {
        const clash = rows.find(
          (row) =>
            row.addressName === data.addressName &&
            isActive(row.status) &&
            row.time &&
            isSameSlot(row.time, data.time)
        );
        if (clash) return { created: false, reason: 'slot-taken' as const, booking: { ...clash } };
      }

      rows.push(record);
      return { created: true, booking: { ...record } };
    });
  },

  /** Tìm theo email khách hàng – with pagination */
  async findByEmail(email: string, options?: { page?: number; limit?: number }): Promise<{ bookings: Booking[]; total: number }> {
    const target = email.toLowerCase().trim();
    const rows = (await bookingStore.read())
      .filter((row) => row.customerEmail.toLowerCase().trim() === target)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const total = rows.length;
    if (!options?.page && !options?.limit) return { bookings: rows, total };

    const page = Math.max(1, options.page || 1);
    const limit = Math.max(1, Math.min(50, options.limit || 10));
    return { bookings: rows.slice((page - 1) * limit, page * limit), total };
  },

  /** Tìm theo ID */
  async findById(id: string): Promise<Booking | undefined> {
    const rows = await bookingStore.read();
    return rows.find((row) => row.id === id);
  },

  /** Tìm theo confirm token (dùng khi admin bấm xác nhận từ email) */
  async findByToken(token: string): Promise<Booking | undefined> {
    const rows = await bookingStore.read();
    return rows.find((row) => row.confirmToken === token);
  },

  /** Xác nhận booking qua token – IDEMPOTENT: safe to call multiple times */
  async confirmByToken(token: string): Promise<{ success: boolean; booking?: Booking; error?: string }> {
    return bookingStore.update((rows) => {
      const current = rows.find((row) => row.confirmToken === token);
      if (!current) return { success: false, error: 'Token không tồn tại hoặc đã được sử dụng.' };
      if (current.status === 'CANCELLED') return { success: false, error: 'Lịch hẹn này đã bị huỷ.' };

      if (current.tokenExpiresAt && Date.now() > new Date(current.tokenExpiresAt).getTime()) {
        current.confirmToken = null;
        current.tokenExpiresAt = null;
        return {
          success: false,
          error: 'Link xác nhận đã hết hạn (quá 72 giờ). Vui lòng liên hệ phòng khám trực tiếp.',
        };
      }

      if (current.status === 'COMPLETED') {
        return { success: false, error: 'Token không tồn tại hoặc đã được sử dụng.' };
      }

      current.status = 'CONFIRMED';
      current.confirmedAt = new Date().toISOString();
      current.confirmToken = null;
      current.tokenExpiresAt = null;
      return { success: true, booking: { ...current } };
    });
  },

  /**
   * Cập nhật trạng thái (ghi confirmedAt + người xác nhận khi CONFIRMED,
   * vô hiệu hoá token khi huỷ).
   *
   * `confirmedBy` is only accepted on the PENDING→CONFIRMED edge. Re-confirming
   * an already-confirmed booking must NOT overwrite the original staff member:
   * two receptionists tapping Confirm in turn would otherwise silently rewrite
   * who the customer was told to expect.
   */
  async updateStatus(id: string, status: BookingStatus, confirmedBy?: ConfirmedBy | null): Promise<boolean> {
    return bookingStore.update((rows) => {
      const row = rows.find((candidate) => candidate.id === id);
      if (!row) return false;

      if (status === 'CONFIRMED') {
        if (row.status === 'PENDING') {
          row.status = 'CONFIRMED';
          row.confirmedAt = new Date().toISOString();
          if (confirmedBy) row.confirmedBy = confirmedBy;
          return true;
        }
        return row.status === 'CONFIRMED';
      }

      const allowedCurrentStatuses: BookingStatus[] =
        status === 'COMPLETED' ? ['CONFIRMED'] : ['PENDING', 'CONFIRMED'];
      if (!allowedCurrentStatuses.includes(row.status)) return false;

      row.status = status;
      if (status === 'CANCELLED') {
        row.confirmToken = null;
        row.tokenExpiresAt = null;
      }
      return true;
    });
  },
};

/** Lấy toàn bộ booking (dùng cho cron reminders & admin tools). */
export async function listAllBookings(filter: { status?: BookingStatus | BookingStatus[] } = {}): Promise<Booking[]> {
  const statuses = filter.status
    ? Array.isArray(filter.status)
      ? filter.status
      : [filter.status]
    : null;

  return (await bookingStore.read())
    .filter((row) => !statuses || statuses.includes(row.status))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
