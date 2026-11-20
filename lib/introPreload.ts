/**
 * lib/introPreload.ts
 *
 * ── VÌ SAO CẦN FILE NÀY ─────────────────────────────────────────────────────
 * `IntroVideo` là client component: `<video>` chỉ được tạo SAU khi React
 * hydrate, nên mạng chỉ bắt đầu tải video intro từ lúc đó. Đo trên dev thấy
 * màn intro đứng im ~5s (nền đen, chưa có frame nào) trước khi video vào
 * `playing`. Trên 3G/4G chậm khoảng trống đó còn dài hơn nữa, và nó rơi đúng
 * vào ấn tượng đầu tiên của người dùng.
 *
 * Cách sửa: một `<script>` nội tuyến trong `<head>` (chạy TRƯỚC paint đầu tiên,
 * cùng chỗ với script theme/boot-curtain) kiểm tra `location.pathname` rồi chèn
 * `<link rel="preload" as="video">` với `fetchpriority="high"` cho video intro.
 *
 * Nhờ vậy:
 *   • trình duyệt tải video song song với quá trình hydrate thay vì sau đó;
 *   • `IntroVideo` render đúng file đang bay về ⇒ không phải tải thêm video thứ hai;
 *   • các trang khác không chịu chi phí này (script thoát ngay khi path ≠ "/").
 *
 * ── VIDEO CỐ ĐỊNH ───────────────────────────────────────────────────────────
 * Intro logo KHÔNG chọn ngẫu nhiên: luôn phát `/belwee-logo-intro-a.mp4`.
 * Trước đây file này random giữa `a` và `b` và ghi lựa chọn lên `window`;
 * nay bỏ hẳn phần random nên không còn khoá `window` nào để đồng bộ.
 *
 * ── AN TOÀN ─────────────────────────────────────────────────────────────────
 * Toàn bộ thân script nằm trong try/catch: Safari chế độ riêng tư / trình duyệt
 * cũ chặn thứ gì đó cũng không làm chết các script khác trong `<head>`.
 * Nếu script không chạy, `IntroVideo` vẫn tự render video — đây chỉ là lớp
 * tăng tốc, không phải điều kiện đúng đắn.
 */

/** Video logo intro — cố định, không random. Không dùng `msd` (DSM) vì đó là mục riêng, không phải intro logo của trang chủ. */
export const INTRO_VIDEOS = ["/belwee-logo-intro-a.mp4"] as const;

/**
 * Script nội tuyến cho `<head>`. PHẢI tự chứa (chạy trước mọi module) nên các
 * giá trị được nhúng thẳng vào chuỗi. Trang chủ là trang duy nhất có intro.
 */
export const INTRO_PRELOAD_SCRIPT = `(function(){try{
if(location.pathname!=="/")return;
var l=document.createElement("link");
l.rel="preload";
l.as="video";
l.type="video/mp4";
l.href=${JSON.stringify(INTRO_VIDEOS[0])};
l.setAttribute("fetchpriority","high");
document.head.appendChild(l);
}catch(e){}})();`;
