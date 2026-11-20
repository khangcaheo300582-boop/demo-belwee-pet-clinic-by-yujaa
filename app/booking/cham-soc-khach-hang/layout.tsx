// app/booking/cham-soc-khach-hang/layout.tsx
//
// Cổng đăng nhập của trang chăm sóc khách hàng — chạy ở SERVER.
//
// VÌ SAO KHÔNG DÙNG BookingAuthGate (app/booking/layout.tsx)
//   Cổng client phải chờ `useSession` trả về nên mỗi lần tải lại trang nó vẽ
//   màn "đang kiểm tra đăng nhập" một nhịp rồi mới hiện nội dung. Với một
//   người ĐANG trong phiên chat, nhịp đó chính là lỗi "đang chat tự nhiên thấy
//   kiểm tra đăng nhập rồi chat hiện lại". Kiểm tra ở server thì quyết định
//   xong trước khi trang được gửi xuống: đã đăng nhập → render thẳng trang
//   điều khoản, chưa đăng nhập → chuyển tới trang đăng nhập.
//
// `?next=` giữ đích danh: đăng nhập xong khách quay lại đúng trang này
// (app/dang-nhap/page.tsx đọc và kiểm tra tham số này).

import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/authOptions';

export const dynamic = 'force-dynamic';

const CARE_PATH = '/booking/cham-soc-khach-hang';

export default async function CustomerCareLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authOptions);

  // `session.user.email` bị đặt về null khi phiên đã quá hạn không hoạt động
  // (xem callback session trong authOptions) — coi như chưa đăng nhập.
  if (!session?.user?.email) {
    redirect(`/dang-nhap?next=${encodeURIComponent(CARE_PATH)}`);
  }

  return <>{children}</>;
}
