"use client";

/**
 * components/home/HeroTitle.tsx
 *
 * Tiêu đề hero tách TỪNG KÝ TỰ để chạy hiệu ứng reveal, nhưng vẫn giữ được
 * MỘT dải gradient liền mạch — điều mà `GlassHeading` cố tình không làm.
 *
 * ── VÌ SAO KHÔNG DÙNG background-clip TRÊN TỪNG SPAN ────────────────────────
 * Mỗi span `inline-block` tạo một background box riêng, nên gradient sẽ khởi
 * động lại ở từng ký tự ⇒ tiêu đề thành sọc. Cách ở đây: đo vị trí layout của
 * từng ký tự, cho mỗi ký tự CÙNG một `background-size` bằng bề rộng cả dòng và
 * dịch nền bằng `background-position-x` âm đúng bằng khoảng cách từ ký tự đó
 * tới đầu dòng. Kết quả: mọi ký tự cùng vẽ một dải gradient, không sọc.
 *
 * Đo bằng `offsetLeft` (layout) chứ không `getBoundingClientRect()`: GSAP
 * transform từng ký tự trong lúc reveal, và rect sẽ trả toạ độ ĐÃ biến đổi ⇒
 * gradient lệch dần trong animation.
 *
 * ── DỰ PHÒNG KHI JS CHẾT ────────────────────────────────────────────────────
 * Chỉ khi đo xong mới bật gradient (`data-hero-measured="true"`). Trước đó các
 * ký tự là chữ trắng đặc ⇒ tiêu đề luôn đọc được, kể cả khi effect không chạy.
 *
 * ── A11Y ────────────────────────────────────────────────────────────────────
 * `<h1>` có `aria-label` nguyên câu; lớp ký tự là `aria-hidden` nên screen
 * reader đọc đúng một lần. Chữ thật vẫn nằm trong DOM (copy/SEO/diacritics).
 */

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";

/** Dùng layout effect ở client, effect thường khi SSR để không cảnh báo React. */
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

export interface HeroTitleProps {
  /** Toàn bộ tiêu đề, KHÔNG gồm phần accent. */
  title: string;
  /** Đuôi nhấn màu (vd "!!!"), có thể rỗng. */
  accent?: string;
  /** Câu đầy đủ cho screen reader. */
  ariaLabel: string;
  className?: string;
  id?: string;
}

interface TitleToken {
  char: string;
  accent: boolean;
}

export default function HeroTitle({
  title,
  accent = "",
  ariaLabel,
  className,
  id,
}: HeroTitleProps) {
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const charsRef = useRef<Array<HTMLSpanElement | null>>([]);

  const tokens = useMemo<Array<TitleToken & { key: string }>>(() => {
    const list: TitleToken[] = Array.from(title).map((char) => ({
      char,
      accent: false,
    }));
    Array.from(accent).forEach((char) => list.push({ char, accent: true }));
    return list.map((token, index) => ({ ...token, key: `${index}-${token.char}` }));
  }, [title, accent]);

  useIsomorphicLayoutEffect(() => {
    const node = titleRef.current;
    if (!node) return;

    let frame = 0;
    let alive = true;

    const measure = () => {
      if (!alive) return;
      const chars = charsRef.current.filter(
        (char): char is HTMLSpanElement => char !== null
      );
      if (chars.length === 0) return;

      const first = chars[0];
      const last = chars[chars.length - 1];
      const start = first.offsetLeft;
      const width = last.offsetLeft + last.offsetWidth - start;
      if (!(width > 0)) return;

      // `offsetLeft` của mỗi ký tự đã là toạ độ layout so với `h1`
      // (`.hero-title` đặt `position: relative`), nên không cần cộng dồn.
      for (const char of chars) {
        char.style.setProperty("--hero-char-x", `${-(char.offsetLeft - start)}px`);
      }
      node.style.setProperty("--hero-title-w", `${width}px`);
      node.dataset.heroMeasured = "true";
    };

    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };

    measure();

    // Cỡ chữ dùng `clamp(..., vw, ...)` nên đổi theo bề rộng cửa sổ; font
    // Nunito tải xong cũng đổi metric. Đo lại ở cả hai thời điểm.
    const observer =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(schedule) : null;
    observer?.observe(node);

    if (typeof document !== "undefined" && document.fonts) {
      void document.fonts.ready.then(() => {
        if (alive) schedule();
      });
    }

    window.addEventListener("resize", schedule);

    return () => {
      alive = false;
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", schedule);
    };
  }, [tokens]);

  return (
    <h1
      ref={titleRef}
      id={id}
      className={cn("hero-title glass-heading relative", className)}
      aria-label={ariaLabel}
    >
      <span className="hero-title__chars" aria-hidden="true">
        {tokens.map((token, index) => (
          <span
            key={token.key}
            ref={(char) => {
              charsRef.current[index] = char;
            }}
            className={cn("hero-char", token.accent && "hero-char--accent")}
          >
            {token.char === " " ? "\u00A0" : token.char}
          </span>
        ))}
      </span>
      <span
        aria-hidden="true"
        className="glass-heading__sheen"
        data-text={`${title}${accent}`}
      />
    </h1>
  );
}
