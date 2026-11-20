// app/api/staff/register/route.ts
// ĐÃ ĐÓNG — trả 410 Gone cho mọi phương thức.
//
// LÝ DO
// Đây từng là cổng tự đăng ký công khai: POST { fullName, dateOfBirth, email,
// branchId, jobTitle, pin, managerPin? }. `managerPin` chỉ quyết định tài khoản
// MỚI trở thành ADMIN chứ không quyết định việc tạo có được hay không — tức
// bất kỳ ai cũng có thể tự tạo tài khoản staff cho mình, tự chọn chức danh, và
// (nếu có mã PIN admin lọt) tự nâng quyền.
//
// Hậu quả đã thấy trong dữ liệu: thẻ rác/trùng (nhiều bản ghi cùng tên), email
// test, ghi chú rác. Cửa này là nguyên nhân gốc, không phải triệu chứng.
//
// YÊU CẦU CỦA CHỦ DỰ ÁN (G7): "xóa hoàn toàn tự đăng ký công khai, chỉ
// Admin/HR cấp tài khoản" và "Route/API tự đăng ký công khai: trả 404/410".
//
// VÌ SAO GIỮ FILE + TRẢ 410 THAY VÌ XOÁ HẲN
//  - 410 báo rõ "cái này từng tồn tại, nay đã bị bỏ" (410) khác 404 "chưa bao
//    giờ có" — client cũ/bot gọi vào sẽ hiểu và dừng thử lại.
//  - Xoá file khiến Next trả 404 và mọi client đều coi như route sai, dễ bị
//    thử lại mãi. Giữ 410 là câu trả lời dứt khoát.
//  - Đường dẫn cũ không còn "link chết" im lặng; client nào còn giữ logic đăng
//    ký sẽ nhận thông báo rõ ràng.
//
// CÁCH CẤP TÀI KHOẢN ĐÚNG (thay cho cổng này)
// Admin/HR cấp tài khoản từ trang Đội ngũ (`/staff/team`) sau khi đăng nhập —
// nơi đó có kiểm tra quyền ở server (`requireStaff` + `roleCan`), audit log và
// rate limit. Không có đường công khai nào tạo được tài khoản staff.

import { NextResponse } from 'next/server';

const MESSAGE =
  'Tự đăng ký tài khoản nhân viên đã được đóng. Tài khoản do Quản trị viên/HR cấp. Nếu bạn chưa có tài khoản, vui lòng liên hệ quản trị viên.';

function gone() {
  return NextResponse.json(
    { success: false, message: MESSAGE, code: 'STAFF_REGISTRATION_CLOSED' },
    { status: 410, headers: { Allow: 'GET, POST, PUT, PATCH, DELETE, OPTIONS' } }
  );
}

// Chặn MỌI phương thức: trước đây chỉ có POST, nhưng để sót một phương thức là
// để lại lỗ hổng. `Allow` nêu rõ các phương thức còn tồn tại (theo RFC 9110).
export const POST = gone;
export const GET = gone;
export const PUT = gone;
export const PATCH = gone;
export const DELETE = gone;