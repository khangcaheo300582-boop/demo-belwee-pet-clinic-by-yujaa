"use client";

/**
 * components/BookingEnvelopeSuccess.tsx
 * Hoạt ảnh thành công: phong thư kính lỏng (2.6s) trên nền đen tuyệt đối.
 *
 * Dòng thời gian (khớp keyframes trong globals.css):
 *   0–20%   nắp mở, tờ giấy xanh nhô ra, viền neon mờ
 *   20–50%  giấy trượt xuống vào trong → thân phong thư sáng dần
 *   50–80%  nắp gập xuống, nảy nhẹ khi chạm mép
 *   80–100% đóng kín, viền neon + X sắc nét, quầng xanh toả từ tâm
 *   → hiện chữ "Đặt Lịch Thành Công" rồi tự chuyển về trang chủ.
 */

import { useEffect, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";

/** Thời lượng hoạt ảnh (khớp --env-dur trong globals.css). */
const ANIMATION_MS = 2600;
/** Thời điểm chữ "Đặt Lịch Thành Công" xuất hiện. */
const CAPTION_DELAY_MS = 2500;
/** Thời điểm bắt đầu mờ dần để rời trang. */
const EXIT_DELAY_MS = 4000;

interface BookingEnvelopeSuccessProps {
  open: boolean;
  onDone: () => void;
}

export default function BookingEnvelopeSuccess({ open, onDone }: BookingEnvelopeSuccessProps) {
  const { t } = useLanguage();
  const [showCaption, setShowCaption] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setShowCaption(false);
      setLeaving(false);
      return;
    }
    const captionTimer = window.setTimeout(() => setShowCaption(true), CAPTION_DELAY_MS);
    const exitTimer = window.setTimeout(() => setLeaving(true), EXIT_DELAY_MS);
    const doneTimer = window.setTimeout(onDone, EXIT_DELAY_MS + 520);
    return () => {
      window.clearTimeout(captionTimer);
      window.clearTimeout(exitTimer);
      window.clearTimeout(doneTimer);
    };
  }, [open, onDone]);

  if (!open) return null;

  return (
    <div
      className={`env-stage ${leaving ? "is-leaving" : ""}`}
      role="status"
      aria-live="polite"
      aria-label={t("booking.success")}
    >
      <div className="env-scene">
        <span className="env-core-glow" aria-hidden="true" />

        <div className="env-glass">
          {/* Tờ giấy xanh — nhô ra rồi trượt xuống vào trong */}
          <span className="env-paper" aria-hidden="true" />
          {/* Mặt trước phong thư — che tờ giấy khi đã nằm trong */}
          <span className="env-front" aria-hidden="true" />
          {/* Nắp phong thư — gập xuống ở 50–80% */}
          <span className="env-flap" aria-hidden="true" />

          {/* Viền neon + X — sắc nét ở 80–100% */}
          <svg className="env-neon" viewBox="0 0 300 210" preserveAspectRatio="none" aria-hidden="true">
            <rect x="3" y="3" width="294" height="204" rx="16" />
            <path className="env-neon-x" d="M2 2 L150 90 L298 2" />
            <path className="env-neon-x" d="M2 208 L150 120 L298 208" />
          </svg>
        </div>
      </div>

      {showCaption && (
        <>
          <p className="env-caption">{t("booking.success")}</p>
          <p className="env-caption-sub">{t("booking.successSub")}</p>
        </>
      )}

      <span className="sr-only">{`Animation duration ${ANIMATION_MS}ms`}</span>
    </div>
  );
}
