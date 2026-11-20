import { redirect } from 'next/navigation';

/**
 * app/booking/page.tsx
 *
 * `/booking` từng trả 404: dự án chỉ có các trang con (`[service]`,
 * `spa-grooming`, `khach-san`, `tiem-ngua`) mà không có trang chỉ mục, nên mọi
 * link tới `/booking` rơi vào trang lỗi — kể cả link trong chính mã nguồn.
 *
 * ── VÌ SAO CHỌN CHUYỂN HƯỚNG THAY VÌ TỰ VIẾT TRANG CHỈ MỤC ────────────────
 * Đã kiểm chứng: `/booking/kham-benh` trả 200, và đó CHÍNH LÀ route mà
 * `lib/clinics.ts` dùng cho dịch vụ "Khám tổng quát & tiêm chủng" (xem
 * `SPECIALTY_SERVICES`). Nói cách khác, trang đặt lịch mà khách bấm vào từ
 * footer vốn đã là `/booking/kham-benh`.
 *
 * Viết một trang chỉ mục mới sẽ tạo thêm một nơi phải cập nhật mỗi khi thêm
 * dịch vụ — tức tái tạo đúng loại lỗi "link chết âm thầm" mà dự án đã mắc
 * nhiều lần. Chuyển hướng giữ đúng một đích, không thêm nguồn sự thật mới.
 *
 * Nếu sau này chủ dự án muốn một trang chỉ mục đặt lịch thật sự (danh sách mọi
 * dịch vụ để chọn), thay nội dung file này bằng trang đó. Hiện tại người dùng
 * tới `/booking` được đưa thẳng tới nơi họ có thể đặt lịch, thay vì gặp 404.
 */

export const dynamic = 'force-dynamic';

export default function BookingIndexPage() {
  redirect('/booking/kham-benh');
}