// lib/revealVariants.ts
//
// BẢNG VARIANT DÙNG CHUNG cho hệ thống reveal (hạng mục A7).
//
// VÌ SAO TÁCH RA ĐÂY: dự án có HAI lối vào cùng một hiệu ứng, và cả hai đều
// tự khai bảng `from` của riêng mình:
//   • components/AnimationProvider.tsx — quét cả trang theo attribute
//     `data-reveal` / `data-reveal-group` / `data-reveal-exit`.
//   • components/Reveal.tsx            — wrapper React cho từng phần tử.
// Hai bảng đó đã trôi khỏi nhau: `zoom` là 0.9 ở wrapper nhưng 0.92 ở quét
// trang, `flip-y` là 40° so với 45°. Nghĩa là cùng một tên variant lại cho
// hai chuyển động khác nhau tuỳ theo chỗ dùng — không ai phát hiện được bằng
// mắt, nhưng nó khiến việc "chỉnh variant zoom" thành hai lần sửa ở hai file
// và luôn có nguy cơ chỉ sửa một.
//
// Từ Giai đoạn 1 cả hai import từ file này. Giá trị được chọn theo bản của
// `Reveal.tsx` (bản lộ ra như API công khai của component). Khác biệt so với
// trước: `zoom` của AnimationProvider 0.92 → 0.9, `flip-y` 45° → 40°. Chênh
// lệch 2% tỉ lệ và 5° xoay, dưới ngưỡng nhận biết, và đổi lại hai lối vào
// không thể lệch nhau nữa.
//
// CHỈ transform + opacity (cộng `filter` cho variant `blur`, vốn là hiệu ứng
// điểm dừng — không chạy liên tục trên nhiều phần tử).

export type RevealVariant =
  | "fade"
  | "fade-up"
  | "fade-down"
  | "fade-left"
  | "fade-right"
  | "zoom"
  | "blur"
  | "flip-y";

/** Trạng thái BẮT ĐẦU của mỗi variant. */
export const REVEAL_FROM: Record<RevealVariant, Record<string, unknown>> = {
  fade: { autoAlpha: 0 },
  "fade-up": { autoAlpha: 0, y: 48 },
  "fade-down": { autoAlpha: 0, y: -48 },
  "fade-left": { autoAlpha: 0, x: -56 },
  "fade-right": { autoAlpha: 0, x: 56 },
  zoom: { autoAlpha: 0, scale: 0.9 },
  blur: { autoAlpha: 0, filter: "blur(12px)", y: 24 },
  "flip-y": { autoAlpha: 0, rotationX: 40, transformPerspective: 600 },
};

/** Trạng thái KẾT THÚC — mọi thuộc tính về mặc định, để không giữ transform. */
export const REVEAL_TO: Record<string, unknown> = {
  autoAlpha: 1,
  x: 0,
  y: 0,
  scale: 1,
  rotationX: 0,
  filter: "blur(0px)",
};

/** Tập variant hợp lệ — dùng để validate giá trị của `data-reveal`. */
export const REVEAL_VARIANTS: ReadonlySet<string> = new Set(Object.keys(REVEAL_FROM));

/** Chuẩn hoá giá trị thô của `data-reveal`; giá trị lạ → `"fade-up"`. */
export function normalizeRevealVariant(raw: string | null | undefined): RevealVariant {
  return raw && REVEAL_VARIANTS.has(raw) ? (raw as RevealVariant) : "fade-up";
}
