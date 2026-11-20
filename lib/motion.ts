/**
 * lib/motion.ts
 *
 * Nguồn duy nhất cho câu hỏi "có nên chuyển động với khách này không?".
 *
 * ── VÌ SAO FILE NÀY TỒN TẠI ────────────────────────────────────────────────
 * Trước đây dự án trả lời câu đó ở tám nơi: một bản sao trong `lib/gsap.ts`,
 * một bản riêng trong `RouteSkeletonOverlay`, một bản nữa trong
 * `BookingLensButton`, các lời gọi `matchMedia` rải rác trong `ParticleDNAField`
 * và `IntroVideo`, cộng `useReducedMotion` của framer-motion trong
 * `LiquidGlassCard`. Tám nơi phải luôn khớp nhau, và CSS trong
 * `app/globals.css` là nơi thứ chín. Muốn đổi hành vi thì phải sửa cả chín.
 *
 * Cách áp dụng:
 *   - CSS: mọi khối reduced-motion trong `app/globals.css`, cùng hai khối
 *     `<style>` trong `app/dang-nhap` và một khối trong `components/ClinicSystem`,
 *     dùng feature query thật `prefers-reduced-motion: reduce`.
 *   - JS: mọi cổng bên dưới đọc module này, không đọc `matchMedia` trực tiếp.
 *
 * ── LỊCH SỬ: TỪNG BỊ VÔ HIỆU HÓA CỐ Ý, ĐÃ BẬT LẠI ─────────────────────────
 * Bản trước đặt `FORCE_MOTION = true` và đổi 16 media query trong globals.css
 * thành `prefers-reduced-motion-disabled` — một media feature KHÔNG tồn tại, nên
 * mọi query luôn false và toàn bộ fallback bên trong chết. Lý do được ghi trong
 * globals.css: muốn ép chuyển động chạy cho mọi khách.
 *
 * Điều đó trái với yêu cầu của đợt nâng cấp này ("animation phải tôn trọng
 * `prefers-reduced-motion`") và với WCAG 2.3.3 — bệnh nhân rối loạn tiền đình
 * cần giao diện đứng yên. Nay đã bật lại.
 *
 * SAU ĐÓ LẠI CÓ MỘT LẦN TẮT SAI LẦN NỮA: hàm bị đổi thành trả `true` vô điều
 * kiện, tắt cứng mọi chuyển động toàn site. Đó là hồi quy, không phải yêu
 * cầu của chủ dự án — nó làm `scripts/verify-motion.ts` đỏ, và làm toàn bộ
 * phần animation của đợt nâng cấp không thể chạy. Đã khôi phục lại việc đọc
 * thiết lập thật của hệ điều hành.
 *
 * HOÀN TÁC nếu cố ý muốn chuyển động chạy cho tất cả: đặt `FORCE_MOTION = true`
 * ở đây, rồi đổi `@media (prefers-reduced-motion: reduce)` thành
 * `@media (prefers-reduced-motion-disabled)` ở globals.css,
 * app/dang-nhp/page.tsx và components/ClinicSystem.tsx. Phải làm cả hai —
 * đổi mỗi cờ này sẽ để JS không còn cổng trong khi fallback CSS vẫn chết.
 */

/**
 * Khi `true`, chuyển động chạy trên MỌI thiết bị, bỏ qua cài đặt "giảm
 * chuyển động" của hệ điều hành.
 *
 * Mặc định `false`. Xem khối lịch sử ở trên trước khi đổi.
 */
export const FORCE_MOTION = false;

export const MOTION = {
  // ── Thời gian (ms) ──
  fast: 180,
  normal: 320,
  slow: 500,
  slowest: 750,

  // ── Easing (cubic-bezier) ──
  easeOut: [0.16, 1, 0.3, 1] as const,
  easeIn: [0.4, 0, 1, 1] as const,
  easeInOut: [0.76, 0, 0.24, 1] as const,
  spring: [0.34, 1.56, 0.64, 1] as const,
  glass: [0.23, 1, 0.32, 1] as const,

  // ── Stagger (ms) ──
  stagger: 60,
  staggerFast: 35,

  // ── Giới hạn hiệu ứng ──
  maxConcurrentMobile: 6,
  maxConcurrentDesktop: 12,
} as const;

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/**
 * Khách này có yêu cầu giảm chuyển động không?
 *
 * Đọc thiết lập THẬT của hệ điều hành. Không dùng `return !FORCE_MOTION`:
 * với `FORCE_MOTION = false`, biểu thức đó trả `true` vô điều kiện — tức tắt
 * mọi hiệu ứng cho tất cả khách, kể cả người không hề bật tuỳ chọn đó.
 *
 * @returns `true` khi nên tắt chuyển động; `false` khi nên chạy.
 *
 * Trên server (không có `window`) trả `false`: HTML phải được render CÓ hiệu
 * ứng để không mất nội dung và để client đánh giá lại đúng sau khi hydrate.
 * Trả `true` ở server sẽ khiến nội dung bị ẩn vĩnh viễn với người dùng bật giảm
 * chuyển động — đúng cái lỗi khiến footer và thẻ cuối trang biến mất ở G2.
 */
export function prefersReducedMotion(): boolean {
  if (FORCE_MOTION) return false;
  if (typeof window === "undefined") return false;
  try {
    return typeof window.matchMedia === "function"
      ? window.matchMedia(REDUCED_MOTION_QUERY).matches
      : false;
  } catch {
    // Trình duyệt cũ hoặc môi trường hạn chế: coi như KHÔNG giảm chuyển động
    // để nội dung hiện bình thường, thay vì ẩn nó vĩnh viễn.
    return false;
  }
}

/**
 * Trả về `true` khi thiết bị là touch (mobile/tablet).
 */
export function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    // @ts-expect-error DocumentTouch may not exist in all environments
    window.DocumentTouch && document instanceof DocumentTouch
  );
}

/**
 * Hook đọc cùng một nguồn sự thật.
 *
 * Đọc trong `useState` initializer (chạy ở lần render đầu) để giá trị có sẵn ngay
 * và khớp với CSS. Cài đặt hệ điều hành hiếm khi đổi giữa chừng phiên; nếu cần
 * thì gọi thêm `useEffect` cập nhật theo `matchMedia(...).addEventListener`.
 */
export function useReducedMotion(): boolean {
  return prefersReducedMotion();
}