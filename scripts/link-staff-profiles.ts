/**
 * Link existing staff login rows to the photographed profiles shown in the
 * directory. Dry-run is the default; --apply adds links and profile details
 * without deleting or replacing any account data.
 *
 * Before applying, run `bash backup.sh`.
 */

import { createJsonStore } from '../lib/jsonStore';
import { STAFF_PROFILES } from '../lib/staffProfiles';

interface StaffRow extends Record<string, unknown> {
  id: string;
  fullName?: string;
  name?: string;
  email?: string;
  role?: string;
  profileId?: string;
  avatarUrl?: string | null;
  bio?: string;
}

const APPLY = process.argv.includes('--apply');
const staffStore = createJsonStore<StaffRow>('staff.json');

function normalizeName(value: unknown): string {
  return String(value ?? '').trim().normalize('NFC').replace(/\s+/g, ' ').toLocaleLowerCase('vi');
}

function matchingRows(rows: StaffRow[], profile: (typeof STAFF_PROFILES)[number]): StaffRow[] {
  const profileName = normalizeName(profile.name);
  return rows.filter(
    (row) =>
      row.profileId === profile.id ||
      (!row.profileId && normalizeName(row.fullName ?? row.name) === profileName)
  );
}

function main(): void {
  const rows = staffStore.read();
  const plans = STAFF_PROFILES.map((profile) => ({
    profile,
    matches: matchingRows(rows, profile),
  }));
  const pairs = plans.flatMap(({ profile, matches }) =>
    matches.map((account) => ({ profile, account }))
  );

  console.log(APPLY ? '=== LIÊN KẾT HỒ SƠ — APPLY ===' : '=== LIÊN KẾT HỒ SƠ — DRY-RUN ===');
  if (pairs.length === 0) console.log('Không tìm thấy cặp hồ sơ/tài khoản trùng tên.');
  for (const { profile, account } of pairs) {
    console.log(
      `${profile.name} (${profile.id}) ↔ ${account.fullName ?? account.name} ` +
        `[id=${account.id}, email=${account.email ?? '(trống)'}, role=${account.role ?? '(trống)'}]`
    );
    console.log('  Đề xuất: giữ ảnh/mô tả/chức danh hồ sơ; liên kết email và quyền từ tài khoản.');
  }

  if (!APPLY) {
    console.log('\nChỉ đọc dữ liệu. Thêm --apply để ghi liên kết; không có bản ghi nào bị xóa.');
    return;
  }

  console.warn('\nHãy chạy `bash backup.sh` và xác nhận backup trước khi áp dụng.');
  const ambiguous = plans.filter((plan) => plan.matches.length > 1);
  for (const { profile } of ambiguous) {
    console.warn(`Bỏ qua ${profile.name}: có nhiều tài khoản trùng tên, cần xử lý thủ công.`);
  }

  const safeProfileIds = new Set(
    plans.filter((plan) => plan.matches.length === 1).map((plan) => plan.profile.id)
  );
  if (safeProfileIds.size === 0) {
    console.log('Không có cặp duy nhất an toàn để ghi; dữ liệu không thay đổi.');
    return;
  }

  staffStore.update((currentRows) => {
    for (const profile of STAFF_PROFILES) {
      if (!safeProfileIds.has(profile.id)) continue;
      const matches = matchingRows(currentRows, profile);
      if (matches.length !== 1) continue;
      const row = matches[0];
      row.profileId = profile.id;
      row.avatarUrl = profile.image;
      row.bio = profile.bioVi;
    }
  });
  console.log(`Đã liên kết ${safeProfileIds.size} cặp duy nhất; không xóa tài khoản.`);
}

main();
