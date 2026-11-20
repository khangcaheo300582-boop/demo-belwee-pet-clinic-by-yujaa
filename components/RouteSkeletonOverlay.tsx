"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getSkeletonForPath } from "@/app/lib/route-skeletons";
import { beginNavGate, endNavGate, getNavPhase, getNavTarget, subscribeNavGate } from "@/lib/navGate";
import { prefersReducedMotion } from "@/lib/motion";
import { releaseBootCurtain } from "@/lib/bootCurtain";

/**
 * Route skeleton overlay — cổng chuyển trang có kiểm soát.
 *
 * 1. Người dùng bấm link (hoặc điều hướng bằng code) → hiện skeleton của trang
 *    đích NGAY LẬP TỨC, trước cả khi RSC/JS của trang đích tải xong.
 * 2. Sau khi trang đích mount, tải trước media trong <main> (ảnh, video, ảnh
 *    nền inline…) để nội dung + hiệu ứng cuộn chạy mượt ngay khi lộ ra.
 * 3. Chỉ khi toàn bộ media trang đích đã tải (hoặc báo lỗi/hết timeout riêng),
 *    mở cổng navGate → skeleton fade out, trang hiện ra cùng hiệu ứng.
 *
 * Trang chủ khi F5 (full load) KHÔNG dùng cổng này — video intro tự xử lý boot;
 * lần mount đầu nếu pathname là `/`, overlay không vẽ gì (yêu cầu "trừ trang
 * chủ": `getSkeletonForPath("/")` trả `null`).
 *
 * LẦN MOUNT CUỐI (F5 / mở URL): trước đây effect pathname bỏ qua lần đầu
 * (`pathname === lastPathRef` khởi tạo bằng nhau), nên rèm pre-paint
 * (lib/bootCurtain.ts) không bao giờ được bàn giao cho skeleton React — nó chỉ
 * thoát nhờ failsafe 4.5s trong CSS, tức là trang đích đã hiện xong người dùng
 *vẫn còn nhìn rèm skeleton tới 3 giây. Nay lần đầu mount với pathname ≠ `/`
 * được coi là lần tải đầu của một trang thường: hiện skeleton React, gọi
 * `releaseBootCurtain()` để rèm CSS mờ đi bên dưới skeleton (cùng token màu →
 * crossfade liền mạch), và chạy toàn bộ `runReveal` (preload media → mở cổng).
 */

const MIN_VISIBLE_MS = 420;
const MIN_VISIBLE_REDUCED_MS = 120;
const PER_URL_TIMEOUT_MS = 2200;
const FADE_MS = 320;
const MAX_MEDIA_URLS = 24;
/**
 * Class reveal trên <html> — kích hoạt animation vào trang (`.template-enter`,
 * khối "HIỆU ỨNG VÀO/RA TRANG" trong globals.css). Gắn đúng lúc mở cổng,
 * gỡ sau REVEAL_HOLD_MS để lần chuyển trang kế tiếp chạy lại từ đầu.
 */
const REVEAL_CLASS = "page-reveal";
const REVEAL_HOLD_MS = 720;

const URL_RE = /url\(\s*(['"]?)(.*?)\1\s*\)/g;
const VIDEO_RE = /\.(?:mp4|webm|ogg|ogv|mov|m4v)$/i;
const IMAGE_RE = /\.(?:png|jpe?g|webp|avif|gif|svg|ico|bmp)$/i;

function toAbsolute(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith("data:") || trimmed.startsWith("blob:")) return null;
  try {
    return new URL(trimmed, window.location.href).href;
  } catch {
    return null;
  }
}

function sameOriginPath(href: string | null): string | null {
  if (!href) return null;
  try {
    const url = new URL(href, window.location.href);
    if (url.origin !== window.location.origin) return null;
    return url.pathname;
  } catch {
    return null;
  }
}

/** Thu thập mọi URL media đang có trong một vùng DOM. */
function collectMediaUrls(root: ParentNode): string[] {
  const urls = new Set<string>();
  const add = (raw: string | null | undefined) => {
    const abs = toAbsolute(raw);
    if (abs) urls.add(abs);
  };

  root.querySelectorAll<HTMLImageElement>("img").forEach((img) => {
    add(img.getAttribute("src"));
    add(img.getAttribute("data-src"));
    const srcset = img.getAttribute("srcset");
    if (srcset) {
      srcset.split(",").forEach((part) => add(part.trim().split(/\s+/)[0]));
    }
  });

  root.querySelectorAll<HTMLVideoElement>("video").forEach((video) => {
    add(video.getAttribute("src"));
    video.querySelectorAll("source").forEach((source) => add(source.getAttribute("src")));
  });

  root.querySelectorAll<HTMLElement>("[style]").forEach((el) => {
    const css = el.getAttribute("style") || "";
    if (!css.includes("url(")) return;
    URL_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = URL_RE.exec(css))) add(match[2]);
  });

  return Array.from(urls);
}

/** Tải trước 1 URL media. Luôn resolve, không bao giờ reject. */
function preloadUrl(absUrl: string): Promise<void> {
  return new Promise<void>((resolve) => {
    let settled = false;
    let timeout = 0;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      resolve();
    };
    timeout = window.setTimeout(finish, PER_URL_TIMEOUT_MS);

    let pathname = "";
    try {
      pathname = new URL(absUrl).pathname;
    } catch {
      finish();
      return;
    }

    if (IMAGE_RE.test(pathname)) {
      const img = new Image();
      img.decoding = "async";
      img.onload = finish;
      img.onerror = finish;
      img.src = absUrl;
      return;
    }

    if (VIDEO_RE.test(pathname)) {
      const video = document.createElement("video");
      video.muted = true;
      video.preload = "auto";
      video.addEventListener("loadeddata", finish, { once: true });
      video.addEventListener("canplay", finish, { once: true });
      video.addEventListener("error", finish, { once: true });
      video.src = absUrl;
      video.load();
      return;
    }

    fetch(absUrl, { credentials: "same-origin" }).then(finish).catch(finish);
  });
}

/** Gắn class reveal lên <html> — bỏ qua nếu khách bật reduced motion. */
function armReveal() {
  if (prefersReducedMotion()) return;
  document.documentElement.classList.add(REVEAL_CLASS);
}

export default function RouteSkeletonOverlay() {
  const pathname = usePathname();
  const router = useRouter();

  const [skeleton, setSkeleton] = useState<React.ReactNode>(null);
  const [visible, setVisible] = useState(false);

  const pathnameRef = useRef(pathname);
  const lastPathRef = useRef(pathname);
  const skeletonPathRef = useRef<string | null>(null);
  const runIdRef = useRef(0);
  const bootDoneRef = useRef(false);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revealTimerRef = useRef<number | null>(null);

  const setVisibleBoth = useCallback((next: boolean) => {
    setVisible(next);
  }, []);

  /** Gỡ class reveal + huỷ timer giữ class (gọi khi skeleton hiện lại để lần
   *  mở cổng sau gắn class mới → animation vào trang chạy lại từ đầu). */
  const clearRevealHold = useCallback(() => {
    if (revealTimerRef.current !== null) {
      window.clearTimeout(revealTimerRef.current);
      revealTimerRef.current = null;
    }
    document.documentElement.classList.remove(REVEAL_CLASS);
  }, []);

  /** Giữ class reveal đủ lâu cho animation chạy xong (0.5s) rồi gỡ. */
  const scheduleRevealHold = useCallback(() => {
    if (revealTimerRef.current !== null) window.clearTimeout(revealTimerRef.current);
    revealTimerRef.current = window.setTimeout(() => {
      revealTimerRef.current = null;
      document.documentElement.classList.remove(REVEAL_CLASS);
    }, REVEAL_HOLD_MS);
  }, []);

  const showSkeleton = useCallback(
    (path: string) => {
      if (fadeTimerRef.current !== null) {
        clearTimeout(fadeTimerRef.current);
        fadeTimerRef.current = null;
      }
      // Gỡ SỚM class reveal của trang trước: điều hướng nhanh liên tiếp thì
      // lần mở cổng sau phải gắn lại class → animation chạy lại từ đầu.
      clearRevealHold();
      skeletonPathRef.current = path;
      setSkeleton(getSkeletonForPath(path));
      setVisibleBoth(true);
    },
    [setVisibleBoth, clearRevealHold]
  );

  const hideSkeleton = useCallback(
    (runId: number) => {
      if (runId !== runIdRef.current) return;
      setVisibleBoth(false);
      if (fadeTimerRef.current !== null) clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = setTimeout(() => {
        if (runId === runIdRef.current) {
          setSkeleton(null);
          skeletonPathRef.current = null;
        }
        fadeTimerRef.current = null;
      }, FADE_MS + 60);
    },
    [setVisibleBoth]
  );

  /**
   * Mở cổng lộ trang — thứ tự thao tác là phần cốt của hiệu ứng:
   *   1. Gắn `page-reveal` → animation `.template-enter` lên lịch chạy.
   *   2. `endNavGate()` → gỡ `page-exit`, nội dung nhìn thấy lại NGAY; hai
   *      bước nằm cùng 1 tick nên không có frame nào chớp nội dung trần.
   *   3. Fade skeleton (hideSkeleton) — trang mới mờ + trượt vào bên dưới.
   */
  const revealNow = useCallback(
    (runId: number) => {
      armReveal();
      scheduleRevealHold();
      endNavGate();
      hideSkeleton(runId);
    },
    [hideSkeleton, scheduleRevealHold]
  );

  /** Tải sẵn media trang đích rồi mở cổng navGate. */
  const runReveal = useCallback(
    (targetPath: string) => {
      const runId = ++runIdRef.current;
      const reduced = prefersReducedMotion();
      const minVisible = reduced ? MIN_VISIBLE_REDUCED_MS : MIN_VISIBLE_MS;
      const startedAt = performance.now();

      const open = () => {
        if (runId !== runIdRef.current) return;
        if (pathnameRef.current !== targetPath) return;
        const wait = Math.max(0, minVisible - (performance.now() - startedAt));
        window.setTimeout(() => {
          if (runId !== runIdRef.current) return;
          if (pathnameRef.current !== targetPath) return;
          revealNow(runId);
        }, wait);
      };

      // Chờ trang đích commit xong 1 frame rồi mới quét DOM.
      //
      // FALLBACK: tab bị ẩn ⇒ `requestAnimationFrame` không fire ⇒ reveal treo
      // ⇒ tấm rèm kẹt ở z-9998 và ăn mất mọi click của người dùng. `setTimeout`
      // thì luôn chạy (dù bị throttle), nên nó chạy cùng lúc với rAF và ai tới
      // trước thì người đó thắng — `started` đảm bảo chỉ chạy một lần.
      let started = false;
      // Kiểu `number` (không phải `ReturnType<typeof setTimeout>` = NodeJS.Timeout)
      // vì biến này được gán bằng `window.setTimeout` — trong DOM lib hàm đó
      // trả về `number`, còn `setTimeout` toàn cục (do @types/node khai báo)
      // trả về `NodeJS.Timeout`. Gán `window.setTimeout` vào biến kiểu Timeout
      // là lỗi type TS2322.
      let fallbackTimer: number | null = null;
      const start = () => {
        if (started) return;
        started = true;
        if (fallbackTimer !== null) {
          window.clearTimeout(fallbackTimer);
          fallbackTimer = null;
        }
        if (runId !== runIdRef.current) return;
        if (pathnameRef.current !== targetPath) return;

        const main = document.querySelector("main") ?? document.body;
        const urls = collectMediaUrls(main).slice(0, MAX_MEDIA_URLS);

        if (urls.length === 0) {
          open();
          return;
        }

        Promise.allSettled(urls.map(preloadUrl)).then(open);
      };

      fallbackTimer = window.setTimeout(start, 200);
      requestAnimationFrame(() => {
        requestAnimationFrame(start);
      });
    },
    [revealNow]
  );

  // Bấm link (<a>) → bật cổng + skeleton tức thì, kể cả link không dùng hook điều hướng.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const targetEl = event.target as Element | null;
      const anchor = targetEl?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;
      if (anchor.dataset.noSkeleton !== undefined) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      if (/^(mailto:|tel:|javascript:|blob:|data:)/i.test(href)) return;

      const path = sameOriginPath(anchor.href);
      if (!path || path === pathnameRef.current) return;

      beginNavGate(path);
      showSkeleton(path);

      try {
        router.prefetch(path);
      } catch {
        /* prefetch là tối ưu, bỏ qua nếu lỗi */
      }

    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [router, showSkeleton]);

  // Cổng do code kích hoạt (useTransitionNavigate, nút menu…) → hiện skeleton ngay.
  useEffect(() => {
    return subscribeNavGate(() => {
      if (getNavPhase() !== "loading") return;
      const target = getNavTarget();
      if (!target || target === pathnameRef.current) return;
      if (skeletonPathRef.current === target) return;
      showSkeleton(target);
    });
  }, [showSkeleton]);

  // Pathname đổi → đảm bảo cổng bật, rồi tải sẵn media và reveal.
  useEffect(() => {
    pathnameRef.current = pathname;

    // MOUNT CUỐI: lần chủ động chạy không có route cũ để so sánh.
    if (!bootDoneRef.current) {
      bootDoneRef.current = true;
      // Trang chủ F5: video intro tự boot — không rèm (script head đã cancel), không skeleton.
      if (pathname !== "/") {
        beginNavGate(pathname);
        if (skeletonPathRef.current !== pathname) {
          showSkeleton(pathname);
        }
        // Nối tiếp rèm pre-paint: skeleton React đã nằm dưới, rèm mờ 320ms
        // rồi gỡ — người dùng chỉ thấy MỘT lớp skeleton liền mạch.
        releaseBootCurtain();
        runReveal(pathname);
      }
      return;
    }

    // Các lần effect chạy lại không đổi route (vd StrictMode dev) thì bỏ qua.
    if (pathname === lastPathRef.current) return;
    lastPathRef.current = pathname;

    beginNavGate(pathname);
    if (skeletonPathRef.current !== pathname) showSkeleton(pathname);
    runReveal(pathname);
  }, [pathname, runReveal, showSkeleton]);

  // Cleanup khi unmount.
  useEffect(() => {
    return () => {
      if (fadeTimerRef.current !== null) clearTimeout(fadeTimerRef.current);
      if (revealTimerRef.current !== null) clearTimeout(revealTimerRef.current);
      document.documentElement.classList.remove(REVEAL_CLASS);
      endNavGate();
    };
  }, []);

  /**
   * Failsafe của tấm rèm: nếu nó còn hiện quá lâu thì buộc gỡ.
   *
   * Rèm là lớp TRANG TRÍ phủ toàn viewport ở `z-index: 9998` và bắt mọi
   * chuột. Bình thường nó tự tắt sau khi reveal xong (media tải xong →
   * mở cổng → fade out). Nhưng reveal dựa vào `requestAnimationFrame`, mà
   * tab bị ẩn thì rAF không fire ⇒ rèm kẹt ⇒ CẢ TRANG chết về mặt chuột:
   * bấm nút ba gạch không ăn, bấm mục trong thẻ menu không ăn.
   *
   * Timer này là lưới an toàn: `setTimeout` luôn chạy (dù bị throttle), nên
   * dù reveal có treo thì rèm cũng phải mở ra. 3.2s > đường đi bình thường
   * (media tối đa 2.2s + 0.42s chờ tối thiểu) nên không cắt ngang.
   */
  useEffect(() => {
    if (!visible) return;
    const timer = window.setTimeout(() => {
      revealNow(runIdRef.current);
    }, 3200);
    return () => window.clearTimeout(timer);
  }, [visible, revealNow]);

  if (!skeleton) return null;

  return (
    <div
      className="fixed inset-0 z-[9998]"
      style={{
        opacity: visible ? 1 : 0,
        transition: `opacity ${FADE_MS}ms cubic-bezier(0.16, 1, 0.3, 1)`,
        pointerEvents: visible ? "auto" : "none",
        contain: "layout style paint",
      }}
      aria-hidden="true"
    >
      {skeleton}
    </div>
  );
}
