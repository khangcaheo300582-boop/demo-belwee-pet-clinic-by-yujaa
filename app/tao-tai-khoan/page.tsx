import { redirect } from "next/navigation";

/**
 * app/tao-tai-khoan/page.tsx
 *
 * Route này KHÔNG có form riêng — nó chỉ là bí danh sang luồng đăng ký nằm
 * trong `/dang-nhap` (một trang, hai chế độ, chung cả form đăng nhập lẫn form
 * đăng ký + OTP).
 *
 * ── GĐ9 · (i): PHẢI CHUYỂN TIẾP `?next=` ─────────────────────────────────────
 * `BookingAuthGate` gửi người chưa đăng nhập tới `/tao-tai-khoan?next=…`.
 * Trước GĐ9 route này bỏ mặc tham số, nên: khách bấm "Tạo tài khoản" →
 * đăng ký xong → về trang chủ thay vì về trang đặt lịch họ đang định đi. Đúng
 * thứ mà cổng chặn cố tránh.
 *
 * `searchParams` là prop của Server Component nên đọc được trước khi render,
 * không cần `useSearchParams` (vốn sẽ buộc cả trang thành client).
 *
 * Vì sao lọc ở đây thay vì để `/dang-nhap` lo: `nextPath` ở trang đăng nhập là
 * hook, không dùng được trong file server. Lọc sớm ở đây giữ đúng một quy tắc
 * cho cả hai cửa, và giá trị đã sạch thì trang đăng nhập vẫn lọc lần nữa
 * (defense in depth — không tốn gì).
 *
 * `encodeURIComponent` rồi Next tự giải mã khi đọc `searchParams.get('next')`.
 */
export default function TaoTaiKhoanRedirect({
  searchParams,
}: {
  searchParams?: { next?: string | string[] };
}) {
  const raw = Array.isArray(searchParams?.next) ? searchParams?.next[0] : searchParams?.next;
  const safe =
    raw && raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/\\")
      ? raw
      : "/";
  redirect(`/dang-nhap?mode=register&next=${encodeURIComponent(safe)}`);
}