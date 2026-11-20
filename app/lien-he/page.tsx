"use client";

/**
 * app/lien-he/page.tsx
 * Trang LIÊN HỆ riêng của Belwee (thay cho liên kết neo "#contact" cũ).
 *
 * Nội dung:
 *   1. Thẻ hero: thông tin liên hệ nhanh (hotline 24h, địa chỉ, giờ mở cửa, email)
 *   2. Form "Hỗ trợ nhanh" — gửi về hộp thư Belwee qua /api/lien-he
 *   3. "Hệ Thống Phòng Khám" (ClinicSystem) — chuyển từ cuối trang Đội Ngũ về đây
 */

import { useState } from "react";
import { useTransitionNavigate } from "@/hooks/useTransitionNavigate";
import { useLanguage } from "@/components/LanguageProvider";
import ClinicSystem from "@/components/ClinicSystem";
import GlassToast from "@/components/GlassToast";
import { HOTLINE, HOTLINE_DISPLAY, HOTLINE_ZALO, isBelweeHotline, normalizePhone } from "@/lib/clinics";
import { validatePhone, validateRequired } from "@/lib/validators";

const HOTLINE_TEL = `tel:${HOTLINE}`;

export default function LienHePage() {
  const navigate = useTransitionNavigate();
  const { t } = useLanguage();

  const [form, setForm] = useState({ name: "", phone: "", message: "" });
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: "error" | "success" } | null>(null);

  const handlePhoneChange = (value: string) => {
    if (isBelweeHotline(value)) {
      setToast({ message: t("contact.hotlineError"), tone: "error" });
      return;
    }
    setForm((prev) => ({ ...prev, phone: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const nameError = validateRequired(form.name, t("contact.quickName"));
    if (nameError) {
      setToast({ message: nameError.message, tone: "error" });
      return;
    }
    if (isBelweeHotline(form.phone)) {
      setToast({ message: t("contact.hotlineError"), tone: "error" });
      return;
    }
    const phoneError = validatePhone(form.phone);
    if (phoneError) {
      setToast({ message: phoneError.message, tone: "error" });
      return;
    }

    setSending(true);
    try {
      const res = await fetch("/api/lien-he", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, phone: normalizePhone(form.phone) }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) {
        setForm({ name: "", phone: "", message: "" });
        setToast({ message: t("contact.quickSent"), tone: "success" });
      } else {
        setToast({ message: data?.message || t("booking.errGeneric"), tone: "error" });
      }
    } catch {
      setToast({ message: t("booking.errNetwork"), tone: "error" });
    } finally {
      setSending(false);
    }
  };

  const tiles = [
    { icon: "📞", label: t("contact.hotlineTitle"), value: HOTLINE_DISPLAY, href: HOTLINE_TEL },
    {
      icon: "📍",
      label: t("contact.addressTitle"),
      value: t("contact.addressValue"),
      href: "https://www.google.com/maps/search/?api=1&query=Belwee+Pet+Clinic+552+Le+Duc+Tho",
    },
    {
      icon: "💬",
      label: "Zalo",
      value: HOTLINE_DISPLAY,
      href: HOTLINE_ZALO,
    },
    { icon: "🕗", label: t("contact.hoursTitle"), value: t("contact.hoursValue") },
    { icon: "✉️", label: t("contact.emailTitle"), value: t("contact.emailValue"), href: "mailto:contact@belwee.vn" },
  ];

  const inputClass =
    "w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3.5 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100";

  return (
    <div className="relative min-h-screen overflow-x-hidden text-slate-800 antialiased">
      <div
        className="fixed inset-0 z-0 h-full w-full scale-105 pointer-events-none"
        style={{
          backgroundImage: "url('/anhnentcdichvu.webp')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: "brightness(0.97) contrast(1.04) saturate(1.05)",
        }}
      />
      <div className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-b from-white/75 via-white/85 to-white/92 backdrop-blur-[2px]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-64 bg-gradient-to-b from-[#f4f8ff] via-[#f4f8ff]/40 to-transparent" />

      <main className="relative z-10 mx-auto max-w-6xl space-y-10 px-4 pt-32 pb-20 sm:px-6">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="text-xs tracking-wide text-slate-700">
          <ol className="flex flex-wrap items-center gap-2">
            <li>
              <button onClick={() => navigate("/")} className="transition-colors hover:text-blue-600">
                {t("contact.ctaHome")}
              </button>
            </li>
            <li aria-hidden="true" className="text-slate-400">
              /
            </li>
            <li className="font-medium text-blue-700" aria-current="page">
              {t("contact.title")}
            </li>
          </ol>
        </nav>

        {/* HERO + THÔNG TIN LIÊN HỆ */}
        <section data-reveal="fade-up" className="contact-hero-card p-8 sm:p-12">
          <div className="mx-auto max-w-3xl space-y-5 text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50/90 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-700">
              ✉️ {t("contact.badge")}
            </span>
            <h1 className="text-3xl font-light tracking-tight text-slate-900 uppercase sm:text-4xl md:text-5xl">
              {t("contact.title")}
            </h1>
            <p className="text-sm leading-relaxed text-slate-600 md:text-base">{t("contact.desc")}</p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <a href={HOTLINE_TEL} className="contact-btn-primary">
                📞 {t("contact.ctaCall")}
              </a>
              <button type="button" onClick={() => navigate("/dich-vu")} className="contact-btn-ghost">
                📅 {t("contact.ctaBook")}
              </button>
            </div>
          </div>

          <div data-reveal-group className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {tiles.map((tile) => {
              const content = (
                <>
                  <span className="text-lg" aria-hidden="true">
                    {tile.icon}
                  </span>
                  <span className="mt-2 block text-[10.5px] font-bold uppercase tracking-[0.16em] text-blue-700">
                    {tile.label}
                  </span>
                  <span className="mt-1 block text-sm font-semibold leading-snug text-slate-800">{tile.value}</span>
                </>
              );
              return tile.href ? (
                <a
                  key={tile.label}
                  href={tile.href}
                  target={tile.href.startsWith("http") ? "_blank" : undefined}
                  rel={tile.href.startsWith("http") ? "noopener noreferrer" : undefined}
                  className="contact-tile block p-5"
                >
                  {content}
                </a>
              ) : (
                <div key={tile.label} className="contact-tile p-5">
                  {content}
                </div>
              );
            })}
          </div>
        </section>

        {/* HỖ TRỢ NHANH */}
        <section data-reveal="fade-up" className="contact-hero-card p-8 sm:p-10">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
                {t("contact.quickTitle")}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{t("contact.quickDesc")}</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-2">
                  <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-slate-500">
                    {t("contact.quickName")} *
                  </span>
                  <input
                    type="text"
                    autoComplete="name"
                    className={inputClass}
                    placeholder={t("contact.quickNamePh")}
                    value={form.name}
                    onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </label>
                <label className="block space-y-2">
                  <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-slate-500">
                    {t("contact.quickPhone")} *
                  </span>
                  <input
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    className={inputClass}
                    placeholder={t("contact.quickPhonePh")}
                    value={form.phone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    required
                  />
                </label>
              </div>
              <label className="block space-y-2">
                <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-slate-500">
                  {t("contact.quickMessage")}
                </span>
                <textarea
                  rows={4}
                  className={`${inputClass} resize-none`}
                  placeholder={t("contact.quickMessagePh")}
                  value={form.message}
                  onChange={(e) => setForm((prev) => ({ ...prev, message: e.target.value }))}
                />
              </label>
              <button type="submit" disabled={sending} className="contact-btn-primary w-full sm:w-auto">
                {sending ? `⌛ ${t("booking.processing")}` : `✉️ ${t("contact.quickSend")}`}
              </button>
            </form>
          </div>
        </section>

        {/* HỆ THỐNG PHÒNG KHÁM — chuyển từ cuối trang Đội Ngũ */}
        <div id="he-thong-phong-kham">
          {/* GĐ5 · 25.4 — bật "Tìm chi nhánh gần tôi". Chỉ bật ở đây, KHÔNG bật ở
            trang chủ: ở trang chủ bốn thẻ chi nhánh là liên kết điều hướng, bấm
            là sang trang khác ngay, tiện ích định vị ở đó chỉ gây rối. */}
            <ClinicSystem showNearest />
        </div>
      </main>

      <GlassToast
        open={toast !== null}
        message={toast?.message ?? ""}
        tone={toast?.tone ?? "error"}
        onClose={() => setToast(null)}
      />
    </div>
  );
}
