"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useTransitionNavigate } from "@/hooks/useTransitionNavigate";
import { useLanguage } from "@/components/LanguageProvider";
import type { MessageKey } from "@/lib/i18n";
import BookingConfirmDialog, { type ConfirmRow } from "@/components/BookingConfirmDialog";
import BookingEnvelopeSuccess from "@/components/BookingEnvelopeSuccess";
import GlassToast from "@/components/GlassToast";
import PetSpeciesPicker from "@/components/PetSpeciesPicker";
import BookingNotificationOptIn from "@/components/BookingNotificationOptIn";
import { BOOKING_BRANCHES, DEFAULT_BRANCH_ID, isBelweeHotline } from "@/lib/clinics";

const SERVICE_MAP: Record<string, { titleKey: MessageKey; icon: string }> = {
  "kham-benh": { titleKey: "booking.svcKhamBenh", icon: "🏥" },
  "tiem-ngua": { titleKey: "booking.svcTiemNgua", icon: "💉" },
  "khach-san": { titleKey: "booking.svcKhachSan", icon: "🏨" },
  "spa-grooming": { titleKey: "booking.svcSpaGrooming", icon: "🛁" },
};

export default function KhamBenhBooking() {
  const params = useParams();
  const serviceSlug = (params?.service as string) || "kham-benh";
  const serviceInfo = SERVICE_MAP[serviceSlug] || SERVICE_MAP["kham-benh"];
  const navigate = useTransitionNavigate();
  const { t } = useLanguage();

  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [hotlineToast, setHotlineToast] = useState(false);
  const [phoneBlocked, setPhoneBlocked] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const submitLockRef = useRef(false);

  const [formData, setFormData] = useState({
    fullName: "",
    phone: "",
    email: "",
    petName: "",
    petType: "Chó",
    date: "",
    time: "",
    notes: "",
    branchId: DEFAULT_BRANCH_ID,
  });

  // ── LƯU NHÁP (localStorage) ──────────────────────────────────
  // Người dùng mất mạng / F5 / đóng nhầm tab → không mất chữ đã gõ.
  // Key tách theo service để 2 tab đặt khác nhau không ghi đè nhau.
  const DRAFT_KEY = `belwee-booking-draft-${serviceSlug}`;

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw) as Partial<typeof formData>;
      // Chỉ khôi phục nếu có dữ liệu thật, tránh khôi phục form rỗng.
      if (draft.fullName || draft.phone || draft.petName) {
        setFormData((prev) => ({ ...prev, ...draft }));
        setDraftRestored(true);
      }
    } catch { /* JSON lỗi / localStorage chặn — bỏ qua */ }
    // Chạy 1 lần theo serviceSlug.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceSlug]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(formData));
    } catch { /* đầy / chặn — bỏ qua */ }
  }, [formData, DRAFT_KEY]);

  const clearDraft = useCallback(() => {
    if (typeof window === "undefined") return;
    try { window.localStorage.removeItem(DRAFT_KEY); } catch { /* bỏ qua */ }
  }, [DRAFT_KEY]);

  const branch = useMemo(
    () => BOOKING_BRANCHES.find((b) => b.id === formData.branchId) ?? BOOKING_BRANCHES[0],
    [formData.branchId]
  );
  const branchName = t(branch.nameKey);

  const set = <K extends keyof typeof formData>(key: K, value: (typeof formData)[K]) =>
    setFormData((prev) => ({ ...prev, [key]: value }));

  /**
   * Chặn nhập số hotline của Belwee vào ô số điện thoại cá nhân.
   * Giá trị bị "chặn" (không đưa vào state) + hiện toast cảnh báo.
   */
  const handlePhoneChange = useCallback((raw: string) => {
    if (isBelweeHotline(raw)) {
      setPhoneBlocked(true);
      setHotlineToast(true);
      return;
    }
    setPhoneBlocked(false);
    setFormData((prev) => ({ ...prev, phone: raw }));
  }, []);

  const closeHotlineToast = useCallback(() => setHotlineToast(false), []);

  const confirmRows: ConfirmRow[] = [
    { key: "service", label: t("booking.sec1"), value: `${serviceInfo.icon} ${t(serviceInfo.titleKey)}` },
    { key: "name", label: t("booking.ownerName"), value: formData.fullName },
    { key: "email", label: t("booking.email"), value: formData.email },
    { key: "phone", label: t("booking.phone"), value: formData.phone },
    { key: "petType", label: t("booking.petType"), value: formData.petType },
    { key: "petName", label: t("booking.petName"), value: formData.petName },
    { key: "branch", label: t("booking.sec4"), value: branchName },
    { key: "date", label: t("booking.date"), value: formData.date },
    { key: "time", label: t("booking.time"), value: formData.time },
    { key: "notes", label: t("booking.notes"), value: formData.notes },
  ];

  /** Chặn gửi mặc định — mở UI xác nhận (modal desktop / bottom-sheet mobile). */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (isBelweeHotline(formData.phone)) {
      setPhoneBlocked(true);
      setHotlineToast(true);
      return;
    }
    setConfirmOpen(true);
  };

  /** "Xác nhận đặt lịch" trong dialog → gửi dữ liệu thật lên API.
   *  submitLockRef chặn double-submit (mạng lag → người dùng bấm nhiều lần,
   *  hoặc double-fire của dialog) — mỗi lần chỉ đúng 1 request. */
  const submitBooking = async () => {
    if (submitLockRef.current) return;
    submitLockRef.current = true;
    setLoading(true);
    setErrorMsg(null);
    try {
      const response = await fetch("/api/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.fullName,
          phone: formData.phone,
          email: formData.email,
          petName: formData.petName,
          petType: formData.petType,
          date: formData.date,
          bookingTime: formData.time,
          notes: formData.notes,
          service: t(serviceInfo.titleKey),
          branch: branchName,
          // Idempotency key — server dùng để bỏ qua request lặp nếu mạng
          // retry tự động (điều kiện “2 người bấm cùng lúc” xử lý ở phía
          // khung giờ, client chỉ đảm bảo không tự gửi trùng).
          clientRequestId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        }),
      });

      if (response.ok) {
        clearDraft();
        setConfirmOpen(false);
        setIsSuccess(true);
      } else {
        const errorData = await response.json().catch(() => null);
        setConfirmOpen(false);
        if (response.status === 409 || errorData?.slotTaken) {
          // Khung giờ vừa bị người khác giữ trước — yêu cầu chọn giờ khác.
          setErrorMsg(
            errorData?.message ||
              "Khung giờ này đã có người đặt. Vui lòng chọn thời gian khác hoặc gọi hotline để được hỗ trợ."
          );
        } else {
          setErrorMsg(errorData?.message || errorData?.error || t("booking.errGeneric"));
        }
      }
    } catch (error) {
      console.error(error);
      setConfirmOpen(false);
      setErrorMsg(t("booking.errNetwork"));
    } finally {
      submitLockRef.current = false;
      setLoading(false);
    }
  };

  const fieldClass =
    "w-full bg-slate-950/40 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white focus:outline-none focus:border-blue-400 focus:bg-slate-950/60 transition";
  const labelClass = "text-xs font-bold text-slate-300 uppercase tracking-wider";
  const cardClass =
    "relative group overflow-hidden liquid-glass-card rounded-[2.5rem] p-6 md:p-8 transition-transform duration-500 hover:scale-[1.01]";
  const sectionTitle = "text-lg font-black text-white border-l-4 border-blue-500 pl-3 mb-6 flex items-center gap-2";

  return (
    <div
      className="relative min-h-screen text-slate-100 font-sans antialiased pb-20 bg-cover bg-center bg-no-repeat bg-fixed"
      style={{ backgroundImage: "url('/anhchuyengia.webp')" }}
    >
      {/* GLOBAL CSS FOR LIQUID GLASS & ANIMATIONS */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .liquid-glass-nav {
          background: rgba(15, 23, 42, 0.5); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);
          border: 1px solid rgba(255, 255, 255, 0.08); box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.5), inset 0 1px 0px rgba(255, 255, 255, 0.1);
        }
        .liquid-glass-card {
          background: rgba(15, 23, 42, 0.45); backdrop-filter: blur(30px); -webkit-backdrop-filter: blur(30px);
          border: 1px solid rgba(255, 255, 255, 0.08); border-top: 1px solid rgba(255, 255, 255, 0.15); border-left: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 30px 60px -15px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.05);
        }
        @keyframes shineSweep {
          0% { transform: translateX(-150%) skewX(-45deg); opacity: 0; }
          50% { opacity: 1; }
          100% { transform: translateX(200%) skewX(-45deg); opacity: 0; }
        }
        .group:hover .glass-shine { animation: shineSweep 1.2s cubic-bezier(0.4, 0, 0.2, 1) forwards; }
        .backdrop-menu { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.6); backdrop-filter: blur(15px); z-index: 40; }
      `,
        }}
      />

      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-slate-950/40 to-slate-950/40 pointer-events-none z-0" />
      <div className="absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-[#f4f8ff] via-[#f4f8ff]/50 to-transparent pointer-events-none z-[1]" />

      {/* FORM CONTENT */}
      <main className="relative z-10 max-w-3xl mx-auto px-4 pt-32 md:pt-40">
        {draftRestored && (
          <div
            role="status"
            aria-live="polite"
            className="mb-5 rounded-2xl border border-blue-400/25 bg-blue-500/10 px-5 py-3 text-xs font-semibold text-blue-100 text-center backdrop-blur-md"
          >
            📝 Đã khôi phục thông tin bạn nhập trước đó.
          </div>
        )}

        <div className="mb-6">
          <button
            type="button"
            onClick={() => navigate("/dich-vu")}
            className="text-sm font-semibold text-slate-300 hover:text-white flex items-center gap-2 bg-white/5 backdrop-blur-md px-5 py-2.5 rounded-full border border-white/10 transition-all hover:bg-white/10 active:scale-95 shadow-lg"
          >
            ⬅ {t("booking.back")}
          </button>
        </div>

        <div data-reveal="fade-up" className="text-center mb-10">
          <h1 className="text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-blue-100 to-blue-300 tracking-tight uppercase drop-shadow-lg">
            {serviceInfo.icon} {t(serviceInfo.titleKey)}
          </h1>
          <div className="w-24 h-1.5 bg-gradient-to-r from-blue-500 to-cyan-400 mx-auto mt-4 rounded-full shadow-[0_0_15px_rgba(56,189,248,0.6)]" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-6" data-reveal-group>
          {/* Section 1 — Thông tin khách hàng */}
          <div className={cardClass}>
            <div className="absolute top-0 bottom-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/10 to-transparent glass-shine pointer-events-none -translate-x-full" />
            <h2 className={sectionTitle}>👤 {t("booking.sec1")}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className={labelClass}>{t("booking.ownerName")} *</label>
                <input
                  type="text"
                  required
                  autoComplete="name"
                  placeholder={t("booking.ownerNamePh")}
                  className={fieldClass}
                  value={formData.fullName}
                  onChange={(e) => set("fullName", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className={labelClass}>{t("booking.email")} *</label>
                <input
                  type="email"
                  required
                  inputMode="email"
                  autoComplete="email"
                  placeholder={t("booking.emailPh")}
                  className={fieldClass}
                  value={formData.email}
                  onChange={(e) => set("email", e.target.value)}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className={labelClass}>{t("booking.phone")} *</label>
                <input
                  type="tel"
                  required
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder={t("booking.phonePh")}
                  aria-invalid={phoneBlocked}
                  aria-describedby={phoneBlocked ? "booking-phone-error" : undefined}
                  className={`${fieldClass} ${phoneBlocked ? "bk-input-error" : ""}`}
                  value={formData.phone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                />
                {phoneBlocked && (
                  <p id="booking-phone-error" className="text-[11px] font-semibold text-red-300">
                    {t("booking.hotlineError")}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Section 2 — Chọn chi nhánh (ngay dưới thông tin khách hàng) */}
          <div className={cardClass}>
            <div className="absolute top-0 bottom-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/10 to-transparent glass-shine pointer-events-none -translate-x-full" />
            <h2 className={sectionTitle}>📍 {t("booking.sec4")}</h2>
            <p className="mb-5 text-xs font-medium text-slate-300/80">{t("booking.branchHint")}</p>
            <div className="bk-branch-grid" role="radiogroup" aria-label={t("booking.sec4")}>
              {BOOKING_BRANCHES.map((item) => {
                const selected = item.id === formData.branchId;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => set("branchId", item.id)}
                    className={`bk-branch-option ${selected ? "is-selected" : ""}`}
                  >
                    <span className="bk-branch-option-badge">
                      {selected ? `✓ ${t("booking.branchSelected")}` : t(item.badgeKey)}
                    </span>
                    <span className="bk-branch-option-name">{t(item.nameKey)}</span>
                    <span className="bk-branch-option-meta">📍 {t(item.addressKey)}</span>
                    <span className="bk-branch-option-meta">🕗 {t(item.hoursKey)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 3 — Thông tin thú cưng */}
          <div className={cardClass}>
            <div className="absolute top-0 bottom-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/10 to-transparent glass-shine pointer-events-none -translate-x-full" />
            <h2 className={sectionTitle}>🐾 {t("booking.sec2")}</h2>
            {/* Species as chips + a validated free-text "Khác" field, rather than
                a native <select>: the escape hatch has to sit BESIDE the chips
                so an exotic animal (hamster, alpaca, nhím) can be named — the
                old select had no way to enter anything but dog/cat/other, and
                staff ended up with petType = "Khác" and no species at all. */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <PetSpeciesPicker
                value={formData.petType}
                onChange={(species) => set("petType", species)}
                options={[
                  { value: 'Chó', label: t("booking.petTypeDog"), emoji: '🐶' },
                  { value: 'Mèo', label: t("booking.petTypeCat"), emoji: '🐱' },
                  { value: 'Khác', label: t("booking.petTypeOther"), emoji: '🐹' },
                ]}
                label={`${t("booking.petType")} *`}
              />
              <div className="space-y-2">
                <label className={labelClass}>{t("booking.petName")} *</label>
                <input
                  type="text"
                  required
                  placeholder={t("booking.petNamePh")}
                  className={fieldClass}
                  value={formData.petName}
                  onChange={(e) => set("petName", e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Section 4 — Thời gian & triệu chứng */}
          <div className={cardClass}>
            <div className="absolute top-0 bottom-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/10 to-transparent glass-shine pointer-events-none -translate-x-full" />
            <h2 className={sectionTitle}>📅 {t("booking.sec3")}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
              <div className="space-y-2">
                <label className={labelClass}>{t("booking.date")} *</label>
                <input
                  type="date"
                  required
                  className={`${fieldClass} [color-scheme:dark]`}
                  value={formData.date}
                  onChange={(e) => set("date", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className={labelClass}>{t("booking.time")} *</label>
                <input
                  type="time"
                  required
                  className={fieldClass}
                  value={formData.time}
                  onChange={(e) => set("time", e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className={labelClass}>{t("booking.notes")}</label>
              <textarea
                rows={3}
                placeholder={t("booking.notesPh")}
                className={`${fieldClass} resize-none`}
                value={formData.notes}
                onChange={(e) => set("notes", e.target.value)}
              />
            </div>
          </div>

          {/* Submit */}
          {errorMsg && (
            <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm text-center font-medium backdrop-blur-md">
              {errorMsg}
            </div>
          )}

          <div className="pt-4 pb-10">
            <button
              type="submit"
              disabled={loading}
              className="w-full relative overflow-hidden bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-lg py-4.5 rounded-2xl shadow-[0_12px_40px_rgba(37,99,235,0.4)] transition-all duration-300 active:scale-[0.98] disabled:opacity-70 group/btn"
            >
              <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full group-hover/btn:animate-[shineSweep_1s_ease-in-out_forwards]" />
              {loading ? `⌛ ${t("booking.processing")}` : `🚀 ${t("booking.submit")}`}
            </button>

            {/* Opt-in thông báo đặt ngay dưới nút đặt lịch.
                Đây là lúc khách vừa bấm "Đặt lịch" nên ý định "báo tôi khi
                được xác nhận" là rõ nhất — hỏi ở đây tự nhiên hơn hỏi ở trang
                cá nhân. Chỉ hiện khi đã đăng nhập vì lựa chọn được lưu theo
                tài khoản; khách vãng lai xem nút sẽ tự động ẩn đi. */}
            <BookingNotificationOptIn className="mt-4" />
          </div>
        </form>
      </main>

      {/* Toast cảnh báo nhập hotline */}
      <GlassToast
        open={hotlineToast}
        onClose={closeHotlineToast}
        message={t("booking.hotlineError")}
        tone="error"
      />

      {/* UI xác nhận trước khi gửi (modal desktop / bottom-sheet mobile) */}
      <BookingConfirmDialog
        open={confirmOpen}
        rows={confirmRows}
        busy={loading}
        onBack={() => setConfirmOpen(false)}
        onConfirm={submitBooking}
      />

      {/* Hoạt ảnh thành công + tự chuyển về trang chủ */}
      <BookingEnvelopeSuccess open={isSuccess} onDone={() => navigate("/")} />
    </div>
  );
}
