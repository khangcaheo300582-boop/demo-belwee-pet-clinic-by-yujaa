// lib/bookingService.ts
// Unified booking creation service — ALL booking forms route through here
// Ensures every booking enters the same state machine: PENDING → CONFIRMED

import { dbBooking, Booking } from './dbBooking';
import { sendMail, sendMailAsync } from './mailer';
import { buildAdminEmail, buildCustomerPendingEmail } from './emailTemplates';
import { validateEmail, validatePhone, validateRequired } from './validators';
import { getBaseUrl } from './site-url';

// Accepts ANY field-name variant from the various booking forms and normalizes
export interface RawBookingInput {
  // Email field variants
  customerEmail?: string;
  email?: string;
  // Name field variants
  customerName?: string;
  name?: string;
  ownerName?: string;
  // Phone field variants
  customerPhone?: string;
  phone?: string;
  phoneNumber?: string;
  // Pet name field variants
  petName?: string;
  // Pet type field variants
  petType?: string;
  // Service field variants
  serviceType?: string;
  service?: string;
  serviceName?: string;
  // Time field variants
  time?: string;
  date?: string;
  bookingDate?: string;
  bookingTime?: string;
  // Notes field variants
  notes?: string;
  note?: string;
  healthStatus?: string;
  additionalNote?: string;
  // Address field variants
  addressName?: string;
  addressKey?: string;
  // Extended service-specific fields
  petAge?: string;
  petWeight?: string;
  vaccineDai?: string;
  hotelDays?: string;
  foodNote?: string;
  vaccineType?: string;
  /**
   * Idempotency key do form sinh (Date.now() + random). Chống tạo trùng
   * booking khi mạng lag → người dùng bấm "Xác nhận" nhiều lần, hoặc request
   * được retry tự động. Không bắt buộc — form cũ không gửi vẫn chạy được.
   */
  clientRequestId?: string;
}

function coalesce(...values: (string | undefined)[]): string | undefined {
  for (const v of values) {
    if (v !== undefined && v !== null && String(v).trim() !== '') {
      return String(v).trim();
    }
  }
  return undefined;
}

function combineDateTime(date?: string, time?: string): string {
  if (date && time) return `${date} ${time}`;
  return date || time || '';
}

/**
 * Core unified booking creation.
 * Every booking form calls this to ensure consistent DB state + email workflow.
 */
export async function createBooking(raw: RawBookingInput): Promise<{
  success: boolean;
  booking?: Booking;
  error?: string;
  mailWarning?: boolean;
  /** true nếu request là replay của một booking đã tồn tại (idempotent). */
  duplicate?: boolean;
  /** true nếu khung giờ + chi nhánh đã bị giữ bởi booking khác. */
  slotTaken?: boolean;
}> {
  // ─── Normalize fields from all form variants ───────────────
  const email = coalesce(raw.customerEmail, raw.email);
  const name = coalesce(raw.customerName, raw.name, raw.ownerName);
  const phone = coalesce(raw.customerPhone, raw.phone, raw.phoneNumber);
  const petName = coalesce(raw.petName);
  const petType = coalesce(raw.petType);
  const serviceType = coalesce(raw.serviceType, raw.service, raw.serviceName) || 'Khám & Điều trị';
  const time = coalesce(raw.time, combineDateTime(raw.date || raw.bookingDate, raw.bookingTime));
  const notes = coalesce(raw.notes, raw.note, raw.healthStatus, raw.additionalNote) || '';

  // Build extended notes from service-specific fields
  const extraParts: string[] = [];
  if (raw.petAge) extraParts.push(`Tuổi: ${raw.petAge}`);
  if (raw.petWeight) extraParts.push(`Cân nặng: ${raw.petWeight}kg`);
  if (raw.vaccineDai) extraParts.push(`Tiêm ngừa dại: ${raw.vaccineDai}`);
  if (raw.hotelDays) extraParts.push(`Số ngày gửi: ${raw.hotelDays}`);
  if (raw.foodNote) extraParts.push(`Chế độ ăn: ${raw.foodNote}`);
  if (raw.vaccineType) extraParts.push(`Loại vaccine: ${raw.vaccineType}`);
  const fullNotes = extraParts.length > 0
    ? (notes ? `${notes} | ` : '') + extraParts.join(' | ')
    : notes;

  const addressName = coalesce(raw.addressName);

  // ─── Validate ──────────────────────────────────────────────
  const emailErr = validateEmail(email || '');
  if (emailErr) return { success: false, error: emailErr.message };

  const nameErr = validateRequired(name || '', 'Họ tên');
  if (nameErr) return { success: false, error: nameErr.message };

  const phoneErr = validatePhone(phone || '');
  if (phoneErr) return { success: false, error: phoneErr.message };

  const petErr = validateRequired(petName || '', 'Tên thú cưng');
  if (petErr) return { success: false, error: petErr.message };

  const timeErr = validateRequired(time ?? '', 'Thời gian hẹn');
  if (timeErr) return { success: false, error: timeErr.message };

  // ─── Create booking in DB (State: PENDING) ─────────────────
  // dbBooking.create tự chặn trong MỘT khối update() đồng bộ:
  //   • duplicate  → cùng clientRequestId đã tồn tại (double-submit/retry)
  //   • slot-taken → khung giờ + chi nhánh đã bị giữ bởi booking khác
  // Trường hợp duplicate: trả success với booking gốc để UX mượt (người dùng
  // thấy "thành công" thay vì lỗi khó hiểu) — và quan trọng là KHÔNG gửi
  // email thông báo lần 2 cho admin.
  const result = await dbBooking.create(
    {
      customerEmail: (email || '').toLowerCase().trim(),
      customerName: name!,
      customerPhone: phone!,
      petName: petName!,
      petType: petType || '',
      serviceType,
      time: time!,
      notes: fullNotes,
      addressName: addressName || '',
    },
    {
      clientRequestId: raw.clientRequestId,
      duplicateSlotCheck: true,
    }
  );

  // Đặt lịch trùng khung giờ → báo lỗi rõ ràng cho khách chọn giờ khác.
  if (!result.created && result.reason === 'slot-taken') {
    return {
      success: false,
      error: 'Khung giờ này tại chi nhánh đã có người đặt. Vui lòng chọn thời gian khác hoặc gọi hotline để được sắp xếp.',
      slotTaken: true,
    };
  }

  const booking = result.booking;

  // Double-submit (duplicate): booking gốc vẫn nguyên, bỏ qua gửi email.
  if (!result.created && result.reason === 'duplicate') {
    return {
      success: true,
      booking,
      duplicate: true,
    };
  }

  // ─── Send admin notification email with CONFIRM button ──────
  const baseUrl = getBaseUrl();
  const confirmUrl = `${baseUrl}/api/xac-nhan?token=${booking.confirmToken}`;
  const adminMail = buildAdminEmail(booking, confirmUrl);
  const adminEmailTo = process.env.EMAIL_RECEIVER?.trim() || 'belweepetclinic@gmail.com';

  const mailSent = await sendMail({
    to: adminEmailTo,
    subject: adminMail.subject,
    html: adminMail.html,
  });

  // ─── Send customer receipt email immediately on booking creation ──
  // Khách hàng nhận email ngay khi đặt lịch (PENDING state),
  // xác nhận phòng khám đã nhận được yêu cầu và sẽ liên hệ sớm.
  const customerEmailTo = (email || '').toLowerCase().trim();
  if (customerEmailTo) {
    const customerMail = buildCustomerPendingEmail(booking);
    sendMailAsync({
      to: customerEmailTo,
      subject: customerMail.subject,
      html: customerMail.html,
    });
  }

  return {
    success: true,
    booking,
    mailWarning: !mailSent,
  };
}
