"use client";

/**
 * hooks/useHeroReveal.ts
 *
 * Một timeline GSAP duy nhất cho màn "hé lộ" hero sau khi video intro tan:
 *
 *   0.00  video nền zoom 1.14 → 1 (cinematic)
 *   0.00  lớp ambient (aurora, flare, sparkles) hiện dần
 *   0.72  overlay intro đã tan xong (INTRO_FADE_MS = 700ms) → bắt đầu lộ chữ
 *   0.72  từng ký tự tiêu đề nhô lên + xoay 3D nhẹ, vệt sáng kính lướt qua
 *   0.94  các ký tự accent ("!!!") bật nảy riêng, đậm hơn phần còn lại
 *   ~1.5  phụ đề được "gõ" từng ký tự, caret bám đúng vị trí layout
 *   ~3.0  CTA hiện lên, quầng sáng thở nhẹ
 *   ~3.3  dock hành động nhanh stagger từng viên
 *   ~4.0  gợi ý cuộn xuống
 *
 * ── NGUYÊN TẮC ───────────────────────────────────────────────────────────────
 * • Mốc bắt đầu lấy từ `INTRO_FADE_MS` (lib/introGate.ts) thay vì số 0.72 viết
 *   tay: nếu ai đó đổi thời lượng fade, cả hai phía đổi cùng lúc.
 * • NGAY khi effect chạy, mọi target được `gsap.set` về trạng thái ẩn. Nhờ vậy
 *   không có một khung hình nào lộ nội dung "đã xong" trong lúc overlay còn
 *   đang tan (nếu chỉ dựa vào `fromTo` đặt ở mốc 0.72, khoảng trước đó vẫn là
 *   trạng thái cuối của HTML).
 * • Chỉ `transform` / `opacity` — không `filter`, không đổi layout. Tiêu đề có
 *   ~20 ký tự và phụ đề ~100 ký tự; blur/filter trên từng ký tự sẽ đẩy GPU
 *   nhưng gần như không nhìn ra khác biệt ở cỡ chữ này.
 * • Reduced-motion: thoát ngay, KHÔNG đặt trạng thái ẩn nào ⇒ tiêu đề, phụ đề,
 *   CTA và dock hiện đầy đủ như HTML tĩnh.
 */

import { useEffect, type RefObject } from "react";
import { gsap, prefersReducedMotion } from "@/lib/gsap";
import { INTRO_FADE_MS } from "@/lib/introGate";

/** Bắt đầu hé lộ đúng lúc overlay intro vừa tan xong (+ 1 nhịp thở). */
const REVEAL_AT = INTRO_FADE_MS / 1000 + 0.02;

function isFinePointer(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(pointer: fine)").matches && window.innerWidth >= 768
  );
}

export function useHeroReveal(
  heroRef: RefObject<HTMLElement>,
  pageReady: boolean
): void {
  useEffect(() => {
    const hero = heroRef.current;
    if (!hero || !pageReady) return;

    // Tôn trọng thiết lập hệ điều hành: không ẩn gì, không chạy timeline.
    if (prefersReducedMotion()) {
      hero.classList.add("is-revealed");
      return () => hero.classList.remove("is-revealed");
    }

    let parallaxCleanup: (() => void) | undefined;

    const ctx = gsap.context(() => {
      // ── Chọn target ───────────────────────────────────────────────────────
      // Tách accent khỏi phần tiêu đề để "!!!" có một nhịp nảy riêng — nếu
      // chạy chung một tween, chúng chỉ là ký tự cuối của chuỗi và không có
      // điểm nhấn thị giác nào.
      const titleChars = gsap.utils.toArray<HTMLElement>(
        ".hero-title .hero-char:not(.hero-char--accent)",
        hero
      );
      const accentChars = gsap.utils.toArray<HTMLElement>(
        ".hero-title .hero-char--accent",
        hero
      );
      const subtitleChars = gsap.utils.toArray<HTMLElement>(
        ".hero-sub .hero-type-char",
        hero
      );
      const subtitleWords = gsap.utils.toArray<HTMLElement>(
        ".hero-sub .hero-type-word",
        hero
      );
      const caret = hero.querySelector<HTMLElement>(".hero-type-caret");
      const sparks = gsap.utils.toArray<HTMLElement>(".hero-spark", hero);
      const dockItems = gsap.utils.toArray<HTMLElement>(".hero-dock li", hero);
      const cta = hero.querySelector<HTMLElement>(".hero-cta");
      const glow = hero.querySelector<HTMLElement>(".hero-cta-glow");
      const cue = hero.querySelector<HTMLElement>(".hero-scroll-cue");
      const flare = hero.querySelector<HTMLElement>(".hero-flare");

      // ── Trạng thái ẩn, áp NGAY (xem "NGUYÊN TẮC" ở đầu file) ─────────────
      const titleFrom = {
        y: 46,
        opacity: 0,
        scale: 0.9,
        rotationX: -38,
        transformPerspective: 700,
        transformOrigin: "50% 85%",
      };
      const accentFrom = {
        y: 54,
        opacity: 0,
        scale: 0.55,
        rotationX: -30,
        transformPerspective: 700,
        transformOrigin: "50% 85%",
      };

      if (titleChars.length) gsap.set(titleChars, titleFrom);
      if (accentChars.length) gsap.set(accentChars, accentFrom);
      if (subtitleChars.length) gsap.set(subtitleChars, { opacity: 0 });
      if (subtitleWords.length) gsap.set(subtitleWords, { y: 8 });
      if (cta) gsap.set(cta, { y: 22, opacity: 0, scale: 0.96 });
      if (dockItems.length) gsap.set(dockItems, { y: 16, opacity: 0, scale: 0.94 });
      if (cue) gsap.set(cue, { y: 10, opacity: 0 });
      if (flare) gsap.set(flare, { opacity: 0, scale: 0.55 });

      const titleStart = REVEAL_AT;
      const titleStagger = 0.03;
      const titleDuration = 0.8;
      const titleEnd =
        titleStart +
        titleDuration +
        titleStagger * Math.max(0, titleChars.length - 1);

      // Gõ chữ bắt đầu khi tiêu đề đã lộ ~2/3 — hai hiệu ứng nối tiếp nhau
      // nhưng vẫn chồng một nhịp để tổng thời gian không bị dài.
      const typingStart = Math.max(titleStart + 0.7, titleEnd - 0.55);
      const typeDuration = Math.min(
        1.45,
        Math.max(1.05, subtitleChars.length * 0.0095)
      );
      const ctaStart = typingStart + typeDuration - 0.08;

      const tl = gsap.timeline({
        defaults: { ease: "power3.out" },
        // Nếu tab bị ẩn giữa chừng, GSAP vẫn chạy nốt timeline khi quay lại
        // thay vì đứng hình ở nửa chừng.
        smoothChildTiming: true,
      });

      // 1. Video nền — zoom rất nhẹ, không đụng opacity (framer-motion giữ).
      tl.fromTo(
        ".hero-video-layer",
        { scale: 1.14 },
        {
          scale: 1,
          duration: 2.6,
          ease: "power2.out",
          onComplete: () => {
            gsap.set(".hero-video-layer", { clearProps: "scale" });
          },
        },
        0
      );

      // 2. Lớp ambient (aurora, flare, sparkles) fade cả cụm.
      tl.fromTo(
        ".hero-ambient",
        { opacity: 0 },
        { opacity: 1, duration: 1.15, ease: "power2.out" },
        0
      );

      // 3. Tiêu đề: từng ký tự nhô lên + xoay 3D nhẹ rồi duỗi phẳng.
      //    Mỗi ký tự dùng CÙNG một dải gradient (HeroTitle đo sẵn), nên
      //    transform không làm gradient lệch.
      if (titleChars.length > 0) {
        tl.fromTo(titleChars, titleFrom, {
          y: 0,
          opacity: 1,
          scale: 1,
          rotationX: 0,
          duration: titleDuration,
          stagger: titleStagger,
          ease: "power3.out",
        }, titleStart);
      }

      // 3b. Accent: nảy rõ hơn, trễ một nhịp ngắn so với ký tự cuối của tiêu đề.
      if (accentChars.length > 0) {
        tl.fromTo(accentChars, accentFrom, {
          y: 0,
          opacity: 1,
          scale: 1,
          rotationX: 0,
          duration: 0.9,
          stagger: 0.07,
          ease: "back.out(2.4)",
        }, titleEnd - 0.28);
      }

      // 3c. Vệt sáng kính + tia sáng bung ra khi tiêu đề bắt đầu hiện.
      tl.call(() => hero.classList.add("is-revealed"), undefined, titleStart);

      if (flare) {
        tl.fromTo(
          flare,
          { opacity: 0, scale: 0.55 },
          { opacity: 0.85, scale: 1.25, duration: 0.55, ease: "power2.out" },
          titleStart + 0.08
        ).to(
          flare,
          { opacity: 0, scale: 1.7, duration: 0.95, ease: "power2.in" },
          titleStart + 0.63
        );
      }

      // 4. Đốm sáng lấp lánh hiện dần (CSS lo phần trôi nổi).
      if (sparks.length > 0) {
        tl.fromTo(
          sparks,
          { opacity: 0 },
          { opacity: 1, duration: 0.9, stagger: 0.055, ease: "sine.out" },
          titleStart + 0.3
        );
      }

      // 5. Phụ đề: từ hơi nhô lên, rồi từng ký tự hiện dần + caret chạy theo.
      if (subtitleWords.length > 0) {
        tl.to(subtitleWords, {
          y: 0,
          duration: 0.5,
          stagger: 0.04,
          ease: "power2.out",
        }, typingStart - 0.15);
      }

      if (subtitleChars.length > 0) {
        const step =
          (typeDuration - 0.02) / Math.max(subtitleChars.length - 1, 1);

        tl.fromTo(
          subtitleChars,
          { opacity: 0 },
          { opacity: 1, duration: 0.02, stagger: step, ease: "none" },
          typingStart
        );

        if (caret) {
          const lastIndex = subtitleChars.length - 1;
          const cursor = { index: 0 };
          let placedIndex = -1;

          const placeCaret = (rawIndex: number, before = false) => {
            const index = Math.max(0, Math.min(lastIndex, rawIndex));
            if (index === placedIndex && !before) return;
            placedIndex = index;
            const char = subtitleChars[index];
            if (!char) return;
            // Chỉ đặt vị trí — opacity do timeline lo, để caret không "nháy"
            // ngược lại mỗi lần cập nhật (GSAP set autoAlpha sẽ ghi đè tween).
            gsap.set(caret, {
              x: char.offsetLeft + (before ? 0 : char.offsetWidth),
              y: char.offsetTop,
              height: char.offsetHeight,
              autoAlpha: 1,
            });
          };

          tl.call(() => placeCaret(0, true), undefined, typingStart);
          tl.to(
            cursor,
            {
              index: lastIndex,
              duration: typeDuration,
              ease: "none",
              onUpdate: () => placeCaret(Math.round(cursor.index)),
            },
            typingStart
          );
          tl.to(
            caret,
            { autoAlpha: 0, duration: 0.25, ease: "power2.in" },
            typingStart + typeDuration + 0.15
          );
        }
      }

      // 6. CTA: hiện lên rồi quầng sáng "thở" rất chậm.
      if (cta) {
        tl.fromTo(
          cta,
          { y: 22, opacity: 0, scale: 0.96 },
          {
            y: 0,
            opacity: 1,
            scale: 1,
            duration: 0.7,
            ease: "back.out(1.5)",
          },
          ctaStart
        );
      }

      if (glow) {
        tl.fromTo(
          glow,
          { opacity: 0, scale: 0.7 },
          { opacity: 0.8, scale: 1, duration: 0.9, ease: "sine.out" },
          ctaStart - 0.1
        ).to(
          glow,
          {
            opacity: 0.35,
            scale: 1.08,
            duration: 2.8,
            repeat: -1,
            yoyo: true,
            ease: "sine.inOut",
          },
          ctaStart + 0.8
        );
      }

      // 7. Dock hành động nhanh: từng viên một (yêu cầu "các nút hiện từng cái").
      if (dockItems.length > 0) {
        tl.to(dockItems, {
          y: 0,
          opacity: 1,
          scale: 1,
          duration: 0.6,
          stagger: 0.085,
          ease: "back.out(1.7)",
        }, ctaStart + 0.26);
      }

      // 8. Gợi ý cuộn xuống.
      if (cue) {
        tl.to(cue, {
          y: 0,
          opacity: 1,
          duration: 0.7,
          ease: "power2.out",
        }, ctaStart + 0.85);
      }
    }, hero);

    // ── Parallax chuột: chỉ desktop + pointer chính xác ─────────────────────
    const ambient = hero.querySelector<HTMLElement>(".hero-ambient");
    if (ambient && isFinePointer()) {
      const xTo = gsap.quickTo(ambient, "x", {
        duration: 0.9,
        ease: "power3.out",
      });
      const yTo = gsap.quickTo(ambient, "y", {
        duration: 0.9,
        ease: "power3.out",
      });

      let frame = 0;
      let targetX = 0;
      let targetY = 0;

      const onMove = (event: PointerEvent) => {
        targetX = (event.clientX / window.innerWidth - 0.5) * -18;
        targetY = (event.clientY / window.innerHeight - 0.5) * -12;
        if (frame) return;
        frame = window.requestAnimationFrame(() => {
          frame = 0;
          xTo(targetX);
          yTo(targetY);
        });
      };

      const onLeave = () => {
        targetX = 0;
        targetY = 0;
        xTo(0);
        yTo(0);
      };

      hero.addEventListener("pointermove", onMove, { passive: true });
      hero.addEventListener("pointerleave", onLeave, { passive: true });

      parallaxCleanup = () => {
        if (frame) window.cancelAnimationFrame(frame);
        hero.removeEventListener("pointermove", onMove);
        hero.removeEventListener("pointerleave", onLeave);
        xTo.tween.kill();
        yTo.tween.kill();
      };
    }

    return () => {
      parallaxCleanup?.();
      hero.classList.remove("is-revealed");
      ctx.revert();
    };
  }, [heroRef, pageReady]);
}
