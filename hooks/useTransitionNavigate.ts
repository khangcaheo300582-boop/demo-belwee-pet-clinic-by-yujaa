"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { scrollToHash } from "@/lib/smoothScroll";
import { beginNavGate } from "@/lib/navGate";

export function useTransitionNavigate() {
  const router = useRouter();
  const pathname = usePathname();
  const pendingNavigationRef = useRef<number | null>(null);

  // Dọn timer điều hướng pending khi đã tới nơi. Class `page-exit` (trang cũ
  // mờ dần) do lib/navGate.ts sở hữu trọn vẹn — hook này KHÔNG đụng vào nữa.
  useEffect(() => {
    if (pendingNavigationRef.current !== null) {
      window.clearTimeout(pendingNavigationRef.current);
      pendingNavigationRef.current = null;
    }
  }, [pathname]);

  return useCallback(
    (href: string, options?: { replace?: boolean }) => {
      if (href.startsWith("#")) {
        scrollToHash(href);
        return;
      }

      const [targetPath, targetHash] = href.split("#", 2);
      if (targetPath === pathname && !targetHash) {
        return;
      }

      if (pendingNavigationRef.current !== null) {
        window.clearTimeout(pendingNavigationRef.current);
      }

      // Mở cổng chuyển trang NGAY: overlay hiện skeleton trang đích, trang cũ
      // mờ dần (class `page-exit` do navGate gắn), hiệu ứng nội dung bị hoãn
      // cho tới khi media của trang đích được tải sẵn (xem RouteSkeletonOverlay).
      // Cùng pathname (chỉ khác hash) thì không mở cổng — tránh kẹt cổng.
      if (targetPath !== pathname) {
        beginNavGate(targetPath);
      }

      pendingNavigationRef.current = window.setTimeout(() => {
        pendingNavigationRef.current = null;
        if (options?.replace) {
          router.replace(href);
        } else {
          router.push(href);
        }
      }, 0);
    },
    [pathname, router]
  );
}