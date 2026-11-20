"use client";

/**
 * components/DoctorLanyardBadge.tsx
 *
 * Thẻ treo (lanyard badge) 3D cho trang hồ sơ bác sĩ — /doi-ngu/[slug].
 *
 * Chuỗi transform lồng nhau, mỗi lớp giữ đúng một trục để chúng cộng lại
 * thay vì đè lên nhau:
 *
 *   stage  — perspective: 1200px. Bắt buộc: không có nó thì lật thẻ bị phẳng
 *            (dẹt) dù rotateY có đúng 180 độ.
 *     └ sway — rotateZ lắc đung, transform-origin: top center để điểm tựa
 *              nằm cố định ở mép trên màn hình, đúng như dây đeo thật.
 *         └ drag — kéo / ném thẻ (x, y) + nghiêng theo vận tốc ngang.
 *             └ flip — rotateY 0/180 với transform-style: preserve-3d.
 *                 ├ front — mặt trước
 *                 └ back  — mặt sau, pre-rotate 180deg + backface-visibility:
 *                           hidden, nếu không chữ sẽ bị ngược khi lật.
 *
 * Lưu ý kỹ thuật: hai lớp sway và drag đều phải có
 * `transform-style: preserve-3d`, nếu không trình duyệt sẽ flatten chúng và
 * hiệu ứng lật thẻ sụp thành phép chiếu phẳng. Hệ quả: tuyệt đối không đặt
 * `overflow`, `filter` hoặc `border-radius` lên hai lớp đó — chỉ đặt được ở
 * mặt thẻ (nằm ngoài chuỗi 3D).
 */

import { useCallback, useId, useMemo, useRef, useState } from "react";
import {
  motion,
  useInView,
  useMotionValue,
  useSpring,
  useTransform,
} from "framer-motion";
import { useLanguage } from "@/components/LanguageProvider";
import { prefersReducedMotion } from "@/lib/motion";
import type { MessageKey } from "@/lib/i18n";

/* ------------------------------------------------------------------ *
 * Vật liệu thẻ — mỗi preset đổi cả bề mặt, mực chữ và màu nhấn.
 * Dùng inline style thay vì class Tailwind động: Tailwind quét source
 * lúc build nên class sinh động sẽ bị purge khỏi CSS.
 * ------------------------------------------------------------------ */

type FinishId = "obscuration" | "vip" | "holo" | "backstage" | "titanium";

interface Finish {
  id: FinishId;
  labelKey: MessageKey;
  /** Bề mặt thẻ. */
  surface: string;
  /** Viền trong mảnh. */
  hairline: string;
  /** Mực chữ chính. */
  ink: string;
  /** Mực chữ phụ. */
  inkMuted: string;
  /** Màu nhấn: gạch chân, pill, mã QR. */
  accent: string;
  /** Mực chữ đặt trên nền nhấn. */
  accentInk: string;
  qrBg: string;
  qrInk: string;
  /** Khung thông tin mặt sau. */
  panel: string;
  panelInk: string;
  panelMuted: string;
  /** Quầng sáng toả ra sau thẻ. */
  halo: string;
  /** Lớp phủ bóng loáng phủ lên mặt thẻ. */
  gloss: string;
  /** Vệt ánh sáng chạy ngang (chỉ Holo). */
  iridescent?: boolean;
}

const FINISHES: Finish[] = [
  {
    id: "obscuration",
    labelKey: "badge.presetObscuration",
    surface:
      "linear-gradient(158deg, #1c1e24 0%, #0a0b0e 46%, #171920 78%, #0d0e12 100%)",
    hairline: "rgba(255,255,255,0.12)",
    ink: "#f5f5f6",
    inkMuted: "#8e939c",
    accent: "#e9e9ec",
    accentInk: "#0a0b0e",
    qrBg: "#0a0b0e",
    qrInk: "#f5f5f6",
    panel: "rgba(255,255,255,0.055)",
    panelInk: "#f0f0f2",
    panelMuted: "#82868f",
    halo: "rgba(226,232,240,0.09)",
    gloss:
      "linear-gradient(118deg, rgba(255,255,255,0) 32%, rgba(255,255,255,0.10) 46%, rgba(255,255,255,0) 60%)",
  },
  {
    id: "vip",
    labelKey: "badge.presetVip",
    surface:
      "linear-gradient(158deg, #241b09 0%, #0d0a05 44%, #2d2209 76%, #120d05 100%)",
    hairline: "rgba(214,177,111,0.34)",
    ink: "#f8eeda",
    inkMuted: "#a89169",
    accent: "#e8c987",
    accentInk: "#1a1408",
    qrBg: "#0f0b05",
    qrInk: "#e8c987",
    panel: "rgba(232,201,135,0.10)",
    panelInk: "#f8eeda",
    panelMuted: "#a89169",
    halo: "rgba(232,201,135,0.20)",
    gloss:
      "linear-gradient(118deg, rgba(255,236,190,0) 30%, rgba(255,236,190,0.20) 46%, rgba(255,236,190,0) 62%)",
  },
  {
    id: "holo",
    labelKey: "badge.presetHolo",
    surface:
      "linear-gradient(152deg, #241a45 0%, #0a2340 20%, #0a3a30 40%, #43280a 60%, #2b0f45 80%, #08243f 100%)",
    hairline: "rgba(255,255,255,0.22)",
    ink: "#ffffff",
    inkMuted: "rgba(255,255,255,0.7)",
    accent: "#7dd3fc",
    accentInk: "#06121c",
    qrBg: "rgba(4,10,18,0.9)",
    qrInk: "#ffffff",
    panel: "rgba(255,255,255,0.11)",
    panelInk: "#ffffff",
    panelMuted: "rgba(255,255,255,0.72)",
    halo: "rgba(125,211,252,0.22)",
    gloss:
      "linear-gradient(118deg, rgba(255,255,255,0) 28%, rgba(255,255,255,0.16) 44%, rgba(255,255,255,0) 62%)",
    iridescent: true,
  },
  {
    id: "backstage",
    labelKey: "badge.presetBackstage",
    surface:
      "linear-gradient(158deg, #1c1636 0%, #08070f 46%, #1b1133 76%, #0a0812 100%)",
    hairline: "rgba(167,139,250,0.32)",
    ink: "#f3f0ff",
    inkMuted: "#9b93b8",
    accent: "#a78bfa",
    accentInk: "#0d0820",
    qrBg: "#0a0812",
    qrInk: "#c4b5fd",
    panel: "rgba(167,139,250,0.11)",
    panelInk: "#f3f0ff",
    panelMuted: "#9b93b8",
    halo: "rgba(167,139,250,0.20)",
    gloss:
      "linear-gradient(118deg, rgba(255,255,255,0) 32%, rgba(255,255,255,0.12) 46%, rgba(255,255,255,0) 60%)",
  },
  {
    id: "titanium",
    labelKey: "badge.presetTitanium",
    surface:
      "linear-gradient(152deg, #71767e 0%, #dfe3e9 16%, #8b9099 32%, #f1f4f8 48%, #7d838c 64%, #cfd4da 82%, #63686f 100%)",
    hairline: "rgba(20,24,30,0.20)",
    ink: "#15181d",
    inkMuted: "#4b525c",
    accent: "#1c2027",
    accentInk: "#f2f4f7",
    qrBg: "#e9ecf1",
    qrInk: "#15181d",
    panel: "rgba(21,24,29,0.10)",
    panelInk: "#15181d",
    panelMuted: "#4b525c",
    halo: "rgba(226,232,240,0.26)",
    gloss:
      "linear-gradient(118deg, rgba(255,255,255,0) 30%, rgba(255,255,255,0.55) 45%, rgba(255,255,255,0) 62%)",
  },
];

const CARD_SHADOW =
  "inset 0 1px 0 rgba(255,255,255,0.22), 0 34px 64px -20px rgba(0,0,0,0.88), 0 12px 26px -10px rgba(0,0,0,0.65)";

/* ------------------------------------------------------------------ *
 * Mã QR trang trí — ma trận tất định theo seed của từng bác sĩ.
 * Không phải mã QR chuẩn để quét được: đủ cấu trúc (3 khối định vị,
 * dải đồng bộ, mã căn chỉnh, vùng yên tĩnh) để đọc như một thẻ thật
 * mà không cần thêm thư viện tạo QR vào bundle.
 * ------------------------------------------------------------------ */

const QR_MODULES = 25;

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildQrMatrix(seed: string): boolean[][] {
  const random = mulberry32(hashSeed(seed));
  const size = QR_MODULES;
  const grid: boolean[][] = Array.from({ length: size }, () =>
    new Array<boolean>(size).fill(false),
  );
  const locked: boolean[][] = Array.from({ length: size }, () =>
    new Array<boolean>(size).fill(false),
  );

  const put = (x: number, y: number, on: boolean) => {
    grid[y][x] = on;
    locked[y][x] = true;
  };
  const block = (x: number, y: number, w: number, h: number, on: boolean) => {
    for (let j = 0; j < h; j += 1) {
      for (let i = 0; i < w; i += 1) put(x + i, y + j, on);
    }
  };

  // 3 khối định vị 7x7 ở ba góc.
  block(0, 0, 7, 7, true);
  block(1, 1, 5, 5, false);
  block(2, 2, 3, 3, true);
  block(size - 7, 0, 7, 7, true);
  block(size - 6, 1, 5, 5, false);
  block(size - 5, 2, 3, 3, true);
  block(0, size - 7, 7, 7, true);
  block(1, size - 6, 5, 5, false);
  block(2, size - 5, 3, 3, true);

  // Dải tách trắng quanh khối định vị.
  block(7, 0, 1, 8, false);
  block(0, 7, 8, 1, false);
  block(size - 8, 0, 1, 8, false);
  block(size - 8, 7, 8, 1, false);
  block(7, size - 8, 1, 8, false);
  block(0, size - 8, 8, 1, false);

  // Dải đồng bộ (timing) chạy ngang và dọc.
  for (let i = 8; i < size - 8; i += 1) {
    const on = i % 2 === 0;
    put(i, 6, on);
    put(6, i, on);
  }

  // Mã căn chỉnh 5x5 ở góc dưới bên phải.
  block(size - 9, size - 9, 5, 5, true);
  block(size - 8, size - 8, 3, 3, false);
  block(size - 7, size - 7, 1, 1, true);

  // Vùng dữ liệu.
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (locked[y][x]) continue;
      grid[y][x] = random() > 0.53;
    }
  }

  return grid;
}

/** Gộp các ô liền nhau theo hàng thành một path duy nhất cho nhẹ DOM. */
function matrixToPath(grid: boolean[][]): string {
  const parts: string[] = [];
  for (let y = 0; y < grid.length; y += 1) {
    let x = 0;
    while (x < grid.length) {
      if (!grid[y][x]) {
        x += 1;
        continue;
      }
      let run = 1;
      while (x + run < grid.length && grid[y][x + run]) run += 1;
      parts.push(`M${x} ${y}h${run}v1h-${run}z`);
      x += run;
    }
  }
  return parts.join("");
}

/* ------------------------------------------------------------------ *
 * Dây đeo — hai dải vải dệt hội tụ về móc.
 * Vẽ bằng SVG với các nét đồng tâm trên cùng một path: nét rộng nhất là
 * viền, các nét hẹp hơn nằm giữa tạo cảm giác dây tròn xuyên.
 * `vector-effect="non-scaling-stroke"` giữ bề dày dây không bị méo
 * khi viewBox bị kéo giãn theo chiều cao responsive.
 * ------------------------------------------------------------------ */

const STRAP_L = "M 58 0 L 120 200";
const STRAP_R = "M 182 0 L 120 200";
const STRAP_STROKES: Array<{ width: number; color: string; dash?: string }> = [
  { width: 22, color: "#05060a" },
  { width: 17, color: "#16181e" },
  { width: 10, color: "#33373f" },
  { width: 4, color: "rgba(255,255,255,0.22)" },
  { width: 22, color: "rgba(255,255,255,0.07)", dash: "2 6" },
];

function LanyardStrap() {
  return (
    <div
      className="relative h-[118px] w-[min(76vw,288px)] sm:h-[165px] lg:h-[215px]"
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 240 200"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
      >
        {[STRAP_L, STRAP_R].map((d) => (
          <g key={d} strokeLinecap="round" fill="none">
            {STRAP_STROKES.map((s) => (
              <path
                key={`${d}-${s.width}-${s.color}`}
                d={d}
                stroke={s.color}
                strokeWidth={s.width}
                strokeDasharray={s.dash}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </g>
        ))}
      </svg>
    </div>
  );
}

/** Móc kim loại: vòng nối dây, thân móc và hàm cắp vào khe thẻ. */
function Clip({ gradientId }: { gradientId: string }) {
  return (
    <div
      className="relative z-10 -mb-1.5 h-[46px] w-[104px]"
      style={{ transform: "translateZ(8px)" }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 120 52" className="h-full w-full" fill="none">
        <defs>
          <linearGradient id={gradientId} x1="60" y1="4" x2="60" y2="50" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#fdfdfe" />
            <stop offset="0.22" stopColor="#c8cdd4" />
            <stop offset="0.48" stopColor="#7f858e" />
            <stop offset="0.7" stopColor="#dfe3e8" />
            <stop offset="1" stopColor="#6b7078" />
          </linearGradient>
        </defs>
        <circle cx="60" cy="9" r="8" stroke={`url(#${gradientId})`} strokeWidth="4.5" />
        <path d="M60 17 L60 25" stroke={`url(#${gradientId})`} strokeWidth="5" strokeLinecap="round" />
        <rect x="34" y="23" width="52" height="23" rx="9" fill={`url(#${gradientId})`} />
        <rect x="39" y="26.5" width="42" height="6" rx="3" fill="rgba(255,255,255,0.55)" />
        <path
          d="M40 42 q20 13 40 0"
          stroke={`url(#${gradientId})`}
          strokeWidth="5"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Thẻ
 * ------------------------------------------------------------------ */

export interface DoctorLanyardBadgeProps {
  /** Tên in lớn trên thẻ, ví dụ "TS. Nguyễn Văn An". */
  name: string;
  /** Chuyên môn, ví dụ "Nội khoa & Tim mạch". */
  specialty: string;
  /** Thứ tự trong đội ngũ (1..n) — in ở góc phải thẻ. */
  index: number;
  /** Chuỗi ổn định (slug) để mỗi bác sĩ có một mã riêng. */
  seed: string;
}

export default function DoctorLanyardBadge({
  name,
  specialty,
  index,
  seed,
}: DoctorLanyardBadgeProps) {
  const { t } = useLanguage();
  const reactId = useId().replace(/:/g, "");
  const clipGradientId = `dlb-clip-${reactId}`;

  const stageRef = useRef<HTMLDivElement>(null);
  const draggedRef = useRef(false);

  const [flipped, setFlipped] = useState(false);
  const [swayOn, setSwayOn] = useState(true);
  const [finishId, setFinishId] = useState<FinishId>("obscuration");

  const finish = FINISHES.find((f) => f.id === finishId) ?? FINISHES[0];

  // Chỉ chạy chuyển động khi khối thẻ thực sự nằm trong khung nhìn — rời
  // khung thì dừng để không đốt vô ích một vòng rAF trên màn hình dài.
  const inView = useInView(stageRef, { margin: "220px 0px 120px 0px" });
  const swayActive = swayOn && inView && !prefersReducedMotion();

  // Kéo thẻ: x/y do useMotionValue nắm để suy ra độ nghiêng.
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const tiltFromX = useTransform(x, [-170, 170], [-9, 9]);
  const tilt = useSpring(tiltFromX, { stiffness: 110, damping: 14, mass: 0.7 });

  const qrPath = useMemo(() => matrixToPath(buildQrMatrix(seed)), [seed]);
  const badgeId = useMemo(() => 1000 + (hashSeed(seed) % 9000), [seed]);

  const flip = useCallback(() => setFlipped((prev) => !prev), []);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
        event.preventDefault();
        flip();
      }
    },
    [flip],
  );

  const slotStyle: React.CSSProperties = {
    background: finish.id === "titanium" ? "rgba(21,24,29,0.42)" : "rgba(0,0,0,0.55)",
    boxShadow: `inset 0 1px 2px rgba(0,0,0,0.6), 0 0 0 1px ${finish.hairline}`,
  };

  const faceShell: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    backfaceVisibility: "hidden",
    WebkitBackfaceVisibility: "hidden",
    borderRadius: "1rem",
    border: "1px solid rgba(255,255,255,0.9)",
    boxShadow: CARD_SHADOW,
    overflow: "hidden",
    background: finish.surface,
    color: finish.ink,
  };

  return (
    <section
      data-reveal="fade-up"
      aria-label={t("badge.title")}
      className="overflow-hidden rounded-[2.5rem] bg-zinc-950 text-zinc-100 shadow-[0_40px_90px_-40px_rgba(2,6,23,0.85)]"
    >
      {/* Đầu đề */}
      <div className="relative z-20 flex flex-wrap items-end justify-between gap-4 px-6 pt-8 sm:px-10 sm:pt-10">
        <div className="max-w-xl space-y-2.5">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-300">
            🪪 {t("badge.kicker")}
          </span>
          <h2 className="text-xl font-light tracking-tight text-white sm:text-2xl">
            {t("badge.title")}
          </h2>
          <p className="text-xs leading-relaxed text-zinc-400 sm:text-sm">
            {t("badge.desc")}
          </p>
        </div>
        <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">
          {t("badge.hint")}
        </p>
      </div>

      {/* Sân khấu thẻ */}
      <div
        ref={stageRef}
        className="relative h-[600px] overflow-hidden sm:h-[680px] lg:h-[740px]"
        style={{
          // Bắt buộc: mọi lớp 3D bên dưới đều lấy phối cảnh từ đây.
          perspective: 1200,
          background:
            "radial-gradient(120% 70% at 50% -10%, rgba(255,255,255,0.07), transparent 60%), #09090b",
        }}
      >
        {/* Lưới nền mờ */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.16]"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.5) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage:
              "radial-gradient(85% 65% at 50% 22%, #000 0%, transparent 78%)",
            WebkitMaskImage:
              "radial-gradient(85% 65% at 50% 22%, #000 0%, transparent 78%)",
          }}
        />
        {/* Quầng sáng màu theo vật liệu thẻ */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-[58%] h-[300px] w-[300px] -translate-x-1/2 rounded-full blur-[80px] transition-colors duration-500"
          style={{ background: finish.halo }}
        />

        {/* Lớp 1 — lắc đung quanh điểm tựa ở mép trên */}
        <motion.div
          className="absolute inset-x-0 top-0 flex flex-col items-center"
          style={{
            transformOrigin: "top center",
            transformStyle: "preserve-3d",
          }}
          animate={swayActive ? { rotateZ: [-4.5, 4.5] } : { rotateZ: 0 }}
          transition={
            swayActive
              ? {
                  duration: 4.8,
                  repeat: Infinity,
                  repeatType: "mirror",
                  ease: [0.45, 0, 0.55, 1],
                }
              : { duration: 0.9, ease: [0.16, 1, 0.3, 1] }
          }
        >
          {/* Lớp 2 — kéo / ném thẻ */}
          <motion.div
            drag
            dragConstraints={stageRef}
            dragElastic={0.55}
            dragMomentum={false}
            dragSnapToOrigin
            dragTransition={{ power: 0.35, timeConstant: 420, bounceStiffness: 260, bounceDamping: 22 }}
            onDragStart={() => {
              draggedRef.current = true;
            }}
            onDragEnd={() => {
              // `click` bắn ngay sau `pointerup`, còn đây là handler
              // drag-end. Xoá cờ ở tick kế tiếp để cú ném không bị hiểu
              // nhầm thành bấm lật thẻ — nhưng cú bấm kế tiếp vẫn ăn.
              window.setTimeout(() => {
                draggedRef.current = false;
              }, 0);
            }}
            className="flex cursor-grab touch-none flex-col items-center active:cursor-grabbing"
            style={{ x, y, rotate: tilt, transformOrigin: "top center", transformStyle: "preserve-3d" }}
          >
            <LanyardStrap />
            <Clip gradientId={clipGradientId} />

            {/* Lớp 3 — lật 3D hai mặt thẻ */}
            <motion.div
              className="relative w-[min(66vw,272px)] cursor-pointer"
              style={{ aspectRatio: "3 / 4", transformStyle: "preserve-3d" }}
              onClick={() => {
                // Bấm sau khi vừa kéo là kết thúc cú ném, không phải ý định lật.
                if (draggedRef.current) return;
                flip();
              }}
              onKeyDown={handleKeyDown}
              role="button"
              tabIndex={0}
              aria-pressed={flipped}
              aria-label={flipped ? t("badge.flipFront") : t("badge.flipBack")}
              animate={{ rotateY: flipped ? 180 : 0 }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* ---- Mặt trước ---- */}
              <div style={faceShell}>
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0"
                  style={{ background: finish.gloss }}
                />
                {finish.iridescent && inView && !prefersReducedMotion() && (
                  <motion.div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 -skew-x-12"
                    style={{
                      background:
                        "linear-gradient(90deg, transparent, rgba(255,255,255,0.42), rgba(125,211,252,0.28), transparent)",
                    }}
                    animate={{ x: ["-40%", "420%"] }}
                    transition={{
                      duration: 4.4,
                      repeat: Infinity,
                      repeatDelay: 1.8,
                      ease: "easeInOut",
                    }}
                  />
                )}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-[6px] rounded-[13px]"
                  style={{ border: `1px solid ${finish.hairline}` }}
                />
                {/* Khe đeo thẻ */}
                <div
                  aria-hidden="true"
                  className="absolute left-1/2 top-2.5 h-1.5 w-11 -translate-x-1/2 rounded-full"
                  style={slotStyle}
                />

                <div className="relative z-10 flex h-full flex-col p-5">
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-[15px] font-semibold tracking-[-0.02em]">
                      {t("badge.wordmark")}
                    </span>
                    <span
                      className="rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em]"
                      style={{ borderColor: finish.hairline, color: finish.inkMuted }}
                    >
                      ID #{badgeId}
                    </span>
                  </div>

                  <div className="mt-4">
                    <p
                      className="text-[8.5px] font-bold uppercase tracking-[0.3em]"
                      style={{ color: finish.accent }}
                    >
                      {t("badge.edition")}
                    </p>
                    <p className="mt-1.5 text-[10.5px] font-medium leading-[1.35]">
                      {t("badge.event")}
                    </p>
                    <p
                      className="mt-1 text-[9.5px] uppercase tracking-[0.12em]"
                      style={{ color: finish.inkMuted }}
                    >
                      {t("badge.date")}
                    </p>
                  </div>

                  <div className="mt-auto">
                    <h3 className="text-balance break-words text-[clamp(1.15rem,5.2vw,1.7rem)] font-semibold leading-[1.04] tracking-[-0.02em]">
                      {name}
                    </h3>
                    <div
                      className="mt-2.5 h-px w-9"
                      style={{ background: finish.accent }}
                    />
                    <p
                      className="mt-2.5 text-[10px] font-semibold uppercase leading-[1.4] tracking-[0.16em]"
                      style={{ color: finish.inkMuted }}
                    >
                      {specialty}
                    </p>
                    <span
                      className="mt-3.5 inline-flex rounded-full px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.2em]"
                      style={{ background: finish.accent, color: finish.accentInk }}
                    >
                      {t("badge.accessPill")}
                    </span>
                  </div>

                  <div
                    className="mt-4 flex items-end justify-between border-t pt-2.5"
                    style={{ borderColor: finish.hairline }}
                  >
                    <span
                      className="text-[9.5px] tracking-[0.06em]"
                      style={{ color: finish.inkMuted }}
                    >
                      {t("badge.site")}
                    </span>
                    <span className="text-[13px] font-semibold leading-none">
                      {index}.
                    </span>
                  </div>
                </div>
              </div>

              {/* ---- Mặt sau: pre-rotate 180° để chữ không bị ngược khi lật ---- */}
              <div style={{ ...faceShell, transform: "rotateY(180deg)" }}>
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0"
                  style={{ background: finish.gloss }}
                />
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-[6px] rounded-[13px]"
                  style={{ border: `1px solid ${finish.hairline}` }}
                />
                <div
                  aria-hidden="true"
                  className="absolute left-1/2 top-2.5 h-1.5 w-11 -translate-x-1/2 rounded-full"
                  style={slotStyle}
                />

                <div className="relative z-10 flex h-full flex-col p-5">
                  <div
                    className="flex items-start justify-between gap-3 border-b pb-3"
                    style={{ borderColor: finish.hairline }}
                  >
                    <span className="text-[15px] font-semibold tracking-[-0.02em]">
                      {t("badge.wordmark")}
                    </span>
                    <span
                      className="max-w-[58%] text-right text-[8.5px] font-bold uppercase leading-[1.3] tracking-[0.2em]"
                      style={{ color: finish.accent }}
                    >
                      {t("badge.credential")}
                    </span>
                  </div>

                  <div className="flex flex-1 flex-col items-center justify-center gap-3">
                    {/* aspect-square để svg h-full có chiều cao xác định —
                        nếu không, height:100% sẽ rơi về auto và méo ô QR. */}
                    <div
                      className="aspect-square w-[126px] rounded-[10px] p-2.5"
                      style={{ background: finish.qrBg, boxShadow: `0 0 0 1px ${finish.hairline}` }}
                    >
                      <svg
                        viewBox={`0 0 ${QR_MODULES} ${QR_MODULES}`}
                        className="h-full w-full"
                        role="img"
                        aria-label={t("badge.qrLabel")}
                      >
                        <path d={qrPath} fill={finish.qrInk} />
                      </svg>
                    </div>
                    <p
                      className="text-center text-[8.5px] font-bold uppercase tracking-[0.24em]"
                      style={{ color: finish.inkMuted }}
                    >
                      {t("badge.scanLabel")}
                    </p>
                  </div>

                  <dl
                    className="rounded-[10px] px-3 py-2.5"
                    style={{ background: finish.panel }}
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <dt
                        className="text-[8px] font-bold uppercase tracking-[0.2em]"
                        style={{ color: finish.panelMuted }}
                      >
                        {t("badge.clinicLabel")}
                      </dt>
                      <dd
                        className="truncate text-[9.5px] font-semibold"
                        style={{ color: finish.panelInk }}
                      >
                        {t("badge.clinicValue")}
                      </dd>
                    </div>
                    <div
                      className="mt-1.5 flex items-baseline justify-between gap-3 border-t pt-1.5"
                      style={{ borderColor: finish.hairline }}
                    >
                      <dt
                        className="text-[8px] font-bold uppercase tracking-[0.2em]"
                        style={{ color: finish.panelMuted }}
                      >
                        {t("badge.roomLabel")}
                      </dt>
                      <dd
                        className="truncate text-[9.5px] font-semibold"
                        style={{ color: finish.panelInk }}
                      >
                        {t("badge.roomValue")}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </motion.div>

        {/* Thanh điều khiển nổi */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center px-3 pb-4 sm:pb-5">
          <div
            role="group"
            aria-label={t("badge.finishLabel")}
            className="pointer-events-auto flex max-w-full flex-col items-center gap-2 rounded-[1.35rem] border border-white/10 bg-zinc-900/85 px-2.5 py-2.5 shadow-[0_24px_50px_-16px_rgba(0,0,0,0.9)] backdrop-blur-xl sm:flex-row sm:gap-3 sm:rounded-full"
          >
            <div className="flex flex-wrap items-center justify-center gap-1">
              {FINISHES.map((option) => {
                const active = option.id === finishId;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setFinishId(option.id)}
                    aria-pressed={active}
                    className={`rounded-full px-2.5 py-1.5 text-[9.5px] font-semibold uppercase tracking-[0.14em] transition-colors duration-300 ${
                      active
                        ? "bg-white text-zinc-950"
                        : "text-zinc-400 hover:bg-white/10 hover:text-zinc-100"
                    }`}
                  >
                    {t(option.labelKey)}
                  </button>
                );
              })}
            </div>

            <span aria-hidden="true" className="hidden h-5 w-px bg-white/15 sm:block" />

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={flip}
                aria-pressed={flipped}
                className={`rounded-full border px-3 py-1.5 text-[9.5px] font-semibold uppercase tracking-[0.14em] transition-colors duration-300 ${
                  flipped
                    ? "border-white/70 bg-white/15 text-white"
                    : "border-white/15 text-zinc-300 hover:border-white/40 hover:text-white"
                }`}
              >
                {flipped ? t("badge.flipBack") : t("badge.flipFront")}
              </button>
              <button
                type="button"
                onClick={() => setSwayOn((prev) => !prev)}
                aria-pressed={swayOn}
                className={`rounded-full border px-3 py-1.5 text-[9.5px] font-semibold uppercase tracking-[0.14em] transition-colors duration-300 ${
                  swayOn
                    ? "border-white/70 bg-white/15 text-white"
                    : "border-white/15 text-zinc-300 hover:border-white/40 hover:text-white"
                }`}
              >
                {t("badge.sway")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
