"use client";

/**
 * components/HomeOnlyIntroVideo.tsx
 *
 * Cổng chỉ cho video intro chạy ở TRANG CHỦ.
 *
 * ── VÌ SAO CẦN CỔNG NÀY ──────────────────────────────────────────────────────
 * `IntroVideo` trước đây được mount trong `app/layout.tsx` — tức chạy ở MỌI
 * route. Đo thật trên dev: mở thẳng `/lien-he` phải chờ ~8.3s video + 0.7s
 * fade mới tới được trang, và trong lúc đó wrapper của trang bị `inert` ⇒
 * không bấm được gì. Điều này trái yêu cầu của chủ dự án: intro logo CHỈ chạy
 * ở Trang chủ; các trang khác chỉ chạy skeleton + animation vào trang.
 *
 * Bốn tình huống cần đúng (Mục 5.5):
 *   (a) mở / F5 ở Trang chủ            → chạy
 *   (b) điều hướng từ trang khác về "/" → chạy (component mount mới)
 *   (c) mở / F5 ở trang khác          → KHÔNG chạy
 *   (d) rời khỏi "/" khi intro đang chạy → dừng, gỡ `inert`, mở khoá trang
 *
 * ── VÌ SAO PHẢI GỌI `setIntroPhase("done")` ─────────────────────────────────
 * `introGate` là module singleton, mặc định khởi tạo là "boot" ở client. Mọi
 * hiệu ứng nội dung (hero, reveal, marquee) chờ `usePageReady()`, mà
 * `usePageReady` chỉ trả `true` khi phase là "fading" hoặc "done".
 *
 * Nếu chỉ `return null` mà không báo "done": phase kẹt vĩnh viễn ở "boot" ⇒
 * `usePageReady()` = false vĩnh viễn ⇒ hero/reveal/marquee KHÔNG BAO GIỜ chạy ở
 * mọi trang khác trang chủ. Đó là một deadlock âm thầm, tệ hơn nhiều so với việc
 * intro chạy nhầm.
 *
 * `subscribeIntro` xử lý đúng cả hai thứ tự: đăng ký sau khi "done" thì được
 * gọi ngay với "done"; đăng ký trước thì nhận thông báo. Không có race.
 */

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import IntroVideo from "@/components/IntroVideo";
import { setIntroPhase } from "@/lib/introGate";

/** Trang duy nhất được chạy intro. */
const INTRO_PATH = "/";

export default function HomeOnlyIntroVideo() {
  const pathname = usePathname();
  const isHome = pathname === INTRO_PATH;

  useEffect(() => {
    // Ở ngoài trang chủ không có ai chạy intro ⇒ phải mở cổng nội dung ngay,
    // nếu không mọi hiệu ứng trang sẽ bị chặn vĩnh viễn (xem comment ở trên).
    if (!isHome) setIntroPhase("done");
  }, [isHome]);

  // Rời khỏi "/" giữa lúc intro đang chạy ⇒ React gỡ IntroVideo khỏi cây, và
  // cleanup trong IntroVideo gỡ `inert` / `aria-hidden` / `intro-playing` rồi
  // đẩy phase về "done". Trang được mở khoá ngay, không kẹt.
  if (!isHome) return null;

  return <IntroVideo />;
}