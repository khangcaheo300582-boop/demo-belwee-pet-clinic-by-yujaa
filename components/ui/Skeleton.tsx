/**
 * components/ui/Skeleton.tsx
 *
 * Hệ thống skeleton loading dùng chung (hạng mục B).
 *
 * VÌ SAO THAY BẢN CŨ
 *   1. Trước đây có ≥3 bản sao keyframes shimmer ở 3 file (`app/globals.css`,
 *      `app/tuyen-dung/page.tsx`, `app/loading.tsx`) và chúng không hề biết
 *      nhau. Nay chỉ còn MỘT animation ở `tailwind.config.ts`
 *      (`animate-skeleton-sheen`).
 *   2. Bản cũ dùng `background-position` (bản sao) hoặc `animate-pulse` (Tailwind).
 *      `background-position` buộc trình duyệt vẽ lại gradient mỗi frame, còn
 *      `animate-pulse` chỉ mờ/nhòe cả khối. Ở đây thanh sáng chạy bằng
 *      `transform: translate3d()` — thuộc tính của compositor, 1 lớp GPU, không
 *      repaint.
 *   3. Bản cũ hardcode màu cho nền TỐI (`bg-white/5`) trong khi site mặc định
 *      SÁNG ⇒ skeleton gần như tàng hình. Nay màu lấy từ token `--sk-base` /
 *      `--sk-sheen` nên tự đúng ở cả hai theme.
 *   4. Bản cũ không có nhánh `prefers-reduced-motion` ⇒ shimmer chạy mãi với
 *      người đã yêu cầu giảm chuyển động. Nay dùng tiện ích `motion-reduce:hidden`
 *      của Tailwind, khối xương giữ nguyên nền tĩnh.
 *   5. Bản cũ chỉ có `role="status"` mà KHÔNG có chữ cho màn hình đọc và không
 *      có `aria-busy`.
 *
 * A11Y: mọi khối xương là phần tử TRANG TRÍ ⇒ `aria-hidden="true"`. Chúng
 * luôn được đặt trong `<SkeletonStatus>` (role="status" + aria-busy="true" +
 * text `sr-only`) — các preset bên dưới đã tự bọc sẵn.
 *
 * CHỐNG CLS: khối xương chỉ hữu ích khi kích thước của nó TRÙNG kích thước nội
 * dung thật; lệch một chút là trang nhảy. Vì vậy mỗi preset dưới đây sao chép
 * ĐÚNG con số của nội dung thật (padding, gap, cỡ chữ, chiều rộng) và ghi lại
 * con số đó tại chỗ, để người sửa sau này có mốc đối chiếu.
 *
 * KHÔNG có hook, KHÔNG có "use client".
 */

import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

/* ────────────────────────────────────────────────────────────────────────────
   Kiểu cơ bản
   ──────────────────────────────────────────────────────────────────────────── */

export type SkeletonVariant = "text" | "rect" | "circle" | "card" | "list";

export type SkeletonRounded =
  | "none"
  | "sm"
  | "md"
  | "lg"
  | "xl"
  | "2xl"
  | "3xl"
  | "full";

/**
 * `page`  — nằm trên nền nội dung theo theme (dùng token `--sk-*`).
 * `ondark` — nằm BÊN TRONG một thẻ kính tối (dashboard staff) không dùng hệ
 *            token `--pt-*`, nên phải tự khai màu sáng mờ.
 */
export type SkeletonTone = "page" | "ondark";

const ROUNDED_CLASS: Record<SkeletonRounded, string> = {
  none: "rounded-none",
  sm: "rounded-sm",
  md: "rounded-md",
  lg: "rounded-lg",
  xl: "rounded-xl",
  "2xl": "rounded-2xl",
  "3xl": "rounded-3xl",
  full: "rounded-full",
};

const DEFAULT_ROUNDED: Record<SkeletonVariant, SkeletonRounded> = {
  // Bo tròn hoàn toàn cho thanh chữ: mềm, hợp ngôn ngữ soft-UI của site.
  text: "full",
  rect: "lg",
  circle: "full",
  card: "3xl",
  list: "full",
};

/** Chiều cao mặc định (px) khi người gọi không truyền `height`. */
const FALLBACK_HEIGHT: Partial<Record<SkeletonVariant, number>> = {
  text: 12,
  rect: 16,
  circle: 44,
  list: 12,
};

const TONE_BASE: Record<SkeletonTone, string> = {
  page: "bg-[var(--sk-base)]",
  ondark: "bg-white/10",
};

const TONE_SHEEN: Record<SkeletonTone, string> = {
  page: "bg-gradient-to-r from-transparent via-[var(--sk-sheen)] to-transparent",
  ondark: "bg-gradient-to-r from-transparent via-white/12 to-transparent",
};

const toCssLength = (value: number | string | undefined) =>
  value === undefined ? undefined : typeof value === "number" ? `${value}px` : value;

/* ────────────────────────────────────────────────────────────────────────────
   Khối xương nguyên thuỷ
   ──────────────────────────────────────────────────────────────────────────── */

interface SkeletonBlockProps {
  className?: string;
  style?: CSSProperties;
  tone: SkeletonTone;
  rounded: SkeletonRounded;
  /** Tắt vệt sáng cho khối rất nhỏ (≤16px) — vệt sẽ không kịp nhìn thấy. */
  sheen: boolean;
  /**
   * Thẻ HTML của khối. `span` cần thiết khi skeleton phải nằm TRONG một phần
   * tử chỉ chứa inline (ví dụ số liệu trong `<p>`): một `div` ở đó sẽ bị trình
   * duyệt tự đóng thẻ cha và phá luôn bố cục.
   */
  as?: "div" | "span";
}

function SkeletonBlock({
  className,
  style,
  tone,
  rounded,
  sheen,
  as: Tag = "div",
}: SkeletonBlockProps) {
  return (
    <Tag
      aria-hidden="true"
      style={style}
      className={cn(
        "relative overflow-hidden",
        ROUNDED_CLASS[rounded],
        TONE_BASE[tone],
        className
      )}
    >
      {sheen && (
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-y-0 left-0 w-1/2 will-change-transform",
            "animate-skeleton-sheen motion-reduce:hidden",
            TONE_SHEEN[tone]
          )}
        />
      )}
    </Tag>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   API chính
   ──────────────────────────────────────────────────────────────────────────── */

export interface SkeletonProps {
  variant?: SkeletonVariant;
  width?: number | string;
  height?: number | string;
  /**
   * Số dòng. Chỉ áp dụng cho `text` / `rect` / `list`. Dòng cuối ngắn hơn một
   * chút để giống đoạn chữ thật — KHÔNG ảnh hưởng chiều cao nên không gây CLS.
   */
  lines?: number;
  rounded?: SkeletonRounded;
  tone?: SkeletonTone;
  className?: string;
  style?: CSSProperties;
  /**
   * Thẻ HTML của khối — mặc định `div`.
   * Dùng `span` khi skeleton nằm trong phần tử chỉ chứa inline (ví dụ một con
   * số trong `<p>`); xem ghi chú ở `SkeletonBlock`.
   */
  as?: "div" | "span";
}

export default function Skeleton({
  variant = "rect",
  width,
  height,
  lines = 1,
  rounded,
  tone = "page",
  className,
  style,
  as: Tag = "div",
}: SkeletonProps) {
  const isMultiLine = (variant === "text" || variant === "rect") && lines > 1;
  const isList = variant === "list";

  if (isMultiLine || isList) {
    const count = Math.max(1, lines);
    const resolvedRounded = rounded ?? DEFAULT_ROUNDED[variant];
    const lineHeight = toCssLength(height) ?? `${FALLBACK_HEIGHT[variant] ?? 12}px`;

    return (
      <div
        role="presentation"
        className={cn("flex flex-col gap-2.5", className)}
        style={{ width: toCssLength(width), ...style }}
      >
        {Array.from({ length: count }, (_, index) => (
          <SkeletonBlock
            key={index}
            tone={tone}
            rounded={resolvedRounded}
            sheen={index === 0 || count <= 6}
            style={{ height: lineHeight }}
            className={cn(index === count - 1 && count > 1 && "w-4/5")}
          />
        ))}
      </div>
    );
  }

  const resolvedRounded = rounded ?? DEFAULT_ROUNDED[variant];
  const resolvedHeight =
    variant === "circle"
      ? toCssLength(height) ?? toCssLength(width) ?? "44px"
      : toCssLength(height) ?? (FALLBACK_HEIGHT[variant] ? `${FALLBACK_HEIGHT[variant]}px` : undefined);

  return (
    <SkeletonBlock
      as={Tag}
      tone={tone}
      rounded={resolvedRounded}
      // Vệt sáng chỉ có nghĩa khi khối đủ lớn; với ô 8–12px nó thành nhấp nháy.
      sheen={variant !== "circle" && variant !== "text"}
      style={{
        width: toCssLength(width),
        height: resolvedHeight,
        ...(variant === "circle" ? { aspectRatio: "1 / 1" } : null),
        ...style,
      }}
      className={cn(variant === "card" && "h-full w-full", className)}
    />
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Vỏ trợ năng
   ──────────────────────────────────────────────────────────────────────────── */

export interface SkeletonStatusProps {
  /** Text cho màn hình đọc, ví dụ "Đang tải danh sách lịch hẹn…". */
  label: string;
  children: ReactNode;
  className?: string;
}

/**
 * Vỏ bọc BẮT BUỘC cho mọi vùng đang tải:
 *   role="status"  → màn hình đọc coi đây là vùng trạng thái
 *   aria-busy      → báo đang cập nhật
 *   `sr-only`      → nói rõ ĐANG TẢI CÁI GÌ (nếu không, người dùng screen
 *                     reader chỉ thấy một khoảng trống im lặng)
 */
export function SkeletonStatus({ label, children, className }: SkeletonStatusProps) {
  return (
    <div role="status" aria-busy="true" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Preset dựng sẵn
   ──────────────────────────────────────────────────────────────────────────── */

export interface SkeletonPetAvatarProps {
  /** Cỡ cạnh (px). MẶC ĐỊNH 44 = `size-11` — cỡ icon thật trong dashboard staff. */
  size?: number;
  /** Bo vuông-mềm (`rounded-2xl`, mặc định) hay tròn hoàn toàn. */
  circle?: boolean;
  tone?: SkeletonTone;
  className?: string;
}

/** Ảnh/icon đại diện thú cưng. */
export function SkeletonPetAvatar({
  size = 44,
  circle = false,
  tone = "ondark",
  className,
}: SkeletonPetAvatarProps) {
  return (
    <Skeleton
      variant="rect"
      width={size}
      height={size}
      rounded={circle ? "full" : "2xl"}
      tone={tone}
      className={cn("shrink-0", className)}
    />
  );
}

export interface SkeletonAppointmentCardProps {
  tone?: SkeletonTone;
  className?: string;
}

/**
 * NỘI DUNG một hàng lịch hẹn — KHÔNG kèm thẻ kính; lớp gọi tự bọc
 * (ví dụ `LiquidGlassCard`) để khớp đúng vỏ của nội dung thật.
 *
 * SỐ ĐO — sao chép từ hàng thật trong `components/staff/StaffDashboard.tsx`
 * (khối `line 436-518`):
 *   khung ngoài  flex-col gap-4 px-5 py-4 · lg:flex-row  → 20/16px, gap 16px
 *   cột trái     flex-1 min-w-0 items-center gap-3        → icon cách chữ 12px
 *   icon         size-11 (44px) rounded-2xl
 *   dòng 1       `font-bold text-base`                   → cao 24px (lh/16px)
 *   dòng 2       `truncate text-sm`                      → cao 20px (lh/14px)
 *   dòng 3       `truncate text-xs`                      → cao 16px (lh/12px)
 *   cột phải     hai pill `h-8` (32px)
 * ⇒ chiều cao phần cơ bản = 16 + max(44, 24+20+16) + 16 = 92px.
 *
 * GIỚI HẠN CLS — ĐỌC TRƯỚC KHI COI LÀ "CLS = 0":
 *   Hàng thật có hai dòng ĐIỀU KIỆN (`appt.confirmedBy` và `appt.ownerPhone`,
 *   mỗi dòng cao 16px + margin 6px/2px). Chúng chỉ xuất hiện khi dữ liệu có.
 *   Nghĩa là chiều cao hàng thật DAO ĐỘNG theo dữ liệu (92px, hoặc 114px,
 *   hoặc 132px…), nên KHÔNG skeleton tĩnh nào khớp được mọi trường hợp.
 *   Preset này khớp TRƯỜNG HỢP CƠ BẢN (92px). Muốn triệt CLS tuyệt đối thì
 *   phải render skeleton có cùng số dòng điều kiện — việc đó cần biết trước
 *   dữ liệu, tức là phải đổi luồng tải. Đã ghi vào báo cáo Giai đoạn 1.
 */
export function SkeletonAppointmentCard({
  tone = "ondark",
  className,
}: SkeletonAppointmentCardProps) {
  return (
    <div className={cn("flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center", className)}>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <SkeletonPetAvatar size={44} tone={tone} />
        <div className="min-w-0 flex-1">
          <Skeleton variant="text" width={148} height={24} tone={tone} />
          <Skeleton variant="text" width={224} height={20} tone={tone} className="max-w-full" />
          <Skeleton variant="text" width={192} height={16} tone={tone} className="max-w-full" />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Skeleton variant="text" width={112} height={32} tone={tone} />
        <Skeleton variant="text" width={96} height={32} tone={tone} />
      </div>
    </div>
  );
}

export interface SkeletonMedicalRecordListProps {
  /** Số hàng xương. Phải khớp số hàng thật đang được tải để không nhảy chiều cao. */
  rows?: number;
  tone?: SkeletonTone;
  className?: string;
}

/**
 * Danh sách hàng hồ sơ bệnh án (dùng ở Giai đoạn 6 — màn hình staff).
 *
 * CHƯA CÓ ĐỐI TƯỢNG THẬT ĐỂ ĐỐI CHIẾU: hiện chưa có màn hình nào render danh
 * sách hồ sơ kèm trạng thái tải (các trang hồ sơ đang là Server Component vẽ
 * thẳng). Vì vậy preset này dùng CHUNG số đo hàng đã kiểm chứng của
 * `SkeletonAppointmentCard`; khi nối vào UI thật ở GĐ6 phải đo lại và đối
 * chiếu từng con số, không được coi là đã đạt CLS = 0.
 */
export function SkeletonMedicalRecordList({
  rows = 4,
  tone = "ondark",
  className,
}: SkeletonMedicalRecordListProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: Math.max(1, rows) }, (_, index) => (
        <SkeletonAppointmentCard key={index} tone={tone} />
      ))}
    </div>
  );
}

/** Vài dòng chữ. Dùng cho đoạn mô tả / ghi chú đang tải. */
export function SkeletonText({
  lines = 3,
  tone = "page",
  className,
  width,
}: {
  lines?: number;
  tone?: SkeletonTone;
  className?: string;
  width?: number | string;
}) {
  return (
    <Skeleton
      variant="list"
      lines={lines}
      height={12}
      tone={tone}
      width={width}
      className={className}
    />
  );
}
