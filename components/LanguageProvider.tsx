"use client";

/**
 * components/LanguageProvider.tsx
 * Quản lý trạng thái đa ngôn ngữ toàn cục (React context).
 *
 * - `lang`: ngôn ngữ hiện tại ("en" | "vi").
 * - `setLang`: đổi ngôn ngữ ngay lập tức, lưu vào localStorage
 *   (`belwee-language`), cập nhật `<html lang>` + title + meta description.
 * - `t(key)`: tra nội dung dịch theo ngôn ngữ hiện tại.
 *
 * Không tải lại trang khi đổi ngôn ngữ → không mất dữ liệu, giữ cuộn,
 * giữ trạng thái đăng nhập/menu.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  LANG_KEY,
  getInitialLanguage,
  isLanguage,
  translate,
  translations,
  type Language,
  type MessageKey,
} from "@/lib/i18n";

interface LanguageContextValue {
  lang: Language;
  setLang: (next: Language) => void;
  /** `vars` (GĐ5) nội suy `{placeholder}` trong chuỗi — xem `translate`. */
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
  /** true khi đã hydrate xong trên client (sau khi đọc localStorage). */
  ready: boolean;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

/** Đồng bộ `<html lang>`, document.title và meta description. */
function syncDocument(lang: Language) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = lang;
  const meta = translationsMeta(lang);
  if (meta && meta.title) document.title = meta.title;
  const desc = document.querySelector('meta[name="description"]');
  if (desc && meta?.description) desc.setAttribute("content", meta.description);
}

function translationsMeta(lang: Language) {
  const messages = translations[lang] as unknown as typeof translations["en"];
  return messages?.meta;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Khởi tạo an toàn cho SSR: mặc định "en". Sau hydrate, useEffect đọc
  // localStorage + navigator rồi cập nhật để tránh hydration mismatch.
  const [lang, setLangState] = useState<Language>("en");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const initial = getInitialLanguage();
    setLangState(initial);
    syncDocument(initial);
    setReady(true);
  }, []);

  const setLang = useCallback((next: Language) => {
    setLangState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LANG_KEY, next);
    }
    syncDocument(next);
  }, []);

  const t = useCallback(
    (key: MessageKey, vars?: Record<string, string | number>) => translate(lang, key, vars),
    [lang]
  );

  const value = useMemo<LanguageContextValue>(
    () => ({ lang, setLang, t, ready }),
    [lang, setLang, t, ready]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage phải được dùng bên trong <LanguageProvider>");
  }
  return ctx;
}

export { isLanguage };