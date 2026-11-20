"use client";

// app/not-found.tsx
// 404 page. Rendered for any URL that matches no route — a bad link, a stale
// bookmark, or a mistyped address.
//
// CLIENT COMPONENT + pt-* TOKENS
//   Bản trước dùng palette sáng cứng (`text-slate-900`, `bg-white/70`). Trang
//   này nằm trong `.pt-scope`, nên ở theme Night nền là #1a1a2e trong khi chữ
//   vẫn gần đen — gần như vô hình. Đổi sang `--pt-*` là sửa cả hai: màu chữ
//   đảo theo theme, và tương phản luôn ≥ 4.5:1 vì token đã được cân bằng ở
//   tầng `--pt-*`.
//   Thành client để dùng `t()`; trang 404 không vào tới dữ liệu nên chi phí
//   hydrate không đáng kể, đổi lại copy đúng ngôn ngữ người đang chọn.

import Link from "next/link";
import { useLanguage } from "@/components/LanguageProvider";
import { HOTLINE_DISPLAY } from "@/lib/clinics";

const SUGGESTIONS = [
  { href: "/dich-vu", label: "Dịch vụ", hint: "Khám, tiêm phòng, spa & grooming" },
  { href: "/gioi-thieu", label: "Giới thiệu", hint: "Về phòng khám và đội ngũ bác sĩ" },
  { href: "/lien-he", label: "Liên hệ", hint: "Đặt lịch và tư vấn" },
  { href: "/tien-ich", label: "Công cụ chăm sóc", hint: "Tuổi thú, khẩu phần, triệu chứng" },
] as const;

/** Inline SVG — a lost puppy. Cheaper than an asset and it inherits currentColor. */
function LostPup() {
  return (
    <svg
      viewBox="0 0 120 120"
      className="h-28 w-28 text-[var(--pt-accent)]"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* ears */}
      <path d="M32 44c-8-4-12-14-10-24 8-2 17 3 21 11" fill="currentColor" opacity=".18" />
      <path d="M88 44c8-4 12-14 10-24-8-2-17 3-21 11" fill="currentColor" opacity=".18" />
      {/* head */}
      <circle cx="60" cy="60" r="30" fill="currentColor" opacity=".1" />
      {/* eyes — the "?" and the dot read as a searching look */}
      <circle cx="50" cy="55" r="3.5" fill="currentColor" />
      <circle cx="70" cy="55" r="3.5" fill="currentColor" />
      {/* snout */}
      <ellipse cx="60" cy="72" rx="14" ry="10" fill="currentColor" opacity=".2" />
      <path d="M60 68v4M56 72h8" />
      {/* question mark above */}
      <path
        d="M50 26c0-5 4-9 10-9s10 4 10 9c0 6-8 6-8 12"
        strokeWidth={4}
        fill="none"
      />
      <circle cx="62" cy="44" r="2.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

export default function NotFound() {
  const { t } = useLanguage();

  return (
    <div className="flex min-h-[80vh] w-full items-center justify-center px-6 py-24">
      <div className="pt-glass w-full max-w-2xl rounded-3xl p-8 text-center sm:p-10">
        <div className="mb-4 flex justify-center">
          <LostPup />
        </div>

        <p className="mb-2 text-6xl font-extrabold leading-none tracking-tight text-[var(--pt-accent)] tabular-nums sm:text-7xl">
          404
        </p>
        <h1 className="pt-heading mb-3 text-2xl font-extrabold sm:text-3xl">
          {t('statusPage.notFoundHeading')}
        </h1>
        <p className="pt-muted mx-auto mb-8 max-w-md text-sm leading-relaxed">
          {t('statusPage.notFoundDesc')}
        </p>

        <div className="mb-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/"
            className="pt-focus rounded-full bg-[var(--pt-accent)] px-6 py-3 text-sm font-bold text-[var(--pt-on-accent)] transition hover:opacity-90"
          >
            {t('statusPage.notFoundHome')}
          </Link>
          <Link
            href="/lien-he"
            className="pt-focus rounded-full border border-[rgb(var(--pt-border-rgb)/0.22)] px-6 py-3 text-sm font-bold transition-colors hover:bg-[var(--pt-accent-soft)]"
          >
            {t('statusPage.notFoundContact')}
          </Link>
        </div>

        <ul className="grid gap-3 text-left sm:grid-cols-2">
          {SUGGESTIONS.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="pt-focus block h-full rounded-2xl border border-[rgb(var(--pt-border-rgb)/0.16)] bg-[var(--pt-accent-soft)] p-4 transition-colors hover:border-[rgb(var(--pt-border-rgb)/0.34)]"
              >
                <span className="pt-heading block text-sm font-bold">{item.label}</span>
                <span className="pt-muted mt-0.5 block text-xs">{item.hint}</span>
              </Link>
            </li>
          ))}
        </ul>

        {/* Đường thoát cuối cùng: ai đó mở nhầm giữa đêm vẫn tìm được người
            gặp được. Số điện thoại đọc từ lib/clinics chứ không gõ lại. */}
        <p className="pt-muted mt-8 text-xs">
          <a
            href={`tel:${HOTLINE_DISPLAY.replace(/\s/g, "")}`}
            className="pt-focus rounded font-semibold text-[var(--pt-accent)] underline underline-offset-4"
          >
            {HOTLINE_DISPLAY}
          </a>
        </p>
      </div>
    </div>
  );
}