"use client";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";

gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

// PERF chung: bỏ qua sự kiện resize trên di động mà không thực sự đổi hướng
// màn hình (trình duyệt mobile gửi resize ảo khi thanh địa chỉ co/gập → trước
// đây ScrollTrigger.refresh() chạy liên tục, đo lại toàn bộ trigger giữa chừng
// khi cuộn → giật). Với desktop không đổi gì.
if (typeof window !== "undefined") {
  ScrollTrigger.config({ ignoreMobileResize: true });
}

// Motion policy now lives in lib/motion.ts. Re-exported here because five
// components already import it from this module; routing through one place
// stops the GSAP gates and the hand-written CSS from disagreeing.
export { prefersReducedMotion } from "./motion";

gsap.defaults({ ease: "power3.out", duration: 0.8 });

export { gsap, ScrollTrigger, ScrollToPlugin };
