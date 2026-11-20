"use client";

import { useEffect, useState } from "react";

/**
 * hooks/useNavState.ts
 *
 * Trạng thái cuộn của navbar — MỘT nguồn sự thật duy nhất cho `data-state`:
 *
 *   "top"      scrollY < TOP_THRESHOLD            → trong suốt, không blur
 *   "compact"  cuộn XUỐNG, đã rời đỉnh           → thu nhỏ, kính lỏng
 *   "expanded" cuộn LÊN, đã rời đỉnh             → full size, VẪN kính lỏng
 *
 * ── CƠ CHẾ ──────────────────────────────────────────────────────────────────
 * • Listener `passive`, mỗi frame chỉ MỘT lần đọc `window.scrollY` (rAF).
 * • Mốc so sánh là ĐỈNH/ĐÁY gần nhất của hành trình, không phải frame trước:
 *   cuộn chậm 2px/frame vẫn tích lũy đủ Δ ≥ DELTA_THRESHOLD để kích hoạt.
 *   (Đo delta so với frame trước sẽ bỏ sót các cú cuộn chậm.)
 * • Dưới TOP_THRESHOLD luôn về "top" bất kể hướng, nên navbar trong suốt
 *   trở lại ngay khi chạm gần đỉnh.
 *
 * ── VÌ SAO KHÔNG setState mỗi frame ─────────────────────────────────────────
 * Chỉ gọi setState khi trạng thái THAY ĐỔI thật sự; giữa hai lần đổi trạng
 * thái thì rAF vẫn chạy nhưng không render lại React.
 */

export type NavState = "top" | "compact" | "expanded";

/** Dưới ngưỡng này coi như "đang ở đỉnh trang". */
const TOP_THRESHOLD = 24;
/**
 * Δ tối thiểu (px) so với mốc đổi hướng gần nhất — hysteresis 7px để thanh
 * không nháy liên tục khi người dùng cuộn rất chậm quanh ngưỡng chuyển trạng
 * thái. Ngưỡng vào/ra trạng thái đầu trang (TOP_THRESHOLD) KHÔNG đổi.
 */
const DELTA_THRESHOLD = 7;

export function useNavState(): NavState {
  const [state, setState] = useState<NavState>("top");

  useEffect(() => {
    const startY = window.scrollY;
    let peak = startY;
    let lastState: NavState = startY < TOP_THRESHOLD ? "top" : "compact";
    let frame = 0;

    const update = () => {
      frame = 0;
      const y = window.scrollY;

      let next: NavState = lastState;
      if (y < TOP_THRESHOLD) {
        next = "top";
        peak = y;
      } else if (y > peak + DELTA_THRESHOLD) {
        next = "compact";
        peak = y;
      } else if (y < peak - DELTA_THRESHOLD) {
        next = "expanded";
        peak = y;
      }

      if (next !== lastState) {
        lastState = next;
        setState(next);
      }
    };

    const schedule = () => {
      if (frame === 0) frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", schedule, { passive: true });

    return () => {
      window.removeEventListener("scroll", schedule);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return state;
}

export default useNavState;
