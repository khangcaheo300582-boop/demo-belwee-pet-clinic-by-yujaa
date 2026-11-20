/**
 * components/ui/GlassPill.tsx
 *
 * Viên thuốc kính mờ — dùng làm KHUNG chứa cho các điều khiển nhỏ (bộ chuyển
 * thẻ, thanh tiến trình, chip trạng thái), không phải nút bấm.
 *
 * Phân biệt với `GlassButton`: pill là *bề mặt*, button là *hành động*. Bộ
 * điều khiển của carousel (tên thẻ đang xem + nút trước/sau) là MỘT pill chứa
 * các nút bên trong, nên chúng được tách thành hai component khác nhau.
 *
 * Vật liệu vẫn là `.glass-pill` trong `app/globals.css`; vệt sáng hover là
 * `.glass-sheen` và nằm ở `z-index: -1` nên nội dung của người gọi vẫn là
 * những flex item trực tiếp — bọc ngoài không làm lệch bố cục.
 *
 * KHÔNG có hook, KHÔNG có "use client".
 */

import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type GlassPillTag = "div" | "span" | "nav" | "li";

export interface GlassPillProps {
  children?: ReactNode;
  className?: string;
  /** Thẻ HTML — mặc định `div`. */
  as?: GlassPillTag;
  /** Tắt vệt sáng quét khi hover (dùng khi pill chỉ để hiển thị, không tương tác). */
  static?: boolean;
  style?: CSSProperties;
  id?: string;
  /** Nhãn trợ năng khi pill là một vùng có nghĩa (ví dụ bộ chuyển dịch vụ). */
  ariaLabel?: string;
}

export default function GlassPill({
  children,
  className,
  as: Tag = "div",
  static: isStatic = false,
  style,
  id,
  ariaLabel,
}: GlassPillProps) {
  return (
    <Tag
      id={id}
      aria-label={ariaLabel}
      className={cn("glass-pill", className)}
      style={style}
    >
      {!isStatic && <span className="glass-sheen" aria-hidden="true" />}
      {children}
    </Tag>
  );
}
