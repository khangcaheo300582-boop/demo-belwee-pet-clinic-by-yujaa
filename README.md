# Belwee Pet Clinic — Nền tảng Web & Quản lý Dịch vụ Thú y

Ứng dụng web toàn diện dành cho **Belwee Pet Clinic**, kết nối trực tiếp khách hàng nuôi thú cưng với đội ngũ bác sĩ và nhân viên phòng khám. Dự án được phát triển trên nền tảng **Next.js (App Router)** và **TypeScript**.

---

## Tính năng nổi bật

- **Chat & Hỗ trợ trực tiếp (Live Chat):** Kênh nhắn tin thời gian thực giúp khách hàng trao đổi nhanh với đội ngũ tư vấn viên, gửi câu hỏi về tình trạng sức khỏe thú cưng và nhận phản hồi tức thì.
- **Đặt lịch khám trực tuyến:** Cho phép chủ nuôi chọn dịch vụ, chi nhánh, bác sĩ, khung giờ phù hợp và theo dõi trạng thái lịch hẹn ngay trên tài khoản cá nhân.
- **Thông báo thông minh (Smart Notifications):** Tự động nhắc lịch hẹn khám/tiêm phòng, gửi email xác thực (OTP) và cập nhật trạng thái xử lý yêu cầu theo thời gian thực.
- **Cổng thông tin & Kiến thức thú y:** Cung cấp thông tin giới thiệu phòng khám, cẩm nang chăm sóc thú cưng, tin tuyển dụng và kênh liên hệ nhanh.
- **Phân quyền & Cổng nội bộ (`staff`):** Khu vực làm việc tách biệt dành cho nhân viên và quản trị viên để tiếp nhận tin nhắn hỗ trợ, điều phối lịch hẹn và quản lý vận hành.
- **Bảo mật & Giám sát hệ thống:** Tích hợp xác thực nhiều lớp, chống tấn công CSRF, giới hạn tần suất truy cập (Rate Limiting) và theo dõi lỗi tự động qua Sentry.

---

## Công nghệ sử dụng

| Nhóm                      | Công nghệ                                        |
| :------------------------ | :----------------------------------------------- |
| **Frontend & Framework**  | Next.js (App Router), React, TypeScript          |
| **Giao diện & Hiệu ứng**  | Tailwind CSS, PostCSS                            |
| **Xác thực & Thông báo**  | NextAuth, Email OTP / SMTP                       |
| **Bảo mật & Giám sát**    | Sentry, Middleware, CSRF & Rate-Limit Protection |
| **Kiểm thử & Chất lượng** | Vitest, Playwright, ESLint, Husky                |

---

## Hướng dẫn cài đặt và chạy dự án (Local)

1. **Clone repository về máy:**
   Chạy lệnh `git clone https://github.com/khangcaheo300582-boop/demo-belwee-pet-clinic-by-yujaa.git` và di chuyển vào thư mục dự án.

2. **Cài đặt các gói thư viện:**
   Chạy lệnh `npm install` tại thư mục gốc `belwee-pet-clinic`.

3. **Cấu hình biến môi trường:**
   Tạo file `.env.local` từ file mẫu `.env.example` và điền đầy đủ các thông số kết nối (Database, SMTP Email, Auth Secret, Sentry DSN...).

4. **Khởi chạy môi trường phát triển:**
   Chạy lệnh `npm run dev`, sau đó mở trình duyệt tại địa chỉ `http://localhost:3000`.

---

## Cấu trúc thư mục

- `app/` — Hệ thống định tuyến (App Router), các trang giao diện người dùng, cổng `staff` và API routes
- `components/` — Các thành phần giao diện (UI components) tái sử dụng
- `hooks/` — Custom React hooks xử lý tương tác và trạng thái giao diện
- `lib/` — Các module xử lý logic nghiệp vụ, kết nối dịch vụ và hàm tiện ích
- `public/` — Tài nguyên tĩnh (hình ảnh, biểu tượng, media)
- `security/` — Cấu hình bảo mật, kiểm soát CSRF, rate-limit và xác thực request
- `scripts/` — Các script tự động hóa kiểm tra và xác minh hệ thống
- `tests/` — Bộ kiểm thử API contract và kiểm thử đầu cuối (E2E)
