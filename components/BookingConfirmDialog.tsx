"use client";

/**
 * components/BookingConfirmDialog.tsx
 * Bước xác nhận trước khi gửi form đặt lịch.
 *
 * - Desktop: modal kính lỏng canh giữa màn hình (.bk-confirm-panel).
 * - Mobile : bottom-sheet kính lỏng trượt lên và bám đáy màn hình
 *            (media query max-width: 767px trong globals.css).
 *
 * Hai hành động:
 *   • "Quay lại"  → onBack(): đóng dialog, dữ liệu form giữ nguyên.
 *   • "Xác nhận đặt lịch" → onConfirm(): gửi dữ liệu + chạy hoạt ảnh thành công.
 */

import { useEffect, useRef } from "react";
import { useLanguage } from "@/components/LanguageProvider";

export interface ConfirmRow {
  key: string;
  label: string;
  value: string;
}

interface BookingConfirmDialogProps {
  open: boolean;
  rows: ConfirmRow[];
  busy?: boolean;
  onBack: () => void;
  onConfirm: () => void;
}

export default function BookingConfirmDialog({
  open,
  rows,
  busy = false,
  onBack,
  onConfirm,
}: BookingConfirmDialogProps) {
  const { t } = useLanguage();
  const panelRef = useRef<HTMLDivElement>(null);

  // Escape = quay lại form; khoá cuộn nền khi dialog đang mở.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onBack();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    panelRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onBack]);

  if (!open) return null;

  return (
    <div
      className="bk-confirm-root"
      role="dialog"
      aria-modal="true"
      aria-label={t("booking.confirmTitle")}
    >
      <div className="bk-confirm-backdrop" onClick={busy ? undefined : onBack} />

      <div ref={panelRef} tabIndex={-1} className="bk-confirm-panel glassContainer is-glass is-dark">
        <div className="bk-confirm-head">
          <h2 className="bk-confirm-title">{t("booking.confirmTitle")}</h2>
          <p className="bk-confirm-subtitle">{t("booking.confirmSubtitle")}</p>
        </div>

        <div className="bk-confirm-body">
          {rows.map((row) => (
            <div className="bk-confirm-row" key={row.key}>
              <span className="bk-confirm-key">{row.label}</span>
              <span className="bk-confirm-val">{row.value || "—"}</span>
            </div>
          ))}
        </div>

        <div className="bk-confirm-foot">
          <button
            type="button"
            className="glassBtn is-ghost bk-confirm-back"
            onClick={onBack}
            disabled={busy}
          >
            {t("booking.confirmBack")}
          </button>
          <button
            type="button"
            className="glassBtn is-primary bk-confirm-go"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? t("booking.processing") : t("booking.confirmGo")}
          </button>
        </div>

        <p className="bk-confirm-hint">{t("booking.confirmHint")}</p>
      </div>
    </div>
  );
}
