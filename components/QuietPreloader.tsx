"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Preloader âm thầm (chạy nền, ưu tiên thấp).
 *
 * Mỗi lần tải lại trang, video intro đang là ưu tiên số 1. Trong lúc đó,
 * component này rón rén tải sẵn các tài nguyên nặng của trang hiện tại:
 *  - Ảnh nền khai báo bằng inline `background-image` (vd nền fixed của trang chủ),
 *  - Ảnh <img> chưa lazy,
 *  - Video nền chưa autoplay (vd /belwee-hero.mp4 — sau này chỉ play, không phải chờ tải).
 *
 * Khi intro fade ra, nội dung đã có sẵn trong cache → các hiệu ứng chạy ngay
 * không giật, không phát sinh đợt tải ồ ạt cùng lúc.
 */

const prefetched = new Set<string>();
const URL_RE = /url\(\s*(['"]?)(.*?)\1\s*\)/g;

function addTo(url: string | null | undefined, set: Set<string>) {
  if (!url) return;
  const trimmed = url.trim();
  if (!trimmed || trimmed.startsWith("data:") || trimmed.startsWith("blob:")) return;
  try {
    set.add(new URL(trimmed, window.location.href).href);
  } catch {
    /* bỏ qua URL không hợp lệ */
  }
}

function collectCurrentPageUrls(set: Set<string>) {
  // 1. Mọi ảnh nền inline (background-image: url(...))
  document.querySelectorAll<HTMLElement>("[style]").forEach((el) => {
    const css = el.getAttribute("style") || "";
    if (!css.includes("url(")) return;
    URL_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = URL_RE.exec(css))) addTo(m[2], set);
  });

  // 2. <img> không lazy, chưa tải xong
  document.querySelectorAll<HTMLImageElement>("img").forEach((img) => {
    if (img.loading === "lazy") return;
    if (img.complete) return;
    addTo(img.currentSrc || img.src, set);
  });

  // 3. Video nền chưa bắt đầu (bỏ qua video intro đang autoplay).
  //    Video có `data-quiet-prefetch` LUÔN được đưa vào cache dù đang
  //    `preload="none"` (video nền hero preload-none để không tranh decode với
  //    intro-logo.mp4, nhưng vẫn cần được tải ưu tiên thấp để phát ngay sau đó).
  document.querySelectorAll<HTMLVideoElement>("video").forEach((video) => {
    const forcePrefetch = video.hasAttribute("data-quiet-prefetch");
    if (video.hasAttribute("autoplay")) return;
    if (!forcePrefetch && video.preload === "none") return;
    if (!forcePrefetch && video.readyState > 0) return; // đã có dữ liệu rồi
    const src = video.currentSrc || video.querySelector("source")?.src;
    addTo(src, set);
  });
}

function prefetchQuiet(absUrl: string) {
  if (prefetched.has(absUrl)) return;
  prefetched.add(absUrl);

  const path = new URL(absUrl).pathname;
  const isImage = /\.(?:png|jpe?g|webp|avif|gif|svg|ico|bmp)$/i.test(path);
  const isVideo = /\.(?:mp4|webm|ogg|ogv|mov)$/i.test(path);

  const link = document.createElement("link");
  link.rel = "preload";
  link.as = isImage ? "image" : isVideo ? "video" : "fetch";
  link.href = absUrl;
  try {
    // Ưu tiên thấp → không tranh băng thông với video intro đang phát
    (link as unknown as { fetchPriority?: string }).fetchPriority = "low";
  } catch {
    /* trình duyệt cũ bỏ qua */
  }

  const remove = () => link.remove();
  link.addEventListener("load", remove, { once: true });
  link.addEventListener("error", remove, { once: true });
  window.setTimeout(remove, 15000);

  document.head.appendChild(link);
}

export default function QuietPreloader() {
  const pathname = usePathname();

  useEffect(() => {
    const urls = new Set<string>();
    collectCurrentPageUrls(urls);

    // Chạy trong lúc rảnh để không cướp CPU/GPU khỏi intro đang phát
    const schedule = () => urls.forEach(prefetchQuiet);
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    let handle: number;
    if (typeof w.requestIdleCallback === "function") {
      handle = w.requestIdleCallback(schedule, { timeout: 1500 });
    } else {
      handle = window.setTimeout(schedule, 800);
    }

    return () => {
      if (typeof w.cancelIdleCallback === "function") {
        w.cancelIdleCallback(handle);
      } else {
        window.clearTimeout(handle);
      }
    };
  }, [pathname]);

  return null;
}
