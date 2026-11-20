// lib/bookingStatus.ts
// Từ vựng trạng thái lịch hẹn — MỘT nơi duy nhất định nghĩa.
//
// ── VÌ SAO FILE NÀY TỒN TẠI ───────────────────────────────────────────────
//   Trạng thái lịch hẹn từng được khai báo ở ba chỗ khác nhau, mỗi chỗ một
//   cách xử lý:
//     • lib/dbBooking.ts            khai báo 4 trạng thái, ghi thẳng xuống JSON
//     • lib/staffAppointments.ts    normalizeBookingStatus() — lạp ẩn ACCEPTED
//     • app/trang-ca-nhan/page.tsx   statusKey() — lạp ẩn ACCEPTED + nhãn tiếng Việt
//   Hệ quả đo được, không phải giả định: data/bookings.json có một lịch hẹn
//   status "ACCEPTED". Màn hình nhân viên hiện nó, /trang-ca-nhan hiện nó, còn
//   /client-portal thì KHÔNG — vì portalData ép kiểu rồi lọc theo trạng thái,
//   nên lịch đó biến mất không một dấu vết. Ba màn hình, một nguồn dữ liệu,
//   ba câu trả lời khác nhau.
//
// ── VÌ SAO FALLBACK LÀ PENDING, KHÔNG PHẢI CONFIRMED ────────────────────────
//   lib/staffAppointments.ts từng fallback về CONFIRMED. Điều đó sai theo hướng
//   nguy hiểm: gặp một từ vựng lạ, nó khẳng định với khách rằng phòng khám đã
//   xác nhận — một sự khẳng định không ai xác nhận được. PENDING an toàn hơn:
//   nó không nói sai, và vẫn là việc nhân viên có thể xử lý ngay. Mọi từ vựng
//   lịch sử đều có trong bảng alias bên dưới, nên fallback chỉ kích hoạt với
//   từ vựng thực sự mới — đúng trường hợp nên hỏi chứ không nên đoán.

/** Bốn trạng thái mà mọi màn hình đều phải hiểu. */
export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';

/**
 * Từ khóa đã từng dùng → trạng thái chuẩn.
 *
 * Bảng này là hợp đồng dữ liệu: mọi từ vựng lịch sử từng xuất hiện trong
 * data/bookings.json phải có mặt ở đây, nếu không một màn hình nào đọc được
 * dòng dữ liệu đó. Thêm từ mới vào đây kèm một dòng kiểm thử.
 */
const STATUS_ALIASES: Readonly<Record<string, BookingStatus>> = {
  // Bốn trạng thái chuẩn, giữ nguyên tên.
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',

  // Luồng đặt lịch cũ gọi CONFIRMED là ACCEPTED. Đây KHÔNG phải trạng thái
  // riêng — cùng nghĩa, chỉ khác tên.
  ACCEPTED: 'CONFIRMED',

  // Ca đã xác nhận và đang thực hiện. Mô hình 4 trạng thái không có "đang xử
  // lý" riêng, và không cần: đang xử lý vẫn là CONFIRMED cho tới khi hoàn tất.
  IN_PROGRESS: 'CONFIRMED',

  // Nhãn tiếng Việt từ dữ liệu nhập tay / dữ liệu cũ.
  'ĐÃ XÁC NHẬN': 'CONFIRMED',
  'ĐÃ XÁC NHẬN ĐẶT LỊCH': 'CONFIRMED',
  'ĐANG XỬ LÝ': 'CONFIRMED',
  'HOÀN THÀNH': 'COMPLETED',
  'ĐÃ HUỶ': 'CANCELLED',
  'ĐÃ HỦY': 'CANCELLED',
  HUY: 'CANCELLED',
};

/**
 * Đưa một trạng thái bất kỳ (kể cả từ dữ liệu cũ) về bốn trạng thái chuẩn.
 *
 * So khớp không phân biệt hoa thường và bỏ khoảng trắng thừa, vì giá trị đến từ
 * cả JSON lẫn form gửi lên.
 */
export function normalizeBookingStatus(status: string | null | undefined): BookingStatus {
  const key = (status ?? '').trim().toUpperCase();
  return STATUS_ALIASES[key] ?? 'PENDING';
}

/**
 * Trạng thái có đúng nghĩa để ghi xuống store không.
 *
 * Khác `normalizeBookingStatus`: hàm này KHÔNG nới lỏng. Dùng ở biên ghi —
 * một route staff gửi "ACCEPTED" phải bị từ chối, vì nếu lưu được thì dữ liệu
 * lại có từ vựng lạ và vòng lặp bắt đầu từ đầu.
 */
export function isBookingStatus(value: unknown): value is BookingStatus {
  if (typeof value !== 'string') return false;
  return ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'].includes(value.trim().toUpperCase());
}

/**
 * Trạng thái còn "đang chạy": khách còn quan tâm, nhân viên còn việc.
 * Lịch đã huỷ không thuộc nhóm này — nó đã kết thúc, chỉ là chưa xoá.
 */
export function isActiveStatus(status: BookingStatus): boolean {
  return status === 'PENDING' || status === 'CONFIRMED';
}