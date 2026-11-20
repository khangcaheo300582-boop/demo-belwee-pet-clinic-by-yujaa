"use client";

/**
 * app/booking/layout.tsx
 *
 * GĐ9 · (i) — mọi trang đặt lịch đều phải đăng nhập mới thấy form.
 *
 * ── VÌ SAO ĐẶT Ở LAYOUT CHỨ KHÔNG SỬA TỪNG TRANG ───────────────────────────
 * Dưới đây có 5 route: `[service]` (bắt `/booking/kham-benh`) cùng 3 trang tĩnh
 * `/booking/spa-grooming`, `/booking/khach-san`, `/booking/tiem-ngua`. Bọc ở
 * layout nghĩa là:
 *   • sửa MỘT chỗ thay vì 4;
 *   • route đặt lịch thêm sau này tự động được bảo vệ — không có chuyện "quên
 *     bọc" kiểu từng phải gỡ import thủ công lẻ tẻ ở từng trang.
 *
 * ── VÌ SAO ĐƯỢC DÙNG `Children` ĐỂ BỌC ──────────────────────────────────────
 * Không lọc gì — chỉ chặn theo phiên đăng nhập, giống một middleware ở tầng
 * render — nên bọc `children` là đủ và rõ ràng.
 *
 * Ghi chú: layout này là client component vì `BookingAuthGate` dùng `useSession`.
 * Điều đó KHÔNG làm mất khả năng pre-render của các trang con — chúng vẫn được
 * render sẵn; chỉ là phần bọc ngoài cần đọc trạng thái phiên ở client.
 */

import type { ReactNode } from "react";
import BookingAuthGate from "@/components/BookingAuthGate";

export default function BookingLayout({ children }: { children: ReactNode }) {
  return <BookingAuthGate>{children}</BookingAuthGate>;
}