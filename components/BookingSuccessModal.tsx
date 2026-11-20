"use client";

import { useEffect } from "react";
import { useTransitionNavigate } from "@/hooks/useTransitionNavigate";

interface BookingSuccessModalProps {
  open: boolean;
  message?: string;
  onClose?: () => void;
  /** ID của booking vừa tạo để hiển thị cho khách */
  appointmentId?: string;
  /** Email khách để xác nhận đã gửi thông báo */
  customerEmail?: string;
}

const sparkPositions = [
  "left-1/2 -top-7",
  "-right-7 top-1/2",
  "left-1/2 -bottom-7",
  "-left-7 top-1/2",
];

export default function BookingSuccessModal({
  open,
  message = "Đặt lịch thành công!",
  onClose,
  appointmentId,
  customerEmail,
}: BookingSuccessModalProps) {
  const navigate = useTransitionNavigate();

  useEffect(() => {
    if (!open) return;

    const redirectTimer = window.setTimeout(() => {
      if (onClose) onClose();
      else navigate("/");
    }, 6000);
    return () => window.clearTimeout(redirectTimer);
  }, [navigate, open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/75 px-4 backdrop-blur-md anim-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label={message}
    >
      <div
        className="w-full max-w-sm rounded-[2rem] border border-white/20 bg-slate-900/90 px-8 py-10 text-center shadow-[0_25px_100px_rgba(0,0,0,0.55)] backdrop-blur-2xl anim-zoom-in relative"
      >
        <button
          type="button"
          onClick={() => {
            if (onClose) onClose();
            else navigate("/");
          }}
          className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/60 hover:bg-white/20 hover:text-white transition-all text-sm font-bold"
          aria-label="Đóng"
        >
          ✕
        </button>

        <div className="relative mx-auto mb-6 flex h-28 w-28 items-center justify-center">
          <div
            className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-500 to-cyan-300 shadow-[0_0_45px_rgba(59,130,246,0.65)]"
            style={{ animation: "successPop 1.1s cubic-bezier(0.16, 1, 0.3, 1) forwards" }}
          />
          <div
            className="relative flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full bg-gradient-to-br from-sky-300 to-blue-500 shadow-inner"
            style={{ animation: "successPop 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.55s backwards" }}
          >
            <svg
              viewBox="0 0 52 52"
              className="h-12 w-12 text-white"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M14 27.5 22 35l16-18"
                stroke="currentColor"
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="success-check"
                pathLength="1"
              />
            </svg>
          </div>

          {sparkPositions.map((position, index) => (
            <span
              key={position}
              className={`absolute ${position} h-2.5 w-2.5 rounded-full bg-cyan-200 shadow-[0_0_12px_rgba(103,232,249,0.95)]`}
              style={{
                animation: `successSpark 1.2s ease-out ${0.85 + index * 0.08}s forwards`,
              }}
            />
          ))}
        </div>

        <h2
          className="text-xl font-black uppercase tracking-wide text-white anim-fade-up"
          style={{ animationDelay: "1.35s" }}
        >
          {message}
        </h2>

        {/* Mã lịch hẹn */}
        {appointmentId && (
          <div
            className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/15 px-4 py-1.5 anim-fade-in"
            style={{ animationDelay: "1.5s" }}
          >
            <span className="text-xs text-slate-400">Mã lịch hẹn</span>
            <span className="text-sm font-bold text-cyan-300 font-mono">#{appointmentId}</span>
          </div>
        )}

        {/* Thông báo email đã gửi */}
        <div
          className="mt-4 rounded-xl border border-blue-500/25 bg-blue-600/15 px-4 py-3 anim-fade-in"
          style={{ animationDelay: "1.6s" }}
        >
          <p className="text-[13px] text-blue-200 leading-relaxed">
            📧 Chúng tôi đã gửi email xác nhận{customerEmail ? ` tới ${customerEmail}` : ""}.
            <br />
            <span className="text-[11px] text-slate-400">Vui lòng kiểm tra hộp thư (kể cả Spam).</span>
          </p>
        </div>

        <p
          className="mt-3 text-sm text-slate-300 anim-fade-in"
          style={{ animationDelay: "1.75s" }}
        >
          Belwee sẽ liên hệ xác nhận trong vòng <strong className="text-cyan-300">30 phút</strong>.
        </p>

        {/* Actions */}
        <div
          className="mt-5 flex flex-col gap-2 anim-fade-in"
          style={{ animationDelay: "1.9s" }}
        >
          <button
            type="button"
            onClick={() => {
              if (onClose) onClose();
              navigate("/trang-ca-nhan");
            }}
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-all hover:scale-[1.02] active:scale-95 shadow-[0_4px_14px_rgba(37,99,235,0.4)]"
          >
            📋 Xem lịch sử đặt lịch
          </button>
          <button
            type="button"
            onClick={() => {
              if (onClose) onClose();
              else navigate("/");
            }}
            className="w-full py-3 rounded-xl bg-white/10 border border-white/15 text-white text-sm font-semibold hover:bg-white/20 transition-all"
          >
            Quay về trang chủ
          </button>
        </div>
      </div>
    </div>
  );
}
