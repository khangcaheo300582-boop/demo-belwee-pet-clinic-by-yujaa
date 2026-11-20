"use client";

/**
 * Navigation gate — cổng chặn hiển thị nội dung trong lúc chuyển trang.
 *
 * Luồng: người dùng bấm link → `beginNavGate(path)` được gọi NGAY (trước khi
 * RSC tải xong) → overlay skeleton hiện lên, các hiệu ứng nội dung bị hoãn
 * (xem `usePageReady`) → RouteSkeletonOverlay tải sẵn media của trang đích rồi
 * gọi `endNavGate()` để mở cổng, nội dung + hiệu ứng xuất hiện.
 *
 * File này cũng là CHỦ SỞ HỮU DUY NHẤT của class `page-exit` trên <html>
 * (trang cũ mờ dần khi chuyển trang — CSS trong khối "HIỆU ỨNG VÀO/RA TRANG"
 * của globals.css). Trước đây `useTransitionNavigate` tự thêm/gỡ class này
 * nhưng CSS không tồn tại → hiệu ứng chết. Giờ một nơi quản lý, và mọi đường
 * thoát (reveal, failsafe 3.2s, auto-release 8s, unmount) đều đi qua
 * `endNavGate` nên class không bao giờ bị kẹt.
 *
 * Cơ chế auto-release giống `introGate` để tránh kẹt cổng nếu điều hướng lỗi.
 */

import { prefersReducedMotion } from "./motion";

export type NavPhase = "idle" | "loading";

const AUTO_RELEASE_MS = 8000;

/** Class gắn lên <html> trong lúc trang cũ mờ dần nhường chỗ skeleton. */
const PAGE_EXIT_CLASS = "page-exit";

/** Bắt đầu hiệu ứng thoát trang (bỏ qua nếu khách bật reduced motion). */
function armPageExit() {
  if (typeof window === "undefined") return;
  if (prefersReducedMotion()) return;
  document.documentElement.classList.add(PAGE_EXIT_CLASS);
}

/** Gỡ hiệu ứng thoát trang — nội dung trở lại nhìn thấy ngay (fade-in là
 *  việc của `.template-enter` + class `page-reveal` của RouteSkeletonOverlay). */
function clearPageExit() {
  if (typeof window === "undefined") return;
  document.documentElement.classList.remove(PAGE_EXIT_CLASS);
}

let phase: NavPhase = "idle";
let target: string | null = null;
let releaseTimer: ReturnType<typeof setTimeout> | null = null;

const subscribers = new Set<() => void>();

function notify() {
  subscribers.forEach((fn) => fn());
}

export function getNavPhase(): NavPhase {
  return phase;
}

export function getNavTarget(): string | null {
  return target;
}

export function subscribeNavGate(callback: () => void): () => void {
  subscribers.add(callback);
  return () => {
    subscribers.delete(callback);
  };
}

export function beginNavGate(path: string) {
  target = path;
  const changed = phase !== "loading";
  phase = "loading";

  // Trang cũ mờ dần NGAY từ lúc bấm link (trước khi skeleton kịp hiện lên).
  armPageExit();

  if (typeof window !== "undefined" && releaseTimer === null) {
    releaseTimer = setTimeout(() => {
      releaseTimer = null;
      endNavGate();
    }, AUTO_RELEASE_MS);
  }

  if (changed) notify();
}

export function endNavGate() {
  if (typeof window !== "undefined" && releaseTimer !== null) {
    clearTimeout(releaseTimer);
    releaseTimer = null;
  }

  // Gỡ class exit TRƯỚC khi early-return: mọi đường mở cổng đều đi qua đây,
  // đây là chỗ duy nhất bảo đảm nội dung không kẹt ở trạng thái mờ.
  clearPageExit();

  if (phase === "idle" && target === null) return;

  phase = "idle";
  target = null;
  notify();
}
