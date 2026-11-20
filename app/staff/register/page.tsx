import { redirect } from 'next/navigation';

// app/staff/register/page.tsx
// ĐÃ ĐÓNG — tự đăng ký nhân viên công khai bị gỡ (G7).
//
// Trước đây trang này render <StaffAuthCard mode={AuthMode.Register} /> cho bất
// kỳ ai ghé, và POST /api/staff/register tạo tài khoản cho bất kỳ ai bấm. Đó là
// cửa vào tài khoản staff không cần quản trị viên — thứ đã để lại nhiều thẻ rác
// và thẻ có vai trò quản trị trong dữ liệu.
//
// GIỮ FILE + CHUYỂN HƯỚNG thay vì xoá hẳn: ai đó đang lưu bookmark `/staff/
// register` (hoặc link cũ còn sót ở email/QR) sẽ không rơi vào 404 trần. Họ
// tới đúng trang đăng nhập và thấy lý do.
//
// `redirect` chạy trên server nên người dùng không thấy màn hình trắng/404.

export const dynamic = 'force-dynamic';

export default function StaffRegisterPage() {
  // `?next=` đi qua không cần thiết ở đây: không có hành động để bảo vệ.
  redirect('/staff/login');
}