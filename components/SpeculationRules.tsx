"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { subscribeIntro, getIntroPhase, type IntroPhase } from "@/lib/introGate";

/**
 * Speculation Rules API (Chrome 108+ prefetch, 121+ prerender) + router.prefetch fallback.
 *
 * Mục tiêu: tải sẵn / chạy ngầm TẤT CẢ các trang công khai trước, để mỗi lần
 * người dùng cuộn tới một phần trang hoặc bấm chuyển hướng, hiệu ứng chạy mượt
 * 100% (JS, ảnh, video, font đều đã nằm trong cache/đã render sẵn).
 *
 * Chiến lược hai pha để không cướp tài nguyên khỏi trang đang dùng:
 *  1. PHA 1 — prefetch (eagerness "moderate"): trình duyệt tự quyết định tải
 *     HTML/JS/data của MỌI trang công khai với ưu tiên thấp. Nhẹ, chạy ngay.
 *  2. PHA 2 — prerender (eagerness "eager"): render đầy đủ mọi trang trong một
 *     tab ẩn. CHỈ chạy khi (a) intro video đã kết thúc và (b) trình duyệt đang
 *     rảnh (requestIdleCallback), có timeout tối đa để không hoãn mãi.
 *
 * - Với trình duyệt không hỗ trợ Speculation Rules (Firefox, Safari...), ta bù
 *   bằng `router.prefetch()` của Next.js.
 *
 * Chỉ các trang tĩnh, công khai được đưa vào. Các route cần xác thực hoặc mang
 * dữ liệu người dùng (/dang-nhap, /trang-ca-nhan, ...) bị loại trừ để tránh
 * render trạng thái sai / rò rỉ dữ liệu cá nhân.
 */

const ALL_PAGES = [
  "/",
  "/dich-vu",
  "/gioi-thieu",
  "/kien-thuc-thu-y",
  "/tuyen-dung",
  "/ChiTietBookingForm",
  "/booking/kham-benh",
  "/booking/tiem-ngua",
  "/booking/khach-san",
  "/booking/spa-grooming",
];

const IDLE_TIMEOUT_MS = 4000;
const FALLBACK_DELAY_MS = 1500;
/**
 * PERF: prerender CHỈ 3 trang mỗi lần điều hướng. Prerender = Chrome mở tab
 * ẩn chạy đầy đủ JS + animation + video của trang đó. Prerender cùng lúc 9
 * trang ngay sau intro (đúng lúc trang chủ đang chạy hero video + particle
 * field + GSAP) → tranh chấp CPU/GPU mạnh, máy yếu đứng máy vài giây.
 * Chrome tự prerender thêm các trang còn lại ở những lần điều hướng sau;
 * banner “No speculative URLs to prerender” trong DevTools là bình thường.
 */
const PRERENDER_LIMIT = 3;

function supportsSpeculationRules(): boolean {
  try {
    return typeof HTMLScriptElement.supports === "function" && HTMLScriptElement.supports("speculationrules");
  } catch {
    return false;
  }
}

function prefersReducedData(): boolean {
  try {
    if (typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-data: reduce)").matches) return true;
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    return Boolean(conn?.saveData);
  } catch {
    return false;
  }
}

function requestIdle(cb: () => void): number {
  const w = window as Window & {
    requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
  };
  if (typeof w.requestIdleCallback === "function") {
    return w.requestIdleCallback(cb, { timeout: IDLE_TIMEOUT_MS });
  }
  return window.setTimeout(cb, FALLBACK_DELAY_MS);
}

function cancelIdle(handle: number): void {
  const w = window as Window & { cancelIdleCallback?: (id: number) => void };
  if (typeof w.cancelIdleCallback === "function") {
    w.cancelIdleCallback(handle);
  } else {
    window.clearTimeout(handle);
  }
}

export default function SpeculationRules() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (prefersReducedData()) return;

    const otherPages = ALL_PAGES.filter((url) => url !== pathname);
    if (otherPages.length === 0) return;

    // --- Bù cho trình duyệt không hỗ trợ Speculation Rules ---
    if (!supportsSpeculationRules()) {
      otherPages.forEach((url) => router.prefetch(url));
      return;
    }

    let cancelled = false;
    let idleHandle: number | null = null;
    let unsubscribeIntro: (() => void) | null = null;
    const scripts: HTMLScriptElement[] = [];

    const injectRules = (rules: unknown) => {
      const script = document.createElement("script");
      script.type = "speculationrules";
      script.textContent = JSON.stringify(rules);
      script.addEventListener("error", () => script.remove());
      document.head.appendChild(script);
      scripts.push(script);
    };

    // --- PHA 1: prefetch nhẹ nhàng, ưu tiên thấp, chạy ngay ---
    injectRules({
      prefetch: [
        { source: "list", urls: otherPages, eagerness: "moderate" },
      ],
    });

    // --- PHA 2: prerender đầy đủ — chỉ khi intro xong + trình duyệt rảnh.
    // Giới hạn 3 trang (xem PRERENDER_LIMIT) theo thứ tự ưu tiên: trang chủ
    // trước, sau đó tới trang đích từ menu (đặt đầu danh sách ALL_PAGES). ---
    const startPrerender = () => {
      if (cancelled) return;
      idleHandle = requestIdle(() => {
        if (cancelled) return;
        injectRules({
          prerender: [
            { source: "list", urls: otherPages.slice(0, PRERENDER_LIMIT), eagerness: "eager" },
          ],
        });
      });
    };

    const phase: IntroPhase = getIntroPhase();
    if (phase === "done") {
      startPrerender();
    } else {
      unsubscribeIntro = subscribeIntro((next: IntroPhase) => {
        if (next === "done") {
          unsubscribeIntro?.();
          unsubscribeIntro = null;
          startPrerender();
        }
      });
    }

    return () => {
      cancelled = true;
      unsubscribeIntro?.();
      unsubscribeIntro = null;
      if (idleHandle !== null) cancelIdle(idleHandle);
      // Xoá script sẽ thu hồi các speculation rules.
      scripts.forEach((s) => s.remove());
      scripts.length = 0;
    };
  }, [pathname, router]);

  return null;
}