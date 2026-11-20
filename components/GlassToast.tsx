"use client";

/**
 * components/GlassToast.tsx
 * Toast kính lỏng (liquid glass) dùng chung: phủ lên trên cùng, tự ẩn sau
 * `duration` ms, có nút đóng và hỗ trợ `role="alert"` cho screen reader.
 *
 * Dùng cho cảnh báo nhập số hotline vào ô số điện thoại cá nhân, và các
 * thông báo dạng "đã gửi yêu cầu" ở trang liên hệ.
 */

import { useEffect } from "react";

export type ToastTone = "error" | "success";

interface GlassToastProps {
  open: boolean;
  message: string;
  tone?: ToastTone;
  onClose: () => void;
  /** Thời gian tự ẩn (ms). Mặc định 5200ms; truyền 0 để giữ đến khi đóng. */
  duration?: number;
  icon?: string;
}

export default function GlassToast({
  open,
  message,
  tone = "error",
  onClose,
  duration = 5200,
  icon,
}: GlassToastProps) {
  useEffect(() => {
    if (!open || duration <= 0) return;
    const timer = window.setTimeout(onClose, duration);
    return () => window.clearTimeout(timer);
  }, [open, duration, onClose, message]);

  if (!open) return null;

  const isSuccess = tone === "success";

  return (
    <div className="bk-toast-wrap">
      <div
        className="bk-toast glassContainer is-glass"
        role="alert"
        aria-live="assertive"
        style={
          isSuccess
            ? {
                color: "#dcfce7",
                background: "rgba(6, 44, 26, 0.42)",
                borderColor: "rgba(74, 222, 128, 0.45)",
                boxShadow:
                  "0 0 26px rgba(34, 197, 94, 0.32), 0 18px 44px -18px rgba(2, 6, 23, 0.75), inset 2px 2px rgba(255, 255, 255, 0.28)",
              }
            : undefined
        }
      >
        <span className="bk-toast-icon" aria-hidden="true">
          {icon ?? (isSuccess ? "✅" : "⚠️")}
        </span>
        <span>{message}</span>
        <button type="button" className="bk-toast-close" onClick={onClose} aria-label="✕">
          ✕
        </button>
      </div>
    </div>
  );
}
