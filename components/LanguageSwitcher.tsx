"use client";

/**
 * components/LanguageSwitcher.tsx
 * Nút chuyển đổi ngôn ngữ (EN / VI) đặt trong thanh điều hướng & chân trang.
 *
 * ── TẠI SAO PANEL MỞ NGANG RA BÊN (yêu cầu D3) ────────────────────────────────
 * Bản cũ mở `absolute right-0 top-full` — tức rơi XUỐNG dưới. Ở chân trang nút
 * nằm sát mép phải nên menu tràn ra ngoài khung nhìn và bị cắt; ở thanh điều
 * hướng nó đè lên nội dung trang. Nay panel nằm CẠNH nút, mở ra theo trục
 * ngang, và tự đảo sang phía còn chỗ khi sát mép phải.
 *
 * ── TẠI SAO CỜ LÀ SVG CHỨ KHÔNG PHẢI EMOJI 🇻🇳/🇬🇧 ───────────────────────────
 * Emoji cờ quốc gia KHÔNG được Windows render (Windows hiện chữ "VN"/"GB" thay
 * cho cờ), và nhiều Linux server cũng vậy. Vẽ SVG nội tuyến thì giống nhau ở
 * mọi máy, không phụ thuộc font hệ thống, cũng không tốn request mạng.
 *
 * ─- `placement` ───────────────────────────────────────────────────────────────
 * "side"  — panel bật ngang ra cạnh (dùng ở footer; tự lật trái/phải).
 * "below" — panel rơi xuống dưới, tràn chiềm ngang (dùng trong ngăn kéo
 *           hamburger trên mobile, nơi ngang bị chiếm hết bởi các mục menu).
 */

import { useId, useState, useRef, useEffect, useLayoutEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useLanguage } from "@/components/LanguageProvider";
import { translations, type Language } from "@/lib/i18n";

interface LanguageSwitcherProps {
  className?: string;
  /** Hiển thị dạng nhỏ gọn (chỉ mã ngôn ngữ) cho màn hình nhỏ. */
  compact?: boolean;
  /** Hướng mở panel. Mặc định "side". */
  placement?: "side" | "below";
}

/** Bề rộng cố định của panel ngang — dùng chung cho cả giá trị trong và ngoài
 *  animation nên không phải đo DOM rồi setState (đo sẽ gây layout thrash). */
const PANEL_WIDTH = 244;

const LANGS: Language[] = ["en", "vi"];

const nativeNames: Record<Language, string> = {
  en: "English",
  vi: "Tiếng Việt",
};

/** Mã hiển thị cạnh cờ — ngắn gọn, đọc được khi cờ bị thu nhỏ. */
const codes: Record<Language, string> = { en: "EN", vi: "VI" };

/** Cờ Việt Nam — đỏ, sao vàng 5 cánh. */
function FlagVietnam({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 16" className={className} aria-hidden="true" focusable="false">
      <rect width="24" height="16" fill="#DA251D" />
      <path
        fill="#FFFF00"
        d="M12 3.2l1.06 2.15 2.37.35-1.72 1.67.4 2.36L12 8.53l-2.11 1.2.4-2.36-1.72-1.67 2.37-.35L12 3.2z"
      />
    </svg>
  );
}

/** Cờ Anh (Union Jack) — dùng cho tiếng Anh. */
function FlagUK({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 16" className={className} aria-hidden="true" focusable="false">
      <rect width="24" height="16" fill="#012169" />
      {/* Chéo trắng */}
      <path d="M0 0l24 16M24 0L0 16" stroke="#FFFFFF" strokeWidth="3.2" />
      {/* Chéo đỏ thu hẹp */}
      <path d="M0 0l24 16M24 0L0 16" stroke="#C8102E" strokeWidth="1.6" />
      {/* Chéo dọc/khoang trắng rồi đỏ (thập thánh) */}
      <path d="M12 0v16M0 8h24" stroke="#FFFFFF" strokeWidth="5.3" />
      <path d="M12 0v16M0 8h24" stroke="#C8102E" strokeWidth="3.1" />
    </svg>
  );
}

const FLAGS: Record<Language, (p: { className?: string }) => JSX.Element> = {
  vi: FlagVietnam,
  en: FlagUK,
};

export default function LanguageSwitcher({
  className = "",
  compact = false,
  placement = "side",
}: LanguageSwitcherProps) {
  const { lang, setLang, t } = useLanguage();
  const listboxId = useId();
  const labelId = useId();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  /**
   * Bật/tắt hướng của panel để không bao giờ tràn ra ngoài viewport.
   *
   * Đo bằng `getBoundingClientRect` của chính nút (không đo window) vì ở
   * `placement="side"` nút thường nằm trong một container hẹp; so sánh với
   * `window.innerWidth` vẫn đúng vì cùng một hệ toạ độ viewport.
   */
  const [side, setSide] = useState<"right" | "left">("left");

  useLayoutEffect(() => {
    if (!open || placement !== "side") return;
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    // Cần `PANEL_WIDTH + 12` (12px là khoảng hở) để panel vừa khít.
    const needed = PANEL_WIDTH + 12;
    setSide(rect.right + needed <= window.innerWidth - 8 ? "right" : "left");
  }, [open, placement]);

  // Đóng menu khi bấm ra ngoài hoặc nhấn Escape.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const select = (next: Language) => {
    if (next !== lang) setLang(next);
    setOpen(false);
  };

  const buttonLabel = compact
    ? lang.toUpperCase()
    : `${nativeNames[lang]} / ${nativeNames[lang === "en" ? "vi" : "en"]}`;

  return (
    <div ref={rootRef} className={`relative inline-block ${className}`}>
      <button
        type="button"
        id={labelId}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-label={t("footer.switchLangShort")}
        onClick={() => setOpen((v) => !v)}
        className="lang-switcher-trigger inline-flex items-center gap-1.5 rounded-full border border-white/40 bg-white/50 px-3 py-1.5 text-xs font-semibold text-slate-700 backdrop-blur-md transition-all duration-200 hover:bg-white/80 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 active:scale-95"
      >
        <svg
          className="h-3.5 w-3.5 text-slate-500"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
        <span>{buttonLabel}</span>
        <svg
          className={`h-3 w-3 text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="listbox"
            id={listboxId}
            aria-labelledby={labelId}
            initial={
              placement === "side"
                ? { width: 0, opacity: 0, x: side === "right" ? -10 : 10 }
                : { width: "100%", height: 0, opacity: 0, y: -8 }
            }
            animate={
              placement === "side"
                ? { width: PANEL_WIDTH, opacity: 1, x: 0 }
                : { width: "100%", height: "auto", opacity: 1, y: 0 }
            }
            exit={
              placement === "side"
                ? { width: 0, opacity: 0, x: side === "right" ? -10 : 10 }
                : { width: "100%", height: 0, opacity: 0, y: -8 }
            }
            // easeOutExpo: bung nhanh rồi hãm — cảm giác "thẻ trượt ra" thay vì
            // "bảng bật". Chỉ width/opacity/x nên vẫn 60fps.
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            className={
              placement === "side"
                ? "lang-switcher-menu absolute top-1/2 z-[12000] -translate-y-1/2 overflow-hidden"
                : "lang-switcher-menu absolute left-0 top-full z-[12000] mt-2 overflow-hidden"
            }
            style={
              placement === "side"
                ? side === "right"
                  ? { left: "calc(100% + 12px)" }
                  : { right: "calc(100% + 12px)" }
                : undefined
            }
          >
            {/* Thẻ kính bo tròn. `overflow-hidden` trên panel là cần thiết: nó
                giữ 2 hàng lựa chọn bị cắt gọn khi panel đang co lại về 0. */}
            <div className="lang-switcher-panel min-w-[13rem] rounded-2xl border border-white/35 bg-white/72 p-1.5 shadow-[0_18px_44px_-18px_rgba(3,20,70,0.55)] backdrop-blur-2xl backdrop-saturate-150">
              {LANGS.map((code) => {
                const active = code === lang;
                const meta = translations[code] as unknown as typeof translations["en"];
                const Flag = FLAGS[code];
                return (
                  <button
                    type="button"
                    key={code}
                    role="option"
                    aria-selected={active}
                    onClick={() => select(code)}
                    className={`lang-switcher-option flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors duration-150 ${
                      active
                        ? "bg-blue-600/12 text-blue-900"
                        : "text-slate-800 hover:bg-white/70"
                    }`}
                  >
                    <Flag className="h-4 w-6 shrink-0 overflow-hidden rounded-[3px] ring-1 ring-black/10" />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                      {nativeNames[code]}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      {codes[code]}
                    </span>
                    {active && (
                      <svg
                        className="h-4 w-4 shrink-0 text-blue-600"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={3}
                        aria-hidden="true"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    <span className="sr-only">{meta.meta.title}</span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}