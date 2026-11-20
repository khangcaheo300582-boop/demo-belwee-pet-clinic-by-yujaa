"use client";

/**
 * components/home/CareReminder.tsx
 *
 * Hạng mục 25.7 — biểu mẫu nhắc lịch chăm sóc (opt-in).
 *
 * ── VÌ SAO KHÔNG DÙNG `useActionState` / `useFormStatus` ──────────────────────
 * Đề bài §9 (G2) và §12 (I2) yêu cầu `useFormStatus` + `useOptimistic`. Cả hai
 * hook đó chỉ có ở **React 19**; dự án đang chạy **React 18.3.1**
 * (`package.json`) — không có `useActionState`, và `<form action={fn}>` với hàm
 * tuỳ ý cũng là React 19.
 *
 * Đã thử và build ĐÃ FAIL đúng như vậy:
 *   "Attempted import error: 'useActionState' is not exported from 'react'"
 *   → `/page` không prerender được.
 *
 * ⇒ Dùng đường tương thích React 18: `onSubmit` + `useTransition` để gọi Server
 * Action. Vẫn giữ đúng hai nguyên tắc quan trọng: nút lấy trạng thái "đang
 * gửi" từ MỘT nguồn, và chống bấm lặp bằng `disabled` thật.
 * Khi dự án nâng lên React 19, đổi sang `useActionState` là một dòng.
 *
 * ⚠️ Hiển thị rõ chữ "chưa nối dịch vụ gửi thật" — xem app/actions/care-reminder.ts.
 */

import { useState, useTransition, type FormEvent } from "react";
import GlassSurface from "@/components/ui/GlassSurface";
import GlassButton from "@/components/ui/GlassButton";
import { submitCareReminder, type CareReminderResult } from "@/app/actions/care-reminder";
import { useLanguage } from "@/components/LanguageProvider";

const INITIAL: CareReminderResult = { status: "idle" };

export default function CareReminder({ className }: { className?: string }) {
  const { t } = useLanguage();
  const [result, setResult] = useState<CareReminderResult>(INITIAL);
  // `isPending` là nguồn duy nhất cho trạng thái nút — không tự thêm state riêng.
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const formData = new FormData(form);
    startTransition(async () => {
      setResult(await submitCareReminder(result, formData));
    });
  }

  return (
    <section
      aria-labelledby="remind-title"
      className={`relative px-5 py-16 sm:px-6 lg:py-20 ${className ?? ""}`}
    >
      <GlassSurface
        radius="3xl"
        variant="lite"
        className="mx-auto max-w-[880px] px-6 py-10 sm:px-10"
      >
        <div className="text-center">
          <span className="inline-block rounded-full bg-blue-100/80 border border-blue-200/80 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.28em] text-blue-700">
            {t("remind.eyebrow")}
          </span>
          <h2
            id="remind-title"
            className="mx-auto mt-4 max-w-[22ch] text-[26px] font-medium leading-[1.3] tracking-tight text-slate-900 sm:text-[30px]"
          >
            {t("remind.title")}
          </h2>
          <p className="mx-auto mt-3 max-w-[54ch] text-sm leading-relaxed text-slate-600">
            {t("remind.desc")}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 grid gap-4 sm:grid-cols-2" noValidate>
          <div>
            <label htmlFor="remind-name" className="mb-1.5 block text-sm font-semibold text-slate-800">
              {t("remind.name")}
            </label>
            <input
              id="remind-name"
              name="name"
              type="text"
              autoComplete="name"
              required
              aria-invalid={result.fieldErrors?.name ? true : undefined}
              aria-describedby={result.fieldErrors?.name ? "remind-name-err" : undefined}
              className="w-full rounded-xl border border-slate-300/90 bg-white/90 px-4 py-3 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500"
            />
            {result.fieldErrors?.name && (
              <p id="remind-name-err" className="mt-1.5 text-xs font-medium text-rose-600">
                {t("remind.error")}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="remind-email" className="mb-1.5 block text-sm font-semibold text-slate-800">
              {t("remind.email")}
            </label>
            <input
              id="remind-email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              aria-invalid={result.fieldErrors?.email ? true : undefined}
              aria-describedby={result.fieldErrors?.email ? "remind-email-err" : undefined}
              className="w-full rounded-xl border border-slate-300/90 bg-white/90 px-4 py-3 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500"
            />
            {result.fieldErrors?.email && (
              <p id="remind-email-err" className="mt-1.5 text-xs font-medium text-rose-600">
                {t("remind.error")}
              </p>
            )}
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="remind-pet" className="mb-1.5 block text-sm font-semibold text-slate-800">
              {t("remind.pet")}
            </label>
            <input
              id="remind-pet"
              name="pet"
              type="text"
              className="w-full rounded-xl border border-slate-300/90 bg-white/90 px-4 py-3 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 sm:max-w-[50%]"
            />
          </div>

          <div className="sm:col-span-2">
            {/* KHÔNG tick sẵn — yêu cầu §25.7. */}
            <label className="flex items-start gap-2.5 text-[13px] leading-relaxed text-slate-700">
              <input
                type="checkbox"
                name="consent"
                required
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-400 accent-blue-600"
              />
              <span>{t("remind.consent")}</span>
            </label>
          </div>

          <div className="sm:col-span-2">
            <GlassButton
              type="submit"
              status={pending ? "loading" : result.status === "success" ? "success" : "idle"}
              disabled={pending}
              liveMessage={pending ? t("remind.submitting") : undefined}
              className="h-12 w-full px-6 text-sm font-semibold sm:w-auto"
            >
              {pending ? t("remind.submitting") : t("remind.submit")}
            </GlassButton>
          </div>

          <p className="sm:col-span-2 text-xs leading-relaxed text-amber-800/90">
            {t("remind.consentPending")}
          </p>

          {/* `role="status"` + `aria-live="polite"` để screen reader đọc kết quả
              mà không phải nhìn thấy thay đổi màu. */}
          <p
            role="status"
            aria-live="polite"
            className={`sm:col-span-2 text-sm font-semibold ${
              result.status === "success"
                ? "text-emerald-700"
                : result.status === "error"
                  ? "text-rose-600"
                  : "sr-only"
            }`}
          >
            {result.status === "success" && t("remind.success")}
            {result.status === "error" && t("remind.error")}
          </p>
        </form>
      </GlassSurface>
    </section>
  );
}