// app/lib/route-skeletons.tsx
//
// Skeleton hiển thị khi chuyển trang (RouteSkeletonOverlay gọi qua
// `getSkeletonForPath`). Mục tiêu: không nháy trắng, xấp xỉ bố cục thật, và
// hạn chế giật.
//
// ĐÃ VIẾT LẠI Ở GIAI ĐOẠN 1 — những gì bản cũ làm sai:
//   1. Nền hardcode navy `#0a0f1c` cho MỌI route, trong khi mặc định của site
//      là `--pt-bg` (kem sáng). Đi từ trang sáng sang trang sáng, cả màn hình
//      nháy từ kem → navy → kem. Nay nền lấy từ `--pt-bg` theo theme, và các
//      route tự vẽ nền tối được liệt kê trong `DARK_ROUTE_PREFIXES` để dùng
//      nền tối cho khớp.
//   2. Shimmer tự viết (`background-position` + `@keyframes skeletonShimmer`
//      trong globals.css) — buộc vẽ lại gradient mỗi frame. Nay dùng
//      `animate-skeleton-sheen` (transform) từ hệ Skeleton dùng chung.
//   3. Không có `aria-busy`, không có chữ cho màn hình đọc.
//   4. Kích thước là phỏng đoán rời rạc; nay các khối chính bám theo bố cục
//      thật của trang chủ (hero full-height, hàng thẻ dịch vụ, lưới 4 thẻ).
//
// LƯU Ý A11Y: overlay cha (`RouteSkeletonOverlay`) đặt `aria-hidden="true"`
// trên toàn bộ vùng phủ, nên `role="status"` ở đây KHÔNG tới được screen
// reader. Đây là lựa chọn có chủ ý: đây là cổng chuyển trang trước khi nội
// dung thật commit — nội dung thật sẽ tự được thông báo khi hiện ra. Markup
// vẫn để đúng để nếu sau này bỏ `aria-hidden` thì không phải sửa lại.

import React from "react";
import Skeleton, { SkeletonStatus, type SkeletonTone } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";

/**
 * Các route tự vẽ nền TỐI cho mình (kiểm tra bằng cách đọc class ở gốc trang):
 *   /dang-nhap, /cap-lai-mat-khau, /tao-tai-khoan (redirect sang dang-nhap)
 *   /kien-thuc-thu-y(+[slug]), /tuyen-dung(+chi-tiet), /booking/*, /staff/*
 *   /gioi-thieu (foto nền tối `anhnentcdichvu.webp` + kính tối `10, 15, 30`)
 *   /care-schedule, /client-portal (kính tối `#0c1322` / `bg-white/5`)
 *   /ChiTietBookingForm (overlay `slate-950/80`, chữ `slate-100`)
 *
 * So khớp KHÔNG phân biệt hoa thường (thư mục `ChiTietBookingForm` nằm lệch
 * casing với URL người dùng; pathname có thể nhảy hoa/thường giữa môi trường).
 *
 * Danh sách này cũng được nhúng vào script rèm trước-paint (lib/bootCurtain.ts)
 * nên KHÔNG được xoá hay đổi tên mà chưa sửa nơi dùng.
 */
export const DARK_ROUTE_PREFIXES = [
  "/dang-nhap",
  "/cap-lai-mat-khau",
  "/tao-tai-khoan",
  "/kien-thuc-thu-y",
  "/tuyen-dung",
  "/booking",
  "/staff",
  "/gioi-thieu",
  "/care-schedule",
  "/client-portal",
  "/ChiTietBookingForm",
] as const;

export function isDarkRoute(pathname: string): boolean {
  const requested = pathname.toLowerCase();
  return DARK_ROUTE_PREFIXES.some((prefix) => {
    const lower = prefix.toLowerCase();
    return requested === lower || requested.startsWith(`${lower}/`);
  });
}

function frameTone(pathname: string): SkeletonTone {
  return isDarkRoute(pathname) ? "ondark" : "page";
}

/* ────────────────────────────────────────────────────────────────────────────
   Khung chung
   ──────────────────────────────────────────────────────────────────────────── */

function SkeletonFrame({
  pathname,
  label,
  children,
}: {
  pathname: string;
  label: string;
  children: React.ReactNode;
}) {
  const dark = isDarkRoute(pathname);
  return (
    <div
      className={cn(
        "h-full w-full overflow-hidden",
        dark ? "bg-[#070b16]" : "bg-[var(--pt-bg)]"
      )}
    >
      <SkeletonStatus
        label={label}
        className="mx-auto flex min-h-full w-full max-w-5xl flex-col items-center px-4 pt-32 sm:px-8"
      >
        {children}
      </SkeletonStatus>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Trang nội dung chung
   ──────────────────────────────────────────────────────────────────────────── */

/** Skeleton trang nội dung — bám hình dạng chung: nhãn + tiêu đề + khối + lưới. */
export function PageSkeleton({ pathname = "/" }: { pathname?: string }) {
  const tone = frameTone(pathname);
  return (
    <SkeletonFrame pathname={pathname} label="Đang tải trang">
      {/* Nhãn nhỏ phía trên tiêu đề (các trang đều có một `span` nhãn). */}
      <Skeleton variant="text" width={132} height={24} tone={tone} className="mb-5" />
      <Skeleton variant="text" width="62%" height={26} tone={tone} className="mb-3" />
      <Skeleton variant="text" width="44%" height={14} tone={tone} className="mb-10" />

      <div className="w-full space-y-6">
        {/* Khối nội dung đầu — tương ứng hero/banner của trang (cao ≥ 220px). */}
        <Skeleton variant="rect" height={220} rounded="3xl" tone={tone} className="w-full" />
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Skeleton variant="rect" height={168} rounded="2xl" tone={tone} />
          <Skeleton variant="rect" height={168} rounded="2xl" tone={tone} />
        </div>
        <Skeleton variant="rect" height={128} rounded="2xl" tone={tone} className="w-full" />
      </div>
    </SkeletonFrame>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Trang chủ — KHÔNG có skeleton (yêu cầu "trừ trang chủ")
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * Trang chủ được miễn skeleton ở MỌI luồng:
 *  • F5 / mở URL trực tiếp: script rèm pre-paint (lib/bootCurtain.ts) đã dừng
 *    từ đầu (`pathname === "/"` → không thêm class `boot-curtain`), và file
 *    `app/loading.tsx` đứng ở segment gốc KHÔNG tồn tại nữa — trang chủ tự boot
 *    bằng video intro.
 *  • Điều hướng client về `/`: overlay bỏ qua — `getSkeletonForPath` trả `null`,
 *    `RouteSkeletonOverlay` render không có gì; `navGate` và preload media vẫn
 *    chạy như bình thường để hiệu ứng nội dung chỉ bắt đầu khi trang sẵn sàng.
 */

/** Map route → skeleton tương ứng. Trang chủ (`/`) trả `null` — không skeleton. */
export function getSkeletonForPath(pathname: string): React.ReactNode {
  if (pathname === "/") return null;
  return <PageSkeleton pathname={pathname} />;
}
