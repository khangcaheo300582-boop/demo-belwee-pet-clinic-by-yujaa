"use client";

import { useEffect, useState } from "react";
import { subscribeIntro, type IntroPhase } from "@/lib/introGate";
import { getNavPhase, subscribeNavGate } from "@/lib/navGate";

/**
 * Trả về `true` khi trang đã sẵn sàng chạy hiệu ứng nội dung:
 *  - Intro đã vào pha "fading" (bắt đầu mờ đi) hoặc "done", VÀ
 *  - Cổng chuyển trang (navGate) đang "idle" — tức media của trang đích đã
 *    được tải sẵn xong (xem RouteSkeletonOverlay).
 *
 * Dùng để gated mọi hiệu ứng (hero, marquee, scroll reveal...) nhằm tránh
 * chạy ngầm sau overlay intro hoặc sau skeleton khi chuyển trang.
 */
export function usePageReady(): boolean {
  const [introReady, setIntroReady] = useState(false);
  const [navIdle, setNavIdle] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeIntro((next: IntroPhase) => {
      // Phải đặt lại cả hai chiều: khi quay về "/" từ trang khác, intro đổi
      // "done" → "playing" và nội dung phải bị đóng cổng lại cho tới khi video
      // tan. Chỉ bật một lần (như bản cũ) thì lần chơi thứ hai sẽ chạy hiệu
      // ứng xuyên qua lớp intro.
      setIntroReady(next === "fading" || next === "done");
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    setNavIdle(getNavPhase() === "idle");
    return subscribeNavGate(() => {
      setNavIdle(getNavPhase() === "idle");
    });
  }, []);

  return introReady && navIdle;
}
