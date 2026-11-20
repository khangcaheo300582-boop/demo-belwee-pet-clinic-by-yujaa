'use client';

/**
 * components/BookingNotificationOptIn.tsx
 *
 * Bọc NotificationToggle + BookingNotificationListener cho trang đặt lịch.
 *
 * ── VÌ SAO CẦN LỚP BỌC NÀY ───────────────────────────────────────────────────
 * Lựa chọn bật thông báo được lưu THEO TÀI KHOẢN (mỗi tài khoản một cờ
 * trong dbNotificationPreference). Trang đặt lịch thì ai cũng vào được,
 * kể cả khách chưa đăng nhập — nếu hiện công tắc luôn thì khi bấm sẽ nhận
 * 401 và người dùng thấy một thông báo lỗi vô lý. Vì vậy phải chờ trạng
 * thái phiên rồi mới quyết định hiện hay không.
 *
 * ── VÌ SAO status === 'loading' PHẢI GIẤU ────────────────────────────────────
 * Trong lúc NextAuth đang xác thực, ta chưa biết khách có tài khoản hay
 * không. Render ra rồi ẩn đi sẽ nháy giao diện, nên chờ cho tới khi biết.
 */

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import NotificationToggle from '@/components/NotificationToggle';
import BookingNotificationListener from '@/components/BookingNotificationListener';

export default function BookingNotificationOptIn({ className }: { className?: string }) {
  const { status } = useSession();
  const [enabled, setEnabled] = useState(false);
  const [ready, setReady] = useState(false);

  // Đọc lựa chọn đã lưu. useSession chỉ nói "đã đăng nhập", còn bật/tắt là dữ
  // liệu riêng phải hỏi server — nếu tự suy ra từ trạng thái phiên thì khách
  // đã bật từ lâu sẽ thấy công tắc bật về mặc định mỗi lần mở form.
  useEffect(() => {
    if (status !== 'authenticated') {
      setReady(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/bookings/notifications/preference', {
          cache: 'no-store',
        });
        if (!res.ok) return;
        const data = (await res.json()) as { preference?: { enabled?: boolean } };
        if (cancelled) return;
        setEnabled(data.preference?.enabled === true);
      } catch {
        /* offline — mặc định tắt, người dùng vẫn bật được thủ công */
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status]);

  if (status !== 'authenticated' || !ready) return null;

  return (
    <div className={className}>
      <NotificationToggle
        variant="inline"
        initialEnabled={enabled}
        onChange={setEnabled}
        className="w-full"
      />
      <BookingNotificationListener enabled={enabled} />
    </div>
  );
}