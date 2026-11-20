"use client";

/**
 * components/home/CareJourney.tsx
 *
 * Hạng mục 25.2 — "Hành trình thăm khám 4 bước".
 *
 * ── NỘI DUNG CHỜ DUYỆT ───────────────────────────────────────────────────────
 * Bốn bước dưới đây là **bản nháp AI soạn theo yêu cầu §26**, không phải mô
 * tả đã được phòng khám xác nhận. Mô tả quy trình thăm khám phải ĐÚNG thực tế
 * (bước 2 tiếp nhận có thật không? bước 3 có siêu âm không? nhắc lịch tái khám
 * qua kênh nào?). Vì vậy:
 *   • toàn bộ chữ nằm trong `lib/i18n.ts` khoá `journey.*` để sửa một chỗ;
 *   • component này KHÔNG phát hành JSON-LD (dữ liệu chưa duyệt mà đã đưa lên
 *     schema là nói với Google một điều chưa được kiểm chứng).
 *
 * ── HIỆU ỨNG GĐ9 · (b): MỖI BƯỚC LÀ MỘT CHUỖI ───────────────────────────────
 * Yêu cầu: "mục đặt lịch hẹn hiển thị trước → 3 chấm nảy lên nảy xuống (đang
 * tải) → dấu tích xanh → thanh xanh xương nối sang bước sau", lặp lại hết.
 *
 * Trước GĐ9 chỉ có MỘT thanh nối đầy dần theo tốc độ cuộn — bước 2 có thể hiện
 * trước khi bước 1, và không có trạng thái "đang xử lý" nào. Nay mỗi bước có đủ
 * ba trạng thái và chuỗi chạy theo THỨ TỰ, mỗi bước bắt đầu sau khi bước trước
 * đã xong.
 *
 * `STEP_MS = 1500`: 3 chấm nảy 900ms, tích hiện 300ms, rồi thanh nối 300ms.
 * 4 bước = 6 giây. Số này có ý nghĩa — quá ngắn thì người đọc không kịp thấy
 * "đang tải", quá dài thì họ đã cuộn mất.
 *
 * ── TẠI SAO DÙNG CSS CHỨ KHÔNG DÙNG GSAP ─────────────────────────────────────
 * Chuỗi này chạy MỘT LẦN, 4 bước, không cần điều khiển theo cuộn giữa chừng.
 * CSS animation + `animation-delay` ngắn hơn nhiều so với dựng timeline GSAP,
 * và tự tôn trọng `prefers-reduced-motion` qua khối trong globals.css.
 *
 * ── VÌ SAO BỎ `useScrollProgress` Ở ĐÂY ────────────────────────────────────────
 * Bản GĐ2A dùng `useScrollProgress` để thanh nối đầy dần theo cuộn. Nay thanh
 * nối chạy theo CHUỖI, không theo cuộn — hai hệ cùng điều khiển một thanh sẽ
 * giằng co nhau. `useScrollProgress` vẫn được dùng ở nơi khác.
 */

import GlassSurface from "@/components/ui/GlassSurface";
import useInView from "@/hooks/useInView";
import { useLanguage } from "@/components/LanguageProvider";
import type { MessageKey } from "@/lib/i18n";

interface Step {
  titleKey: MessageKey;
  descKey: MessageKey;
  /** Icon tự vẽ bằng SVG — không dùng emoji để giữ nhất quán độ nét. */
  path: string;
}

const STEPS: readonly Step[] = [
  {
    titleKey: "journey.s1Title",
    descKey: "journey.s1Desc",
    path: "M8 3v3M16 3v3M4.5 9.5h15M6 5.5h12a1.5 1.5 0 0 1 1.5 1.5v11A1.5 1.5 0 0 1 18 19.5H6A1.5 1.5 0 0 1 4.5 18V7A1.5 1.5 0 0 1 6 5.5ZM9 13.5l2 2 4-4",
  },
  {
    titleKey: "journey.s2Title",
    descKey: "journey.s2Desc",
    path: "M12 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM5 20a7 7 0 0 1 14 0",
  },
  {
    titleKey: "journey.s3Title",
    descKey: "journey.s3Desc",
    path: "M12 3v3.5M12 17.5V21M4.2 7.5l3 1.7M16.8 14.8l3 1.7M4.2 16.5l3-1.7M16.8 9.2l3-1.7M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z",
  },
  {
    titleKey: "journey.s4Title",
    descKey: "journey.s4Desc",
    path: "M20 12a8 8 0 1 1-2.6-5.9M20 4v4h-4",
  },
];

/** Thời lượng một bước (ms) — xem khối HIỆU ỨNG. */
const STEP_MS = 1500;

export default function CareJourney({ className }: { className?: string }) {
  const { t } = useLanguage();
  const [listRef, inView] = useInView<HTMLOListElement>({ threshold: 0.25 });

  return (
    <section
      aria-labelledby="journey-title"
      className={`relative px-5 py-16 sm:px-6 lg:py-20 ${className ?? ""}`}
    >
      <div className="mx-auto max-w-[1240px]">
        <div data-reveal="fade-up" className="text-center">
          <span className="inline-block rounded-full bg-blue-100/80 border border-blue-200/80 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.28em] text-blue-700">
            {t("journey.eyebrow")}
          </span>
          {/*
            GĐ9 · (b) — bỏ `max-w-[20ch]`.
            Ước lượng: `1ch` của Nunito 28px ≈ 15.4px nên 20ch ≈ 308px, còn
            "Hành trình thăm khám tại Belwee" dài 31 ký tự ⇒ bị ép thành 3 dòng.
            Chủ dự án yêu cầu tiêu đề dàn NGANG. `max-w-[30ch]` cho vừa 2 dòng
            khi cần nhưng thường vẫn 1 dòng; `text-balance` để khi xuống dòng
            thì hai dòng cân nhau thay vì một dòng dài một dòng ngắn.
          */}
          <h2
            id="journey-title"
            className="mx-auto mt-4 max-w-[30ch] text-balance text-[28px] font-medium leading-[1.25] tracking-tight text-slate-900 sm:text-[30px]"
          >
            {t("journey.title")}
          </h2>
          <span aria-hidden="true" className="mx-auto mt-5 block h-px w-[130px] bg-slate-300/80" />
        </div>

        <ol
          ref={listRef}
          className="journey-grid relative mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6"
        >
          {/* Đường nối "thanh xanh xương": CHẠY THEO CHUỖI, không theo cuộn.
              `inset-x-[12.5%]` = từ TÂM cột thứ nhất đến TÂM cột thứ tư.
              Thứ tự vẽ: `<span>` này là con ĐẦU TIÊN của `<ol>`, các `<li>` mang
              `relative`. Phần tử `absolute` không có z-index và phần tử `relative`
              cũng không có z-index thì vẽ theo THỨ TỰ CÂY ⇒ đường nối nằm DƯỚI
              thẻ. Lần đầu không có `relative` ở `<li>` nên đường nối nằm TRÊN và
              cắt ngang mặt thẻ (đo thật ở GĐ2A). */}
          <span aria-hidden="true" className="journey-connector hidden lg:block">
            {STEPS.slice(0, -1).map((_, i) => (
              <span
                key={i}
                className="journey-connector-seg"
                style={{
                  left: `${(i * 100) / (STEPS.length - 1)}%`,
                  width: `${100 / (STEPS.length - 1)}%`,
                  animationDelay: inView ? `${(i + 1) * STEP_MS + 1100}ms` : "9999ms",
                }}
              />
            ))}
          </span>

          {STEPS.map((step, index) => (
            <li key={step.titleKey} className="relative">
              <GlassSurface
                radius="xl"
                variant="lite"
                className="journey-step h-full px-5 py-6 text-center"
              >
                {/* Vòng tròn icon: đổi từ "đang tải" sang "xong" theo chuỗi. */}
                <span
                  aria-hidden="true"
                  className="journey-icon relative mx-auto flex h-[68px] w-[68px] items-center justify-center rounded-full border border-blue-200/80 bg-white text-blue-600 shadow-[0_6px_18px_-10px_rgba(37,99,235,0.6)]"
                  style={inView ? { animationDelay: `${index * STEP_MS}ms` } : undefined}
                  data-state={inView ? "run" : "idle"}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.7}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="journey-icon-glyph h-7 w-7"
                  >
                    <path d={step.path} />
                  </svg>

                  {/* 3 chấm "đang tải" — chỉ transform/opacity. */}
                  <span className="journey-dots absolute inset-0 flex items-center justify-center gap-1.5">
                    <i /><i /><i />
                  </span>

                  {/* Dấu tích xanh — vẽ bằng stroke-dashoffset (chỉ vẽ nét, không
                      animate layout). `pathLength` cố định 24 cho đúng với path. */}
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    className="journey-check absolute inset-0 h-full w-full p-[18px]"
                  >
                    <path
                      d="M5 12.5l4.5 4.5L19 7"
                      stroke="currentColor"
                      strokeWidth={2.6}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      pathLength={24}
                    />
                  </svg>
                </span>

                <h3 className="mt-4 text-[15px] font-semibold text-slate-900 sm:text-base">
                  {t(step.titleKey)}
                </h3>
                <p className="mt-2 text-[13px] leading-[1.7] text-slate-600 sm:text-[14px]">
                  {t(step.descKey)}
                </p>
                <span
                  aria-hidden="true"
                  className="mt-3 block font-mono text-[11px] font-semibold tracking-[0.2em] text-blue-500/70"
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
              </GlassSurface>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}