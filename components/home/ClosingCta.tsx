"use client";

/**
 * components/home/ClosingCta.tsx
 *
 * Hạng mục 25.8 — khối kính lỏng lớn ngay trước footer.
 *
 * VÌ SAO KHÔNG TRÙNG VỚI THẺ "BELWEE LUÔN QUAN TÂM BẠN" (hạng mục D):
 *   Thẻ D theo yêu cầu loại trừ **trang chủ**, nên hai thứ không cùng xuất
 *   hiện ở một trang. Ở đây chỉ có Closing CTA.
 *
 * `variant="lite"` vì nền phía sau ở đáy trang đã là gradient mờ (khối blob
 * A5) — blur thêm ở đây không đổi gì mắt thấy mà tốn GPU mỗi lần cuộn.
 */

import GlassSurface from "@/components/ui/GlassSurface";
import GlassButton from "@/components/ui/GlassButton";
import { PhoneIcon } from "@/components/ui/icons";
import { useLanguage } from "@/components/LanguageProvider";
import { HOTLINE, HOTLINE_DISPLAY } from "@/lib/clinics";

export default function ClosingCta({ className }: { className?: string }) {
  const { t } = useLanguage();

  return (
    <section
      aria-labelledby="closing-cta-title"
      className={`relative px-5 pb-16 pt-4 sm:px-6 lg:pb-20 ${className ?? ""}`}
    >
      <GlassSurface
        radius="3xl"
        variant="lite"
        className="mx-auto max-w-[1240px] px-6 py-12 text-center sm:px-12"
      >
        <h2
          id="closing-cta-title"
          className="mx-auto max-w-[24ch] text-[28px] font-medium leading-[1.25] tracking-tight text-slate-900 sm:text-[34px]"
        >
          {t("closing.title")}
        </h2>
        <p className="mx-auto mt-3 max-w-[52ch] text-sm leading-relaxed text-slate-600 sm:text-base">
          {t("closing.desc")}
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {/* `as="a"` — CTA này ĐIỀU HƯỚNG tới /dich-vu, không phải hành động
              nên phải là liên kết thật (đề bài §1). `GlassButton` lo phần
              vật liệu kính. */}
          <GlassButton
            as="a"
            href="/dich-vu"
            className="h-12 px-7 text-sm font-semibold"
          >
            {t("closing.book")}
          </GlassButton>
          <a
            href={`tel:${HOTLINE}`}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-slate-300/80 bg-white/80 px-7 text-sm font-semibold text-slate-800 transition-colors hover:bg-white focus-visible:outline-none"
          >
            <PhoneIcon className="h-[18px] w-[18px] shrink-0 text-rose-600" />
            {t("closing.call")}
            <span className="sr-only"> — {HOTLINE_DISPLAY}</span>
          </a>
        </div>
      </GlassSurface>
    </section>
  );
}