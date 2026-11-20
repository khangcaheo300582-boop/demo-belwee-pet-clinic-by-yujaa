"use client";

/**
 * hooks/useScrollProgress.ts
 *
 * Tiến độ cuộn của MỘT phần tử, trả về `MotionValue<number>` (0 → 1).
 *
 * ── VÌ SAO KHÔNG DÙNG `useScroll({ target })` CỦA FRAMER-MOTION ──────────────
 * Đo được trên Chrome thật (không phải headless), localhost:3001:
 *
 *   useScroll({ target, offset: ["start 90%", "center 45%"] })   → chạy ✅
 *   useScroll({ target, offset: ["start start", "end start"] })   → ĐỨNG YÊN ❌
 *
 * Cùng thư viện, cùng `target`, chỉ khác chuỗi `offset`. Framer-motion 13 bật
 * đường tăng tốc bằng **native ViewTimeline** khi trình duyệt hỗ trợ
 * (`can-use-native-timeline.mjs` → `supportsViewTimeline()`), và đường đó
 * không phát ra giá trị cho khoảng offset dạng `start/end` khi phần tử cao
 * đúng bằng một viewport (hero là `min-h-screen`) — MotionValue đứng ở 0.
 *
 * Hệ quả nếu cứ dùng `useScroll`: hiệu ứng A1 (cross-fade nền) **không bao giờ
 * chạy**, và ta sẽ tưởng nó chạy vì không có lỗi console.
 *
 * ── VÌ SAO CÁCH NÀY CHẮC CHẮN CHẠY ──────────────────────────────────────────
 * Đây đúng là kỹ thuật mà dự án đã dùng và **đã đo là chạy** ở ba nơi:
 *   • `components/ScrollProgressBar.tsx`   — rAF + `documentElement.scrollTop`
 *   • `components/SiteNavbar.tsx`          — rAF + `window.scrollY`
 *   • effect "mờ dần tiêu đề dịch vụ" trong `app/page.tsx` — rAF + `getBoundingClientRect()`
 * Cả ba đều cập nhật đúng ở mọi mốc cuộn khi đo bằng cả `window.scrollTo`
 * lẫn cuộn chuột thật. Hook này chỉ gom kỹ thuật đó lại một chỗ.
 *
 * ── RÀNG BUỘC ───────────────────────────────────────────────────────────────
 * • Listener `passive`, và chỉ MỘT lần ghi DOM cho mỗi khung hình (rAF).
 * • KHÔNG `setState` ⇒ mỗi pixel cuộn không render lại React.
 * • Người gọi vẫn dùng `useTransform` để ánh xạ 0→1 thành giá trị hiển thị,
 *   nên phần "biến số" của hiệu ứng vẫn là MotionValue thuần (compositor).
 */

import { useEffect } from "react";
import { useMotionValue, type MotionValue } from "framer-motion";
import { prefersReducedMotion } from "@/lib/motion";

export interface ScrollProgressOptions {
  /**
   * Cạch nào của phần tử chạm `fromVh` (theo % chiều cao viewport) ⇒ progress 0.
   * Mặc định `"start"` = mép trên.
   */
  fromAnchor?: "start" | "bottom";
  /**
   * Cạch chạm `toVh` ⇒ progress 1.
   *
   * Mặc định `"bottom"` — tức mặc định hook tương đương `["start start",
   * "end start"]`: chạy từ lúc mép trên chạm đỉnh viewport tới lúc mép dưới
   * chạm đỉnh viewport (hết đúng một chiều cao phần tử).
   *
   * ⚠️ ĐỪNG đổi mặc định này thành `"start"`: với `fromVh = toVh = 0` hai mốc
   * sẽ trùng nhau ⇒ `span === 0` ⇒ nhánh `return` bên dưới ⇒ MotionValue đứng
   * yên 0 vĩnh viễn MÀ KHÔNG có lỗi nào. Đã mắc phải đúng lỗi đó một lần khi
   * viết hook cho hero; đừng tái phạm.
   */
  toAnchor?: "start" | "center" | "bottom";
  /** Mép trên chạm 0% chiều cao viewport. */
  fromVh?: number;
  /** Mốc kết thúc, % chiều cao viewport. */
  toVh?: number;
  /**
   * Giá trị dùng khi người dùng bật "giảm chuyển động" — mặc định `1` tức là
   * hiệu ứng ở TRẠNG THÁI CUỐI ngay lập tức (bền mặt đã hoàn chỉnh) thay vì
   * chạy theo cuộn. Đặt `0` nếu hiệu ứng nên "không xảy ra" khi giảm chuyển động.
   */
  reducedValue?: number;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export default function useScrollProgress(
  ref: React.RefObject<HTMLElement>,
  {
    fromAnchor = "start",
    toAnchor = "bottom",
    fromVh = 0,
    toVh = 0,
    reducedValue = 1,
  }: ScrollProgressOptions = {}
): MotionValue<number> {
  const progress = useMotionValue(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // ── Giảm chuyển động: nhảy thẳng tới trạng thái CUỐI, không gắn listener ──
    // Quyết định nằm ở ĐÂY thay vì trong component gọi, vì:
    //   • chỉ MỘT nơi biết "giảm chuyển động" tương tác với hiệu ứng cuộn;
    //   • component gọi không phải setState ⇒ không có lần render thứ hai và
    //     không có khoảng thời gian mà hiệu ứng vẫn chạy dù đã bật giảm chuyển động;
    //   • đọc media query trong effect ⇒ server và client render giống nhau.
    if (prefersReducedMotion()) {
      progress.set(reducedValue);
      return;
    }

    let frame = 0;

    const update = () => {
      frame = 0;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || 1;

      // Giá trị `rect.top` (px tính từ mép trên viewport) ứng với progress = 0
      // và progress = 1.
      const fromPx = fromAnchor === "bottom" ? (fromVh / 100) * vh - rect.height : (fromVh / 100) * vh;
      const toPx =
        toAnchor === "bottom"
          ? (toVh / 100) * vh - rect.height
          : toAnchor === "center"
            ? (toVh / 100) * vh - rect.height / 2
            : (toVh / 100) * vh;

      const span = fromPx - toPx;
      // `span === 0` xảy ra khi hai mốc trùng nhau — chia 0 sẽ ra NaN và
      // làm hỏng mọi phép biến đổi phía dưới. Giữ nguyên giá trị cuối.
      if (span === 0) return;
      progress.set(clamp01((fromPx - rect.top) / span));
    };

    const schedule = () => {
      if (frame === 0) frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });

    // Nội dung tải thêm (ảnh lazy, section mới) làm vị trí phần tử dịch mà
    // không phát `scroll` ⇒ tính lại khi kích thước phần tử đổi.
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(schedule);
      ro.observe(el);
    }

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      ro?.disconnect();
    };
  }, [ref, fromAnchor, toAnchor, fromVh, toVh, reducedValue, progress]);

  return progress;
}