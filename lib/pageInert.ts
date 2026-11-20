/**
 * lib/pageInert.ts — quản lý `inert` cho vùng nội dung trang.
 *
 * ── VÌ SAO CẦN FILE NÀY ──────────────────────────────────────────────────────
 * `inert` là thuộc tính KẾ THỪA: đặt lên một phần tử thì mọi hậu duệ cũng bị
 * vô hiệu hoá — không click được, không hover được, không focus được.
 *
 * Trong `app/layout.tsx`, `<main>` nằm trong `<div class="app-shell">`, và
 * `.app-shell` CŨNG chứa `<SiteNavbar />` — tức là `<header class=
 * "site-global-header">` và THẺ MENU nằm bên trong nó.
 *
 * Nên câu lệnh cũ:
 *
 *     const wrapper = document.querySelector("main")?.parentElement; // = .app-shell
 *     wrapper?.setAttribute("inert", "");
 *
 * không chỉ khoá nội dung trang — nó khoá LUÔN chính thẻ menu vừa mở ra.
 * Kết quả: thẻ vẫn hiện (CSS transition vẫn chạy) nhưng KHÔNG nút nào bấm
 * được, không hover được, không focus được → đúng triệu chứng "ấn nút menu thì
 * thẻ hiện, nhưng không thao tác chuột nào dùng được".
 *
 * ── VÌ SAO CẦN SỔ ĐĂNG KÝ (REGISTRY) ────────────────────────────────────────
 * Có hai chủ sở hữu `inert` độc lập nhau:
 *   • video intro — khoá TOÀN BỘ `.app-shell` (kể cả navbar) vì overlay
 *     intro chiếm trọn màn hình.
 *   • menu hamburger — khoá nội dung trang nhưng MIỄN nhánh chứa header
 *     (thẻ menu nằm trong header).
 *
 * Nếu mỗi bên tự ghi/xoá thuộc tính trực tiếp thì chúng đè lên nhau: effect
 * mount của navbar (chạy SAU effect của intro vì navbar nằm sâu hơn trong
 * cây) sẽ xoá `inert` mà intro vừa đặt → trang không còn bị khoá, và ngược
 * lại khi menu đóng cũng có thể xoá nhầm khoá của intro.
 *
 * Sổ đăng ký giải quyết đúng: mỗi chủ sở hữu giữ một "khoá" có tên riêng,
 * và trạng thái `inert` cuối cùng được TÍNH LẠI từ toàn bộ khoá đang giữ.
 * Nhả một khoá không đụng tới khoá khác.
 *
 * ── HAI PHẠM VI ───────────────────────────────────────────────────────────────
 * "shell"   → đặt `inert` lên chính `.app-shell` ⇒ kế thừa xuống mọi thứ.
 *             Dùng cho video intro toàn màn hình.
 * "content" → đặt `inert` lên TỪNG nhánh con của `.app-shell`, trừ nhánh chứa
 *             `<header class="site-global-header">`; đồng thời khoá chrome của
 *             navbar (logo, danh sách mục, các nút phụ) để bàn phím không Tab
 *             vào được mục đang bị CSS ẩn. Dùng cho menu hamburger.
 */

/** Phạm vi khoá. */
export type InertScope = "shell" | "content";

/** Sổ đăng ký khoá: tên chủ sở hữu → phạm vi. */
const locks = new Map<string, InertScope>();

/** Gán `inert` + `aria-hidden` cho một phần tử. */
function lockElement(el: Element): void {
  el.setAttribute("inert", "");
  el.setAttribute("aria-hidden", "true");
}

/** Bỏ `inert` + `aria-hidden` khỏi một phần tử. */
function releaseElement(el: Element): void {
  el.removeAttribute("inert");
  el.removeAttribute("aria-hidden");
}

/**
 * Khoá / mở khoá một danh sách phần tử bất kỳ.
 */
export function setElementsInert(
  elements: ReadonlyArray<Element | null | undefined>,
  inert: boolean,
): void {
  for (const el of elements) {
    if (!el) continue;
    if (inert) lockElement(el);
    else releaseElement(el);
  }
}

/**
 * Tính lại trạng thái `inert` của trang từ toàn bộ khoá đang giữ.
 */
function applyInertLocks(): void {
  if (typeof document === "undefined") return;
  const shell = document.querySelector(".app-shell");
  if (!shell) return;
  const header = document.querySelector(".site-global-header");

  let shellLocked = false;
  let contentLocked = false;
  for (const scope of locks.values()) {
    if (scope === "shell") shellLocked = true;
    else contentLocked = true;
  }

  // ── 1) Phạm vi "shell": khoá chính `.app-shell` ⇒ kế thừa xuống navbar,
  //       <main> và footer. Đúng nghĩa "overlay intro chiếm trọn màn hình".
  if (shellLocked) {
    lockElement(shell);
  } else {
    releaseElement(shell);
  }

  // ── 2) Chrome của thanh điều hướng (logo, danh sách mục, nút cứu hộ /
  //       nút đặt lịch / avatar / nút đăng xuất của staff).
  //
  //       Khi menu mở, CSS ẩn chúng (`opacity: 0; pointer-events: none`) nhưng
  //       chúng VẪN còn trong tab order ⇒ bàn phím Tab vào được một mục đang
  //       vô hình rồi thoát ra khỏi thẻ menu. `inert` gỡ chúng khỏi tab order
  //       lẫn khỏi cây accessibility, đúng như một modal.
  //
  //       Nút `.site-global-hamburger` cố ý KHÔNG bị khoá — cần bấm được để
  //       đóng menu.
  if (header) {
    setElementsInert(
      [
        header.querySelector(".site-global-logo"),
        header.querySelector(".site-global-links"),
        ...Array.from(
          header.querySelectorAll(
            ".site-global-actions > *:not(.site-global-hamburger)",
          ),
        ),
      ],
      contentLocked,
    );
  }

  // ── 3) Phạm vi "content": khoá từng nhánh con của `.app-shell`, TRỪ nhánh
  //       chứa header — vì thẻ menu nằm bên trong header và phải sống sót.
  for (const child of Array.from(shell.children)) {
    const isHeaderBranch = header
      ? child === header || child.contains(header)
      : false;
    const locked = contentLocked && !isHeaderBranch;
    if (locked) lockElement(child);
    else releaseElement(child);
  }
}

/**
 * Giữ khoá `inert` với tên `id` và phạm vi `scope`.
 *
 * Giữ lại khoá đã có cùng tên sẽ ĐỔI phạm vi (vd. chuyển từ "content" sang
 * "shell") và tính lại trạng thái.
 */
export function acquireInertLock(id: string, scope: InertScope): void {
  locks.set(id, scope);
  applyInertLocks();
}

/**
 * Nhả khoá `inert` của `id`.
 *
 * Chỉ gỡ khoá CỦA `id` này — các khoá khác (ví dụ khoá của video intro) vẫn
 * còn hiệu lực.
 */
export function releaseInertLock(id: string): void {
  locks.delete(id);
  applyInertLocks();
}
