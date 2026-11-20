"use client";

/**
 * components/ScrollProgressBar.tsx
 * Thanh tiến độ cuộn mảnh ở đầu trang — phần "hiệu ứng cuộn" của I1.
 *
 * VÌ SAO GHI THẲNG `style.transform` THAY VÌ `setState`
 *   Giá trị này đổi ở MỌI khung hình khi người dùng đang cuộn. Nếu đưa vào
 *   state thì mỗi khung đều kích hoạt một lần render của cây component —
 *   trên mobile đó là nhiều ms mất đi mỗi khung, và React 18 còn phải render
 *   lại các component con. Ghi vào `style.transform` chỉ chạm đúng một node,
 *   không re-render gì.
 *
 * CHỈ ANIMATE `transform`
 *   Không dùng `width`/`left`: đổi width ép trình duyệt tính lại vị trí mọi
 *   khung (layout + paint + composite), mất 60fps trên máy yếu. `scaleX` cộng
 *   thêm `transform-origin: left` chỉ là phép biến đổi trên GPU.
 *
 * `will-change` ĐẶT SẴN LUÔN, KHÔNG ĐỘNG VÀO LÚC CUỘN
 *   Đổi `will-change` khi bắt đầu cuộn sẽ tạo một lần "layer thật" đúng lúc
 *   người dùng vừa bắt đầu cuộn — tức là đúng lúc cần nó nhất nhưng lại tốn
 *   chi phí nhất. Thanh này luôn hiện và chiếm 3px, đặt sẵn vô hại.
 *
 * ẨN TRÊN THIẾT BỊ CẢM ỨNG
 *   Không `pointer-events` và `aria-hidden` vì thanh là thuần trang trí — nó
 *   không điều khiển gì và không có nội dung cho trình đọc màn hình.
 */

import { useEffect, useRef } from "react";

export default function ScrollProgressBar() {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;

    let frame = 0;

    /** Đọc vị trí cuộn một lần mỗi khung, rồi viết ra thanh. */
    const update = () => {
      frame = 0;
      const doc = document.documentElement;
      // `scrollHeight - clientHeight` = chiều dài cuộn tối đa. Dùng
      // `documentElement` chứ không phải `body`: body cao bằng nội dung nên
      // clientHeight lấy nhầm trên Safari.
      const max = doc.scrollHeight - doc.clientHeight;
      const ratio = max > 0 ? Math.min(doc.scrollTop / max, 1) : 0;
      bar.style.transform = `scaleX(${ratio})`;
    };

    /** Người dùng cuộn liên tục → chỉ cập nhật 1 lần/khung, bỏ các sự kiện dư. */
    const onScroll = () => {
      if (frame === 0) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    // Nội dung tải thêm (ảnh lazy, route mới) làm chiều cao trang đổi mà
    // không phát `scroll` → phải tính lại khi kích thước viewport đổi.
    window.addEventListener("resize", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px] origin-left"
      style={{ willChange: "transform", transform: "scaleX(0)" }}
    >
      <div
        ref={barRef}
        className="h-full w-full origin-left bg-gradient-to-r from-sky-400 via-cyan-300 to-amber-300"
      />
    </div>
  );
}
