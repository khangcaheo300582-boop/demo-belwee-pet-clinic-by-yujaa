/**
 * Dấu chân trang trí tĩnh trong nền hero.
 *
 * Ba điểm cần giữ khi sửa file này:
 *
 * Cường độ thấp (opacity 0.06–0.13). Đây là lớp vân nền, không phải hoạt
 *    cảnh: người đọc phải đọc được tiêu đề đặt trên nó trước khi kịp thấy
 *    dấu chân.
 */

interface Paw {
  /** Vị trí trong hero, phần trăm. */
  left: string;
  top: string;
  /** Cạnh hình, px. */
  size: number;
  /** Nghiêng tĩnh, cho dấu chân nằm nghiêng thay vì thẳng đứng. */
  rot: number;
  /** Nhịp trôi (giây) và trễ, để các dấu không đồng pha. */
  dur: number;
  delay: number;
  opacity: number;
}

const PAWS: Paw[] = [
  { left: "5%",  top: "26%", size: 54, rot: -18, dur: 11,   delay: 0,   opacity: 0.13 },
  { left: "88%", top: "62%", size: 44, rot: 24,  dur: 9.5,  delay: 1.2, opacity: 0.11 },
  { left: "70%", top: "18%", size: 30, rot: -8,  dur: 13,   delay: 2.1, opacity: 0.09 },
  { left: "22%", top: "80%", size: 38, rot: 32,  dur: 10.5, delay: 0.6, opacity: 0.1 },
  { left: "52%", top: "88%", size: 26, rot: 12,  dur: 14,   delay: 3.4, opacity: 0.07 },
];

/** Inline SVG dùng chung cho mọi dấu chân: một path cho miếng đệm, bốn
 *  ellipse cho ngón. Rẻ hơn ảnh, và kế thừa `currentColor` nên đổi màu
 *  được bằng CSS. */
function PawGlyph({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} fill="currentColor" aria-hidden="true">
      <path d="M32 31c8.8 0 16.5 6.4 16.5 13.6 0 4.9-4 7.9-8.8 7.9-3.7 0-5.9-2-7.7-2s-4 2-7.7 2c-4.8 0-8.8-3-8.8-7.9C15.5 37.4 23.2 31 32 31z" />
      <ellipse cx="16.5" cy="22" rx="5.4" ry="7" transform="rotate(-17 16.5 22)" />
      <ellipse cx="26.5" cy="14.5" rx="4.9" ry="7" transform="rotate(-5 26.5 14.5)" />
      <ellipse cx="37.5" cy="14.5" rx="4.9" ry="7" transform="rotate(5 37.5 14.5)" />
      <ellipse cx="47.5" cy="22" rx="5.4" ry="7" transform="rotate(17 47.5 22)" />
    </svg>
  );
}

export default function HeroPaws() {
  return (
    <div className="hero-paws" aria-hidden="true">
      {PAWS.map((paw, index) => (
        <div
          key={index}
          className="hero-paw"
          style={{
            left: paw.left,
            top: paw.top,
            opacity: paw.opacity,
            // Biến này để CSS lấy ra, không dùng ở JS.
            ["--paw-dur" as string]: `${paw.dur}s`,
            ["--paw-delay" as string]: `${paw.delay}s`,
            ["--paw-rot" as string]: `${paw.rot}deg`,
          }}
        >
          <span className="hero-paw__float">
            <PawGlyph size={paw.size} />
          </span>
        </div>
      ))}
    </div>
  );
}