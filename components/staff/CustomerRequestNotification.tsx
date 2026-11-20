"use client";

/**
 * components/staff/CustomerRequestNotification.tsx
 * Thông báo Liquid Glass cho nhân viên khi có yêu cầu chăm sóc khách hàng mới.
 * Kết nối qua SSE /api/realtime/stream với kênh customer:requests.
 */

import { useCallback, useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowRight, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export default function CustomerRequestNotification() {
  const [visible, setVisible] = useState(false);
  const [requestInfo, setRequestInfo] = useState<{
    id: string;
    sessionId: string;
    preview: string;
    time: string;
  } | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || typeof EventSource === "undefined") return;

    // Kênh cho yêu cầu khách hàng — trong thực tế backend sẽ định nghĩa
    const url = "/api/realtime/stream?channels=customer:requests";
    try {
      const source = new EventSource(url);
      eventSourceRef.current = source;

      source.addEventListener("customer:request", (event: MessageEvent<string>) => {
        try {
          const parsed = JSON.parse(event.data) as { sessionId?: string; preview?: string; time?: string };
          setRequestInfo({
            id: `REQ_${Date.now()}`,
            sessionId: parsed.sessionId || "unknown",
            preview: parsed.preview || "Có yêu cầu chăm sóc khách hàng mới từ khách hàng.",
            time: parsed.time || new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
          });
          setVisible(true);
        } catch {
          // bỏ qua frame lỗi
        }
      });

      source.onerror = () => {
        setVisible(false);
      };
    } catch {
      // Nếu SSE chưa sẵn sàng, không hiển thị thông báo
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, []);

  const handleClick = useCallback(() => {
    window.open("/booking/cham-soc-khach-hang", "_self");
  }, []);

  const handleClose = useCallback(() => {
    setVisible(false);
  }, []);

  return (
    <>
      <AnimatePresence>
        {visible && requestInfo && (
          <motion.div
            initial={{ opacity: 0, x: 48, scale: 0.94 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 32, scale: 0.94 }}
            transition={{ type: "spring", stiffness: 380, damping: 26, duration: 0.35 }}
            className={cn(
              "fixed top-24 right-5 z-[110] w-[340px] max-w-[92vw] rounded-[26px] border border-white/[0.08]",
              "bg-gradient-to-b from-white/[0.07] to-[#070b16]/70 backdrop-blur-3xl",
              "shadow-[0_32px_80px_-20px_rgba(2,6,23,0.7),inset_0_1px_0_rgba(255,255,255,0.05)]"
            )}
            role="alert"
            aria-live="polite"
          >
            <div className="p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] bg-gradient-to-br from-amber-300/15 to-amber-400/10 border border-amber-300/20 shadow-[0_0_16px_-6px_rgba(251,191,36,0.25)]">
                  <MessageCircle className="h-5 w-5 text-amber-200" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-[14px] font-extrabold tracking-tight text-white">Yêu cầu của khách hàng</h3>
                  <p className="mt-1.5 text-[12.5px] leading-[1.65] text-white/60">
                    Bạn có một yêu cầu chăm sóc khách hàng mới từ khách hàng. Vui lòng truy cập khu vực trò chuyện để tiếp nhận và hỗ trợ.
                  </p>
                  <p className="mt-2 text-[10px] text-white/30">{requestInfo.time}</p>
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      onClick={handleClick}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500",
                        "px-4 py-2 text-[11px] font-bold text-slate-950 shadow-[0_2px_12px_rgba(34,197,94,0.25)]",
                        "hover:brightness-110 active:scale-[0.97] transition"
                      )}
                    >
                      Tới trang chăm-sóc-khach-hang
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
                <button
                  onClick={handleClose}
                  className="shrink-0 rounded-full p-1.5 text-white/30 hover:text-white hover:bg-white/10 transition"
                  aria-label="Đóng thông báo"
                  title="Đóng"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
