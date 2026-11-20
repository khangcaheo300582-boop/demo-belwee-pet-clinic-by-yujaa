"use client";

/**
 * Template entrance — wrapper nội dung mỗi route (Next re-mount template mỗi
 * lần đổi trang nên đây là "viền" tự nhiên cho hiệu ứng vào trang).
 *
 * Hiệu ứng KHÔNG nằm ở đây nữa — nó là CSS animation `.template-enter` trong
 * app/globals.css (khối "HIỆU ỨNG VÀO/RA TRANG"), chỉ chạy khi <html> mang
 * class `page-reveal`: RouteSkeletonOverlay gắn class đúng lúc mở cổng
 * navGate (media trang đích đã tải xong). Nhờ vậy trang mới KHÔNG hiện ngay
 * từ lúc mount — nó chờ sau skeleton rồi mờ + trượt nhẹ vào trong 0.5s.
 *
 * Lịch sử: trước đây dùng framer-motion (blur + scale) — ~35-50KB gz chỉ để
 * làm 1 fade, hydrate trên MỌI route, và SSR render opacity:0 cần failsafe
 * 5s chống kẹt trang trắng khi hydration lỗi. Nay thuần CSS (compositor
 * thread) + failsafe cấu trúc: JS chết ⇒ không class nào được gắn ⇒ trang
 * hiện bình thường.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="template-enter min-h-screen">{children}</div>;
}