"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { gsap, ScrollTrigger, prefersReducedMotion } from "@/lib/gsap";
import { usePageReady } from "@/hooks/usePageReady";

// Bảng variant dùng CHUNG với components/Reveal.tsx (hạng mục A7) — xem đầu
// lib/revealVariants.ts để rõ vì sao: hai bản sao đã lệch nhau (zoom 0.92 vs
// 0.9, flip-y 45° vs 40°) nên cùng một tên variant cho hai chuyển động khác
// nhau tuỳ theo đường vào.
import {
  normalizeRevealVariant,
  REVEAL_FROM as VARIANT_FROM,
  REVEAL_TO,
  type RevealVariant as VariantKey,
} from "@/lib/revealVariants";

const HEADING_SELECTOR = "h1,h2,h3,h4,h5,h6";

/**
 * Vì sao không dùng `autoAlpha` cho mọi thứ.
 *
 * `autoAlpha` của GSAP = `opacity` + `visibility`. Khi opacity về 0 nó đặt
 * `visibility: hidden`, và `visibility: hidden` **xoá phần tử khỏi cây trợ năng**
 * (accessibility tree). Hệ quả thật, không phải lý thuyết:
 *
 *   - Trên trang chủ, tiêu đề `<h2>` của khối dịch vụ nằm dưới fold và dùng
 *     `data-reveal-exit`. Trước khi cuộn tới, nó là `visibility: hidden`, nên
 *     screen reader (và axe-core) **không thấy** nó → `<h3>` trong thẻ carousel
 *     trở thành heading đầu tiên sau `<h1>` → nhảy cấp h1 → h3, vi phạm
 *     WCAG 1.3.1. Lighthouse bắt được đúng lỗi này (`heading-order`).
 *   - Ngoài ra `visibility` cũng trái với ràng buộc của dự án: animation chỉ
 *     được đụng `transform` / `opacity`.
 *
 * Nên: tiêu đề (và mọi phần tử chứa tiêu đề) dùng `opacity` thuần — ẩn bằng mắt
 * nhưng assistive tech vẫn đọc được cấu trúc. Vì `opacity: 0` **không** chặn
 * chuột, ta cặp thêm `pointerEvents` để phần tử chưa hiện vẫn không bấm được.
 * Phần tử không có tiêu đề thì giữ `autoAlpha` như cũ: `visibility: hidden`
 * vừa ẩn vừa chặn tương tác, không cần thêm `pointerEvents`.
 */
function keepsInA11yTree(el: HTMLElement): boolean {
  return (
    el.matches(HEADING_SELECTOR) ||
    el.closest(HEADING_SELECTOR) !== null ||
    el.querySelector(HEADING_SELECTOR) !== null
  );
}

/** Bản sao của `src` bỏ `autoAlpha` — dùng khi ta thay bằng `opacity` + pointerEvents. */
function withoutAutoAlpha(src: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(src)) {
    if (key !== "autoAlpha") out[key] = src[key];
  }
  return out;
}

/** Trạng thái "ẩn" cho tween reveal, chọn theo việc có giữ tiêu đề trong a11y tree không. */
function fadeFrom(el: HTMLElement, variant: VariantKey): Record<string, unknown> {
  if (!keepsInA11yTree(el)) return VARIANT_FROM[variant];
  return { ...withoutAutoAlpha(VARIANT_FROM[variant]), opacity: 0, pointerEvents: "none" };
}

/** Trạng thái "hiện" tương ứng — `pointerEvents` chỉ thêm khi dùng nhánh `opacity`. */
function fadeTo(el: HTMLElement): Record<string, unknown> {
  if (!keepsInA11yTree(el)) return REVEAL_TO;
  return { ...withoutAutoAlpha(REVEAL_TO), opacity: 1, pointerEvents: "auto" };
}

/**
 * Global GSAP + ScrollTrigger scanner.
 * - Tự động animate mọi phần tử có attribute `data-reveal` (opt-in, an toàn).
 * - Attribute có thể mang variant: data-reveal="fade-left" / "blur" / v.v.
 * - Hỗ trợ data-delay (giây) và kiểu bắt buộc data-reveal-stagger.
 * - Lọc lại khi đổi route (client-side navigation).
 */
export default function AnimationProvider() {
  const pathname = usePathname();
  // Chỉ quét & chạy hiệu ứng khi intro bắt đầu fade ra — nếu không, các phần tử
  // data-reveal nằm trong khung hình đầu sẽ "bắn" ngầm phía sau overlay intro và
  // biến mất trước khi người dùng nhìn thấy (mất hiệu ứng xuất hiện khi cuộn).
  const pageReady = usePageReady();

  useEffect(() => {
    if (!pageReady) return;
    if (prefersReducedMotion()) return;
    if (typeof document === "undefined") return;

    let cancelled = false;
    let ctx: gsap.Context | null = null;
    let loadHandler: (() => void) | null = null;
    const imgCleanups: (() => void)[] = [];
    // Gom mọi nhu cầu refresh về 1 lần duy nhất mỗi frame. Trước đây mỗi ảnh
    // lazy-load xong + sự kiện load gọi ScrollTrigger.refresh() riêng → đợt
    // "đo lại toàn bộ trigger" dồn dập ngay khi vừa hết intro, hoặc lặp lại
    // khi cuộn qua khúc nhiều ảnh → chính là cảm giác "giật giật rồi hiển thị".
    let refreshQueued = false;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = () => {
      if (cancelled) return;
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        refreshTimer = null;
        if (refreshQueued || cancelled) return;
        refreshQueued = true;
        requestAnimationFrame(() => {
          refreshQueued = false;
          if (!cancelled) ScrollTrigger.refresh();
        });
      }, 220);
    };

    const run = () => {
      const main = document.querySelector("main");
      if (!main || cancelled) return;

      ctx = gsap.context(() => {
        // 1. ScrollTrigger refresh sau khi load (gộp chung, đã throttle rAF)
        loadHandler = () => scheduleRefresh();
        if (document.readyState === "complete") {
          loadHandler();
        } else {
          window.addEventListener("load", loadHandler, { once: true });
        }

        // 2. Tự động animate các element data-reveal
        const revealEls = Array.from(main.querySelectorAll<HTMLElement>("[data-reveal]"));
        revealEls.forEach((el) => {
          const variant = normalizeRevealVariant(el.getAttribute("data-reveal"));
          const delay = parseFloat(el.getAttribute("data-delay") || "0") || 0;

          // Chế độ hai chiều (data-reveal-exit): phần tử tan dần vào khi xuất hiện
          // và tan dần ra khi bị cuộn khỏi vùng nhìn — scrub theo vị trí cuộn nên
          // không cần listener scroll (mượt, không rung/lag).
          if (el.hasAttribute("data-reveal-exit")) {
            const keepTree = keepsInA11yTree(el);
            gsap.timeline({
              scrollTrigger: {
                trigger: el,
                start: "top 96%",
                end: "bottom 30%",
                scrub: 0.6,
              },
            })
              .fromTo(el, fadeFrom(el, variant), { ...fadeTo(el), duration: 1, ease: "none" }, 0)
              .to(
                el,
                keepTree
                  ? { opacity: 0, pointerEvents: "none", y: -32, scale: 0.98, duration: 1, ease: "none" }
                  : { autoAlpha: 0, y: -32, scale: 0.98, duration: 1, ease: "none" },
                1
              );
            return;
          }

          gsap.fromTo(
            el,
            fadeFrom(el, variant),
            {
              ...fadeTo(el),
              duration: 0.9,
              delay,
              ease: "power3.out",
              clearProps: "filter",
              scrollTrigger: {
                trigger: el,
                start: "top 88%",
                once: true,
              },
            }
          );
        });

        // 3. Stagger cho các nhóm con bên trong [data-reveal-group]
        const groups = Array.from(main.querySelectorAll<HTMLElement>("[data-reveal-group]"));
        groups.forEach((group) => {
          const children = Array.from(group.children) as HTMLElement[];
          if (!children.length) return;
          // Cả nhóm dùng chung một nhánh ẩn/hiện: GSAP nhận `toVars` dạng đơn
          // và áp cho mọi target, nên quyết định theo cả nhóm. Nhóm nào chứa
          // tiêu đề thì dùng `opacity` để giữ cấu trúc heading cho screen reader;
          // nhóm còn lại giữ `autoAlpha` như trước.
          const keepTree = keepsInA11yTree(group);
          gsap.fromTo(
            children,
            keepTree ? { opacity: 0, y: 44, pointerEvents: "none" } : { autoAlpha: 0, y: 44 },
            {
              ...(keepTree ? { opacity: 1, pointerEvents: "auto" } : { autoAlpha: 1 }),
              y: 0,
              duration: 0.8,
              ease: "power3.out",
              stagger: 0.12,
              scrollTrigger: {
                trigger: group,
                start: "top 85%",
                once: true,
              },
            }
          );
        });

        // 4. Refresh gộp khi ảnh lazy load xong (đã throttle — không refresh
        //    dồn dập mỗi ảnh, tránh đo lại trigger giữa chừng khi cuộn).
        const images = Array.from(main.querySelectorAll("img"));
        images.forEach((img) => {
          if (img.complete) return;
          img.addEventListener("load", scheduleRefresh, { once: true });
          imgCleanups.push(() => img.removeEventListener("load", scheduleRefresh));
        });
      }, main);
    };

    // Nhường một frame để client-side content render xong (tránh tạo ScrollTrigger
    // khi layout chưa ổn định → vị trí trigger sai rồi tự sửa 1 lần giữa cuộn).
    const raf = requestAnimationFrame(() => {
      if (!cancelled) run();
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      if (refreshTimer) clearTimeout(refreshTimer);
      if (loadHandler) window.removeEventListener("load", loadHandler);
      imgCleanups.forEach((fn) => fn());
      imgCleanups.length = 0;
      ctx?.revert();
      ctx?.kill();
      ctx = null;
    };
  }, [pathname, pageReady]);

  return null;
}
