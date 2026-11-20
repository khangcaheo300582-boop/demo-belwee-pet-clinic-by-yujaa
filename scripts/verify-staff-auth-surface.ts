/**
 * scripts/verify-staff-auth-surface.ts
 *
 * Kiểm chứng bề mặt xác thực của khu staff sau khi G7 đóng cổng tự đăng ký.
 *
 * Mục tiêu là bắt hồi quy bảo mật: không được đường nào cho tạo tài khoản
 * staff mà không qua quản trị viên, và mọi API staff phải chặn người chưa
 * đăng nhập.
 *
 * KHÔNG chạm dữ liệu: mọi lời gọi đều dừng ở lớp xác thực, không có request
 * nào tạo/sửa/xoá bản ghi thật. Test đăng nhập đúng/sai cần seed dữ liệu thật
 * nên để riêng (scripts/verify-staff-auth.ts).
 *
 * Chạy: npx tsx scripts/verify-staff-auth-surface.ts
 */

const BASE = process.env.BASE_URL ?? `http://localhost:${process.env.PORT ?? 3001}`;

interface Case {
  name: string;
  method: string;
  path: string;
  /** Mã lệch mong đợi. `2xx` = bất kỳ mã thành công nào. */
  expect: number | "2xx" | "3xx";
  body?: unknown;
  note?: string;
}

const CASES: Case[] = [
  // ── Cổng tự đăng ký: phải đóng hoàn toàn ──────────────────────────────
  { name: "GET  /api/staff/register", method: "GET", path: "/api/staff/register", expect: 401 },
  { name: "POST /api/staff/register", method: "POST", path: "/api/staff/register", expect: 401 },
  { name: "PUT  /api/staff/register", method: "PUT", path: "/api/staff/register", expect: 401 },
  { name: "PATCH /api/staff/register", method: "PATCH", path: "/api/staff/register", expect: 401 },
  { name: "DELETE /api/staff/register", method: "DELETE", path: "/api/staff/register", expect: 401 },
  {
    name: "POST /api/staff/register voi payload dang ky",
    method: "POST",
    path: "/api/staff/register",
    expect: 401,
    body: {
      fullName: "Kẻ Tấn Công",
      dateOfBirth: "1990-01-01",
      email: "attacker@example.com",
      branchId: "b1",
      jobTitle: "BAC_SI",
      pin: "123456",
    },
    note: "payload dang ky day du van khong tao duoc tai khoan",
  },

  // ── Trang đăng ký: không để link chết ──────────────────────────────────
  { name: "GET  /staff/register", method: "GET", path: "/staff/register", expect: "3xx" },

  // ── Trang staff phải đòi phiên ─────────────────────────────────────────
  { name: "GET  /staff/dashboard", method: "GET", path: "/staff/dashboard", expect: "3xx" },
  { name: "GET  /staff/team", method: "GET", path: "/staff/team", expect: "3xx" },
  { name: "GET  /staff/chat", method: "GET", path: "/staff/chat", expect: "3xx" },
  { name: "GET  /staff/profile", method: "GET", path: "/staff/profile", expect: "3xx" },

  // ── Trang đăng nhập phải công khai ─────────────────────────────────────
  { name: "GET  /staff/login", method: "GET", path: "/staff/login", expect: "2xx" },
  { name: "GET  /staff/forgot-pin", method: "GET", path: "/staff/forgot-pin", expect: "2xx" },

  // ── API staff phải trả 401 JSON (không phải redirect HTML) ────────────
  { name: "GET  /api/staff/team", method: "GET", path: "/api/staff/team", expect: 401 },
  { name: "POST /api/staff/team (cap tai khoan)", method: "POST", path: "/api/staff/team", expect: 401 },
  {
    name: "POST /api/staff/team voi payload cap tai khoan",
    method: "POST",
    path: "/api/staff/team",
    expect: 401,
    body: {
      fullName: "Nhan Vien Moi",
      dateOfBirth: "1995-05-05",
      email: "new.staff@example.com",
      branchId: "b1",
      jobTitle: "LE_TAN",
      pin: "654321",
      managerPin: "111111",
    },
    note: "khong co phien -> khong duoc cap tai khoan du co payload hop le",
  },
  { name: "GET  /api/staff/me", method: "GET", path: "/api/staff/me", expect: 401 },
  { name: "GET  /api/staff/appointments", method: "GET", path: "/api/staff/appointments", expect: 401 },
  { name: "GET  /api/staff/records", method: "GET", path: "/api/staff/records", expect: 401 },
];

function matches(actual: number, expect: Case["expect"]): boolean {
  if (expect === "2xx") return actual >= 200 && actual < 300;
  if (expect === "3xx") return actual >= 300 && actual < 400;
  return actual === expect;
}

let failures = 0;

async function main() {
  console.log(`Kiem chung be mat xac thuc staff — ${BASE}\n`);

  for (const c of CASES) {
    const init: RequestInit = { method: c.method, redirect: "manual" };
    if (c.body !== undefined) {
      init.headers = { "content-type": "application/json" };
      init.body = JSON.stringify(c.body);
    }

    let actual = -1;
    let detail = "";
    try {
      const res = await fetch(`${BASE}${c.path}`, init);
      actual = res.status;
      if (c.expect === 401 && c.path.startsWith("/api/")) {
        // API staff phải trả JSON, không phải HTML — client JS cần đọc được.
        const ct = res.headers.get("content-type") ?? "";
        if (!ct.includes("application/json")) detail = ` (content-type: ${ct})`;
      }
    } catch (err) {
      detail = ` (loi: ${String(err)})`;
    }

    const ok = matches(actual, c.expect);
    if (ok && detail) {
      console.log(`  WARN  ${c.name} -> ${actual}${detail}`);
    } else if (ok) {
      console.log(`  PASS  ${c.name} -> ${actual}`);
    } else {
      failures += 1;
      console.log(`  FAIL  ${c.name} -> ${actual}, mong doi ${String(c.expect)}${detail}`);
    }
    if (c.note) console.log(`        · ${c.note}`);
  }

  console.log(
    `\n${failures === 0 ? "TAT CA KIEM TRA DANG CHAY PASS" : `${failures} KIEM TRA FAIL`}`
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});