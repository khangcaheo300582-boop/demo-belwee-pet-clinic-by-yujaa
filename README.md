# Belwee Pet Clinic — Web Platform

Ứng dụng web cho **Belwee Pet Clinic**, xây dựng bằng **Next.js (App Router)** và **TypeScript**.

## Tính năng chính

- Trang giới thiệu phòng khám, kiến thức thú y, liên hệ và tuyển dụng
- Tiện ích đặt lịch, tài khoản khách hàng và trang cá nhân
- Khu vực quản lý dành cho nhân viên (`staff`) cùng hệ thống kiểm thử, giám sát lỗi (Sentry) và bảo mật tích hợp

## Công nghệ sử dụng

| Nhóm                  | Công nghệ                               |
| :-------------------- | :-------------------------------------- |
| Framework             | Next.js (App Router), React, TypeScript |
| Styling               | Tailwind CSS, PostCSS                   |
| Monitoring & Security | Sentry, Middleware / Security Audit     |
| Kiểm thử & Chất lượng | Vitest, Playwright, ESLint, Husky       |

## Hướng dẫn chạy dự án ở máy local

1. **Cài đặt thư viện:**
   Chạy lệnh `npm install` tại thư mục gốc `belwee-pet-clinic`.

2. **Cấu hình biến môi trường:**
   Tạo file `.env.local` dựa trên `.env.example` và điền các biến kết nối cần thiết.

3. **Khởi chạy server phát triển:**
   Chạy lệnh `npm run dev` và truy cập `http://localhost:3000` trên trình duyệt.

## Cấu trúc thư mục chính

- `app/` — Các route, trang giao diện và API của ứng dụng
- `components/` — Các component giao diện tái sử dụng
- `hooks/` — Custom React hooks
- `lib/` — Hàm tiện ích và xử lý logic dùng chung
- `public/` — Tài nguyên tĩnh (hình ảnh, biểu tượng...)
- `scripts/` — Các script kiểm tra tự động
- `security/` — Cấu hình bảo mật, CSRF, rate-limit và kiểm tra request
- `tests/` — Kiểm thử API và End-to-End (E2E)
