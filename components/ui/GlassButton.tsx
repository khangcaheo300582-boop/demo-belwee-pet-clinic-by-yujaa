/**
 * components/ui/GlassButton.tsx
 *
 * CTA kính mờ có trạng thái (design system §2).
 *
 * VÌ SAO TRẠNG THÁI LÀ PROP CHỨ KHÔNG PHẢI STATE NỘI BỘ: nguồn sự thật của
 * "đang gửi / thành công / lỗi" là lớp gọi (Server Action, fetch, form). Nếu
 * component tự giữ state thì sẽ có HAI nguồn (state trong nút + state ở form)
 * và chúng lệch nhau ngay khi request kết thúc ngoài dự kiến — nút hiện
 * "thành công" trong khi form vẫn đang chờ, hoặc ngược lại. Ở đây chỉ truyền
 * xuống, không suy diễn.
 *
 * Tương tác đã có trong `app/globals.css`:
 *   .glass-pill  → vật liệu kính (dùng chung với GlassPill)
 *   .glass-btn   → hover/active/focus/disabled, màu theo `data-gstatus`
 *   .glass-sheen → vệt sáng quét ngang, chỉ transform + opacity
 *
 * Chống bấm lặp: khi `status === "loading"` nút bị `disabled` thật (không chỉ
 * giảm opacity) nên cả chuột lẫn Enter/Space đều không kích hoạt lại.
 *
 * KHÔNG có hook, KHÔNG có "use client" ⇒ dùng được ở cả hai phía.
 */

import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type GlassButtonStatus = "idle" | "loading" | "success" | "error";

export interface GlassButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  children?: ReactNode;
  /** Trạng thái do lớp gọi cung cấp. Mặc định `"idle"`. */
  status?: GlassButtonStatus;
  type?: "button" | "submit" | "reset";
  /**
   * Phần tử gốc. Mặc định `button`.
   *
   * Dùng `as="a"` khi CTA là **điều hướng** (tới trang đặt lịch, tới trang đội
   * ngũ…). Đề bài §1 cấm dùng `button` cho phần tử chỉ điều hướng; đây là nơi
   * duy nhất được phép vẽ nút kính để bọc một liên kết.
   *
   * Khi khoá (`disabled` hoặc `status="loading"`), liên kết **mất hẳn `href`**
   * ⇒ không focus được, không Enter được. `aria-disabled` thôi không đủ.
   */
  as?: "button" | "a";
  /** Bắt buộc khi `as="a"`. */
  href?: string;
  /** Icon hiển thị trước nhãn. Tự động `aria-hidden` (nhãn chữ đã đủ nghĩa). */
  icon?: ReactNode;
  /** Nhãn phụ cho màn hình đọc khi trạng thái đổi (ví dụ "Đang gửi yêu cầu…"). */
  liveMessage?: string;
  className?: string;
}

export default function GlassButton({
  children,
  status = "idle",
  type = "button",
  as = "button",
  href,
  icon,
  liveMessage,
  className,
  disabled,
  ...rest
}: GlassButtonProps) {
  const isLoading = status === "loading";
  const isLink = as === "a";

  // Nội dung dùng chung cho cả hai phần tử gốc.
  const inner = (
    <>
      <span className="glass-sheen" aria-hidden="true" />
      {isLoading ? (
        <span className="glass-btn__spinner" aria-hidden="true" />
      ) : (
        icon && <span aria-hidden="true">{icon}</span>
      )}
      {/* Chỉ render span nhãn khi CÓ nhãn: nút chỉ có icon (nút chuyển thẻ)
          nếu vẫn render một span rỗng thì `gap: 0.5rem` của .glass-pill vẫn
          tính nó là một flex item và đẩy icon lệch khỏi tâm. */}
      {children !== undefined && children !== null && children !== "" ? (
        <span>{children}</span>
      ) : null}
      {liveMessage && (
        <span className="sr-only" role="status" aria-live="polite">
          {liveMessage}
        </span>
      )}
    </>
  );

  const cls = cn(
    "glass-pill glass-btn px-5 py-2.5 text-sm",
    isLink && "inline-flex",
    className
  );

  // Hai nhánh riêng thay vì `<Tag>` động: `ButtonHTMLAttributes` và
  // `AnchorHTMLAttributes` mâu thuẫn nhau ở vài thuộc tính (`onToggle`,
  // `formAction`…) nên TS không chấp nhận cách trải chung.
  if (isLink) {
    // Ép kiểu MỘT lần, có chú thích: kiểu props được khai là
    // `ButtonHTMLAttributes` (nghĩa mặc định là `<button>`), nên khi trải sang
    // `<a>` TypeScript bắt những handler chỉ có ở button (`onToggle`,
    // `formAction`…). Người gọi ở nhánh liên kết không truyền các prop đó —
    // `href` là prop riêng đã tách ra ngoài. Ép kiểu ở đúng MỘT chỗ thay vì
    // viết tay lại danh sách ~40 thuộc tính của `<a>` (dễ sót).
    const anchorRest = rest as unknown as AnchorHTMLAttributes<HTMLAnchorElement>;
    // Bị khoá thì BỎ HẲN `href`, không chỉ gắn `aria-disabled`.
    //
    // `aria-disabled` là thuộc tính cho trình đọc màn hình, nó KHÔNG chặn gì
    // cả: `<a href>` vẫn bấm được bằng chuột và vẫn kích hoạt được bằng
    // Enter/Space khi được focus. CSS `pointer-events: none` chặn được chuột
    // nhưng vẫn để lại bàn phím. Không có `href` thì `<a>` không còn là liên
    // kết nên không focus được, không Enter được — đúng nghĩa "đang khoá".
    const locked = disabled || isLoading;
    return (
      <a
        {...anchorRest}
        href={locked ? undefined : href}
        aria-disabled={locked || undefined}
        aria-busy={isLoading || undefined}
        data-gstatus={status}
        className={cls}
      >
        {inner}
      </a>
    );
  }

  return (
    <button
      {...rest}
      type={type}
      // `disabled` thật, không phải chỉ `aria-disabled`: cần chặn cả sự kiện
      // click và submit của form khi đang gửi.
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      data-gstatus={status}
      className={cls}
    >
      {inner}
    </button>
  );
}
