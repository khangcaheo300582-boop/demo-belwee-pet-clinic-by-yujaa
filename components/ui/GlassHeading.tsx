/**
 * components/ui/GlassHeading.tsx
 *
 * Tiêu đề lớn dạng kính lỏng (hạng mục §24).
 *
 * ── VÌ SAO KHÔNG TÁCH CHỮ ──────────────────────────────────────────────────
 * Yêu cầu §24 cấm tách từng chữ thành thẻ riêng, và đó không chỉ là sở thích:
 * `.glass-heading` đổ màu bằng `background-clip: text` trên MỘT phần tử. Một
 * phần tử con `display: inline-block` (span bọc từ hoặc từng chữ) TẠO background
 * box mới ⇒ gradient khởi động lại ở mỗi từ ⇒ tiêu đề thành sọc trắng‑xanh
 * xen kẽ thay vì một khối kính liền mạch.
 *
 * Bản cũ của trang chủ đúng là đang vi phạm điều đó: `Array.from(t("..."))` sinh
 * ~46 thẻ `<span class="hero-word"><span class="hero-char">`, và GSAP bounce
 * từng chữ. Xem docs/phase-2a-report.md §"§24" để biết đánh đổi.
 *
 * ── RÀNG BUỘC SEO / A11Y ──────────────────────────────────────────────────
 * Đây vẫn là thẻ heading thật (`h1` mặc định) chứa văn bản thật: bôi đen/copy
 * được, screen reader đọc đúng một lần, không cần `aria-label`. Vệt sáng là
 * một `<span aria-hidden>` rỗng ⇒ không đọc trùng.
 *
 * KHÔNG có hook, KHÔNG có "use client" ⇒ dùng được ở Server Component.
 * Auto-sheen là CSS thuần (`animation` có `delay`), không cần JS.
 */

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type GlassHeadingLevel = "h1" | "h2" | "h3";

export interface GlassHeadingProps {
  /** Chữ chính. */
  children: ReactNode;
  /**
   * Đuôi dạng "!!!" — tô bằng `--glass-tint` và giữ `white-space: nowrap`
   * để không rớt dấu lên dòng lẻ.
   */
  accent?: string;
  /** Cấp heading. Mặc định `h1`. */
  level?: GlassHeadingLevel;
  /** Đặt vệt sáng lướt qua. Mặc định có. */
  sheen?: boolean;
  className?: string;
  id?: string;
}

export default function GlassHeading({
  children,
  accent,
  level = "h1",
  sheen = true,
  className,
  id,
}: GlassHeadingProps) {
  const Tag = level;

  // Nội dung đầy đủ để lớp sheen vẽ lại đúng hình chữ. Chỉ dùng khi có sheen —
  // không thì không tạo chuỗi thừa.
  const sheenText =
    sheen && typeof children === "string"
      ? `${children}${accent ?? ""}`
      : undefined;

  return (
    <span className={cn("glass-heading-wrap relative block", className)}>
      <Tag id={id} className="glass-heading relative">
        {children}
        {accent ? <span className="glass-heading__accent">{accent}</span> : null}
        {sheen && sheenText ? (
          <span aria-hidden="true" className="glass-heading__sheen" data-text={sheenText} />
        ) : null}
      </Tag>
    </span>
  );
}