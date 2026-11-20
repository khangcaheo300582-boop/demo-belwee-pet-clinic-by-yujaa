"use client";

/**
 * components/home/QuickActionDock.tsx
 *
 * Hạng mục 25.1 — hàng 4 viên thuốc kính ngay dưới hero:
 * Đặt lịch · Cấp cứu 24h · Phòng khám gần bạn · Gọi tư vấn.
 *
 * ── SỐ ĐIỆN THOẠI KHÔNG TỰ BỊA ──────────────────────────────────────────────
 * Mọi số điện thoại lấy từ `lib/clinics.ts` (`HOTLINE`, `HOTLINE_DISPLAY`).
 * Không có số nào gõ tay ở đây. Đổi số ở `lib/clinics.ts` là cả site đổi.
 *
 * ── VÌ SAO "CẤP CỨU 24H" LÀ `tel:` THẬT, KHÔNG PHẢI NÚT ─────────────────────
 * Yêu cầu §1: "Không dùng button/a cho phần tử không có hành động." Gọi điện
 * là hành động thật và `tel:` hoạt động cả khi JavaScript chết, nên nó là
 * `<a href="tel:">` — trình đọc màn hình đọc đúng là "liên kết", và người dùng
 * bấm được ngay cả khi trang chưa hydrate xong.
 *
 * ── PHẠM VI ──────────────────────────────────────────────────────────────────
 * Nằm ngay dưới nút CTA của hero (chèn trong `app/page.tsx`) và hiện ở MỌI
 * kích thước màn hình. Trước GĐ2A, màn hẹp dùng "thanh hành động cố định" dưới
 * màn hình (`components/home/MobileActionBar.tsx`); thanh đó đã bị GỠ vì đè lên
 * nội dung và chiếm diện tích, nên dock này là chỗ giữ các hành động ấy. Bốn
 * viên thuốc nằm trong `flex-wrap` nên tự xuống dòng ở 360px, không tràn ngang.
 */

import type { ReactNode } from "react";
import Link from "next/link";
import GlassPill from "@/components/ui/GlassPill";
import {
  CalendarIcon,
  ChatIcon,
  MapPinIcon,
  PhoneIcon,
} from "@/components/ui/icons";
import { useLanguage } from "@/components/LanguageProvider";
import { HOTLINE, HOTLINE_DISPLAY } from "@/lib/clinics";
import type { MessageKey } from "@/lib/i18n";

interface DockItem {
  key: MessageKey;
  labelKey: MessageKey;
  href: string;
  /** `danger` dùng tint đỏ cho mục cấp cứu. */
  tone?: "danger";
  /**
   * Icon đúng nghĩa. Tách khỏi `href` vì HAI mục cùng gọi `tel:` nhưng phải
   * mang hai ý khác nhau — xem components/ui/icons.tsx.
   */
  icon: ReactNode;
}

const ITEMS: readonly DockItem[] = [
  { key: "dock.book", labelKey: "dock.book", href: "/dich-vu", icon: <CalendarIcon className="h-[18px] w-[18px] shrink-0" /> },
  {
    key: "dock.emergency",
    labelKey: "dock.emergency",
    href: `tel:${HOTLINE}`,
    tone: "danger",
    icon: <PhoneIcon className="h-[18px] w-[18px] shrink-0" />,
  },
  // Mục "Phòng khám gần bạn" dẫn tới trang Liên hệ, nơi có đầy đủ 4 chi nhánh
  // kèm giờ mở cửa. Tính năng "dùng vị trí của tôi" (25.4) CHƯA làm vì toạ độ
  // 4 chi nhánh đều null trong lib/clinics.ts — xem docs/phase-2b-report.md.
  { key: "dock.clinic", labelKey: "dock.clinic", href: "/lien-he", icon: <MapPinIcon className="h-[18px] w-[18px] shrink-0" /> },
  { key: "dock.consult", labelKey: "dock.consult", href: `tel:${HOTLINE}`, icon: <ChatIcon className="h-[18px] w-[18px] shrink-0" /> },
];

export default function QuickActionDock({ className }: { className?: string }) {
  const { t } = useLanguage();

  return (
    <nav aria-label={t("dock.aria")} className={className}>
      <ul className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
        {ITEMS.map((item) => {
          const isPhone = item.href.startsWith("tel:");
          const body = (
            <GlassPill
              as="span"
              static={!isPhone}
              // Màu chữ mặc định lấy từ `.pt-glass` (`color: var(--pt-fg)`).
              // Không thêm `text-*` của Tailwind ở đây: `.pt-glass` nằm ngoài
              // `@layer` nên thắng mọi utility — đo được cả 4 viên trước đó đều
              // ra `rgb(74, 59, 48)` dù đã gắn class.
              // `glass-pill--danger` là class riêng khai sau `.pt-glass` nên mới
              // thắng được, và dùng `--pt-danger` để tự đổi theo theme.
              className={`flex h-11 items-center gap-2 px-4 text-sm font-semibold ${
                item.tone === "danger" ? "glass-pill--danger" : ""
              }`}
            >
              {item.icon}
              {t(item.labelKey)}
              {item.tone === "danger" && (
                <span className="sr-only">{HOTLINE_DISPLAY}</span>
              )}
            </GlassPill>
          );

          return (
            <li key={item.key}>
              <Link
                href={item.href}
                // Liên kết `tel:` không được đưa vào lịch sử điều hướng của SPA
                // và không nên mở tab mới.
                onClick={isPhone ? (e) => e.stopPropagation() : undefined}
                className="inline-block rounded-full focus-visible:outline-none"
                aria-label={isPhone ? `${t(item.labelKey)} — ${HOTLINE_DISPLAY}` : undefined}
              >
                {body}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}