"use client";

/**
 * components/CommandPalette.tsx
 * Tìm kiếm toàn trang bằng bàn phím — Cmd/Ctrl + K (I2).
 *
 * VÌ SAO INDEX NẠP LẦI, KHÔNG IMPORT SẴN
 *   Nguồn kiếm thức (11 bài, ~37KB text) + danh sách bác sĩ là hai thứ lớn
 *   nhất ngoài bundle chính. Import tĩnh ở đầu file sẽ kéo chúng vào mọi
 *   route, kể cả `/staff/chat` — nơi người dùng không bao giờ mở palette.
 *   Ở đây module được `import()` động và chỉ lần đầu bấm phím; sau đó cache lại
 *   trong `useRef` nên mở tiếp không tải lại.
 *
 * BỎ DẤU KHI SO KHỚP
 *   Người Việt gõ "vacxin" nhưng bài viết viết "vắc-xin"; gõ "tie mngua" nhưng
 *   tiêu đề là "tiêm ngừa". Chuẩn hoá bỏ dấu + gộp khoảng trắng/`-`/`_` ở
 *   CẢ HAI VẾ (từ khoá lẫn dữ liệu) nên hai cách gõ đều ra kết quả.
 *
 * FOCUS
 *   Khi mở, focus vào ô input (người dùng gõ ngay) và khóa cuộn trang nền.
 *   `role="dialog"` + `aria-modal` + `aria-label` để trình đọc màn hình đọc
 *   đúng vai trò. Tab bị giữ trong hộp thoại: Shift+Tab từ ô input về nút đóng
 *   rồi vòng lại, không bao giờ thoát ra nền — xem `onKeyDown` bên dưới.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  CornerDownLeft,
  Loader2,
  MapPin,
  Search,
  Stethoscope,
  X,
} from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import { BRANCHES, SPECIALTY_SERVICES } from "@/lib/clinics";
import { translate } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { MessageKey } from "@/lib/i18n";

type ResultKind = "page" | "service" | "branch" | "staff" | "article";

interface Result {
  id: string;
  kind: ResultKind;
  title: string;
  subtitle?: string;
  href: string;
  /** Từ khoá bổ sung, không hiện ra — dùng để so khớp. */
  keywords: string;
}

/** Trang tĩnh hay được vào từ navbar/footer, nên đưa vào palette cho tiện. */
const STATIC_PAGES: Array<{ href: string; titleKey: MessageKey; subKey: MessageKey }> = [
  { href: "/", titleKey: "palette.home", subKey: "palette.subHome" },
  { href: "/dich-vu", titleKey: "palette.services", subKey: "palette.subServices" },
  { href: "/booking/kham-benh", titleKey: "palette.bookExam", subKey: "palette.subBook" },
  { href: "/booking/tiem-ngua", titleKey: "palette.bookVaccine", subKey: "palette.subBook" },
  { href: "/lien-he", titleKey: "palette.contact", subKey: "palette.subContact" },
  { href: "/doi-ngu", titleKey: "palette.team", subKey: "palette.subTeam" },
  { href: "/kien-thuc-thu-y", titleKey: "palette.knowledge", subKey: "palette.subKnowledge" },
  { href: "/gioi-thieu", titleKey: "palette.about", subKey: "palette.subAbout" },
  { href: "/trang-ca-nhan", titleKey: "palette.profile", subKey: "palette.subProfile" },
  { href: "/tien-ich", titleKey: "palette.tools", subKey: "palette.subTools" },
];

/** Bỏ dấu + gộp khoảng trắng và dấu gạch, để "vac xin" ≈ "vắc-xin". */
function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export default function CommandPalette() {
  const router = useRouter();
  const { t, lang } = useLanguage();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  /** -1 = chưa chọn. Chọn mặc định dòng đầu khi có kết quả. */
  const [active, setActive] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  /**
   * Index nặng (bài viết + nhân sự) sau khi nạp xong.
   *
   * Để trong `useState` chứ không phải `useRef` — có chủ đích. Bản đầu để trong
   * ref và `results` lấy ra trong `useMemo`: memo không "biết" ref đổi nên khi
   * tải xong danh sách vẫn không render lại, và ESLint đúng khi báo là
   * `loading` là phụ thuộc thừa. State là nơi đúng cho dữ liệu ảnh hưởng tới
   * render; ref chỉ dành cho thứ không ảnh hưởng render (input, list DOM).
   */
  const [extra, setExtra] = useState<Result[] | null>(null);
  const [loading, setLoading] = useState(false);

  /** Index phần tĩnh — luôn sẵn, không cần tải. */
  const baseIndex = useMemo<Result[]>(() => {
    const pages: Result[] = STATIC_PAGES.map((page) => ({
      id: `page:${page.href}`,
      kind: "page",
      title: t(page.titleKey),
      subtitle: t(page.subKey),
      href: page.href,
      keywords: page.href,
    }));

    // Dịch vụ và chi nhánh lấy thẳng từ lib/clinics.ts — nguồn đã dùng cho
    // navbar, footer và trang đặt lịch, nên palette không thể lệch danh sách.
    const services: Result[] = SPECIALTY_SERVICES.map((service) => ({
      id: `service:${service.href}`,
      kind: "service",
      title: t(service.labelKey),
      subtitle: t("palette.subService"),
      href: service.href,
      keywords: service.href,
    }));

    const branches: Result[] = BRANCHES.map((branch) => ({
      id: `branch:${branch.id}`,
      kind: "branch",
      title: t(branch.fullNameKey),
      subtitle: branch.address,
      // Dẫn tới mục "Hệ thống phòng khám" trong footer để thấy địa chỉ + nút
      // chỉ đường, thay vì tới route riêng (dự án chưa có trang chi tiết chi nhánh).
      href: "/lien-he",
      keywords: `${branch.code} ${branch.address} ${branch.addressShort}`,
    }));

    return [...pages, ...services, ...branches];
  }, [t]);

  /* ── Phím tắt toàn cục: Cmd/Ctrl + K ───────────────────────────────────── */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((prev) => !prev);
        return;
      }
      // "/" mở nhanh khi không đang gõ trong ô nhập — nhưng BỎ QUA khi đang
      // có con trỏ trong input/textarea, nếu không gõ "/" ra chữ sẽ bị nuốt.
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable === true;
      if (event.key === "/" && !typing && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* ── Tải phần index nặng khi mở lần đầu ───────────────────────────────── */
  useEffect(() => {
    // `extra !== null` = đã nạp rồi → mở lần sau không import lại module.
    if (!open || extra !== null || loading) return;
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const [{ knowledgeArticles }, { STAFF_PROFILES, staffDisplayName }, { teamDoctors }] =
          await Promise.all([
            import("@/lib/knowledgeData"),
            import("@/lib/staffProfiles"),
            import("@/lib/teamData"),
          ]);
        if (cancelled) return;

        const items: Result[] = [];

        for (const article of knowledgeArticles) {
          items.push({
            id: `article:${article.slug}`,
            kind: "article",
            title: article.title,
            subtitle: `${article.author} · ${article.date}`,
            href: `/kien-thuc-thu-y/${article.slug}`,
            keywords: `${article.category} ${article.tags.join(" ")} ${article.excerpt}`,
          });
        }

        for (const person of STAFF_PROFILES) {
          // `bioVi`/`bioEn` là cả câu tiếng Việt/Anh — dùng làm từ khoá so khớp
          // để tìm được người theo chuyên môn, không chỉ theo tên.
          const bio = lang === "en" ? person.bioEn : person.bioVi;
          items.push({
            id: `staff:${person.id}`,
            kind: "staff",
            title: staffDisplayName(person),
            subtitle: lang === "en" ? person.titleEn : person.title,
            href: "/doi-ngu",
            keywords: `${person.branch} ${person.branchEn} ${bio}`,
          });
        }

        for (const doctor of teamDoctors) {
          items.push({
            id: `doctor:${doctor.slug}`,
            kind: "staff",
            title: doctor.name,
            subtitle: `${doctor.degree} · ${translate(lang, doctor.specKey)}`,
            href: `/doi-ngu/${doctor.slug}`,
            keywords: `${doctor.bioVi.join(" ")} ${doctor.bioEn.join(" ")}`,
          });
        }

        setExtra(items);
        // Index vừa dài hơn → dòng đang chọn cũ có thể vượt quá cuối.
        setActive(-1);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, extra, loading, lang]);

  /* ── Lọc ───────────────────────────────────────────────────────────────── */
  const results = useMemo(() => {
    const all = extra ? [...baseIndex, ...extra] : baseIndex;
    const q = normalize(query);
    if (!q) return all.slice(0, 24);
    const terms = q.split(" ").filter(Boolean);
    const matched = all.filter((item) => {
      const haystack = normalize(`${item.title} ${item.subtitle ?? ""} ${item.keywords}`);
      // Mọi từ khoá đều phải có mặt — AND chứ không OR, để "tiêm ngừa" không
      // ra cả bài "cạo vôi răng" chỉ vì chung chữ "thú".
      return terms.every((term) => haystack.includes(term));
    });
    return matched.slice(0, 24);
  }, [baseIndex, query, extra]);

  /* ── Điều hướng bằng bàn phím ──────────────────────────────────────────── */
  const go = useCallback(
    (href: string) => {
      setOpen(false);
      setQuery("");
      setActive(-1);
      router.push(href);
    },
    [router]
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActive((prev) => (results.length ? (prev + 1) % results.length : -1));
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActive((prev) =>
          results.length ? (prev <= 0 ? results.length - 1 : prev - 1) : -1
        );
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        const target = results[active] ?? results[0];
        if (target) go(target.href);
      }
    },
    [active, go, results]
  );

  /* ── Focus + khoá cuộn nền khi mở ─────────────────────────────────────── */
  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();

    // `overflow: hidden` trên <html> chặn cuộn trang nền. Ghi vào style trực
    // tiếp rồi khôi phục đúng giá trị cũ — không dùng biến CSS để tránh phải
    // khai báo trong globals.css cho một thứ chỉ sống trong vòng đời overlay.
    const previous = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = previous;
    };
  }, [open]);

  /* Cuộn dòng đang chọn vào khung nhìn khi bấm mũi tên. */
  useEffect(() => {
    if (active < 0) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const iconFor = (kind: ResultKind) => {
    switch (kind) {
      case "article":
        return BookOpen;
      case "staff":
        return Stethoscope;
      case "branch":
        return MapPin;
      default:
        return Search;
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-start justify-center px-4 pt-[12vh] sm:pt-[16vh]"
      onKeyDown={onKeyDown}
    >
      {/* Lớp nền: bấm vào đây đóng. Nền tối đủ để hộp thoại nổi lên nhưng vẫn
          thấy được trang bên dưới — người dùng nhận ra đang ở ngữ cảnh nào. */}
      <button
        type="button"
        aria-label={t("palette.close")}
        onClick={() => setOpen(false)}
        className="absolute inset-0 cursor-default bg-slate-950/60 backdrop-blur-[3px]"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("palette.title")}
        className="pt-glass-strong relative w-full max-w-xl overflow-hidden rounded-[24px] shadow-2xl sm:rounded-[28px]"
      >
        <div className="flex items-center gap-3 border-b border-black/5 px-4 py-3 dark:border-white/10">
          {loading ? (
            <Loader2 className="size-5 shrink-0 animate-spin text-sky-600 dark:text-sky-300" aria-hidden="true" />
          ) : (
            <Search className="size-5 shrink-0 text-sky-600 dark:text-sky-300" aria-hidden="true" />
          )}
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(-1);
            }}
            placeholder={t("palette.placeholder")}
            aria-label={t("palette.title")}
            className="min-w-0 flex-1 bg-transparent text-sm text-[var(--pt-fg)] outline-none placeholder:text-[var(--pt-fg-muted)] sm:text-base"
          />
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={t("palette.close")}
            className="shrink-0 rounded-full p-1.5 text-[var(--pt-fg-muted)] transition-colors hover:bg-black/5 hover:text-[var(--pt-fg)] dark:hover:bg-white/10"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        {results.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-[var(--pt-fg-muted)]">
            {t("palette.empty")}
          </p>
        ) : (
          <ul ref={listRef} className="max-h-[52vh] overflow-y-auto overscroll-contain py-1.5">
            {results.map((item, index) => {
              const Icon = iconFor(item.kind);
              const selected = index === active;
              return (
                <li key={item.id} data-index={index}>
                  <button
                    type="button"
                    // `aria-selected` trên `role="option"` là cách trình đọc màn
                    // hình thông báo "dòng nào đang được chọn" khi dùng phím mũi tên.
                    role="option"
                    aria-selected={selected}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => go(item.href)}
                    className={cn(
                      "flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors",
                      selected
                        ? "bg-sky-500/12 dark:bg-sky-400/16"
                        : "hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                    )}
                  >
                    <Icon
                      className="size-4 shrink-0 text-sky-600 dark:text-sky-300"
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-[var(--pt-fg)]">
                        {item.title}
                      </span>
                      {item.subtitle ? (
                        <span className="block truncate text-xs text-[var(--pt-fg-muted)]">
                          {item.subtitle}
                        </span>
                      ) : null}
                    </span>
                    {selected ? (
                      <CornerDownLeft
                        className="size-3.5 shrink-0 text-[var(--pt-fg-muted)]"
                        aria-hidden="true"
                      />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {/* Gợi ý phím — ẩn trên mobile vì không có bàn phím để bấm. */}
        <div className="hidden items-center gap-4 border-t border-black/5 px-4 py-2 text-[11px] text-[var(--pt-fg-muted)] dark:border-white/10 sm:flex">
          <span>↑↓ {t("palette.hintMove")}</span>
          <span>↵ {t("palette.hintOpen")}</span>
          <span>Esc {t("palette.hintClose")}</span>
          <span className="ml-auto">{t("palette.resultCount").replace("{n}", String(results.length))}</span>
        </div>
      </div>
    </div>
  );
}
