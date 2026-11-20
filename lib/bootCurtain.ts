/**
 * lib/bootCurtain.ts — "rèm skeleton trước khi paint" cho lần tải đầu tiên.
 *
 * ── VÌ SAO CẦN ──────────────────────────────────────────────────────────────
 * `RouteSkeletonOverlay` là client component nên chỉ mount SAU khi hydration
 * xong. Với điều hướng client-side thì không sao (rèm là React), nhưng khi
 * người dùng F5 / mở URL trực tiếp ở trang KHÔNG phải trang chủ, trang sẽ
 * "thẳng cẳng" không có skeleton nào cho tới lúc JS chạy — đúng chỗ chủ dự
 * án yêu cầu: skeleton phải chạy từ lúc load trang cho tới khi trang load
 * xong.
 *
 * ── CƠ CHẾ ─────────────────────────────────────────────────────────────────
 * 1. `<script>` nội tuyến trong <head> (xem app/layout.tsx) chạy TRƯỚC paint
 *    đầu tiên: nếu pathname khác trang chủ thì thêm class `boot-curtain`
 *    (và `boot-curtain-dark` cho các route tự vẽ nền tối) lên <html>.
 * 2. CSS trong app/globals.css vẽ một tấm rèm phủ toàn viewport bằng đúng
 *    token nền/skeleton của site — không nháy trắng, không cần JS.
 * 3. Sau hydration, `RouteSkeletonOverlay` hiện skeleton React của trang đích
 *    rồi gọi `releaseBootCurtain()` để tấm rèm CSS mờ đi và gỡ khỏi DOM —
 *    người dùng chỉ thấy MỘT lớp skeleton liền mạch từ paint đầu tiên cho tới
 *    khi cổng navGate mở và trang hiện ra cùng hiệu ứng nội dung.
 *
 * ── AN TOÀN ─────────────────────────────────────────────────────────────────
 * • Trang chủ KHÔNG có rèm — video intro tự boot (yêu cầu: "trừ trang chủ").
 * • Failsafe CSS (boot-curtain-failsafe): nếu JS lỗi / không hydrate được,
 *   rèm tự mờ sau FAILSAFE_MS bất kể JS — không bao giờ kẹt màn hình trống.
 * • Lớp phủ là pseudo-element trên <html> nên KHÔNG đụng tới DOM mà React
 *   sẽ hydrate — không thể gây hydration mismatch.
 */

import { DARK_ROUTE_PREFIXES } from "@/app/lib/route-skeletons";

/** Class đánh dấu rèm đang hiển thị. Phải khớp app/globals.css. */
export const BOOT_CURTAIN_CLASS = "boot-curtain";
/** Class phụ: route tự vẽ nền tối → rèm dùng nền tối cho khớp. */
export const BOOT_CURTAIN_DARK_CLASS = "boot-curtain-dark";
/** Class thêm vào để rèm FADE OUT rồi mới gỡ hẳn (tránh biến mất đột ngột). */
export const BOOT_CURTAIN_OUT_CLASS = "boot-curtain-out";

/** Delay gỡ class sau khi đã fade — phải ≥ thời gian transition trong CSS. */
const REMOVE_DELAY_MS = 320;

/**
 * Script nội tuyến cho <head>. PHẢI tự chứa hoàn toàn (chạy trước mọi module)
 * nên hằng số được nhúng thẳng vào chuỗi. Trang chủ được miễn rèm.
 */
export const BOOT_CURTAIN_SCRIPT = `(function(){try{
var p=location.pathname;
if(p==="/")return;
var r=document.documentElement;
r.classList.add(${JSON.stringify(BOOT_CURTAIN_CLASS)});
var d=${JSON.stringify(DARK_ROUTE_PREFIXES)};
for(var i=0;i<d.length;i++){
  if(p===d[i]||p.indexOf(d[i]+"/")===0){
    r.classList.add(${JSON.stringify(BOOT_CURTAIN_DARK_CLASS)});
    break;
  }
}
}catch(e){}})();`;

/**
 * Gỡ rèm: thêm class fade-out, sau REMOVE_DELAY_MS gỡ hẳn cả hai class.
 * Gọi NGAY khi skeleton React đã mount (RouteSkeletonOverlay) — trong lúc
 * rèm CSS đang mờ đi, skeleton React đã nằm bên dưới nên chuyển tiếp liền mạch.
 * Không-op nếu rèm không có mặt (điều hướng client-side, hoặc trang chủ).
 */
export function releaseBootCurtain(): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (!root.classList.contains(BOOT_CURTAIN_CLASS)) return;

  root.classList.add(BOOT_CURTAIN_OUT_CLASS);
  window.setTimeout(() => {
    root.classList.remove(BOOT_CURTAIN_CLASS, BOOT_CURTAIN_DARK_CLASS);
    root.classList.remove(BOOT_CURTAIN_OUT_CLASS);
  }, REMOVE_DELAY_MS);
}
