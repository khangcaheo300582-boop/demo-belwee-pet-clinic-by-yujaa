"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useSession } from "next-auth/react";
import { scrollToHash } from "@/lib/smoothScroll";
import { useTransitionNavigate } from "@/hooks/useTransitionNavigate";
import { usePageReady } from "@/hooks/usePageReady";
import { useNavState, type NavState } from "@/hooks/useNavState";
import { gsap, prefersReducedMotion } from "@/lib/gsap";
import { isTouchDevice } from "@/lib/motion";
import { acquireInertLock, releaseInertLock } from "@/lib/pageInert";
import { initLiquidGlassNav } from "@/lib/liquidGlassNav";
import { useLanguage } from "@/components/LanguageProvider";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { HOTLINE, HOTLINE_DISPLAY } from "@/lib/clinics";
import type { MessageKey } from "@/lib/i18n";
import { useTheme } from "@/components/ThemeProvider";

export interface NavItem {
  href: string;
  route: string;
  /** Either an i18n key (public site) or a ready-made string (staff portal, which has no i18n). Rendered through `label`, which picks the right one. */
  msg?: MessageKey;
  label?: string;
}

/** Biến thể pill theo số từ trong nhãn. */
export type NavPillVariant = "compact-pill" | "full-pill";

const NAV_ITEMS: readonly NavItem[] = [
  { msg: "nav.home", href: "/#home", route: "/" },
  { msg: "nav.about", href: "/gioi-thieu", route: "/gioi-thieu" },
  { msg: "nav.services", href: "/dich-vu", route: "/dich-vu" },
  { msg: "nav.team", href: "/doi-ngu", route: "/doi-ngu" },
  { msg: "nav.petKnowledge", href: "/kien-thuc-thu-y", route: "/kien-thuc-thu-y" },
  { msg: "nav.careers", href: "/tuyen-dung", route: "/tuyen-dung" },
  { msg: "nav.contact", href: "/lien-he", route: "/lien-he" },
];

/**
 * GĐ9 · (a) — thanh hiện đủ 7 mục khi còn chỗ, thu còn 3 mục khi chật.
 *
 * Yêu cầu chủ dự án: màn rộng thì hiện TẤT CẢ mục, màn hẹp thì chỉ 3 mục
 * (Trang chủ · Dịch vụ · Kiến thức thú y).
 *
 * ── VÌ SAO ĐO CHỨ KHÔNG ĐẶT NGƯỠNG CỨNG ──────────────────────────────────────
 * Bản GĐ3 dùng `PRIMARY_ROUTES` — cắt cứng 3 mục, KHÔNG đo gì cả. Nhưng bề
 * rộng cần thiết phụ thuộc NGÔN NGỮ (tiếng Việt "Dịch vụ" ngắn hơn tiếng Anh
 * "Services", còn "Liên hệ"/"Contact" thì ngược lại) và phụ thuộc phần tải
 * trang (nút Cấp cứu 24h có mặt hay không, đã đăng nhập hay chưa — mỗi thứ
 * chiếm 100–180px). Một ngưỡng viết cứng sẽ đúng trên máy tôi và sai trên máy
 * người khác.
 *
 * ── ĐO NHƯ THẾ NÀO ─────────────────────────────────────────────────────────────
 * 1. `useIsomorphicLayoutEffect` chạy TRƯỚC lần vẽ đầu tiên ở client ⇒ không
 *    nháy. Bọc qua hook riêng vì bản server cảnh báo nếu gọi `useLayoutEffect`.
 * 2. Bề rộng 7 nhãn đo bằng MỘT span dò đường nét đặt ngoài màn hình, chép
 *    nguyên style chữ từ một mục thật. KHÔNG bỏ ẩn rồi đo lại: `display:none`
 *    cho `offsetWidth = 0` nên sẽ đo ra 0 và quyết định sai.
 * 3. Kết quả nhớ trong `useRef`; `ResizeObserver` chỉ so lại với chỗ trống hiện
 *    tại ⇒ kéo cửa sổ không nhảy, không đo lại 7 lần mỗi lần cuộn.
 * 4. Đổi ngôn ngữ thì đo lại từ đầu — bề rộng chữ khác nhau, dùng `lang` làm khoá.
 *
 * Trạng thái khởi tạo = ĐỦ (7 mục). Server cũng render ra vậy nên không có
 * hydration mismatch; nếu sau đó phát hiện chật thì thu lại trước khi vẽ.
 */
/** Phần tử nhận focus, dùng khi bẫy focus trong thẻ danh mục. */
const FOCUSABLE_IN_CARD =
  'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

const AUTH_PATHS = ["/dang-nhap", "/cap-lai-mat-khau", "/tao-tai-khoan"];

/**
 * Tên khoá `inert` của menu hamburger trong sổ đăng ký (lib/pageInert.ts).
 *
 * Dùng hằng số thay vì chuỗi rời rạc để chắc chắn "mở khoá" luôn nhả đúng
 * khoá đã "khoá" — và để không đụng tới khoá của video intro.
 */
const MENU_LOCK_ID = "site-navbar-hamburger";

/**
 * `useLayoutEffect` chỉ chạy ở client. Gọi thẳng trong component có
 * `"use client"` vẫn bị React CẢNH BÁO khi render ở server, nên phải đổi tên
 * nó trên server. Đây là mẹo chuẩn, không phải lỗi bị lách.
 */
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * Danh sách 3 mục được giữ lại khi thanh nav không còn đủ chỗ cho cả 7.
 * Đúng yêu cầu của chủ dự án: màn rộng hiện TẤT CẢ mục, màn hẹp chỉ hiện
 * 3 mục (Trang chủ · Dịch vụ · Kiến thức thú y).
 */
const COMPACT_ROUTES: ReadonlySet<string> = new Set(["/", "/dich-vu", "/kien-thuc-thu-y"]);

/**
 * Chế độ hiển thị cụm mục trên thanh điều hướng.
 *
 *   "full"    — đủ chỗ cho cả 7 mục.
 *   "compact" — chỉ giữ 3 mục của `COMPACT_ROUTES`, các mục còn lại bị đánh
 *               dấu `data-overflow-hidden` (CSS `display:none`).
 *   "hidden"  — kể cả 3 mục cũng không vừa ⇒ ẩn hẳn cụm mục, chỉ còn logo +
 *               nút ba gạch. Không có chế độ này thì nút ba gạch bị đẩy ra
 *               ngoài mép phải và bị `.site-global-nav { overflow: hidden }`
 *               CẮT MẤT ⇒ không bấm được nút menu.
 */
type LinksMode = "full" | "compact" | "hidden";

/**
 * Bề rộng cụm mục có vừa chỗ trống không.
 *
 * Chừa `48px` dư cho padding/viền của track và sai số font trước khi ổn định:
 * đo bằng `getBoundingClientRect` là chính xác, nhưng giữa phép
 * đo và lúc vẽ có thể font vừa nạp xong và nhãn dài thêm vài px; thiếu phần
 * dư thì thanh tràn đúng lúc người dùng kéo cửa sổ — lúc này
 * `.site-global-actions` có `flex-shrink: 0` nên phần dư sẽ đè lên mục cuối.
 * Đây đúng là lỗi đã xảy ra ở GĐ3 (nút "Book now" chồng lên mục cuối).
 */
function fitsLinks(
  measured: readonly { item: NavItem; width: number }[] | null,
  available: number | null,
): boolean {
  if (!measured || measured.length === 0 || available === null) return true;
  const gap = 4; // `.site-global-links { gap: 4px }`
  const needed = measured.reduce((sum, m) => sum + m.width, 0) + gap * (measured.length - 1);
  return needed + 48 <= available;
}

/**
 * Chế độ hiển thị cụm mục, tính từ bề rộng THẬT.
 *
 *   "full"    — cả 7 mục vừa chỗ trống.
 *   "compact" — không đủ cho 7, nhưng đủ cho 3 mục của `COMPACT_ROUTES`
 *               (Trang chủ · Dịch vụ · Kiến thức thú y).
 *   "hidden"  — không đủ cho cả 3 ⇒ ẩn hẳn cụm mục, chỉ còn logo + nút ba
 *               gạch. Không có chế độ này thì nút ba gạch bị đẩy ra ngoài mép
 *               phải và bị `.site-global-nav { overflow: hidden }` CẮT MẤT ⇒
 *               không bấm được nút menu.
 */
function computeLinksMode(
  measured: readonly { item: NavItem; width: number }[] | null,
  available: number | null,
): LinksMode {
  if (!measured || measured.length === 0 || available === null) return "full";
  if (fitsLinks(measured, available)) return "full";

  // Chỉ giữ 3 mục `COMPACT_ROUTES` — đo riêng chúng, không cắt khỏi mảng
  // (xem comment của prop `overflowHidden` ở NavItem).
  const compact = measured.filter((m) => COMPACT_ROUTES.has(m.item.route));
  if (compact.length > 0 && fitsLinks(compact, available)) return "compact";

  return "hidden";
}

interface SiteNavbarProps {
  /**
   * Override the menu. The staff portal renders this SAME component with four
   * different items (see components/staff/StaffNavbar.tsx) rather than
   * duplicating 570 lines of hover-pill, scroll-glass and hamburger logic —
   * which is why the list is a prop and not a module constant.
   */
  items?: readonly NavItem[];
  /** Hide the account/login entry in the mobile drawer (staff draws its own). */
  showAccountItem?: boolean;
  /** Where the drawer footer renders its language switcher. */
  footerSlot?: ReactNode;
  /**
   * The pill button on the right. The public site uses "Book now" → /dich-vu;
   * the staff portal repoints it at the dashboard, so a staff member who taps
   * it lands back in their own area instead of being ejected to marketing.
   */
  ctaHref?: string;
  ctaLabel?: string;
  /** Rendered before the CTA — the staff portal puts its logout button here. */
  actionsSlot?: ReactNode;
  /**
   * The left-hand pill. Defaults to the public emergency hotline link. The
   * staff portal turns it into a non-interactive status chip instead — a
   * "dial 0772 003 915" button inside an internal tool is a mis-click waiting
   * to happen, and it would pull the employee out of the portal entirely.
   * `null` label removes the element.
   */
  emergencyHref?: string | null;
  emergencyLabel?: string;
  emergencyAria?: string;
  /** Keep the staff navigation in document flow while pinning it during scroll. */
  sticky?: boolean;
}

/**
 * NavItem dùng chung với prop `variant` ("compact-pill" | "full-pill").
 * Tránh tạo 2 component trùng lặp logic — biến thể được chọn theo số từ trong
 * nhãn (≤ 2 từ ⇒ compact-pill; > 2 từ ⇒ full-pill) hoặc override qua prop.
 *
 * Hiệu ứng hover:
 *  - compact-pill: nền viên thuốc bo nhẹ hiện ra sau chữ, rồi co lại theo
 *    spring (scale 1.15 → 1) tạo cảm giác đàn hồi nhẹ.
 *  - full-pill: giữ nguyên kiểu bo tròn đầy đủ hiện tại.
 * Cả hai đều phản ứng focus-visible (bàn phím) ngoài ra hover (chuột).
 */
function NavItem({
  item,
  isHighlighted,
  isCurrentPage,
  onClick,
  onMouseEnter,
  onFocus,
  onBlur,
  t,
  overflowHidden = false,
}: {
  item: NavItem;
  isHighlighted: boolean;
  isCurrentPage: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
  onFocus: () => void;
  onBlur: () => void;
  t: (key: MessageKey) => string;
  /**
   * Mục bị thu vì thanh nav không còn đủ chỗ.
   *
   * KHÔNG cắt khỏi mảng: mảng bị cắt thì không đo được bề rộng của chính mục
   * đang bị ẩn, nên không bao giờ biết lúc nào đủ chỗ hiện lại — và thứ tự mục
   * cũng nhảy khi đổi ngôn ngữ hay kéo cửa sổ. Giữ nguyên trong DOM rồi đánh
   * dấu `data-overflow-hidden` (CSS `display:none` lo cả khỏi bố cục, khỏi
   * tab order và khỏi trình đọc màn hình). `tabIndex={-1}` là lưới an toàn
   * thứ hai, không phụ thuộc CSS.
   */
  overflowHidden?: boolean;
}) {
  return (
    <Link
      href={item.href}
      onClick={(event) => { event.preventDefault(); onClick(); }}
      onMouseEnter={onMouseEnter}
      onFocus={onFocus}
      onBlur={onBlur}
      tabIndex={overflowHidden ? -1 : undefined}
      data-overflow-hidden={overflowHidden ? "" : undefined}
      className={`site-global-link nav-item-link ${isHighlighted ? "is-current" : ""}`}
      aria-current={isCurrentPage ? "page" : undefined}
    >
      <span className="nav-item-text">{labelOf(item, t)}</span>
    </Link>
  );
}

function labelOf(item: NavItem, t: (key: MessageKey) => string): string {
  return item.msg ? t(item.msg) : item.label ?? "";
}

function SiteNavbarInner({
  items = NAV_ITEMS,
  showAccountItem = true,
  footerSlot,
  ctaHref = "/dich-vu",
  ctaLabel,
  actionsSlot,
  emergencyHref = `tel:${HOTLINE}`,
  emergencyLabel,
  emergencyAria,
  sticky = false,
}: SiteNavbarProps = {}) {
  const pathName = usePathname();
  const transitionNavigate = useTransitionNavigate();
  const { data: session, status } = useSession();
  const { t, lang } = useLanguage();
  const { theme: _theme } = useTheme();
  // Trạng thái cuộn (top / compact / expanded) — nguồn duy nhất cho `data-state`.
  const navState = useNavState();
  const [atTopCount, setAtTopCount] = useState(0);
  const [isHamburgerOpen, setIsHamburgerOpen] = useState(false);
  const [leavingHref, setLeavingHref] = useState<string | null>(null);
  const [hamburgerMounted, setHamburgerMounted] = useState(false);
  const [hamburgerClosing, setHamburgerClosing] = useState(false);
  const [linksMode, setLinksMode] = useState<LinksMode>("full");
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  const mountedRef = useRef(false);
  const mouseRef = useRef({ x: 50, y: 50 });
  const rafRef = useRef<number | null>(null);
  const isTouchRef = useRef(isTouchDevice());
  const closeTimerRef = useRef<number | null>(null);
  const navigationTimerRef = useRef<number | null>(null);
  const previousPathRef = useRef(pathName);
  const navRef = useRef<HTMLElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const linksRef = useRef<HTMLDivElement>(null);
  const hoverBubbleRef = useRef<HTMLSpanElement>(null);
  const highlightedIndexRef = useRef<number | null>(null);
  const hamburgerRef = useRef<HTMLDivElement>(null);
  const hamburgerButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
      if (navigationTimerRef.current !== null) window.clearTimeout(navigationTimerRef.current);
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Liquid glass THẬT (Chromium, chỉ sau khi map sinh xong): gắn displ
  // filter qua class `lg-refract` trên <html>. Non-Chromium/Safari/Firefox
  // giữ nguyên kiểu frosted trong CSS. Dọn observer khi unmount.
  useEffect(() => initLiquidGlassNav(navRef.current), []);

  // Giữ bản sao isTouchDevice đã đọc ở lần render đầu (tránh gọi matchMedia lẻ tẻ).
  useEffect(() => {
    isTouchRef.current = isTouchDevice();
  }, []);

  const savedYRef = useRef(0);
  // Guard idempotency: CHỈ unlock khi lock thật sự đang active, và CHỈ lock
  // khi chưa lock. Bằng chứng runtime: effect `!hamburgerMounted` có thể mount
  // lại (hydration/StrictMode remount) khi body chưa từng bị lock → nếu gọi
  // unlock mù quáng sẽ `scrollTo(0, savedYRef=0)` nhảy mất vị trí người dùng
  // (log: yBefore=800 → scrollTo(0,0)). Ngược lại, lock chạy lần 2 khi body
  // đã `position: fixed` sẽ đọc `window.scrollY = 0` → overwrite savedYRef
  // thành 0 → đóng menu restore về đầu trang.
  const bodyLockActiveRef = useRef(false);

  // Body scroll lock with scrollbar compensation (iOS Safari compatible)
  const lockBodyScroll = useCallback(() => {
    if (bodyLockActiveRef.current) return;
    savedYRef.current = window.scrollY;
    const root = document.documentElement;
    const sbw = window.innerWidth - root.clientWidth;
    root.style.scrollBehavior = "auto";
    document.body.style.setProperty("--scrollbar-width", `${sbw}px`);
    Object.assign(document.body.style, {
      position: "fixed",
      top: `-${savedYRef.current}px`,
      left: "0",
      right: "0",
      width: "100%",
      paddingRight: sbw ? `${sbw}px` : "",
    });
    document.body.classList.add("hamburger-open");
    // iOS Safari: prevent touchmove on body
    document.body.style.overscrollBehavior = "none";
    document.body.style.touchAction = "none";
    bodyLockActiveRef.current = true;
  }, []);

  const unlockBodyScroll = useCallback(() => {
    if (!bodyLockActiveRef.current) return;
    bodyLockActiveRef.current = false;
    const y = savedYRef.current;
    document.documentElement.style.scrollBehavior = "auto";
    Object.assign(document.body.style, {
      position: "",
      top: "",
      left: "",
      right: "",
      width: "",
      paddingRight: "",
    });
    document.body.style.removeProperty("--scrollbar-width");
    document.body.classList.remove("hamburger-open");
    document.body.style.removeProperty("overscroll-behavior");
    document.body.style.removeProperty("touch-action");
    void document.body.offsetHeight;
    window.scrollTo(0, y);
    document.documentElement.style.scrollBehavior = "";
  }, []);

  const closeHamburger = useCallback(() => {
    if (!isHamburgerOpen) return;
    setHamburgerClosing(true);
    setIsHamburgerOpen(false);
    setLeavingHref(null);
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = window.setTimeout(() => {
      if (!mountedRef.current) return;
      setHamburgerMounted(false);
      setHamburgerClosing(false);
      hamburgerButtonRef.current?.focus({ preventScroll: true });
      // KHÔNG unlock ở đây: body phải giữ nguyên trạng thái fixed (với top
      // compensative) cho tới khi effect `!hamburgerMounted` gỡ class
      // `body.hamburger-open` rồi mới unlock. Nếu unlock trước khi class
      // bị gỡ, CSS `body.hamburger-open { position: fixed }` (không có top)
      // sẽ kéo trang về 0 trong 1 frame trước khi class biến mất — đúng
      // lỗi "đóng menu thấy trang nhảy lên đầu rồi trở lại".
    }, 420);
  }, [isHamburgerOpen]);

  // Track chuột để cập nhật --mouse-x/--mouse-y (CSS custom property) trực tiếp
  // qua ref — KHÔNG dùng React state, tránh re-render mỗi pixel. Throttle bằng
  // requestAnimationFrame. Tắt trên thiết bị cảm ứng.
  const handleMouseMove = useCallback(
    (event: React.MouseEvent) => {
      if (prefersReducedMotion() || isTouchRef.current) return;
      const nav = navRef.current;
      if (!nav) return;
      const rect = nav.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 100;
      const y = ((event.clientY - rect.top) / rect.height) * 100;
      mouseRef.current = { x, y };
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(() => {
          const navEl = navRef.current;
          if (navEl) {
            navEl.style.setProperty("--mouse-x", `${mouseRef.current.x}%`);
            navEl.style.setProperty("--mouse-y", `${mouseRef.current.y}%`);
          }
          rafRef.current = null;
        });
      }
    },
    [navRef],
  );

  // Ripple "trở về đỉnh" cũ: chỉ đếm số lần navbar quay lại trạng thái top.
  const prevNavStateRef = useRef<NavState>("top");
  useEffect(() => {
    if (prevNavStateRef.current !== "top" && navState === "top") {
      setAtTopCount((count) => count + 1);
    }
    prevNavStateRef.current = navState;
  }, [navState]);

  useEffect(() => {
    document.body.classList.add("site-global-nav-active");
    return () => document.body.classList.remove("site-global-nav-active");
  }, []);

  useEffect(() => {
    if (previousPathRef.current === pathName) return;
    previousPathRef.current = pathName;
    setHoveredIndex(null);
    setFocusedIndex(null);
    closeHamburger();
  }, [pathName, closeHamburger]);

  // Hamburger open/close: body scroll lock, focus trap, inert background
  useEffect(() => {
    if (!hamburgerMounted) {
      unlockBodyScroll();
      // Nhả khoá `inert` của riêng MENU. Dùng sổ đăng ký (lib/pageInert.ts)
      // thay vì `document.querySelector("main")?.parentElement` — phần tử đó
      // chính là `.app-shell`, mà `.app-shell` chứa CẢ header lẫn thẻ menu, nên
      // đặt `inert` trực tiếp lên nó là tự khoá chính thẻ menu vừa mở ⇒ mọi nút
      // trong thẻ chết (không click/hover/focus được). Sổ đăng ký cũng bảo đảm
      // việc nhả khoá ở đây KHÔNG xoá nhầm khoá của video intro.
      releaseInertLock(MENU_LOCK_ID);
      return;
    }

    if (isHamburgerOpen) {
      lockBodyScroll();
      // Khoá nội dung trang nhưng MIỄN nhánh chứa header — thẻ menu nằm
      // trong header nên phải sống sót. Đồng thời khoá chrome của navbar
      // (logo, danh sách mục, nút cứu hộ/đặt lịch/avatar) để bàn phím không
      // Tab vào được mục đang bị CSS ẩn. Xem lib/pageInert.ts.
      acquireInertLock(MENU_LOCK_ID, "content");

      const card = hamburgerRef.current;
      const focusableElements = card
        ? Array.from(
            card.querySelectorAll<HTMLElement>(FOCUSABLE_IN_CARD)
          ).filter((el) => el.offsetParent !== null)
        : [];

      const handleKeydown = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
          closeHamburger();
          return;
        }
        if (event.key === "Tab") {
          const firstFocusable = focusableElements[0];
          const lastFocusable = focusableElements[focusableElements.length - 1];
          if (document.activeElement === lastFocusable && !event.shiftKey) {
            event.preventDefault();
            firstFocusable.focus({ preventScroll: true });
          } else if (document.activeElement === firstFocusable && event.shiftKey) {
            event.preventDefault();
            lastFocusable.focus({ preventScroll: true });
          }
        }
      };

      window.addEventListener("keydown", handleKeydown);
      requestAnimationFrame(() => {
        if (focusableElements[0]) focusableElements[0].focus({ preventScroll: true });
      });

      return () => {
        // KHÔNG unlockBodyScroll() ở đây — body phải giữ fixed cho tới khi
        // thẻ menu gỡ xong (effect `!hamburgerMounted` là điểm unlock DUY
        // NHẤT, chạy ngay sau khi class `body.hamburger-open` bị gỡ trong
        // cùng commit ⇒ không có frame nào bị CSS class fixed không-top
        // kéo về đầu trang).
        releaseInertLock(MENU_LOCK_ID);
        window.removeEventListener("keydown", handleKeydown);
      };
    }

    // Đang đóng (transitioning): GIỮ nguyên trạng thái khóa cuộn của body
    // (inline styles do lockBodyScroll đặt, class `hamburger-open` cũng đã
    // có từ lúc mở). KHÔNG re-add class tại đây: nếu body đã được unlock
    // sớm mà class còn sót, CSS `body.hamburger-open { position: fixed }`
    // (không có `top`) sẽ collapse document về 0 ⇒ trang nhảy đầu trang.
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeHamburger();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.classList.remove("hamburger-open");
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    closeHamburger,
    hamburgerMounted,
    isHamburgerOpen,
    lockBodyScroll,
    unlockBodyScroll,
  ]);

  // An toàn khi unmount: nếu navbar bị gỡ khi menu còn đang mở (vd. đổi
  // layout, navigateaway khiến component mất), timer đóng có thể bị huỷ
  // trước khi chạy — đảm bảo body không bị kẹt `position: fixed` vĩnh viễn.
  useEffect(() => () => unlockBodyScroll(), [unlockBodyScroll]);

  // Entrance animation premium — Ripple lan từ tâm + stagger content.
  const pageReady = usePageReady();
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (!pageReady || prefersReducedMotion()) return;
    const header = document.querySelector(".site-global-header");
    if (!header) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".site-global-header",
        { y: -20, autoAlpha: 0 },
        {
          y: 0,
          autoAlpha: 1,
          duration: 0.7,
          ease: "power2.out",
          delay: 0.15,
          // Xoá transform NGAY khi chạy xong. Một
          // `transform: translate(0px, 0px)` còn sót lại trên header là nó
          // trở thành containing block cho mọi phần tử `position: fixed`
          // bên trong, và ép header thành một layer GPU riêng vô nghĩa suốt
          // thời gian header còn nằm trên màn hình. translate(0,0) không đổi
          // hình ảnh nên xoá không ảnh hưởng hiệu ứng vào trang.
          clearProps: "transform",
        }
      );
      gsap.fromTo(
        ".site-global-logo",
        { scale: 0.5, autoAlpha: 0, rotateY: 15 },
        { scale: 1, autoAlpha: 1, rotateY: 0, duration: 0.8, ease: "elastic.out(1, 0.6)", delay: 0.35 }
      );
      gsap.fromTo(
        ".site-global-link",
        { y: 14, autoAlpha: 0, scale: 0.9 },
        { y: 0, autoAlpha: 1, scale: 1, duration: 0.6, ease: "elastic.out(1, 0.75)", stagger: 0.06, delay: 0.5 }
      );
      // Entrance của cụm nút bên phải (cứu hộ / đặt lịch / avatar / ba gạch).
      //
      // Lệch `x` PHẢI nhỏ hơn padding phải của thanh nav, nếu không nút ba
      // gạch bị đẩy ra ngoài khung nav ⇒ `.site-global-nav { overflow: hidden }`
      // cắt mất một phần ⇒ hiện tượng "nút menu bị cụt". Ở ≤640px padding
      // chỉ 12px nên lệch cứng 24px là cắt mất ~11px.
      //
      // Đọc padding thật của thanh ⇒ tự đúng ở mọi breakpoint, không cần
      // hardcode theo media query.
      const navEl = navRef.current;
      const padRight = navEl
        ? parseFloat(getComputedStyle(navEl).paddingRight) || 0
        : 24;
      const actionsOffset = Math.max(0, Math.min(24, padRight - 2));

      gsap.fromTo(
        ".site-global-actions > *",
        { x: actionsOffset, autoAlpha: 0 },
        { x: 0, autoAlpha: 1, duration: 0.55, ease: "back.out(1.4)", stagger: 0.05, delay: 0.65 }
      );
    });
    return () => ctx.revert();
  }, [pathName, pageReady]);

  const isPublicNav = items === NAV_ITEMS;

  const itemWidthsRef = useRef<readonly { item: NavItem; width: number }[] | null>(null);

  const measureLabels = useCallback((labels: readonly string[]) => {
    const sample = linksRef.current?.querySelector<HTMLElement>(".site-global-link");
    if (!sample || typeof document === "undefined") return null;

    const cs = getComputedStyle(sample);
    const probe = document.createElement("span");
    probe.style.position = "absolute";
    probe.style.left = "-9999px";
    probe.style.top = "0";
    probe.style.whiteSpace = "nowrap";
    probe.style.visibility = "hidden";
    probe.style.fontFamily = cs.fontFamily;
    probe.style.fontSize = cs.fontSize;
    probe.style.fontWeight = cs.fontWeight;
    probe.style.letterSpacing = cs.letterSpacing;
    probe.style.paddingLeft = cs.paddingLeft;
    probe.style.paddingRight = cs.paddingRight;
    probe.style.boxSizing = "border-box";

    const widths = labels.map((label) => {
      probe.textContent = label;
      document.body.appendChild(probe);
      const w = probe.getBoundingClientRect().width;
      probe.remove();
      return w;
    });
    return widths;
  }, []);

  const availableForLinks = useCallback(() => {
    const nav = navRef.current;
    if (!nav) return null;
    const logo = nav.querySelector<HTMLElement>(".site-global-logo");
    const actions = nav.querySelector<HTMLElement>(".site-global-actions");
    const links = linksRef.current;
    if (!logo || !actions || !links) return null;
    const navW = nav.getBoundingClientRect().width;
    const used = logo.getBoundingClientRect().width + actions.getBoundingClientRect().width;
    return navW - used - 32;
  }, []);

  /**
   * Đo lại bề rộng nhãn và tính lại chế độ hiển thị cụm mục.
   *
   * PHẢI đo lại được nhiều lần, không chỉ một lần lúc mount. Lý do: lần đo
   * đầu chạy ở layout effect, tức TRƯỚC khi web font nạp xong ⇒ nhãn được đo
   * bằng font DỰ PHÒNG ⇒ bề rộng sai ⇒ chế độ "full/compact/hidden" sai ⇒
   * thanh tràn ⇒ nút ba gạch bị `.site-global-nav { overflow: hidden }` cắt
   * mất ⇒ người dùng không bấm được nút menu.
   */
  const measureAndApplyLinksMode = useCallback(() => {
    if (!isPublicNav) return;
    const labels = items.map((item) => labelOf(item, t));
    const widths = measureLabels(labels);
    if (!widths) return;
    itemWidthsRef.current = items.map((item, i) => ({
      item,
      width: widths[i],
    }));
    setLinksMode(computeLinksMode(itemWidthsRef.current, availableForLinks()));
  }, [isPublicNav, items, t, measureLabels, availableForLinks]);

  useIsomorphicLayoutEffect(() => {
    measureAndApplyLinksMode();
  }, [measureAndApplyLinksMode, lang]);

  /**
   * Đo lại khi web font nạp xong.
   *
   * `next/font` dùng `display: swap` ⇒ lần đo đầu (layout effect) chạy với
   * font DỰ PHÒNG. Chờ `document.fonts.ready` rồi đo lại thì mới đúng bề
   * rộng thật, và chế độ hiển thị cụm mục mới đúng — nếu không, nút ba gạch
   * có thể bị đẩy ra ngoài mép phải và bị `overflow: hidden` cắt mất.
   *
   * `loadingdone` bắt cả các lần nạp font về sau (ví dụ subset tiếng Việt
   * tới muộn hơn), không chỉ lần nạp đầu.
   */
  useEffect(() => {
    if (!isPublicNav) return;
    if (typeof document === "undefined" || !document.fonts) return;

    let cancelled = false;
    const remeasure = () => {
      if (cancelled) return;
      // Chờ 1 frame để layout áp lại font mới rồi mới đo.
      requestAnimationFrame(() => {
        if (cancelled) return;
        measureAndApplyLinksMode();
      });
    };

    void document.fonts.ready.then(remeasure).catch(() => {});
    document.fonts.addEventListener("loadingdone", remeasure);

    return () => {
      cancelled = true;
      document.fonts.removeEventListener("loadingdone", remeasure);
    };
  }, [isPublicNav, lang, measureAndApplyLinksMode]);

  useEffect(() => {
    if (!isPublicNav) return;
    const nav = navRef.current;
    if (!nav || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      const next = computeLinksMode(itemWidthsRef.current, availableForLinks());
      setLinksMode((prev) => (prev === next ? prev : next));
    });
    ro.observe(nav);
    // Quan sát thêm cụm mục: bề rộng của nó đổi khi chế độ hiển thị đổi, và
    // thay đổi đó có thể làm chế độ cần được tính lại.
    const links = linksRef.current;
    if (links) ro.observe(links);
    return () => ro.disconnect();
  }, [isPublicNav, availableForLinks]);

  const navigate = (href: string) => {
    closeHamburger();
    if (href.includes("#") && pathName === "/") {
      scrollToHash(href.substring(href.indexOf("#")));
      return;
    }
    transitionNavigate(href);
  };

  const ctaText = ctaLabel ?? t("nav.book");
  const emergencyText = emergencyLabel ?? t("nav.emergency");
  const emergencyChipAria = emergencyAria ?? emergencyText;

  const isActive = (item: NavItem) => {
    if (item.route === "/") return pathName === "/";
    if (item.route.startsWith("/#")) return false;
    return pathName === item.route || pathName.startsWith(`${item.route}/`);
  };
  const activeIndex = items.findIndex(isActive);
  const highlightedIndex = hoveredIndex ?? focusedIndex ?? activeIndex;

  const openHamburger = () => {
    if (hamburgerClosing) return;
    setLeavingHref(null);
    setHamburgerClosing(false);
    setHamburgerMounted(true);
    setIsHamburgerOpen(true);
  };

  const handleHamburgerNav = (href: string) => {
    if (hamburgerClosing) return;
    setLeavingHref(href);
    if (navigationTimerRef.current !== null) window.clearTimeout(navigationTimerRef.current);
    navigationTimerRef.current = window.setTimeout(() => {
      if (!mountedRef.current) return;
      setHamburgerClosing(true);
      setIsHamburgerOpen(false);
      setLeavingHref(null);
      navigationTimerRef.current = window.setTimeout(() => {
        if (!mountedRef.current) return;
        setHamburgerMounted(false);
        setHamburgerClosing(false);
        navigationTimerRef.current = null;
        if (href.includes("#") && pathName === "/") {
          scrollToHash(href.substring(href.indexOf("#")));
        } else {
          transitionNavigate(href);
        }
      }, 320);
    }, 180);
  };

  // Trạng thái đăng nhập — gated bởi mountedRef để tránh hydration mismatch:
  // lần render đầu (server + client đầu) vẫn dùng phiên bản chưa đăng nhập
  // (placeholder cùng kích thước), sau khi mount + session resolve thì mới swap.
  const isAuthenticated = mountedRef.current && status === "authenticated" && !!session?.user;
  const isAtTop = navState === "top";

  // Match the single indicator to the active, hovered, or focused link.
  const updateHoverBubble = useCallback((index: number | null) => {
    const bubble = hoverBubbleRef.current;
    const links = linksRef.current;
    if (!bubble || !links) {
      if (bubble) bubble.style.opacity = "0";
      return;
    }

    if (index === null) {
      bubble.style.opacity = "0";
      return;
    }

    const linkEls = Array.from(links.querySelectorAll<HTMLElement>(".site-global-link"));
    const targetEl = linkEls[index];
    if (!targetEl || targetEl.getClientRects().length === 0) {
      bubble.style.opacity = "0";
      return;
    }

    const linksRect = links.getBoundingClientRect();
    const linkRect = targetEl.getBoundingClientRect();
    const x = linkRect.left - linksRect.left;
    const y = linkRect.top - linksRect.top;
    bubble.style.width = `${linkRect.width}px`;
    bubble.style.height = `${linkRect.height}px`;
    bubble.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    bubble.style.opacity = "1";
  }, []);

  useIsomorphicLayoutEffect(() => {
    highlightedIndexRef.current = highlightedIndex;
    updateHoverBubble(highlightedIndex);
  }, [highlightedIndex, linksMode, lang, updateHoverBubble]);

  // Re-measure after resizing or font changes; both can move or resize a link.
  useEffect(() => {
    const links = linksRef.current;
    if (!links) return;

    let frame = 0;
    let cancelled = false;
    const update = () => updateHoverBubble(highlightedIndexRef.current);
    const scheduleUpdate = () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        update();
      });
    };
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(scheduleUpdate);

    observer?.observe(links);
    links.querySelectorAll<HTMLElement>(".site-global-link").forEach((link) => {
      observer?.observe(link);
    });
    window.addEventListener("resize", scheduleUpdate);

    const fonts = document.fonts;
    if (fonts) {
      void fonts.ready.then(() => {
        if (!cancelled) scheduleUpdate();
      });
      fonts.addEventListener("loadingdone", scheduleUpdate);
    }

    return () => {
      cancelled = true;
      observer?.disconnect();
      window.removeEventListener("resize", scheduleUpdate);
      if (frame) window.cancelAnimationFrame(frame);
      fonts?.removeEventListener("loadingdone", scheduleUpdate);
    };
  }, [updateHoverBubble]);

  return (
    <>
      <header
        ref={headerRef}
        className={`site-global-header ${sticky ? "is-staff-sticky" : ""} ${hamburgerMounted ? "is-hamburger-open" : ""} ${hamburgerClosing ? "is-closing" : ""}`}
        aria-label={t("nav.navAria")}
      >
        <div className="site-global-header-inner">
          <nav
            ref={navRef}
            className={`site-global-nav liquid-glass-base lg-material ${isAtTop ? "is-at-top" : "is-active is-glass"} ${navState === "compact" ? "is-morph" : ""} ${isAuthenticated ? "is-auth" : ""}`}
            data-state={navState}
            data-touch={isTouchRef.current ? "true" : "false"}
            onMouseMove={handleMouseMove}
          >
            {/* Nền đỉnh trang: trong suốt + gradient mờ trắng hai đầu */}
            <span className="site-global-nav-bg-top" aria-hidden="true" />
            {/* Nền đã cuộn: chỉ còn lớp nhuộm mờ — backdrop-filter duy nhất nằm trên <nav> */}
            <span className="site-global-nav-bg-scroll" aria-hidden="true" />
            {/* Mờ xanh theo chuột (mousemove → CSS var, rAF, không re-render) */}
            <span className="site-global-nav-mouse-glow" aria-hidden="true" />
            <span className="site-global-ripple site-global-ripple-init" aria-hidden="true" />
            <span
              className="site-global-ripple site-global-ripple-reverse"
              key={`rr-${atTopCount}`}
              aria-hidden="true"
            />
            <span className="site-global-nav-glow" aria-hidden="true" />
            <span className="site-global-nav-sheen" aria-hidden="true" />
            <Link
              href="/"
              onClick={(event) => {
                event.preventDefault();
                navigate("/");
              }}
              className="site-global-logo"
            >
              <Image
                src="/logo-belwee.png"
                alt="Belwee Pet Clinic"
                width={110}
                height={28}
                priority
              />
            </Link>

            <div
              className="site-global-links"
              ref={linksRef}
              data-links-mode={isPublicNav ? linksMode : "full"}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              {/* Liquid glass hover bubble - Module A4 */}
              <span
                ref={hoverBubbleRef}
                className="site-global-hover-bubble"
                aria-hidden="true"
              />

              <div className="site-global-link-track">
                {items.map((item, _idx) => {
                  // Chế độ "compact" chỉ giữ 3 mục `COMPACT_ROUTES`; chế độ
                  // "hidden" giấu hết. Mục bị ẩn KHÔNG bị cắt khỏi mảng (xem
                  // comment prop `overflowHidden` ở NavItem) nên vẫn đo được
                  // bề rộng và tự hiện lại khi đủ chỗ.
                  const overflowHidden =
                    isPublicNav &&
                    linksMode !== "full" &&
                    (linksMode === "hidden" || !COMPACT_ROUTES.has(item.route));
                  return (
                    <NavItem
                      key={item.href}
                      item={item}
                      isHighlighted={highlightedIndex === _idx}
                      isCurrentPage={isActive(item)}
                      t={t}
                      overflowHidden={overflowHidden}
                      onMouseEnter={() => setHoveredIndex(_idx)}
                      onFocus={() => setFocusedIndex(_idx)}
                      onBlur={() => setFocusedIndex((index) => (index === _idx ? null : index))}
                      onClick={() => {
                        setHoveredIndex(null);
                        setFocusedIndex(null);
                        navigate(item.href);
                      }}
                    />
                  );
                })}
              </div>
            </div>

            <div className="site-global-actions">
              {emergencyHref ? (
                <a href={emergencyHref} className="site-global-emergency">
                  <span aria-hidden="true">🚨</span>
                  <span className="site-global-emergency-label">{emergencyText}</span>
                </a>
              ) : emergencyText ? (
                <span className="site-global-emergency is-static" aria-label={emergencyChipAria}>
                  <span aria-hidden="true">🚨</span>
                  <span className="site-global-emergency-label">{emergencyText}</span>
                </span>
              ) : null}
              <button
                type="button"
                onClick={() => navigate(ctaHref)}
                className="site-global-booking"
              >
                {ctaText}
              </button>
              {actionsSlot}

              <button
                type="button"
                ref={hamburgerButtonRef}
                onClick={isHamburgerOpen ? closeHamburger : openHamburger}
                aria-haspopup="dialog"
                aria-controls="site-global-hamburger-card"
                aria-expanded={isHamburgerOpen}
                aria-label={isHamburgerOpen ? t("nav.closeMenu") : t("nav.openMenu")}
                className="site-global-hamburger"
              >
                <span className="site-global-hamburger-icon" aria-hidden="true">
                  <span className={isHamburgerOpen ? "rotate-45 translate-y-[5px]" : ""} />
                  <span className={isHamburgerOpen ? "opacity-0" : ""} />
                  <span className={isHamburgerOpen ? "-rotate-45 -translate-y-[5px]" : ""} />
                </span>
              </button>
            </div>
          </nav>

          <div
            ref={hamburgerRef}
            id="site-global-hamburger-card"
            role="dialog"
            aria-label={t("nav.menu")}
            aria-hidden={!isHamburgerOpen}
            tabIndex={-1}
            className={`site-global-hamburger-card lg-material ${isHamburgerOpen ? "is-open" : ""} ${hamburgerClosing ? "is-closing" : ""}`}
          >
            <div className="site-global-hamburger-head">{t("nav.systemMenu")}</div>
            <div className="site-global-hamburger-list">
              {items.map((item, idx) => (
                <button
                  key={item.href}
                  type="button"
                  onClick={() => handleHamburgerNav(item.href)}
                  className={`site-global-hamburger-item ${leavingHref === item.href ? "is-leaving" : ""} ${isActive(item) ? "is-current" : ""}`}
                  style={{ ["--hamburger-item-idx"]: idx } as CSSProperties}
                >
                  <span>{labelOf(item, t)}</span>
                  <span aria-hidden="true">→</span>
                </button>
              ))}
              {isPublicNav && (
                <>
                  <button
                    type="button"
                    onClick={() => handleHamburgerNav(ctaHref)}
                    className="site-global-hamburger-item"
                    style={{ ["--hamburger-item-idx"]: items.length } as CSSProperties}
                  >
                    <span>📅 {ctaText}</span>
                    <span aria-hidden="true">→</span>
                  </button>
                  <a
                    href={`tel:${HOTLINE}`}
                    onClick={closeHamburger}
                    aria-label={`${t("dock.consult")} — ${HOTLINE_DISPLAY}`}
                    className="site-global-hamburger-item no-underline"
                    style={{ ["--hamburger-item-idx"]: items.length + 1 } as CSSProperties}
                  >
                    <span>📞 {t("dock.consult")}</span>
                    <span aria-hidden="true">→</span>
                  </a>
                </>
              )}
              {showAccountItem && (
                <button
                  type="button"
                  onClick={() =>
                    handleHamburgerNav(
                      status === "authenticated" ? "/trang-ca-nhan" : "/dang-nhap"
                    )
                  }
                  className={`site-global-hamburger-item is-auth ${leavingHref === (status === "authenticated" ? "/trang-ca-nhan" : "/dang-nhap") ? "is-leaving" : ""}`}
                  style={{ ["--hamburger-item-idx"]: items.length + 2 } as CSSProperties}
                >
                  <span>{status === "authenticated" ? `👤 ${t("nav.profile")}` : `🔐 ${t("nav.login")}`}</span>
                  <span aria-hidden="true">→</span>
                </button>
              )}
            </div>
            <div className="site-global-hamburger-footer">
              {footerSlot ?? <LanguageSwitcher />}
            </div>
          </div>
        </div>

        {/*
          KHÔNG còn lớp phủ mờ nền (overlay).

          Trước đây có một `div.site-global-hamburger-overlay` phủ toàn viewport
          (fixed, inset: 0) để làm mờ + làm tối trang phía sau khi mở menu.
          Nó bị gỡ theo yêu cầu: hiệu ứng mờ nền làm nền bị "cháy" và ăn thêm
          một lớp `backdrop-filter` phủ toàn màn hình (rất đắt GPU trên máy
          yếu, nhất là khi nền có video).

          Việc chặn tương tác với phần nền KHÔNG mất: nền vẫn bị khoá bằng
          `inert` (xem lib/pageInert.ts) nên chuột không bấm được vào đâu ngoài
          thẻ menu. Đóng menu: bấm nút X, phím Escape, hoặc bấm một mục.
        */}
      </header>
    </>
  );
}

function SiteNavbar(props: SiteNavbarProps) {
  const pathName = usePathname();
  const isAuthPage = AUTH_PATHS.includes(pathName);
  if (isAuthPage) return null;
  return <SiteNavbarInner {...props} />;
}

export default SiteNavbar;