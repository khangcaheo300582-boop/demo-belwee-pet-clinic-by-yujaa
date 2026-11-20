"use client";

import React, { useEffect, useRef, useState } from "react";
import { gsap, prefersReducedMotion } from "@/lib/gsap";
// Bảng variant dùng CHUNG với components/AnimationProvider.tsx (hạng mục A7).
// Trước đây mỗi file tự khai một bảng và chúng đã lệch nhau (zoom 0.9 vs 0.92,
// flip-y 40° vs 45°) — xem đầu lib/revealVariants.ts.
import { REVEAL_FROM, REVEAL_TO, type RevealVariant } from "@/lib/revealVariants";

interface RevealProps {
  children: React.ReactNode;
  variant?: RevealVariant;
  delay?: number;
  duration?: number;
  stagger?: number;
  className?: string;
  as?: "div" | "section" | "article" | "li" | "span" | "h1" | "h2" | "h3" | "p" | "header";
  id?: string;
  /**
   * Nhãn trợ năng cho vùng được bọc.
   *
   * Chỉ nhận `aria-label` chứ không nhận cả đối tượng `aria-*`: `Reveal` là
   * wrapper trang trí, và cho phép truyền `role` sẽ dễ dàng tạo ra vùng trợ năng
   * giả mà không ai cập nhật. `aria-label` là ngoại lệ duy nhất thực sự cần —
   * dùng cho vùng điều hướng không có phần tử con mang nhãn (như cặp
   * "bài trước / bài sau").
   */
  ariaLabel?: string;
}

export default function Reveal({
  children,
  variant = "fade-up",
  delay = 0,
  duration = 0.9,
  stagger = 0,
  className = "",
  as: Tag = "div",
  id,
  ariaLabel,
}: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  useEffect(() => {
    const node = ref.current;
    if (!node || !ready) return;

    if (prefersReducedMotion()) {
      gsap.set(node, { clearProps: "all" });
      return;
    }

    let ctx: gsap.Context | null = null;

    ctx = gsap.context(() => {
      const targets = stagger && stagger > 0 && node.children.length
        ? Array.from(node.children)
        : node;

      gsap.fromTo(
        targets,
        REVEAL_FROM[variant],
        {
          ...REVEAL_TO,
          duration,
          delay,
          ease: "power3.out",
          stagger: stagger || 0,
          clearProps: "all",
          scrollTrigger: {
            trigger: node,
            start: "top 88%",
            once: true,
          },
        }
      );
    }, node);

    return () => {
      ctx?.revert();
      ctx = null;
    };
  }, [ready, variant, delay, duration, stagger]);

  return (
    <Tag
      ref={ref as never}
      id={id}
      aria-label={ariaLabel}
      className={className}
    >
      {children}
    </Tag>
  );
}
