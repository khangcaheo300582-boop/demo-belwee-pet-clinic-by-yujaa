// scripts/reset-admin-pin.ts
// Đổi mã PIN cho tài khoản admin (staff) trong hệ thống staff.

import { resetStaffPin, findStaffByEmail, registerStaff, verifyStaffPin } from '../lib/staff-service';
import { BRANCHES } from '../lib/clinics';

const EMAIL = 'thuybelwee@admin.com';
const PIN = '300582';

async function main() {
  let staff = await findStaffByEmail(EMAIL);

  // Nếu chưa có tài khoản staff cho email này thì tạo mới (mặc định là ADMIN).
  if (!staff) {
    const branch = BRANCHES[0];
    const created = await registerStaff({
      fullName: 'Quản trị viên Belwee',
      email: EMAIL,
      branchId: branch.id,
      jobTitle: 'QUAN_TRI',
      pin: PIN,
      dateOfBirth: null,
    });
    if (!created.ok) {
      console.error('Không thể tạo tài khoản admin:', created);
      process.exit(1);
    }
    console.log('Đã tạo mới tài khoản staff admin.');
  }

  const result = await resetStaffPin(EMAIL, PIN);

  if (result.ok) {
    console.log(`✅ ĐÃ THÀNH CÔNG: Mã PIN của ${EMAIL} đã được đặt lại thành ${PIN}.`);
    const updated = await findStaffByEmail(EMAIL);
    if (updated) {
      console.log(
        `   Thông tin: id=${updated.id}, name=${updated.name}, role=${updated.role}, isActive=${updated.isActive}, hasPinHash=${Boolean(updated.pinHash)}`
      );
    }

    // Xác minh lại: mã PIN mới phải đăng nhập được.
    const check = await verifyStaffPin(EMAIL, PIN);
    if (check.ok) {
      console.log(`✅ XÁC THỰC: Mã PIN ${PIN} của ${EMAIL} hoạt động đúng.`);
    } else {
      console.error(`❌ XÁC THỰC THẤT BẠI: Mã PIN ${PIN} không hoạt động. Lỗi: ${check.error}`);
      process.exit(1);
    }
    process.exit(0);
  } else {
    console.error(`❌ KHÔNG THÀNH CÔNG: ${result.error}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Lỗi khi đổi PIN admin:', error);
  process.exit(1);
});
