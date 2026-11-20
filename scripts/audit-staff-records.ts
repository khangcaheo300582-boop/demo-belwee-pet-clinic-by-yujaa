/**
 * scripts/audit-staff-records.ts
 *
 * BÁO CÁO CHỈ ĐỌC về bản ghi nhân viên. TUYỆT ĐỐI KHÔNG XOÁ GÌ.
 *
 * Chạy: npx tsx scripts/audit-staff-records.ts
 * Tuỳ chọn:
 *   --json        in ra JSON để máy đọc
 *   --csv <path>  xuất bảng ra file CSV (để gửi cho chủ dự án xem)
 *
 * ── VÌ SAO FILE NÀY TỒN TẠI ────────────────────────────────────────────────
 * Yêu cầu G7 của chủ dự án: liệt kê email trùng, tên trùng, email chứa "test",
 * thẻ đã khóa không lịch sử, và mọi tài khoản có vai trò quản trị — rồi xuất
 * CSV — nhưng "KHÔNG tự xóa dữ liệu".
 *
 * Nó cũng phục vụ một việc cụ thể: bản sửa lỗi nạp `.env.local` trong
 * `scripts/verify-staff-auth.ts` đã khiến kiểm tra đó chạy được thật, và vì
 * `lib/staff-service` chỉ có MỗT store (MongoDB) cùng không có hàm xoá, nó đã
 * tạo bản ghi thật trong database của khách hàng. Script này cho ta thấy chính
 * xác những gì cần dọn, trước khi đề xuất bất cứ hành động xoá nào.
 *
 * Nguyên tắc: mọi thao tác xoá phải đi qua UI quản trị và có người duyệt.
 * Script này không có đường dẫn nào tới `deleteMany`.
 */

import './load-env';

import fs from 'fs';
import path from 'path';

interface Row {
  id: string;
  fullName: string;
  email: string;
  role: string;
  jobTitle: string;
  branchId: string;
  isActive: boolean;
  createdAt: string | null;
  lastLoginAt: string | null;
}

const args = process.argv.slice(2);
const wantJson = args.includes('--json');
const csvIndex = args.indexOf('--csv');
const csvPath = csvIndex !== -1 ? args[csvIndex + 1] : null;

/** Bản ghi trông như rác/test — KHÔNG tự suy diễn thêm, chỉ liệt kê để người duyệt. */
const TEST_EMAIL_RE = /(test|demo|sample|lockout|abc|xxx)/i;

function esc(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

async function main() {
  const dataPath = path.join(process.cwd(), 'data', 'staff.json');
  const docs = JSON.parse(fs.readFileSync(dataPath, 'utf-8')) as Record<string, unknown>[];
  const rows: Row[] = docs.map((rec) => {
    return {
      id: String(rec.id ?? rec._id ?? ''),
      fullName: String(rec.fullName ?? rec.name ?? ''),
      email: String(rec.email ?? ''),
      role: String(rec.role ?? ''),
      jobTitle: String(rec.jobTitle ?? ''),
      branchId: String(rec.branchId ?? ''),
      isActive: rec.isActive !== false,
      createdAt: rec.createdAt ? new Date(rec.createdAt as string).toISOString() : null,
      lastLoginAt: rec.lastLoginAt ? new Date(rec.lastLoginAt as string).toISOString() : null,
    };
  });

  const lowerEmails = new Map<string, string[]>();
  const lowerNames = new Map<string, string[]>();
  for (const r of rows) {
    const e = r.email.toLowerCase().trim();
    if (e) lowerEmails.set(e, [...(lowerEmails.get(e) ?? []), r.id]);
    const n = r.fullName.toLowerCase().trim();
    if (n) lowerNames.set(n, [...(lowerNames.get(n) ?? []), r.id]);
  }

  const dupEmails = [...lowerEmails.entries()].filter(([, ids]) => ids.length > 1);
  const dupNames = [...lowerNames.entries()].filter(([, ids]) => ids.length > 1);
  const testLike = rows.filter((r) => TEST_EMAIL_RE.test(r.email) || TEST_EMAIL_RE.test(r.fullName));
  const admins = rows.filter((r) => /ADMIN|QUAN_TRI/i.test(r.role));
  const lockedNoLogin = rows.filter((r) => !r.isActive && !r.lastLoginAt);

  const report = {
    total: rows.length,
    duplicateEmails: dupEmails.map(([email, ids]) => ({ email, ids })),
    duplicateNames: dupNames.map(([name, ids]) => ({ name, ids })),
    testLike: testLike.map((r) => ({ id: r.id, fullName: r.fullName, email: r.email })),
    adminAccounts: admins.map((r) => ({ id: r.id, fullName: r.fullName, email: r.email, role: r.role })),
    lockedNeverLoggedIn: lockedNoLogin.map((r) => ({ id: r.id, fullName: r.fullName, email: r.email })),
    all: rows,
  };

  if (wantJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`\n=== BÁO CÁO NHÂN VIÊN (chỉ đọc, không xoá gì) ===`);
  console.log(`Tổng số bản ghi: ${report.total}\n`);

  console.log(`-- Email trùng (không phân biệt hoa/thường): ${report.duplicateEmails.length}`);
  for (const d of report.duplicateEmails) console.log(`   ${d.email}  → ${d.ids.join(', ')}`);

  console.log(`\n-- Tên trùng: ${report.duplicateNames.length}`);
  for (const d of report.duplicateNames) console.log(`   ${d.name}  → ${d.ids.join(', ')}`);

  console.log(`\n-- Trông giống dữ liệu test/rác: ${report.testLike.length}`);
  for (const t of report.testLike) console.log(`   ${t.email}  (${t.fullName})  id=${t.id}`);

  console.log(`\n-- Tài khoản có vai trò quản trị: ${report.adminAccounts.length}`);
  for (const a of report.adminAccounts) console.log(`   ${a.role}  ${a.email}  (${a.fullName})  id=${a.id}`);

  console.log(`\n-- Đã khóa mà chưa từng đăng nhập: ${report.lockedNeverLoggedIn.length}`);
  for (const a of report.lockedNeverLoggedIn) console.log(`   ${a.email}  (${a.fullName})  id=${a.id}`);

  console.log(`\n-- Danh sách đầy đủ --`);
  for (const r of rows) {
    console.log(
      `   ${r.isActive ? ' ' : '!'} ${r.email.padEnd(34)} ${r.role.padEnd(14)} ${r.fullName}`
    );
  }

  if (csvPath) {
    const header = 'id,fullName,email,role,jobTitle,branchId,isActive,createdAt,lastLoginAt';
    const lines = rows.map((r) =>
      [
        r.id, r.fullName, r.email, r.role, r.jobTitle, r.branchId,
        String(r.isActive), r.createdAt ?? '', r.lastLoginAt ?? '',
      ].map(esc).join(',')
    );
    fs.writeFileSync(csvPath, [header, ...lines].join('\n'), 'utf-8');
    console.log(`\nĐã xuất CSV: ${csvPath}`);
  }

  console.log('\nScript này KHÔNG xoá gì. Mọi thao tác dọn dữ liệu phải qua UI quản trị.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });