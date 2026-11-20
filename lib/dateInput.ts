// lib/dateInput.ts
// Một chỗ duy nhất để đọc chuỗi thời gian tự do thành ISO.
//
// VÌ SAO TÁCH RA
//   Trước đây `normalizeDateInput` nằm trong lib/portalData.ts — nhưng nó được
//   dùng bởi cả cron nhắc lịch, cả lớp staff appointments, lẫn timeline lịch
//   hẹn. Hàm tiện ích nằm trong file dựng view-model là cách chắc chắn nhất để
//   tạo vòng import về sau: timeline cần hàm này, mà portalData lại cần timeline.
//   Tách ra giữa hai vòng là cấu trúc đúng, và đổi tên file để người đọc tìm
//   thấy ngay.
//
// ĐẶC TẦU ĐẦU VÀO — vì sao phải "cố gắng đoán"
//   Các form gửi lên không thống nhất: `datetime-local` cho ra
//   "2026-01-15T09:00", một form khác lại ghép chuỗi thành "2026-01-15 09:00",
//   còn form nhập tay có thể là "15/01/2026 09:00". Dữ liệu cũ đã nằm sẵn trong
//   data/bookings.json theo cả ba kiểu, nên bộ đọc phải chấp nhận cả ba.
//   Sai ở đây không phải chuyện hiển thị: cron nhắc lịch và kiểm tra trùng khung
//   giờ đều dựa vào hàm này.

/**
 * Chuẩn hoá chuỗi thời gian tự do → ISO, hoặc null nếu không hiểu được.
 *
 * Chấp nhận:
 *   - ISO / datetime-local: "2026-01-15", "2026-01-15T09:00", "2026-01-15 09:00"
 *   - Ngày Việt Nam: "15/01/2026", "15/01/2026 09:00", "15/01/2026 9:05"
 *
 * Trả về null chứ không phải `new Date(NaN)`: người gọi cần phân biệt "không có
 * dữ liệu" với "có dữ liệu sai", vì hai trường hợp đó được xử lý khác nhau —
 * một cái thì bỏ qua bước, cái kia thì báo lỗi cho người dùng.
 */
export function normalizeDateInput(input: string | null | undefined): string | null {
  const trimmed = (input ?? '').trim();
  if (!trimmed) return null;

  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const d = new Date(trimmed);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  const vn = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (vn) {
    const d = new Date(
      Number(vn[3]),
      Number(vn[2]) - 1,
      Number(vn[1]),
      Number(vn[4] || 0),
      Number(vn[5] || 0),
      0,
      0
    );
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  const d = new Date(trimmed);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Chuẩn hoá một chuỗi đã-đảm-bảo-ISO (các trường mà server tự sinh: createdAt,
 * confirmedAt…). Khác `normalizeDateInput` ở chỗ KHÔNG đoán — chỉ chấp nhận
 * chuỗi parse được. Dùng cho `atISO` của timeline, nơi im lặng thay vì đoán là
 * đúng: không có mốc thời gian ghi nhận thì phải là null chứ không phải một
 * ngày bịa ra.
 */
export function normalizeTimestamp(input: string | null | undefined): string | null {
  const trimmed = (input ?? '').trim();
  if (!trimmed) return null;
  const d = new Date(trimmed);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
