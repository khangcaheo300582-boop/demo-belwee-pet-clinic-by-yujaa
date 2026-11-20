"use client";

/**
 * components/home/HeroSubtitle.tsx
 *
 * Phụ đề hero được tách tới từng KÝ TỰ để chạy hiệu ứng gõ chữ, nhưng vẫn giữ
 * nguyên bố cục của cả câu:
 *
 *  · Mỗi TỪ là một `inline-block` + `white-space: nowrap` ⇒ trình duyệt không
 *    bao giờ ngắt dòng giữa một từ (tiếng Việt có dấu rất dễ bị bẻ đôi).
 *  · Ký tự vẫn nằm trong luồng layout dù `opacity` = 0 ⇒ gõ tới đâu chữ cũng
 *    đã chiếm đúng chỗ đó, không có layout shift.
 *  · `<span class="sr-only">` giữ nguyên câu đầy đủ cho screen reader; phần
 *    chữ động là `aria-hidden` nên không bị đọc lặp.
 *
 * Dự phòng khi JS chết: ký tự mặc định `opacity: 1` (xem globals.css), nên
 * phụ đề vẫn hiện đầy đủ ngay từ HTML.
 */

import { Fragment, useMemo } from "react";
import { cn } from "@/lib/utils";

export interface HeroSubtitleProps {
  /** Câu đầy đủ. */
  text: string;
  id?: string;
  className?: string;
}

interface SubtitleWord {
  word: string;
  chars: string[];
}

export default function HeroSubtitle({
  text,
  id,
  className,
}: HeroSubtitleProps) {
  const words = useMemo<SubtitleWord[]>(() => {
    // NFC: tiếng Việt dựng sẵn (một code point) — nếu chuỗi ở dạng NFD thì
    // `Array.from` sẽ tách dấu ra khỏi nguyên âm và hiệu ứng gõ sẽ vỡ chữ.
    return text
      .normalize("NFC")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => ({ word, chars: Array.from(word) }));
  }, [text]);

  return (
    <p id={id} className={cn("hero-sub", className)}>
      <span className="sr-only">{text}</span>
      <span className="hero-sub-visual" aria-hidden="true">
        {words.map((item, wordIndex) => (
          <Fragment key={`${wordIndex}-${item.word}`}>
            {wordIndex > 0 ? " " : null}
            <span className="hero-type-word">
              {item.chars.map((char, charIndex) => (
                <span
                  key={`${charIndex}-${char}`}
                  className="hero-type-char"
                >
                  {char}
                </span>
              ))}
            </span>
          </Fragment>
        ))}
        <span className="hero-type-caret" />
      </span>
    </p>
  );
}
