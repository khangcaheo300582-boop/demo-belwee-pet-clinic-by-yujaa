// lib/bookingTimeline.ts
// Biến một booking thành dòng tiến trình khách hàng đọc được.
//
// ── NGUYÊN TẮC KHÔNG THỎA HIỆP: KHÔNG BỊA MỐC THỜI GIAN ──────────────────
//   Kiểu dữ liệu booking chỉ ghi ba mốc: createdAt, confirmedAt, và `time`
//   (khung giờ khách đặt). Nó KHÔNG có completedAt, không có cancelledAt.
//   Nên bước "Hoàn thành" và "Đã huỷ" ở đây có trạng thái nhưng không có giờ —
//   và đó là câu trả lời trung thực. Đặt giờ ước lượng (ví dụ "dự kiến hoàn tất
//   lúc giờ khám") sẽ khiến khách tưởng phòng khám đã lên lịch cụ thể, trong
//   khi không ai hứa điều đó. `atISO: null` nghĩa là "chưa ghi nhận", và UI
//   nói đúng câu đó thay vì im lặng.
//
// ── VÌ SAO TÁCH RIÊNG, KHÔNG VIẾT THẲNG TRONG portalData.ts ───────────────
//   Đây là logic thuần: input là một object booking, output là một mảng bước.
//   Không đọc store, không phụ thuộc React. Nhờ vậy nó test được bằng bảng dữ
//   liệu thuần — scripts/verify-booking-timeline.ts — thay vì phải dựng cả
//   pipeline đặt lịch chỉ để kiểm tra một phép so sánh trạng thái.

import { normalizeDateInput, normalizeTimestamp } from './dateInput';
import type { BookingStatus } from './dbBooking';
import type { MessageKey } from './i18n';

/**
 * Trạng thái hiển thị của một mốc trên dòng thời gian.
 *
 * `skipped` là trạng thái riêng chứ không phải `upcoming` rỗng: một lịch hẹn bị
 * huỷ trước khi phòng khám xác nhận thì bước "Phòng khám xác nhận" chưa từng
 * xảy ra. Vẽ nó như bước sắp tới sẽ khiến khách tưởng còn đang chờ xác nhận.
 */
export type TimelineState = 'done' | 'current' | 'upcoming' | 'skipped';

export interface TimelineStep {
  /** Định danh ổn định để React khoá node và test tham chiếu. */
  key: 'requested' | 'confirmed' | 'appointment' | 'closed';
  /** Khoá i18n, không phải chuỗi đã dịch — để đổi ngôn ngữ không cần dựng lại. */
  labelKey: MessageKey;
  /** Khoá i18n của dòng phụ, nếu bước này có. */
  detailKey?: MessageKey;
  /**
   * Mốc thời gian đã ghi nhận, hoặc null.
   *
   * null KHÔNG phải "chưa tới" — nó là "hệ thống không lưu mốc này". Xem khối
   * giải thích đầu file.
   */
  atISO: string | null;
  state: TimelineState;
  /** Giá trị cho placeholder `{pet}` / `{service}` của detailKey. */
  values?: Record<string, string>;
  /** Người xác nhận, chỉ có ở bước `confirmed`. */
  byName?: string | null;
}

/** Đúng những trường timeline cần. Hẹp có chủ đích để test dựng được object. */
export interface TimelineInput {
  status: BookingStatus;
  createdAt: string;
  confirmedAt?: string | null;
  confirmedBy?: { name?: string | null } | null;
  time: string;
  petName?: string;
  serviceType?: string;
}

/** Khung giờ đã đặt, chuẩn hoá từ chuỗi tự do của form. */
function scheduledISO(time: string): string | null {
  return normalizeDateInput(time);
}

/**
 * Dựng dòng tiến trình từ một booking.
 *
 * Trạng thái lấy từ `status` (trạng thái là sự thật, luôn có mặt); mốc thời gian
 * lấy từ trường đã ghi (có thể vắng). Hai thứ tách bạch là lý do hàm này không
 * bao giờ phải đoán.
 */
export function buildBookingTimeline(b: TimelineInput): TimelineStep[] {
  const createdISO = normalizeTimestamp(b.createdAt);
  const confirmedISO = normalizeTimestamp(b.confirmedAt);
  const appointmentISO = scheduledISO(b.time);

  const cancelled = b.status === 'CANCELLED';
  const completed = b.status === 'COMPLETED';

  // `neverConfirmed` = huỷ mà không có dấu vết xác nhận nào. Đây là điều kiện
  // tách bước "skipped" khỏi bước "done": lịch huỷ sau khi đã xác nhận thì bước
  // xác nhận VẪN xảy ra và vẫn phải hiện.
  const neverConfirmed = cancelled && !confirmedISO;

  const steps: TimelineStep[] = [
    {
      key: 'requested',
      labelKey: 'timeline.stepRequested',
      detailKey: 'timeline.stepRequestedDetail',
      atISO: createdISO,
      // Đã tạo booking thì bước này chắc chắn xảy ra, kể cả khi ngay sau đó bị
      // huỷ. Không có ngoại lệ.
      state: 'done',
    },
    {
      key: 'confirmed',
      labelKey: 'timeline.stepConfirmed',
      atISO: confirmedISO,
      byName: b.confirmedBy?.name ?? null,
      state: neverConfirmed ? 'skipped' : b.status === 'PENDING' ? 'current' : 'done',
      // Chỉ hiện dòng phụ "đang chờ xác nhận" khi đang thật sự chờ. Với lịch đã
      // xác nhận, dòng phụ đó là sai và gây lo lắng vô ích.
      ...(b.status === 'PENDING'
        ? { detailKey: 'timeline.stepConfirmedPending' as MessageKey }
        : {}),
    },
    {
      key: 'appointment',
      labelKey: 'timeline.stepAppointment',
      detailKey: 'timeline.stepAppointmentDetail',
      atISO: appointmentISO,
      state: completed ? 'done' : cancelled ? 'skipped' : b.status === 'CONFIRMED' ? 'current' : 'upcoming',
      values: { pet: b.petName ?? '', service: b.serviceType ?? '' },
    },
  ];

  // Bước kết chỉ tồn tại khi hồ sơ thật sự đã đóng. Với lịch còn PENDING hoặc
  // CONFIRMED, vẽ sẵn một bước "Hoàn thành" ở cuối là nói dối rằng phòng khám
  // đã hẹn giờ kết thúc ca — điều không ai hứa.
  if (completed || cancelled) {
    steps.push({
      key: 'closed',
      labelKey: completed ? 'timeline.stepCompleted' : 'timeline.stepCancelled',
      atISO: null,
      state: 'done',
    });
  }

  return steps;
}
