"use client";

/**
 * components/CountUp.tsx
 * Số liệu đếm chạy khi cuộn tới — phần "số liệu đếm chạy" của I1.
 *
 * BA THỨ KHÔNG ĐƯỢC LÀM Ở ĐÂY
 *
 * 1. KHÔNG dùng `setInterval`.
 *    setInterval 16ms không khớp nhịp vẽ, mỗi lần đều trễ một nhịp → con số
 *    rung/nhảy. Ở đây dùng `requestAnimationFrame`, tức là mỗi lần trình duyệt
 *    vẽ khung hình thì con số được cập nhật đúng một lần, mượt 60fps.
 *
 * 2. KHÔNG dùng `ease-in-out` toàn cả chặng.
 *    Toàn bộ đường cong ease tạo cảm giác "giật": đầu chậm, giữa nhanh, cuối
 *    chậm. Số đếm trông tự nhiên khi TỐC ĐỘ gần như không đổi (như đồng hồ
 *    đếm giây), tức `easeOutExpo`: chạy nhanh ngay, rồi tiện dần về đích.
 *
 * 3. KHÔNG để width nhảy theo số.
 *    "9" hẹp hơn "10" — nếu không khoá, mỗi lần đổi số là một lần reflow toàn
 *    khối, thấy rõ ở mobile. `font-variant-numeric: tabular-nums` giữ mọi con
 *    số cùng bề rộng nên layout đứng yên, chỉ vẽ lại chữ.
 *
 * `prefers-reduced-motion`: nhảy thẳng về giá trị cuối, không chạy.
 */

import { useEffect, useRef, useState } from "react";

/** ~1.4 giây — đủ thấy ra con số chạy nhưng không làm người dùng chờ. */
const DURATION_MS = 1400;

interface Props {
  /** Giá trị đích (số nguyên). */
  value: number;
  /** Ký tự/số đứng trước, ví dụ "+" hoặc "hơn ". */
  prefix?: string;
  /** Ký tự/số đứng sau, ví dụ "+" hoặc " năm". */
  suffix?: string;
  /** Làm tròn: ví dụ 1450 → "1.450" (locale vi-VN dùng dấu chấm). */
  locale?: string;
  className?: string;
}

/** easeOutExpo — bật đầu nhanh, tiện dần. f(0)=0, f(1)=1, không vượt quá 1. */
function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

export default function CountUp({
  value,
  prefix = "",
  suffix = "",
  locale = "vi-VN",
  className,
}: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(0);
  /** Đã chạy xong chưa — chốt để IntersectionObserver không chạy lại lần 2. */
  const doneRef = useRef(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (reduceMotion) {
      setDisplay(value);
      return;
    }

    // Không có IntersectionObserver (rất hiếm) → hiện luôn số đích, đừng để
    // người dùng thấy "0" vĩnh viễn vì một API thiếu.
    if (typeof IntersectionObserver === "undefined") {
      setDisplay(value);
      return;
    }

    let frame = 0;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry.isIntersecting || doneRef.current) return;

        doneRef.current = true;
        observer.disconnect();

        const start = performance.now();
        const tick = (now: number) => {
          const progress = Math.min((now - start) / DURATION_MS, 1);
          setDisplay(Math.round(easeOutExpo(progress) * value));
          if (progress < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      },
      // threshold 0.35: phải thấy phần đáng kể mới bắt đầu chạy, tránh con số
      // chạy xong trong lúc người dùng còn đang lướt qua rồi lướt tiếp.
      { threshold: 0.35 }
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value]);

  return (
    <span ref={ref} className={className} style={{ fontVariantNumeric: "tabular-nums" }}>
      {prefix}
      {display.toLocaleString(locale)}
      {suffix}
    </span>
  );
}
