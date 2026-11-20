"use client";

/**
 * hooks/useInView.ts
 *
 * Báo "phần tử đã lọt vào khung nhìn" đúng MỘT LẦN rồi giữ nguyên — đây là điều
 * kiện cần cho chuỗi hoạt cảnh chạy một lần theo thứ tự (GĐ9 · b).
 *
 * ── VÌ SAO KHÔNG DÙNG `data-reveal` CÓ SẴN ────────────────────────────────────
 * Hệ thống A7 (`data-reveal`) làm mờ + nâng phần tử lên khi lọt khung nhìn. Nó
 * đúng cho phần "nội dung hiện dần", nhưng chuỗi 4 bước cần điều khiển THỨ TỰ
 * và thời điểm giữa các bước (bước 1 xong mới tới bước 2), nên phải tự quản lý.
 * Dùng chung hệ reveal cho cả hai sẽ khó kiểm soát và dễ đụng nhau.
 *
 * ── VÌ SAO DÙNG `IntersectionObserver` CHỨ KHÔNG DÙNG SCROLL ───────────────────
 * Nghe sự kiện `scroll` rồi so `getBoundingClientRect` tốn một lần tính bố cục
 * cho MỌI khung hình — đúng thứ làm trang nặng khi cuộn. `IntersectionObserver`
 * do trình duyệt tự đẩy thông báo, không phát sinh bố cục trong JS.
 *
 * ── `once` ───────────────────────────────────────────────────────────────────
 * Chuỗi hoạt cảnh chỉ nên chạy một lần. Nếu bật/tắt theo vị trí thì người
 * đọc cuộn lên cuộn xuống sẽ thấy hiệu ứng chạy lại từ đầu, rất rối. Vì vậy mặc
 * định `once = true` và callback chỉ bắn một phát.
 */

import { useEffect, useRef, useState, type RefObject } from "react";
import { prefersReducedMotion } from "@/lib/gsap";

export default function useInView<T extends HTMLElement>(
  options: { threshold?: number; rootMargin?: string; once?: boolean } = {}
): [RefObject<T>, boolean] {
  const { threshold = 0.35, rootMargin = "0px 0px -12% 0px", once = true } = options;
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Không hỗ trợ thì coi như đã thấy — nội dung phải hiện, không được ẩn vĩnh
    // viễn trên một trình duyệt cũ.
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }

    // Người bật giảm chuyển động: hiện thẳng, không chạy chuỗi.
    if (prefersReducedMotion()) {
      setInView(true);
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true);
            if (once) io.disconnect();
          } else if (!once) {
            setInView(false);
          }
        }
      },
      { threshold, rootMargin }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold, rootMargin, once]);

  return [ref, inView];
}