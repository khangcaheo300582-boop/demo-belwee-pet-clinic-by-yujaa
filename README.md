<p align="center">
  <img src="./public/belwee-logo-intro.webp" alt="Belwee Intro Logo" width="560" />
</p>
# Belwee Pet Clinic — Web Platform
 
<p align="center">
  <a href="https://github.com/khangcaheo300582-boop/demo-belwee-pet-clinic-by-yujaa/raw/main/public/belwee-logo-intro-a.mp4">▶ Xem video intro có tiếng</a>
</p>
<table>
  <tr>
    <td width="68%" valign="middle">
      Ứng dụng web toàn diện dành cho <b>Belwee Pet Clinic</b>, kết nối trực tiếp khách hàng nuôi thú cưng với đội ngũ bác sĩ và nhân viên phòng khám, phát triển trên nền tảng <b>Next.js (App Router)</b> và <b>TypeScript</b>.
    </td>
    <td width="32%" align="center" valign="middle">
      <img src="./public/logo-belwee.png" alt="Belwee" width="100%" />
    </td>
  </tr>
</table>
---
 
## NGƯỜI PHÁT TRIỂN
 
<table>
  <tr>
    <td width="68%" valign="middle">
      <b>Tác giả / Người phát triển:</b> Yujaaz (<code>khangcaheo300582-boop</code>)<br>
      <b>Đơn vị áp dụng:</b> Belwee Pet Clinic<br>
      <b>Chuyên môn &amp; Vai trò:</b> Full-stack Web Development, UI/UX &amp; Interactive Design, Digital Marketing &amp; Conversion Flow, Security &amp; QA Integration<br>
      <b>Liên hệ:</b> <code>khangcaheo300582@gmail.com</code> • Facebook: <b>Gra Yujaa</b>
    </td>
    <td width="32%" align="center" valign="middle">
      <img src="./public/admin-fkd.png?v=2" alt="Người phát triển - Yujaaz" width="180" />
    </td>
  </tr>
</table>
<p>
  <a href="https://github.com/khangcaheo300582-boop"><img src="https://img.shields.io/badge/GitHub-khangcaheo300582--boop-181717?style=for-the-badge&logo=github&logoColor=white" alt="GitHub" /></a>
  <a href="https://facebook.com/"><img src="https://img.shields.io/badge/Facebook-Gra%20Yujaa-1877F2?style=for-the-badge&logo=facebook&logoColor=white" alt="Facebook" /></a>
  <a href="mailto:khangcaheo300582@gmail.com"><img src="https://img.shields.io/badge/Gmail-khangcaheo300582@gmail.com-EA4335?style=for-the-badge&logo=gmail&logoColor=white" alt="Gmail" /></a>
</p>
---
 
## TÍNH NĂNG
 
- **Đặt lịch và theo dõi trạng thái lịch hẹn theo thời gian thực** qua các bước **State 1 → State 2 → State 3**, khách hàng nhận cập nhật tức thì từ phòng khám.
<p align="center">
  <img src="./public/axbc.png" alt="Trạng thái lịch hẹn" width="100%" />
</p>
- **Danh mục dịch vụ theo nhóm** dạng thẻ, giúp khách hàng chọn đúng dịch vụ phù hợp cho thú cưng.
<p align="center">
  <img src="./public/baner-dich-vu.png" alt="Danh mục dịch vụ" width="100%" />
</p>
- **Giao diện trang chủ và kết nối thú y**, tối ưu chuyển đổi khách hàng.
<p align="center">
  <img src="./public/ktty1.png" alt="Giao diện trang chủ 1" width="49%" />
  <img src="./public/ktty2.png" alt="Giao diện trang chủ 2" width="49%" />
</p>
- **Giám sát hệ thống:** theo dõi hoạt động, ghi log và phát hiện bất thường để vận hành ổn định.
<p align="center">
  <img src="./public/Gi%C3%A1m%20s%C3%A1t%20h%E1%BB%87%20th%E1%BB%91ng%201.png" alt="Giám sát hệ thống 1" width="49%" />
  <img src="./public/gi%C3%A1m%20s%C3%A1t%20h%E1%BB%87%20th%E1%BB%91ng%202.png" alt="Giám sát hệ thống 2" width="49%" />
</p>
- **Phân quyền truy cập** theo vai trò (quản trị, nhân viên, khách hàng), đúng người đúng chức năng.
<p align="center">
  <img src="./public/ph%C3%A2n%20quy%E1%BB%81n%201.png" alt="Phân quyền 1" width="49%" />
  <img src="./public/ph%C3%A2n%20quy%E1%BB%81n%202.png" alt="Phân quyền 2" width="49%" />
</p>
---
 
## Công nghệ sử dụng
 
| Nhóm | Công nghệ |
| --- | --- |
| Frontend & Framework | Next.js (App Router), React, TypeScript |
| Giao diện & Hiệu ứng | Tailwind CSS, Framer Motion |
| Xác thực & Thông báo | NextAuth, Nodemailer (SMTP), SSE |
| Bảo mật & Giám sát | Sentry, Middleware, CSRF & Rate Limit Protection |
| Kiểm thử & CI/CD | Vitest, Playwright, GitHub Actions |
 
---
 
## Hướng dẫn cài đặt và chạy dự án (Local)
 
1. **Clone repository** về máy:
```bash
git clone https://github.com/khangcaheo300582-boop/demo-belwee-pet-clinic-by-yujaa.git
cd demo-belwee-pet-clinic-by-yujaa
```
 
2. **Cài đặt thư viện:**
```bash
npm install
```
 
3. **Cấu hình môi trường:** sao chép `.env.example` thành `.env.local`, rồi điền các giá trị cần thiết (database, SMTP, secret xác thực...).
```bash
cp .env.example .env.local
```
 
4. **Khởi chạy** môi trường phát triển:
```bash
npm run dev
```
 
   Truy cập: http://localhost:3000
 
---
 
## Cấu trúc thư mục
 
```text
demo-belwee-pet-clinic-by-yujaa/
├── app/                   # Next.js App Router: pages, layouts, API routes
│   ├── api/               # Route handlers (API)
│   └── (pages)/           # Các trang giao diện
├── components/            # Component giao diện dùng chung
├── lib/                   # Logic nghiệp vụ, tiện ích, cấu hình
├── public/                # Ảnh, video, logo dùng cho giao diện và README
├── screenshots/           # Ảnh chụp màn hình dự án
├── middleware.ts          # Middleware xác thực, bảo mật
├── next.config.mjs        # Cấu hình Next.js
├── tailwind.config.ts     # Cấu hình Tailwind CSS
├── vitest.config.ts       # Cấu hình unit test
├── playwright.config.ts   # Cấu hình e2e test
└── README.md
```
 
<p align="center">
  <sub>© Belwee Pet Clinic — Phát triển bởi Yujaaz</sub>
</p>
 
