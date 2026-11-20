/**
 * components/ui/icons.tsx
 *
 * Bộ icon nét mảnh dùng chung cho các section mới (GĐ2B).
 *
 * ── VÌ SAO KHÔNG DÙNG EMOJI ────────────────────────────────────────────────
 * Lần đầu dock dùng 📅/📞/🚨. Đo bằng mắt trên ảnh chụp thật
 * (docs/gd2b-shots/01-dock.png) cho thấy hai lỗi thông tin, không phải lỗi thẩm mỹ:
 *   1. "Phòng khám gần bạn" mang icon LỊCH — hoàn toàn sai nghĩa.
 *   2. "Cấp cứu 24h" và "Gọi tư vấn" cùng ra 📞 — hai hành động khác nhau,
 *      không phân biệt được trước khi đọc chữ.
 * Ngoài ra emoji đổi hình dạng giữa các hệ điều hành và tô màu lung tung
 * (🚨 đỏ, 📅 tím) trong khi phần còn lại của trang dùng một hệ màu.
 *
 * Ở đây: 24×24, nét 1.8, bo tròn, `currentColor` ⇒ luôn cùng độ dày và cùng
 * màu với chữ. KHÔNG có "use client", KHÔNG có state — dùng được ở server component.
 */

import type { SVGProps } from "react";

/** Kích thước mặc định — đủ để đọc ở 18–20px. */
const BASE: SVGProps<SVGSVGElement> = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
  focusable: false,
};

export function CalendarIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...BASE} {...props}>
      <path d="M8 3v3M16 3v3M4.5 9.5h15M6.5 5.5h11A1.5 1.5 0 0 1 19 7v11.5A1.5 1.5 0 0 1 17.5 20h-11A1.5 1.5 0 0 1 5 18.5V7A1.5 1.5 0 0 1 6.5 5.5Z" />
    </svg>
  );
}

/** Điện thoại — dùng cho "Cấp cứu 24h" và "Gọi tư vấn". */
export function PhoneIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...BASE} {...props}>
      <path d="M15.5 21A13.5 13.5 0 0 1 3 8.5 2.5 2.5 0 0 1 5.5 6h1.2a1 1 0 0 1 .98.8l.6 3a1 1 0 0 1-.3.95l-1.3 1.02a11 11 0 0 0 4.05 4.05l1.02-1.3a1 1 0 0 1 .95-.3l3 .6a1 1 0 0 1 .8.98V18a2.5 2.5 0 0 1-2.5 2.5Z" />
    </svg>
  );
}

/** Ghim bản đồ — dùng cho "Phòng khám gần bạn". */
export function MapPinIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...BASE} {...props}>
      <path d="M12 21s7-5.4 7-11a7 7 0 1 0-14 0c0 5.6 7 11 7 11Z" />
      <path d="M12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
    </svg>
  );
}

/**
 * Ổ khóa — dùng cho cổng "đăng nhập để đặt lịch" (GĐ9 · i).
 */
export function LockIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...BASE} {...props}>
      <rect x="4.5" y="10.5" width="15" height="9.5" rx="2.5" />
      <path d="M8 10.5V7.75a4 4 0 0 1 8 0V10.5" />
      <path d="M12 14.25v2.5" />
    </svg>
  );
}

/**
 * Dấu tích — dùng cho nút "dùng vị trí" ở trạng thái đã tìm xong (GĐ9 · d).
 */
export function CheckIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...BASE} {...props}>
      <path d="m5 12.5 4.5 4.5L19 7" />
    </svg>
  );
}

/**
 * Vòng tròn tâm với nét chéo tia — biểu tượng "dùng vị trí của tôi".
 * Dùng cho nút tìm chi nhánh gần nhất (GĐ5, hạng mục 25.4).
 * KHÁC `MapPinIcon`: cái ghim là "một địa điểm", cái này là "hành động định vị".
 */
export function LocateIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...BASE} {...props}>
      <circle cx="12" cy="12" r="3.25" />
      <path d="M12 2.75v2.5M12 18.75v2.5M2.75 12h2.5M18.75 12h2.5" />
      <circle cx="12" cy="12" r="7.25" />
    </svg>
  );
}

/** Bong bóng trò chuyện — dùng cho "Gọi tư vấn" (hỏi bác sĩ). */
export function ChatIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...BASE} {...props}>
      <path d="M20 12a7.5 7.5 0 0 1-10.9 6.7L4 20l1.4-4.6A7.5 7.5 0 1 1 20 12Z" />
    </svg>
  );
}

/** Băng cứu hộ (ống dẫn khí) — dùng cho "Cấp cứu" ở thanh mobile. */
export function SirenIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...BASE} {...props}>
      <path d="M7 15a5 5 0 0 1 10 0v3H7v-3ZM4 21h16M12 4V2.5M5.6 6.6 4.5 5.5M18.4 6.6l1.1-1.1M2.5 12H1M23 12h-1.5" />
    </svg>
  );
}
