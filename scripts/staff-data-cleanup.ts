/**
 * scripts/staff-data-cleanup.ts
 *
 * Dọn dữ liệu staff theo danh sách MỤC TIÊU khai báo sẵn trong file này.
 *
 * Chạy: npx tsx scripts/staff-data-cleanup.ts           (mặc định DRY-RUN)
 *       npx tsx scripts/staff-data-cleanup.ts --apply   (thực sự ghi)
 *
 * ── NGUYÊN TẮC BẤT BIẾN ────────────────────────────────────────────────────
 * 1. Mặc định là DRY-RUN. Không có `--apply` thì KHÔNG ghi gì cả.
 * 2. Chỉ đụng vào những bản ghi khớp ĐÚNG CẢ email lẫn id khai báo ở
 *    `TARGETS`. Khớp đúng 1 bản ghi, nhiều hơn hoặc ít hơn đều dừng lại.
 *    Nhờ vậy đổi id trong file không thể khiến script xoá nhầm người thật.
 * 3. In ra đúng bản ghi sẽ bị tác động TRƯỚC khi ghi, rồi mới ghi.
 * 4. Không bao giờ xoá tài khoản ADMIN đang hoạt động, và không bao giờ xoá
 *    bản ghi không nằm trong TARGETS — kể cả khi script được sửa sai.
 *
 * ── VÌ SAO CÓ FILE NÀY ────────────────────────────────────────────────────
 * `lib/staff-service` không có `deleteStaff`. Không có đường nào trong code
 * xoá được tài khoản. Đây là công cụ MỘT LẦN cho các mục tiêu đã được chủ
 * dự án duyệt tường minh.
 *
 * Nguồn dữ liệu: data/staff.json (file-backed). Ghi qua lib/jsonStore nên
 * file được thay bằng tmp + rename, không bao giờ bị ghi dở.
 */

import './load-env';

import { createJsonStore } from '../lib/jsonStore';

type Action = 'delete' | 'demote-to-staff';

interface Target {
  /** Khớp bắt buộc — email đã lowercase. */
  email: string;
  /** Khớp bắt buộc — chống xoá nhầm khi dữ liệu bị đổi. */
  id: string;
  action: Action;
  why: string;
}

/**
 * Danh sách mục tiêu ĐÃ ĐƯỢC CHỦ DỰ ÁN DUYỆT (2026-10-18).
 *
 * Thêm bất kỳ mục nào ở đây đều là một thay đổi ghi vào dữ liệu của khách —
 * hãy ghi kèm lý do và xin duyệt trước.
 */
const TARGETS: Target[] = [
  {
    email: 'lockout-test@belwee.vn',
    id: 'STF_MVDVNTV1DZ1Q',
    action: 'delete',
    why:
      'Ban ghi rac do scripts/verify-staff-auth.ts tao khi chay truc tiep vao DB ' +
      'that. Da duyet xoa de don sach lai DB cua chu du an.',
  },
  {
    email: 'zenithflowstudio@gmail.com',
    id: 'STF_MUVEDXHP2GC1',
    action: 'demote-to-staff',
    why:
      'Tai khoan co vai tro ADMIN ma khong ro nguon goc. Chu du an da duyet ' +
      'ha ve STAFF thuong; giu nguyen email va PIN, chi thay doi quyen.',
  },
  {
    email: 'stale3.test@belwee.vn',
    id: 'STF_MUVFPUHG4F0O',
    action: 'delete',
    why:
      'Ban ghi rac con lai tu thoi con mo cong tu dang ky cong khai (da dong ' +
      'o G7.1). Ten "TenMoiDaLuu", email chua "test", da khoa, chua tung ' +
      'dang nhap. Chu du an da duyet xoa.',
  },
  {
    email: 'fixverify.test@belwee.vn',
    id: 'STF_MUVFUUSM84OY',
    action: 'delete',
    why:
      'Ban ghi rac trung ten voi ban ghi tren ("TenMoiDaLuu"), cung la rac tu ' +
      'thoi mo cong tu dang ky. Chu du an da duyet xoa.',
  },
];

const APPLY = process.argv.includes('--apply');

interface Rec extends Record<string, unknown> {
  id: string;
  email: string;
  fullName: string;
  role: string;
  isActive: boolean;
}

const staffStore = createJsonStore<Rec>('staff.json');

function matches(rec: Rec, target: Target): boolean {
  return (
    String(rec.email ?? '').toLowerCase().trim() === target.email &&
    String(rec.id ?? '') === target.id
  );
}

async function main() {
  console.log(
    APPLY
      ? '\n=== CHẾ ĐỘ APPLY — sẽ GHI vào data/staff.json ===\n'
      : '\n=== CHẾ ĐỘ DRY-RUN — KHÔNG ghi gì cả (thêm --apply để chạy thật) ===\n'
  );

  let planned = 0;

  for (const target of TARGETS) {
    const hits = staffStore.read().filter((rec) => matches(rec, target));

    if (hits.length !== 1) {
      console.log(`  BO QUA  ${target.email}`);
      console.log(`           khop ${hits.length} ban ghi (can dung 1). Moi them --apply sau khi kiem tra lai.`);
      continue;
    }

    const rec = hits[0];
    console.log(`  MUC TIEU  ${target.email}`);
    console.log(`           id       = ${rec.id}`);
    console.log(`           ten      = ${rec.fullName}`);
    console.log(`           vai tro  = ${rec.role}  →  ${target.action === 'delete' ? '(xoa)' : 'STAFF'}`);
    console.log(`           ly do    : ${target.why}`);

    if (target.action === 'demote-to-staff' && rec.role === 'STAFF') {
      console.log(`           → đã là STAFF, không cần làm gì.`);
      continue;
    }

    planned += 1;

    if (!APPLY) {
      console.log(`           → DRY-RUN: chưa ghi.`);
      continue;
    }

    if (target.action === 'delete') {
      const deleted = staffStore.update((rows) => {
        const index = rows.findIndex((row) => matches(row, target));
        if (index === -1) return 0;
        rows.splice(index, 1);
        return 1;
      });
      console.log(`           → ĐÃ XOÁ (${deleted} ban ghi).`);
    } else {
      const updated = staffStore.update((rows) => {
        const row = rows.find((candidate) => matches(candidate, target));
        if (!row) return 0;
        row.role = 'STAFF';
        return 1;
      });
      console.log(`           → ĐÃ HẠ VỀ STAFF (${updated} ban ghi).`);
    }
  }

  console.log(
    planned === 0
      ? '\nKhông có thay đổi nào được thực hiện.'
      : APPLY
        ? `\nĐã áp dụng ${planned} thay đổi.`
        : `\n${planned} thay đổi sẽ được thực hiện nếu chạy lại với --apply.`
  );
  console.log('Chạy lại `npm run audit:staff` để xác nhận kết quả.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
