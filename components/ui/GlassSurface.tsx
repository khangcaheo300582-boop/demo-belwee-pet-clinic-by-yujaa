/**
 * components/ui/GlassSurface.tsx
 *
 * Thẻ kính mờ dùng chung (design system §2).
 *
 * VÌ SAO CHỈ LÀ MỘT LỚP GHÉP CLASS: vật liệu kính (tint → glare → inset rim →
 * hairline → đổ bóng) cùng các hệ số theo theme và các fallback
 * `@supports` / `prefers-reduced-transparency` đều nằm ở MỘT chỗ duy nhất —
 * `.pt-glass` trong `app/globals.css`. Component này KHÔNG tự vẽ lại vật liệu;
 * nó chỉ:
 *   • ghép đúng class,
 *   • mở bán kính qua token `--glass-radius` (không hardcode px ở JSX),
 *   • tùy chọn thêm lớp nhuộm tông `--glass-tint` (hook cho hạng mục K1).
 *
 * Nhờ vậy khi cần đổi độ trong suốt / blur / fallback của kính, người sau
 * không phải đi tìm từng chỗ dùng `GlassSurface` để sửa.
 *
 * KHÔNG có hook, KHÔNG có "use client" ⇒ dùng được cả trong Server Component
 * lẫn Client Component.
 */

import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Bán kính bo góc — giá trị CSS, không phải class Tailwind (để ghi vào token). */
const RADIUS_VALUES: Record<Exclude<GlassRadius, "lg">, string> = {
  sm: "12px",
  md: "16px",
  xl: "28px",
  "2xl": "32px",
  "3xl": "36px",
  full: "9999px",
};

export type GlassRadius = "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "full";

export type GlassSurfaceTag = "div" | "article" | "section" | "aside" | "li" | "figure";

/**
 * Mức vật liệu (mục 20 của đề bài):
 *  - `full` — `backdrop-filter` thật. Dành cho tối đa ~3 lớp trong cùng một
 *    viewport: navbar, pill điều khiển, thẻ lớn nổi bật.
 *  - `lite` — GIỮ gradient + viền + bóng nhưng TẮT `backdrop-filter`, đồng thời
 *    tăng độ đục để bù. Dùng khi nền phía sau đã là ảnh/gradient mờ sẵn: blur
 *    thêm gần như không đổi thị giác nhưng vẫn tốn GPU mỗi lần cuộn.
 */
export type GlassVariant = "full" | "lite";

export interface GlassSurfaceProps {
  children?: ReactNode;
  className?: string;
  /**
   * Bản "đục hơn" cho vùng nhiều chữ nhỏ hoặc form — tăng alpha của tint nên
   * chữ luôn đủ tương phản bất kể nền phía sau là gì.
   */
  strong?: boolean;
  /**
   * Bán kính bo góc. `"lg"` = mặc định của dự án (24px, lấy từ
   * `--glass-radius`); các giá trị khác ghi đè token cục bộ cho đúng thẻ này.
   */
  radius?: GlassRadius;
  /** Mức vật liệu. Mặc định `full`. */
  variant?: GlassVariant;
  /**
   * Bật lớp nhuộm theo tông thú cưng (`--glass-tint`, hạng mục K1).
   * Mặc định tắt để KHÔNG sinh thêm lớp vẽ khi không cần.
   */
  tint?: boolean;
  /** Thẻ HTML — mặc định `div`. */
  as?: GlassSurfaceTag;
  style?: CSSProperties;
  id?: string;
}

export default function GlassSurface({
  children,
  className,
  strong = false,
  radius = "lg",
  variant = "full",
  tint = false,
  as: Tag = "div",
  style,
  id,
}: GlassSurfaceProps) {
  return (
    <Tag
      id={id}
      className={cn(
        "pt-glass",
        variant === "lite" ? "glass-surface glass-surface--lite" : "glass-surface",
        strong && "pt-glass-strong",
        className
      )}
      style={
        radius === "lg"
          ? style
          : ({ ...style, "--glass-radius": RADIUS_VALUES[radius] } as CSSProperties)
      }
    >
      {tint && <span className="glass-surface__tint" aria-hidden="true" />}
      {children}
    </Tag>
  );
}
