/**
 * components/LiquidGlassDefs.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Nguồn filter SVG dùng chung cho toàn bộ hệ "Liquid Glass" của Belwee.
 *
 * Kiến trúc 3 lớp (áp dụng cho mọi .glassContainer / .glassBtn):
 *   1. .glassContainer::after  → nền kính, `filter: url(#container-glass)`
 *   2. .glassBtn::before       → lớp frosted + viền sáng inset
 *   3. .glassBtn::after        → đổ bóng / quầng neon (z-index: -1)
 *
 * `#container-glass` = goo (color matrix trên alpha đã blur) + displacement
 * theo nhiễu turbulence → mép kính "chảy" như chất lỏng, các mảng rời rạc
 * dính lại thành một khối liền mạch.
 *
 * Component này render ĐÚNG MỘT LẦN trong app/layout.tsx. Filter SVG không
 * chiếm layout (w-0 h-0) và chỉ được trình duyệt tính khi có phần tử tham chiếu.
 */

import React from "react";

/* Bản đồ dịch (displacement map) cho #lens-edge.
 *
 * Chi tiết dễ sai: feDisplacementMap luôn đọc CẢ hai trục. Muốn lượt 1 chỉ bẻ
 * mép trái/phải thì trục Y phải dịch đúng 0, tức kênh alpha của bản đồ phải
 * đứng yên ở 0.5 (vì dịch = scale × (giá trị − 0.5)). Một hình SVG phủ kín mặc
 * định có alpha = 1, tức trục Y sẽ bị đẩy +scale/2 ở MỌI điểm — mép kính bị
 * trôi lệch toàn bộ. Vì vậy rect dùng fill-opacity='.5': kênh R/G mang gradient
 * (trục cần bẻ), kênh A đứng yên 0.5 (trục cần giữ nguyên). */
const LENS_MAP_X =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' preserveAspectRatio='none'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='0'%3E%3Cstop offset='0' stop-color='%23000'/%3E%3Cstop offset='.5' stop-color='%23800'/%3E%3Cstop offset='1' stop-color='%23fff'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='100' height='100' fill='url(%23g)' fill-opacity='.5'/%3E%3C/svg%3E";

const LENS_MAP_Y =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' preserveAspectRatio='none'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='0' y2='1'%3E%3Cstop offset='0' stop-color='%23000'/%3E%3Cstop offset='.5' stop-color='%23800'/%3E%3Cstop offset='1' stop-color='%23fff'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='100' height='100' fill='url(%23g)' fill-opacity='.5'/%3E%3C/svg%3E";

export default function LiquidGlassDefs() {
  return (
    <svg
      className="lg-svg-defs"
      width="0"
      height="0"
      aria-hidden="true"
      focusable="false"
      style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
    >
      <defs>
        {/* ──────────────────────────────────────────────────────────────
            1. CONTAINER GLASS — goo + khúc xạ mép cho khối "kính lỏng"
            x/y/width/height nới rộng để displacement không bị cắt cụt.
            ────────────────────────────────────────────────────────────── */}
        <filter
          id="container-glass"
          x="-20%"
          y="-20%"
          width="140%"
          height="140%"
          colorInterpolationFilters="sRGB"
        >
          {/* Bước 1 — làm mềm alpha để tạo "chất lỏng" */}
          <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
          {/* Bước 2 — color matrix kéo alpha về nhị phân (goo/contrast ramp):
              hàng alpha = 0 0 0 20 -9 → alpha > 0.45 thành đặc, dưới ngưỡng biến mất,
              các mảng rời dính vào nhau. */}
          <feColorMatrix
            in="blur"
            type="matrix"
            values="1 0 0 0 0
                    0 1 0 0 0
                    0 0 1 0 0
                    0 0 0 20 -9"
            result="goo"
          />
          {/* Bước 3 — nhiễu fractal làm bản đồ dịch chuyển (khúc xạ) */}
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.009 0.013"
            numOctaves="2"
            seed="7"
            result="noise"
          />
          <feGaussianBlur in="noise" stdDeviation="1.4" result="softNoise" />
          {/* Bước 4 — dịch mép khối goo theo nhiễu → mép "chảy" lỏng */}
          <feDisplacementMap
            in="goo"
            in2="softNoise"
            scale="11"
            xChannelSelector="R"
            yChannelSelector="G"
            result="liquid"
          />
          {/* Bước 5 — giữ nội dung gốc sắc nét, chỉ bo mềm lớp nền */}
          <feComposite in="liquid" in2="goo" operator="atop" result="merged" />
          <feGaussianBlur in="merged" stdDeviation="0.5" />
        </filter>

        {/* ──────────────────────────────────────────────────────────────
            2. GLASS GLOW — quầng neon cho viền/đường phát sáng
            ────────────────────────────────────────────────────────────── */}
        <filter id="container-glass-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="glow-soft" />
          <feGaussianBlur in="SourceGraphic" stdDeviation="11" result="glow-wide" />
          <feMerge>
            <feMergeNode in="glow-wide" />
            <feMergeNode in="glow-soft" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* ──────────────────────────────────────────────────────────────
            3. GLASS SHEEN — ánh sáng quét trên mặt kính (highlight trượt)
            ────────────────────────────────────────────────────────────── */}
        <filter id="container-glass-sheen" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="sheen" />
          <feComponentTransfer in="sheen">
            <feFuncA type="linear" slope="1.35" intercept="-0.1" />
          </feComponentTransfer>
        </filter>
        {/* ──────────────────────────────────────────────────────────────
            3b. LENS EDGE — khúc xạ rìa thật cho backdrop-filter
            ──────────────────────────────────────────────────────────────
            #container-glass bên trên dịch chuyển alpha CỦA CHÍNH NÓ (lớp goo
            bên trong phần tử). Filter này thì ngược lại: nó dịch chuyển
            backdrop — tức những pixel nền thật sự bị bẻ cong ở mép kính.

            Cách làm: feDisplacementMap cần một "bản đồ dịch" (in2). Bản đồ ở đây
            là một gradient tuyến tính dạng data-URI, sáng dần từ trái sang phải:
              giữa  = 0.5  → dịch 0        (nền giữa thẻ giữ nguyên)
              trái  = 0.0  → dịch -scale/2 (kéo nền từ ngoài vào mép trái)
              phải  = 1.0  → dịch +scale/2 (kéo nền ra ngoài mép phải)
            Chạy HAI lượt nối tiếp (một theo trục X, một theo trục Y) để cả bốn
            mép đều bẻ cong — một lượt đơn chỉ bẻ được hai mép đối diện.

            CHỈ CHẠY TRÊN CHROMIUM. url() trong backdrop-filter không được Safari
            và Firefox hỗ trợ; xem .site-global-hamburger-card trong globals.css —
            filter nằm ở một khai báo riêng để trình duyệt thiếu hỗ trợ chỉ mất
            riêng dòng đó, không mất luôn hiệu ứng kính.
            ────────────────────────────────────────────────────────────── */}
        <filter
          id="lens-edge"
          x="-8%"
          y="-8%"
          width="116%"
          height="116%"
          colorInterpolationFilters="sRGB"
        >
          {/* Lượt 1 — bẻ mép trái & phải theo trục X */}
          <feImage
            href={LENS_MAP_X}
            result="mapX"
            preserveAspectRatio="none"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="mapX"
            scale="10"
            xChannelSelector="R"
            yChannelSelector="A"
            result="bentX"
          />
          {/* Lượt 2 — bẻ mép trên & dưới theo trục Y, nối tiếp lượt 1 */}
          <feImage
            href={LENS_MAP_Y}
            result="mapY"
            preserveAspectRatio="none"
          />
          <feDisplacementMap
            in="bentX"
            in2="mapY"
            scale="10"
            xChannelSelector="A"
            yChannelSelector="R"
            result="bentXY"
          />
        </filter>
      </defs>
    </svg>
  );
}
