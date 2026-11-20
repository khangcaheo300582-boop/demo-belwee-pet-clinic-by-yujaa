"use client";

/**
 * components/BookingAuthGate.tsx
 *
 * GĐ9 · (i) — chỉ vào được form đặt lịch khi ĐÃ ĐĂNG NHẬP.
 *
 * ── VÌ SAO CỔNG Ở TẦNG COMPONENT, KHÔNG Ở TẦNG ROUTE ──────────────────────────
 * Trang đặt lịch đều là client component (`"use client"`) vì form, nháp
 * localStorage và dialog xác nhận đều cần trạng thái. Middleware ở tầng
 * request sẽ chặn được nhưng phải định tuyến lại bằng Response, dễ để lọt khi
 * JS chưa tải; ở đây chặn ngay trong cây render nên không có đường vòng.
 *
 * ── BA TRẠNG THÁI, VÌ SAO PHẢI ĐỦ BA ──────────────────────────────────────────
 * `useSession` trả về `loading | authenticated | unauthenticated`. Nếu render
 * form luôn rồi mới ẩn khi biết là khách, thì trên mạng chậm người dùng THẤY
 * form rồi mất — tệ hơn là không thấy. Vì vậy:
 *   • `loading`         → hiện khung "đang kiểm tra", KHÔNG render form
 *   • `unauthenticated` → hiện yêu cầu đăng nhập
 *   • `authenticated`   → render `children` (form)
 *
 * ── GIỮ ĐÍCH DANH SAU KHI ĐĂNG NHẬP ───────────────────────────────────────────
 * `callbackUrl` đưa người dùng về đúng trang đặt lịch họ đang định vào, kèm
 * tham số `?next=` để trang đăng nhập trả lại đúng chỗ sau khi đăng nhập xong.
 * Nếu không, người dùng bấm "Spa & Grooming" → bị đá về trang chủ, phải tìm lại
 * từ đầu — đúng cái trải nghiệm mà cổng định định nói.
 *
 * ── KHÔNG CHẶN NGƯỜI ĐÃ ĐĂNG NHẬP NHÂN VIÊN ──────────────────────────────────
 * Session nhân viên và khách hàng dùng chung cơ chế; cổng này chỉ hỏi "có
 * phiên hay không", không phân biệt vai trò. Việc phân quyền thuộc về API
 * phía server, không thuộc một cổng hiển thị.
 */

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/components/LanguageProvider";
import { LockIcon } from "@/components/ui/icons";

/**
 * Trang chăm sóc khách hàng kiểm tra đăng nhập ở SERVER
 * (app/booking/cham-soc-khach-hang/layout.tsx) nên không đi qua cổng này.
 * Nhờ vậy khách đang trong phiên chat không thấy màn "đang kiểm tra đăng nhập"
 * mỗi lần tải lại trang — cổng server đã chặn trước khi trang được render.
 */
const SERVER_GATED_CARE_PATH = "/booking/cham-soc-khach-hang";

export default function BookingAuthGate({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const pathname = usePathname();
  const { t } = useLanguage();

  /**
   * next-auth mặc định `refetchOnWindowFocus`: mỗi lần quay lại tab nó gọi
   * `_getSession` và đặt `status = "loading"` trong lúc chờ. Nếu cổng render
   * spinner cho mọi lần "loading" thì người đang chat thấy màn "đang kiểm tra
   * đăng nhập" chớp qua rồi chat hiện lại — đúng lỗi người dùng báo.
   *
   * Vì vậy sau khi đã xác nhận có phiên một lần, các nhịp loading về sau vẫn
   * render `children`. Chỉ "unauthenticated" thật sự mới đưa về màn đăng nhập.
   */
  const [wasAuthenticated, setWasAuthenticated] = useState(false);

  useEffect(() => {
    if (status === "authenticated") setWasAuthenticated(true);
    else if (status === "unauthenticated") setWasAuthenticated(false);
  }, [status]);

  if (pathname === SERVER_GATED_CARE_PATH) return <>{children}</>;

  if (status === "authenticated" || (status === "loading" && wasAuthenticated)) {
    return <>{children}</>;
  }

  // `status === "loading"` chỉ kéo dài vài chục ms với phiên đã lưu, nhưng với
  // khách mới thì cả trang. Hiện khung chờ thay vì form để không nháy.
  if (status === "loading") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-5">
        <div
          role="status"
          aria-live="polite"
          className="flex flex-col items-center gap-3 text-center"
        >
          <span
            aria-hidden="true"
            className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-300 border-t-blue-600"
          />
          <p className="text-sm text-slate-600">{t("bookingGate.checking")}</p>
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    const callbackUrl = `${pathname ?? "/booking/kham-benh"}`;
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-5 py-16">
        <div
          data-reveal="fade-up"
          className="w-full max-w-lg rounded-[2rem] border border-blue-200/70 bg-white/85 p-8 text-center shadow-[0_24px_60px_-28px_rgba(30,64,175,0.4)] sm:p-10"
        >
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-600/10 text-blue-600">
            <LockIcon className="h-6 w-6" />
          </span>

          <h1 className="mt-5 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
            {t("bookingGate.title")}
          </h1>
          <p className="mx-auto mt-3 max-w-[42ch] text-sm leading-relaxed text-slate-600">
            {t("bookingGate.desc")}
          </p>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link
              href={`/dang-nhap?next=${encodeURIComponent(callbackUrl)}`}
              className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              {t("bookingGate.login")}
            </Link>
            <Link
              href="/tao-tai-khoan?next=${encodeURIComponent(callbackUrl)}"
              className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white/70 px-6 py-3 text-sm font-semibold text-slate-700 transition-colors hover:border-blue-300 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              {t("bookingGate.register")}
            </Link>
          </div>

          <p className="mt-6 text-[13px] text-slate-500">{t("bookingGate.orCall")}</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}