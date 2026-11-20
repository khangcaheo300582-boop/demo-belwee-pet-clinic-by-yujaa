"use client";

/**
 * components/home/HomeFaq.tsx
 *
 * Hạng mục 25.6 — Câu hỏi thường gặp.
 *
 * ── VÌ SAO MẶC ĐỊNH SECTION NÀY KHÔNG HIỆN ───────────────────────────────────
 * Yêu cầu §28: "Mọi section mới có feature flag hoặc điều kiện dữ liệu: thiếu
 * dữ liệu thật thì không render, không để placeholder lộ ra."
 *
 * `FAQ_ITEMS` đang RỖNG, và phải rỗng: câu trả lời về giờ mở cửa, cách đặt
 * lịch, loài thú nhận khám, hình thức thanh toán là **thông tin thực tế của
 * phòng khám**, không phải thứ AI được phép bịa. §26 của đề bài cũng ghi rõ
 * "câu trả lời do chủ dự án cung cấp".
 *
 * ⇒ Khi chủ dự án điền câu trả lời vào `FAQ_ITEMS`, section tự hiện. Không sửa
 * component này.
 *
 * ── A11Y ─────────────────────────────────────────────────────────────────────
 * Mỗi câu là `<h3><button aria-expanded aria-controls>` đúng chuẩn accordion;
 * vùng trả lời dùng `hidden` + `grid-template-rows` (KHÔNG animate `height`).
 */

import GlassSurface from "@/components/ui/GlassSurface";
import { useLanguage } from "@/components/LanguageProvider";

/**
 * Câu hỏi + câu trả lời do CHỦ DỰ ÁN cung cấp.
 *
 * Hiện rỗng — xem lý do ở đầu file. Thêm câu mới bằng cách thêm một mục:
 *   { id: "hours", question: "...", answer: "..." }
 * `answer` phải là câu trả lời THẬT; để trống sẽ khiến câu đó bị bỏ qua.
 */
const FAQ_ITEMS: readonly { id: string; question: string; answer: string }[] = [];

export default function HomeFaq({ className }: { className?: string }) {
  const { t } = useLanguage();

  // Điều kiện dữ liệu — không render gì cả khi chưa có câu trả lời nào.
  const items = FAQ_ITEMS.filter((item) => item.answer.trim().length > 0);
  if (items.length === 0) return null;

  return (
    <section
      aria-labelledby="faq-title"
      className={`relative px-5 py-16 sm:px-6 lg:py-20 ${className ?? ""}`}
    >
      <div className="mx-auto max-w-[880px]">
        <h2
          id="faq-title"
          data-reveal="fade-up"
          className="text-center text-[28px] font-medium leading-[1.3] tracking-tight text-slate-900 sm:text-[30px]"
        >
          {t("faq.title")}
        </h2>

        <div data-reveal-group className="mt-10 space-y-3">
          {items.map((item) => (
            <GlassSurface key={item.id} radius="xl" variant="lite" className="overflow-hidden">
              <summary className="faq-item__summary">
                <span>{item.question}</span>
                <span aria-hidden="true" className="faq-item__chevron">
                  ▾
                </span>
              </summary>
              {/* `details/tummary` xử lý sẵn bàn phím (Enter/Space) và ngữ
                  nghĩa mở/đóng — không cần JS. Vùng trả lời chuyển bằng
                  `grid-template-rows`, KHÔNG animate `height`. */}
              <div className="faq-item__panel">
                <p className="px-5 pb-5 pt-1 text-sm leading-relaxed text-slate-600">
                  {item.answer}
                </p>
              </div>
            </GlassSurface>
          ))}
        </div>
      </div>
    </section>
  );
}