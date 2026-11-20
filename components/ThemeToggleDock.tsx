"use client";

// components/ThemeToggleDock.tsx
// Chỗ duy nhất quyết định nút bật/tắt Sáng–Tối có xuất hiện hay không.
//
// YÊU CẦU
//   KHÔNG hiển thị nút chuyển đổi sáng/tối ở bất kỳ trang nào — CHỈ được có
//   ở trang cá nhân (`/trang-ca-nhan`).
//
// VÌ SAO LÀ ALLOW-LIST CHỨ KHÔNG PHẢI DENY-LIST
//   Bản trước liệt kê route KHÔNG có nút. Đảo ngược lại thành danh sách
//   "route không được có": mọi route mới thêm vào đều MẶC ĐỊNH BỊ LOẠI — đúng
//   kỹ thuật, nhưng chỉ còn đúng khi ai đó cũng nhớ thêm tên route vào
//   danh sách. Cho một người khác (hoặc chính tôi vài tháng sau) tiếp tục code,
// một route quên ghi nghĩa sẽ mọc nút theme lên mà không ai nhận ra.
//
//   Allow-list đảo chiều mặc định: route mới mặc nhiên không có nút, và muốn
//   có nút thì phải gõ tên nó vào. Muốn thêm nút ở đâu là một QUYẾT ĐỊNH có
//   chủ đích, không phải một sự quên.
//
// VÌ SAO CẦN FILE NÀY
//   Nút nằm trong app/layout.tsx nên theo mặc định xuất hiện trên MỌI trang.
//   Layout là SERVER component và không đọc được pathname (Next chỉ cấp
//   `params`/`searchParams` cho route segment, không cấp pathname cho layout).
//   Vì vậy điều kiện route buộc phải nằm ở một client component con.
//
// CỐT LÕI: KHÔNG RENDER — KHÔNG GIẤU BẰNG CSS
//   Ở đây trả `null`, tức phần tử không tồn tại trong DOM: không còn `div`
//   `.pet-theme-toggle-dock` nào. Dùng `hidden`, `opacity: 0` hay `z-index` thì
//   control vẫn chiếm chỗ trong layout và vẫn tra cứu được bằng trình đọc màn
//   hình — việc "không có nút" phải đúng nghĩa là không có.
//
// KHÔNG ĐỤNG TỚI HỆ THỐNG THEME
//   `ThemeProvider`, token `--theme-*`, `THEME_INIT_SCRIPT` và script chống
//   nháy (FOUC) giữ nguyên ở MỌI trang. Nghĩa là khách vẫn giữ được theme
//   Sáng/Tối đang dùng khi điều hướng khắp site, chỉ là không có nút để bấm ở
//   những trang không được phép hiện nút.

import { usePathname } from "next/navigation";
import PetThemeToggle from "@/components/PetThemeToggle";

/**
 * Route DUY NHẤT được hiện nút chuyển đổi sáng/tối.
 *
 * Phải khớp chính xác `pathname` sau khi Next đã bóc dynamic segment.
 * Thêm route con (ví dụ `/trang-ca-nhan/doi-mat-khau`) thì phải liệt kê tường
 * minh — không dùng `startsWith`, vì `startsWith("/trang-ca-nhan")` sẽ mở
 * nút cho cả mọi route con, kể cả route không thuộc phạm vi cá nhân.
 */
const ROUTES_WITH_TOGGLE = new Set(["/trang-ca-nhan"]);

export default function ThemeToggleDock() {
  const pathname = usePathname();

  // `usePathname` trả `null` khi đang chờ Suspense (ví dụ khi bọc trong
  // `useSearchParams`). Trả `null` luôn.
  //
  // Không "hiện thừa cho an toàn": hiện thừa ở một trang khác chỉ là thiếu nút
  // trong tích tắc, còn hiện thừa ở bất kỳ trang nào khác là vi phạm đúng
  // thứ yêu cầu cấm. Chọn phía không bao giờ render nút khi chưa biết chắc
  // route.
  if (!pathname) return null;

  if (!ROUTES_WITH_TOGGLE.has(pathname)) return null;

  return (
    <div className="pet-theme-toggle-dock">
      <PetThemeToggle />
    </div>
  );
}