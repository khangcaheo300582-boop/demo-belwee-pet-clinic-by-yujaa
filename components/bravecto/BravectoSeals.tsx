"use client";

/**
 * components/bravecto/BravectoSeals.tsx
 *
 * Hai "con dấu" của trang Bravecto 365, dựng bằng SVG inline:
 *
 *   • YearBadge   — huy hiệu tròn tím, chữ trắng xếp vòng, đồng hồ bấm giờ nhô ở
 *                   đỉnh. Dùng ở Hero và dùng LẠI ở Section 5 (cùng một component,
 *                   không chép hai bản SVG).
 *   • DaysSeal365 — nhãn tròn trắng viền răng cưa "CÙNG BÉ / 365 / NGÀY".
 *
 * ── VÌ SAO KHÔNG DÙNG ẢNH PNG ────────────────────────────────────────────────
 * /public không có file huy hiệu nào. Xuất SVG từ trình thiết kế rồi commit cũng
 * được, nhưng SVG inline giữ chữ là CHỮ THẬT: sắc nét ở mọi DPR, đổi được nội
 * dung bằng sửa một hằng số, và không tốn thêm request (0 KB ảnh).
 *
 * ── ID TRONG SVG ─────────────────────────────────────────────────────────────
 * Mỗi <textPath>/<clipPath> cần id duy nhất. Badge xuất hiện 2 lần trên cùng
 * một trang nên id cứng sẽ trùng ⇒ trình duyệt lấy id đầu tiên, badge thứ hai
 * mất chữ. `useId()` của React sinh id ổn định giữa server và client nên không
 * có hydration mismatch.
 */

import { useId } from "react";

/** Năm dòng chữ xếp vòng trong huy hiệu tím (đúng nội dung thiết kế). */
const BADGE_LINES = [
  "1 NĂM BẢO VỆ",
  "CHO CHÓ KHỎI",
  "VE, GHẺ, BỌ CHÉT",
  "VỚI 1 LẦN TIÊM",
  "DUY NHẤT",
] as const;

/**
 * Đường cong nhẹ cho một dòng chữ.
 *
 * Dùng cung bậc 2 (quadratic) chứ không dùng cung tròn quanh tâm: 5 dòng chữ
 * đồng tâm sẽ có độ cong rất khác nhau (dòng trong cong gắt, dòng ngoài gần
 * thẳng), chữ dòng trong bị bóp méo. Cung bậc 2 với cùng độ vồng cho 5 dòng
 * "cong đều như tem" và chữ vẫn thẳng hàng dọc, đọc được ở cỡ 12–14px.
 */
function curvedLinePath(y: number, halfWidth = 74, bulge = 12): string {
  return `M ${120 - halfWidth} ${y} Q 120 ${y - bulge} ${120 + halfWidth} ${y}`;
}

interface YearBadgeProps {
  className?: string;
  /** Nhãn cho trình đọc màn hình; nội dung chữ bên trong là trang trí. */
  label?: string;
}

export function YearBadge({ className, label }: YearBadgeProps) {
  const uid = useId().replace(/[:]/g, "");
  const accessibleLabel =
    label ??
    "1 năm bảo vệ cho chó khỏi ve, ghẻ, bọ chét với 1 lần tiêm duy nhất";

  return (
    <svg
      viewBox="0 0 240 240"
      className={className}
      role="img"
      aria-label={accessibleLabel}
      focusable="false"
    >
      <defs>
        <linearGradient id={`${uid}-plate`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#6b3aa3" />
          <stop offset="55%" stopColor="#5a2c8c" />
          <stop offset="100%" stopColor="#43206b" />
        </linearGradient>
        {BADGE_LINES.map((_, index) => (
          <path
            key={index}
            id={`${uid}-arc-${index}`}
            d={curvedLinePath(84 + index * 21)}
            fill="none"
          />
        ))}
      </defs>

      {/* Quai đồng hồ bấm giờ — nhô lên khỏi vòng tròn.
          Chân quai kéo xuống tới y=36, tức ĐÈ LÊN vành trắng (đỉnh vành ở y=23)
          và chạm thân tím (đỉnh ở y=30). Nếu chỉ đặt quai phía trên vành, trên
          thẻ trắng ở Section 5 vành trắng biến mất vào nền ⇒ quai trông như một
          chữ T lơ lửng, rời khỏi huy hiệu. */}
      <rect x="104" y="0" width="32" height="12" rx="5" fill="#b3abc4" />
      <rect x="116" y="10" width="8" height="26" rx="3" fill="#cfc9db" />

      {/* Thân huy hiệu: viền trắng dày + nền tím */}
      <circle cx="120" cy="126" r="103" fill="#ffffff" />
      <circle cx="120" cy="126" r="96" fill={`url(#${uid}-plate)`} />
      <circle
        cx="120"
        cy="126"
        r="86"
        fill="none"
        stroke="rgba(255,255,255,0.28)"
        strokeWidth="1.6"
      />

      <g aria-hidden="true">
        {BADGE_LINES.map((line, index) => (
          <text
            key={line}
            fill="#ffffff"
            fontSize="16.5"
            fontWeight="800"
            letterSpacing="0.6"
            textAnchor="middle"
            fontFamily="var(--font-nunito), system-ui, sans-serif"
          >
            <textPath href={`#${uid}-arc-${index}`} startOffset="50%">
              {line}
            </textPath>
          </text>
        ))}
      </g>
    </svg>
  );
}

/**
 * Vẽ viền răng cưa (scallop) cho nhãn tròn.
 *
 * Công thức: mỗi "răng" là một nửa đường tròn bán kính r, tâm nằm trên vòng
 * bán kính (R − r). Để các răng chạm nhau đúng, r phải thoả
 * `r = R·sin(π/n) / (1 + sin(π/n))` — khi đó dây cung giữa hai tâm bằng đúng
 * đường kính răng, tức hai nửa đường tròn nối liền không hở, không chồng.
 * Dùng cung `A r r 0 0 1` (sweep = 1) để răng nở RA NGOÀI.
 */
function scallopPath(cx: number, cy: number, radius: number, teeth: number): string {
  const step = (Math.PI * 2) / teeth;
  const tooth = (radius * Math.sin(Math.PI / teeth)) / (1 + Math.sin(Math.PI / teeth));
  const orbit = radius - tooth;
  let path = "";

  for (let index = 0; index < teeth; index += 1) {
    const from = index * step - Math.PI / 2;
    const to = from + step;
    const x1 = cx + orbit * Math.cos(from);
    const y1 = cy + orbit * Math.sin(from);
    const x2 = cx + orbit * Math.cos(to);
    const y2 = cy + orbit * Math.sin(to);

    if (index === 0) path += `M ${x1.toFixed(2)} ${y1.toFixed(2)} `;
    path += `A ${tooth.toFixed(2)} ${tooth.toFixed(2)} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)} `;
  }

  return `${path}Z`;
}

interface DaysSeal365Props {
  className?: string;
}

export function DaysSeal365({ className }: DaysSeal365Props) {
  return (
    <svg
      viewBox="0 0 200 200"
      className={className}
      role="img"
      aria-label="Cùng bé 365 ngày"
      focusable="false"
    >
      <path d={scallopPath(100, 100, 98, 30)} fill="#ffffff" />
      <text
        x="100"
        y="74"
        textAnchor="middle"
        fill="#2f7fd0"
        fontSize="19"
        fontWeight="800"
        letterSpacing="1.6"
        fontFamily="var(--font-nunito), system-ui, sans-serif"
      >
        CÙNG BÉ
      </text>
      <text
        x="100"
        y="136"
        textAnchor="middle"
        fill="#5a2c8c"
        fontSize="62"
        fontWeight="900"
        letterSpacing="-2"
        fontFamily="var(--font-nunito), system-ui, sans-serif"
      >
        365
      </text>
      <text
        x="100"
        y="166"
        textAnchor="middle"
        fill="#2f7fd0"
        fontSize="19"
        fontWeight="800"
        letterSpacing="1.6"
        fontFamily="var(--font-nunito), system-ui, sans-serif"
      >
        NGÀY
      </text>
    </svg>
  );
}
