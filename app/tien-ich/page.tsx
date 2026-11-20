import type { Metadata } from 'next';
import PetCareToolsClient from './PetCareToolsClient';

// app/tien-ich/page.tsx
// Trang "công cụ chăm sóc" (I2).
//
// ── VÌ SAO SERVER WRAPPER + CLIENT CON ────────────────────────────────────────
// Metadata (title/description/OG) phải sinh ở server để crawler đọc được, còn
// bản thân ba công cụ cần `useState` + `useLanguage()`. Đặt gộp vào một file
// 'use client' thì Next loại bỏ export metadata và trang sẽ không có mô tả riêng
// trong kết quả tìm kiếm.

export const metadata: Metadata = {
  title: 'Công cụ chăm sóc thú cưng',
  description:
    'Quy đổi tuổi thú cưng ra tuổi người, ước lượng khẩu phần theo cân nặng và kiểm tra triệu chứng sơ bộ để chuẩn bị trước khi đặt lịch tại Belwee Pet Clinic.',
  openGraph: {
    title: 'Công cụ chăm sóc thú cưng',
    description:
      'Quy đổi tuổi, tính khẩu phần và kiểm tra triệu chứng sơ bộ trước khi đặt lịch khám.',
    locale: 'vi_VN',
    type: 'website',
  },
  alternates: { canonical: '/tien-ich' },
};

export default function Page() {
  return <PetCareToolsClient />;
}