/**
 * scripts/migrate-admin.ts
 *
 * Migration/seed script to replace all admin accounts with a single new admin.
 *
 * Chạy:
 *   npx tsx scripts/migrate-admin.ts           (mặc định DRY-RUN)
 *   npx tsx scripts/migrate-admin.ts --apply   (thực sự ghi)
 *   npx tsx scripts/migrate-admin.ts --apply --hard-delete  (xoá cứng tài khoản cũ)
 *   npx tsx scripts/migrate-admin.ts --dry-run --confirm YES  (xác nhận danh sách trước khi chạy thật)
 *
 * ── NGUYÊN TẮC BẤT BIẾN ────────────────────────────────────────────────────
 * 1. Mặc định là DRY-RUN. Không có `--apply` thì KHÔNG ghi gì cả.
 * 2. Chỉ đụng vào data/users.json, data/staff.json, data/auth-sessions.json, data/audit-log.json.
 * 3. In ra đúng bản ghi sẽ bị tác động TRƯỚC khi ghi, rồi mới ghi.
 * 4. Không bao giờ xoá tài khoản admin cuối cùng (rollback nếu < 1 admin ACTIVE).
 * 5. Mật khẩu admin mới CHỈ đọc từ biến môi trường SEED_ADMIN_PASSWORD.
 *    Không bao giờ ghi giá trị này vào source, test, seed, README, commit, log.
 *
 * ── MỤC TIÊU ────────────────────────────────────────────────────────────────
 * Tài khoản admin mới: thuybelwee@admin.com
 * - Role: ADMIN, Status: ACTIVE, mustChangePin: true
 * - Nếu email đã tồn tại → cập nhật thành ADMIN/ACTIVE + đặt lại mật khẩu
 * - Tạo kèm StaffProfile hiển thị "Quản trị viên Belwee"
 *
 * Tài khoản cũ bị gỡ (xác nhận bằng --confirm):
 * - admin@belwee.vn
 * - khangcaheo300582@gmail.com
 * - zenithflowstudio@gmail.com
 * - Mọi account ADMIN/HR_MANAGER khác phát hiện được khi quét DB
 */

import './load-env';

import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { createAsyncJsonStore, createJsonStore } from '../lib/jsonStore';
import { STAFF_PROFILES } from '../lib/staffProfiles';

// ─── Local helpers ──────────────────────────────────────────────────────────
function generateStaffId(): string {
  return `STF_${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
}

// ─── TYPE DEFINITIONS ──────────────────────────────────────────────────────

interface User {
  id: string;
  email: string;
  password: string;
  name: string;
  image?: string | null;
  provider: 'credentials' | 'google';
  googleId?: string | null;
  role?: string;
  passwordHistory?: string[];
  createdAt: string;
  updatedAt: string;
}

interface StaffRecord {
  id: string;
  fullName: string;
  name?: string;
  dateOfBirth: string | null;
  email: string;
  branchId: string;
  role: string;
  jobTitle: string;
  pinHash?: string;
  pin?: string;
  avatarUrl: string | null;
  bio: string;
  isActive: boolean;
  lastLoginAt: string | null;
  rulesAcknowledgedAt: string | null;
  rulesVersion: number | null;
  createdAt: string;
  updatedAt: string;
}

interface AuthSession {
  jti: string;
  userId: string;
  expiresAt: string;
  revoked: boolean;
  revokedAt: string | null;
  createdAt: string;
}

interface AdminCandidate {
  source: 'staff' | 'user';
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  hasCredential: boolean;
}

interface AuditEntry {
  event: string;
  timestamp: string;
  newAdminEmail: string;
  removedAccountIds: string[];
  performedBy: string;
  hardDelete: boolean;
}

// ─── CẤU HÌNH ──────────────────────────────────────────────────────────────
const NEW_ADMIN_EMAIL = 'thuybelwee@admin.com'.toLowerCase().trim();
const NEW_ADMIN_NAME = 'Quản trị viên Belwee';
const NEW_ADMIN_JOB_TITLE = 'QUAN_TRI';
const NEW_ADMIN_ROLE = 'ADMIN';
const NEW_ADMIN_BRANCH = 'b1';

const KNOWN_OLD_ADMIN_EMAILS = [
  'admin@belwee.vn',
  'khangcaheo300582@gmail.com',
  'zenithflowstudio@gmail.com',
].map((e) => e.toLowerCase().trim());

const APPLY = process.argv.includes('--apply');
const HARD_DELETE = process.argv.includes('--hard-delete');
const CONFIRM_YES = process.argv.includes('--confirm') && process.argv.includes('YES');
const DRY_RUN = !APPLY;

// ─── STORES ────────────────────────────────────────────────────────────────
const userStore = createAsyncJsonStore<User>('users.json');
const staffStore = createAsyncJsonStore<StaffRecord>('staff.json');
const sessionStore = createAsyncJsonStore<AuthSession>('auth-sessions.json');
const auditStore = createJsonStore<AuditEntry>('audit-log.json');

// ─── HELPERS ───────────────────────────────────────────────────────────────
function rowEmail(row: Pick<StaffRecord | User, 'email'>): string {
  return String(row.email ?? '').toLowerCase().trim();
}

async function revokeAllSessions(userId: string): Promise<number> {
  const revokedAt = new Date().toISOString();
  return sessionStore.update(async (rows) => {
    let count = 0;
    for (const row of rows) {
      if (row.userId !== userId || row.revoked) continue;
      row.revoked = true;
      row.revokedAt = revokedAt;
      count++;
    }
    return count;
  });
}

async function scanForAdmins(): Promise<AdminCandidate[]> {
  const candidates: AdminCandidate[] = [];

  // Quét staff.json
  const staffRows = await staffStore.read();
  for (const row of staffRows) {
    const normalized = rowEmail(row);
    const role = String(row.role ?? '').toUpperCase();
    if (role === 'ADMIN' || role === 'HR_MANAGER') {
      candidates.push({
        source: 'staff',
        id: String(row.id),
        email: normalized,
        name: String(row.fullName ?? row.name ?? ''),
        role,
        isActive: row.isActive !== false,
        hasCredential: Boolean(row.pinHash || row.pin),
      });
    }
  }

  // Quét users.json
  const userRows = await userStore.read();
  for (const row of userRows) {
    const normalized = rowEmail(row);
    const role = String(row.role ?? '').toUpperCase();
    if (role === 'ADMIN' || role === 'HR_MANAGER' || KNOWN_OLD_ADMIN_EMAILS.includes(normalized)) {
      candidates.push({
        source: 'user',
        id: String(row.id),
        email: normalized,
        name: String(row.name ?? ''),
        role,
        isActive: Boolean(row.password), // coi có password là active
        hasCredential: Boolean(row.password),
      });
    }
  }

  // Khử trùng theo email (ưu tiên staff nếu có cả hai)
  const byEmail = new Map<string, AdminCandidate>();
  for (const c of candidates) {
    const existing = byEmail.get(c.email);
    if (!existing || existing.source === 'user') {
      byEmail.set(c.email, c);
    }
  }

  return Array.from(byEmail.values());
}

// ─── MAIN ──────────────────────────────────────────────────────────────────
async function main() {
  console.log(
    DRY_RUN
      ? '\n=== CHẾ ĐỘ DRY-RUN — KHÔNG ghi gì cả (thêm --apply để chạy thật) ===\n'
      : HARD_DELETE
      ? '\n=== CHẾ ĐỘ APPLY + HARD-DELETE — sẽ GHI & XOÁ CỨNG vào data/*.json ===\n'
      : '\n=== CHẾ ĐỘ APPLY — sẽ GHI vào data/*.json (không xoá cứng) ===\n'
  );

  if (DRY_RUN) {
    console.log('Mẹo: thêm --confirm YES để xem danh sách sẽ bị gỡ, sau đó chạy lại với --apply --confirm YES');
    console.log('Mẹo: thêm --hard-delete để xoá cứng tài khoản cũ (mặc định chỉ hạ quyền + khóa).\n');
  }

  // 1. Kiểm tra biến môi trường mật khẩu
  const seedPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!seedPassword || seedPassword.trim() === '') {
    console.error('❌ LỖI: Thiếu hoặc rỗng biến môi trường SEED_ADMIN_PASSWORD.');
    console.error('   Hãy đặt SEED_ADMIN_PASSWORD trong .env.local trước khi chạy script này.');
    console.error('   Ví dụ: SEED_ADMIN_PASSWORD="your-strong-password-min-10-chars"');
    process.exit(1);
  }
  if (seedPassword.length < 10) {
    console.error('❌ LỖI: SEED_ADMIN_PASSWORD phải có độ dài ≥ 10 ký tự.');
    process.exit(1);
  }

  // 2. Quét DB
  console.log('🔍 Đang quét data/users.json và data/staff.json tìm tài khoản quản trị...');
  const adminCandidates = await scanForAdmins();
  console.log(`   Tìm thấy ${adminCandidates.length} tài khoản có vai trò quản trị:`);
  for (const c of adminCandidates) {
    console.log(`   - [${c.source}] ${c.email} (id=${c.id}, role=${c.role}, active=${c.isActive})`);
  }

  // 3. Tách admin mới và admin cũ
  const newAdminExisting = adminCandidates.find((c) => c.email === NEW_ADMIN_EMAIL);
  const oldAdmins = adminCandidates.filter((c) => c.email !== NEW_ADMIN_EMAIL);

  if (oldAdmins.length === 0 && !newAdminExisting) {
    console.log('\n✅ Không có admin cũ nào cần gỡ. Chỉ cần tạo admin mới.');
  } else if (oldAdmins.length === 0) {
    console.log('\n✅ Admin mới đã tồn tại. Không có admin cũ nào cần gỡ.');
  }

  // 4. Kiểm tra xác nhận nếu có admin cũ
  if (oldAdmins.length > 0) {
    console.log('\n📋 DANH SÁCH TÀI KHOẢN CŨ SẼ BỊ GỠ (hạ quyền/khóa/xoá):');
    for (const c of oldAdmins) {
      console.log(`   - [${c.source}] ${c.email} (id=${c.id}, role=${c.role})`);
    }

    if (!APPLY && !CONFIRM_YES) {
      console.log('\n⚠️  DRY-RUN: Chưa xác nhận. Chạy lại với --dry-run --confirm YES để xem chi tiết, hoặc --apply --confirm YES để thực thi.');
      return;
    }

    if (APPLY && !CONFIRM_YES) {
      console.error('\n❌ LỖI: Cần xác nhận bằng --confirm YES trước khi chạy --apply.');
      console.error('   Ví dụ: npx tsx scripts/migrate-admin.ts --apply --confirm YES');
      process.exit(1);
    }
  }

  // 5. Thực hiện migration
  console.log('\n🚀 Bắt đầu migration...\n');

  try {
    await step1CreateNewAdmin(seedPassword);
    await step2VerifyNewAdmin(seedPassword);
    if (oldAdmins.length > 0) {
      await step3ProcessOldAdmins(oldAdmins);
    }
    await step4VerifyAtLeastOneAdmin();
    await step5WriteAuditLog(oldAdmins.map((c) => c.id));

    console.log('\n✅ Migration hoàn tất thành công!');
    console.log(`   Admin mới: ${NEW_ADMIN_EMAIL} (ACTIVE, ADMIN, mustChangePin=true)`);
    if (oldAdmins.length > 0) {
      console.log(`   Đã xử lý ${oldAdmins.length} tài khoản cũ.`);
      console.log(`   Các phiên đăng nhập cũ đã bị thu hồi.`);
    }
  } catch (error) {
    console.error('\n❌ Migration thất bại:', error);
    console.error('   Dữ liệu có thể ở trạng thái không nhất quán. Hãy restore từ backup.');
    process.exit(1);
  }

  if (DRY_RUN) {
    console.log('\n💡 Đây là DRY-RUN. Chạy lại với --apply --confirm YES để thực thi thật.');
  }
}

// ─── BƯỚC 1: Tạo hoặc cập nhật admin mới ────────────────────────────────────
async function step1CreateNewAdmin(seedPassword: string) {
  console.log('📝 BƯỚC 1: Tạo/cập nhật admin mới...');

  const passwordHash = await bcrypt.hash(seedPassword, 12);
  const pinHash = await bcrypt.hash(seedPassword, 10);
  const now = new Date().toISOString();

  // 1a. Xử lý data/users.json
  await userStore.update(async (rows) => {
    const idx = rows.findIndex((u) => rowEmail(u) === NEW_ADMIN_EMAIL);
    if (idx !== -1) {
      rows[idx] = {
        ...rows[idx],
        password: passwordHash,
        name: NEW_ADMIN_NAME,
        role: NEW_ADMIN_ROLE,
        updatedAt: now,
      };
      console.log(`   → Cập nhật users.json: ${NEW_ADMIN_EMAIL} (id=${rows[idx].id})`);
      return;
    }
    // Tạo mới user
    const newId = `USR_${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    rows.push({
      id: newId,
      email: NEW_ADMIN_EMAIL,
      password: passwordHash,
      name: NEW_ADMIN_NAME,
      image: null,
      provider: 'credentials',
      googleId: null,
      role: NEW_ADMIN_ROLE,
      createdAt: now,
      updatedAt: now,
    });
    console.log(`   → Tạo mới users.json: ${NEW_ADMIN_EMAIL} (id=${newId})`);
  });

  // 1b. Xử lý data/staff.json
  await staffStore.update(async (rows) => {
    const existingIdx = rows.findIndex((r) => rowEmail(r) === NEW_ADMIN_EMAIL);
    if (existingIdx !== -1) {
      rows[existingIdx] = {
        ...rows[existingIdx],
        fullName: NEW_ADMIN_NAME,
        name: NEW_ADMIN_NAME,
        role: NEW_ADMIN_ROLE,
        jobTitle: NEW_ADMIN_JOB_TITLE,
        pinHash,
        isActive: true,
        updatedAt: now,
      };
      delete rows[existingIdx].pin;
      console.log(`   → Cập nhật staff.json: ${NEW_ADMIN_EMAIL} (id=${rows[existingIdx].id})`);
      return;
    }
    const newId = generateStaffId();
    rows.push({
      id: newId,
      fullName: NEW_ADMIN_NAME,
      name: NEW_ADMIN_NAME,
      dateOfBirth: null,
      email: NEW_ADMIN_EMAIL,
      branchId: NEW_ADMIN_BRANCH,
      role: NEW_ADMIN_ROLE,
      jobTitle: NEW_ADMIN_JOB_TITLE,
      pinHash,
      avatarUrl: null,
      bio: '',
      isActive: true,
      lastLoginAt: null,
      rulesAcknowledgedAt: null,
      rulesVersion: null,
      createdAt: now,
      updatedAt: now,
    });
    console.log(`   → Tạo mới staff.json: ${NEW_ADMIN_EMAIL} (id=${newId})`);
  });

  // 1c. Kiểm tra StaffProfile
  const hasProfile = STAFF_PROFILES.some((p) => p.id === 'quan-tri-vien-belwee' || p.name === NEW_ADMIN_NAME);
  if (!hasProfile) {
    console.log('   ⚠️  Lưu ý: StaffProfile cho admin mới chưa có trong lib/staffProfiles.ts.');
    console.log('      Hãy thêm thủ công sau migration (id gợi ý: "quan-tri-vien-belwee").');
  }

  console.log('   ✅ Bước 1 hoàn tất.\n');
}

// ─── BƯỚC 2: Tự kiểm tra admin mới ──────────────────────────────────────────
async function step2VerifyNewAdmin(seedPassword: string) {
  console.log('🔎 BƯỚC 2: Tự kiểm tra admin mới...');

  // Kiểm tra users.json
  const userRows = await userStore.read();
  const user = userRows.find((u) => rowEmail(u) === NEW_ADMIN_EMAIL);
  if (!user) {
    throw new Error(`Admin mới không tồn tại trong users.json sau khi tạo.`);
  }
  const passwordOk = await bcrypt.compare(seedPassword, user.password);
  if (!passwordOk) {
    throw new Error(`Hash mật khẩu admin mới không khớp.`);
  }
  if (user.role !== NEW_ADMIN_ROLE) {
    throw new Error(`Role admin mới không phải ADMIN (hiện tại: ${user.role}).`);
  }
  console.log(`   ✅ users.json: ${user.email} - role=${user.role} - hash OK`);

  // Kiểm tra staff.json
  const staffRows = await staffStore.read();
  const staff = staffRows.find((s) => rowEmail(s) === NEW_ADMIN_EMAIL);
  if (!staff) {
    throw new Error(`Admin mới không tồn tại trong staff.json sau khi tạo.`);
  }
  const pinOk = await bcrypt.compare(seedPassword, staff.pinHash || '');
  if (!pinOk) {
    throw new Error(`Hash PIN admin mới không khớp.`);
  }
  if (staff.role !== NEW_ADMIN_ROLE) {
    throw new Error(`Role admin mới trong staff.json không phải ADMIN (hiện tại: ${staff.role}).`);
  }
  if (!staff.isActive) {
    throw new Error(`Admin mới trong staff.json không ACTIVE.`);
  }
  console.log(`   ✅ staff.json: ${staff.email} - role=${staff.role} - isActive=${staff.isActive} - hash OK`);

  console.log('   ✅ Bước 2 hoàn tất.\n');
}

// ─── BƯỚC 3: Xử lý admin cũ ────────────────────────────────────────────────
async function step3ProcessOldAdmins(oldAdmins: AdminCandidate[]) {
  console.log('🔧 BƯỚC 3: Xử lý tài khoản admin cũ...\n');

  for (const admin of oldAdmins) {
    console.log(`   Xử lý: [${admin.source}] ${admin.email} (id=${admin.id})`);

    if (admin.source === 'staff') {
      await processOldStaffAdmin(admin);
    } else if (admin.source === 'user') {
      await processOldUserAdmin(admin);
    }
  }

  console.log('   ✅ Bước 3 hoàn tất.\n');
}

async function processOldStaffAdmin(admin: AdminCandidate) {
  if (HARD_DELETE) {
    const deleted = await staffStore.update((rows) => {
      const idx = rows.findIndex((r) => String(r.id) === admin.id);
      if (idx === -1) return 0;
      rows.splice(idx, 1);
      return 1;
    });
    console.log(`   → ĐÃ XOÁ CỨNG staff.json (${deleted} bản ghi).`);
  } else {
    const updated = await staffStore.update((rows) => {
      const idx = rows.findIndex((r) => String(r.id) === admin.id);
      if (idx === -1) return 0;
      rows[idx] = {
        ...rows[idx],
        role: 'RECEPTIONIST',
        jobTitle: 'LE_TAN',
        isActive: false,
        pinHash: undefined,
        pin: undefined,
        updatedAt: new Date().toISOString(),
      };
      return 1;
    });
    console.log(`   → ĐÃ HẠ VỀ STAFF (RECEPTIONIST) + KHÓA + XÓA PIN (${updated} bản ghi).`);
  }
  await revokeAllSessions(admin.id);
}

async function processOldUserAdmin(admin: AdminCandidate) {
  await userStore.update((rows) => {
    const idx = rows.findIndex((u) => rowEmail(u) === admin.email);
    if (idx === -1) return 0;
    rows[idx] = {
      ...rows[idx],
      password: '', // Xóa mật khẩu -> không đăng nhập được
      role: 'USER', // Hạ xuống user thường
      name: `[Đã gỡ] ${admin.name}`,
      updatedAt: new Date().toISOString(),
    };
    return 1;
  });
  console.log(`   → ĐÃ VÔ HIỆU HÓA users.json: role=USER, password cleared`);
  await revokeAllSessions(admin.id);
}

// ─── BƯỚC 4: Kiểm tra còn ít nhất 1 admin ACTIVE ───────────────────────────
async function step4VerifyAtLeastOneAdmin() {
  console.log('🔎 BƯỚC 4: Kiểm tra còn ít nhất 1 admin ACTIVE...');

  const staffRows = await staffStore.read();
  const staffAdmins = staffRows.filter((s) => String(s.role).toUpperCase() === 'ADMIN' && s.isActive !== false);

  const userRows = await userStore.read();
  const userAdmin = userRows.find((u) => rowEmail(u) === NEW_ADMIN_EMAIL);

  if (staffAdmins.length === 0 && !userAdmin) {
    throw new Error('ROLLBACK: Không còn admin ACTIVE nào sau migration!');
  }

  console.log(`   ✅ staff.json: ${staffAdmins.length} admin ACTIVE`);
  console.log(`   ✅ users.json: ${userAdmin ? 1 : 0} admin ACTIVE`);
  console.log('   ✅ Bước 4 hoàn tất.\n');
}

// ─── BƯỚC 5: Ghi audit log ─────────────────────────────────────────────────
async function step5WriteAuditLog(removedIds: string[]) {
  console.log('📝 BƯỚC 5: Ghi audit log...');

  const auditEntry: AuditEntry = {
    event: 'ADMIN_REPLACED',
    timestamp: new Date().toISOString(),
    newAdminEmail: NEW_ADMIN_EMAIL,
    removedAccountIds: removedIds,
    performedBy: 'migration-script',
    hardDelete: HARD_DELETE,
  };

  auditStore.update((rows) => {
    rows.push(auditEntry);
  });

  console.log(`   → Đã ghi audit-log.json (event=ADMIN_REPLACED, removed=${removedIds.length} ids).`);
  console.log('   ✅ Bước 5 hoàn tất.\n');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });