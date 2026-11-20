// app/api/staff/team/route.ts
// The staff directory.
//
//   GET   → every employee (public-to-staff fields only)
//   POST  → create an account on someone's behalf, using a manager PIN
//   PATCH → grant / revoke access for one account (staff:grant, ADMIN only)
//
// G7: /api/staff/register ĐÃ ĐÓNG (410 Gone cho mọi phương thức).
//   Trước đây nó cho phép ai cũng tự tạo tài khoản cho MÌNH và tự chọn chức
//   danh — đó là nguyên nhân gốc của các thẻ rác/trùng trong dữ liệu. Vì vậy
//   nhận xét cũ ở đây ("an toàn vì lễ tân không viết chẩn đoán") KHÔNG còn đúng:
//   vấn đề không phải quyền hạn thấp, mà là việc không cần quản trị viên mà vẫn
//   có tài khoản staff.
//
//   Đây là CON ĐƯỜNG DUY NHẤT còn lại để cấp tài khoản: Admin/HR mở trang Đội
//   ngũ, cung cấp PIN của chính mình (bằng chứng thẩm quyền, không lưu lại), và
//   tài khoản mới được tạo. Cổng này sau `staff:grant` + `requireStaffAction`,
//   có Zod validate và ghi audit log.

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireStaffAction } from '@/lib/staffSession';
import {
  listAllStaff,
  publicList,
  verifyStaffPin,
  registerStaff,
  setStaffActive,
  validateDateOfBirth,
  JOB_TITLE_LABELS,
  staffBranch,
  type StaffJobTitle,
} from '@/lib/staff-service';
import { STAFF_PROFILES } from '@/lib/staffProfiles';
import { buildStaffDirectory } from '@/lib/staffDirectory';
import { BRANCHES } from '@/lib/clinics';
import { audit, clientIpFrom } from '@/security/audit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Cards that must never reach the directory.
 *
 * The ADMIN seed account stays in data/staff.json because removing it would
 * make `ensureAdminStaff` recreate it on the next sign-in — but it is an
 * operations account, not a team member, so it is filtered out of every list.
 * The other entries were junk created by the old open /staff/register route
 * (G7 closed it); they were deleted from storage, and the name guards below
 * stop a future re-seed or manual restore from bringing the cards back.
 */
const HIDDEN_TEAM_EMAILS = new Set(['admin@belwee.vn', 'thuybelwee@admin.com']);
const HIDDEN_TEAM_NAME = /^(khangc|tenmoidaluu|zenithflow\s*studio|quản\s*trị\s*viên\s*belwee)$/i;

function isHiddenTeamCard(record: { email: string; fullName: string }): boolean {
  return HIDDEN_TEAM_EMAILS.has(record.email.trim().toLowerCase()) || HIDDEN_TEAM_NAME.test(record.fullName.trim());
}

export async function GET() {
  // staff:team rather than appointment:view: reading the directory must not
  // require access to the customer queue.
  const session = await requireStaffAction('staff:team');
  if ('error' in session) return session.error;

  const records = await listAllStaff();
  const visibleRecords = publicList(records).filter((member) => !isHiddenTeamCard(member));
  const staff = buildStaffDirectory(visibleRecords, session.staff.id);
  const withBranches = staff.map((member) => {
    const branch = member.branchId ? staffBranch(member.branchId) : null;
    return {
      ...member,
      branchCode: branch?.code ?? null,
      branchName: branch?.address ?? null,
    };
  });

  return NextResponse.json({ staff: withBranches, branches: BRANCHES });
}

const CREATE_SCHEMA = z.object({
  profileId: z.string().trim().min(1).optional(),
  fullName: z.string().trim().min(2).max(100).optional(),
  dateOfBirth: z.string().trim().min(1).optional(),
  email: z.string().trim().email().max(254),
  branchId: z.string().trim().min(1).optional(),
  jobTitle: z.string().trim().min(1).optional(),
  pin: z.string().trim().regex(/^\d{6}$/, 'Mã PIN phải gồm đúng 6 chữ số.'),
  /** The granting admin's own PIN — proof of authority, never stored. */
  managerPin: z.string().trim().regex(/^\d{6}$/, 'Mã PIN không hợp lệ.'),
});

export async function POST(request: NextRequest) {
  const session = await requireStaffAction('staff:grant');
  if ('error' in session) return session.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: 'Dữ liệu gửi lên không hợp lệ.' }, { status: 400 });
  }

  const parsed = CREATE_SCHEMA.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      { message: first?.message || 'Dữ liệu không hợp lệ.', field: first?.path[0] },
      { status: 400 }
    );
  }

  const profile = parsed.data.profileId
    ? STAFF_PROFILES.find((item) => item.id === parsed.data.profileId)
    : undefined;
  if (parsed.data.profileId && !profile) {
    return NextResponse.json({ message: 'Không tìm thấy hồ sơ nhân viên.', field: 'profileId' }, { status: 400 });
  }

  const fullName = profile?.name ?? parsed.data.fullName;
  const dateOfBirth = profile?.dateOfBirth ?? parsed.data.dateOfBirth ?? null;
  const branchId = profile
    ? profile.branchId ?? BRANCHES[0].id
    : parsed.data.branchId;
  const jobTitle = profile?.jobTitle ?? parsed.data.jobTitle;

  if (!fullName) {
    return NextResponse.json({ message: 'Vui lòng nhập tên nhân viên.', field: 'fullName' }, { status: 400 });
  }
  if (!profile && !dateOfBirth) {
    return NextResponse.json({ message: 'Vui lòng chọn ngày sinh.', field: 'dateOfBirth' }, { status: 400 });
  }
  const dobError = dateOfBirth ? validateDateOfBirth(dateOfBirth) : null;
  if (dobError) {
    return NextResponse.json({ message: dobError, field: 'dateOfBirth' }, { status: 400 });
  }

  const normalizedJobTitle = jobTitle?.toUpperCase() as StaffJobTitle | undefined;
  if (!normalizedJobTitle || !(normalizedJobTitle in JOB_TITLE_LABELS)) {
    return NextResponse.json({ message: 'Chức danh không hợp lệ.', field: 'jobTitle' }, { status: 400 });
  }
  if (!branchId || !BRANCHES.some((b) => b.id === branchId)) {
    return NextResponse.json({ message: 'Chi nhánh không hợp lệ.', field: 'branchId' }, { status: 400 });
  }

  if (!profile) {
    const normalizedName = fullName.trim().normalize('NFC').replace(/\s+/g, ' ').toLocaleLowerCase('vi');
    const matchingProfile = STAFF_PROFILES.find(
      (item) =>
        item.name.trim().normalize('NFC').replace(/\s+/g, ' ').toLocaleLowerCase('vi') === normalizedName
    );
    if (matchingProfile) {
      return NextResponse.json(
        {
          message: `Đã có hồ sơ ${matchingProfile.name}. Hãy chọn “Cấp tài khoản” trên thẻ hồ sơ để liên kết, tránh tạo trùng.`,
          field: 'fullName',
        },
        { status: 409 }
      );
    }
  }

  // The granting admin proves their own PIN before a new account appears.
  // Verified here (not delegated to registerStaff) so the check is against the
  // SESSION's staff email — registerStaff accepts ANY admin's PIN, which is
  // right for self-registration but wrong for a privileged grant.
  const proof = await verifyStaffPin(session.staff.email, parsed.data.managerPin);
  if (!proof.ok) {
    await audit('STAFF_ACCESS_DENIED', {
      ip: clientIpFrom(request),
      staffId: session.staff.id,
      email: session.staff.email,
      detail: 'grant account: manager PIN rejected',
    });
    return NextResponse.json(
      { message: proof.error, field: 'managerPin' },
      { status: proof.locked ? 429 : 400 }
    );
  }

  const result = await registerStaff({
    ...(profile ? { profileId: profile.id, avatarUrl: profile.image, bio: profile.bioVi } : {}),
    fullName,
    dateOfBirth,
    email: parsed.data.email,
    branchId,
    jobTitle: normalizedJobTitle,
    pin: parsed.data.pin,
    // NOT forwarded: the authority was already proven above, and forwarding it
    // would let registerStaff re-verify against a different admin's PIN.
    managerPin: null,
  });

  if (!result.ok) {
    return NextResponse.json({ message: result.error, field: result.field }, { status: 400 });
  }

  await audit('STAFF_REGISTERED', {
    ip: clientIpFrom(request),
    staffId: session.staff.id,
    email: result.staff.email,
    detail: `granted by ${session.staff.id} role=${result.staff.role} branch=${result.staff.branchId}${profile ? ` profile=${profile.id}` : ''}`,
  });

  return NextResponse.json({ staff: result.staff }, { status: 201 });
}

const REVOKE_SCHEMA = z.object({
  staffId: z.string().trim().min(1),
  isActive: z.boolean(),
  /** The granting admin's own PIN — required to revoke access. */
  managerPin: z.string().trim().regex(/^\d{6}$/, 'Mã PIN không hợp lệ.'),
});

export async function PATCH(request: NextRequest) {
  const session = await requireStaffAction('staff:grant');
  if ('error' in session) return session.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: 'Dữ liệu gửi lên không hợp lệ.' }, { status: 400 });
  }

  const parsed = REVOKE_SCHEMA.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: 'Dữ liệu không hợp lệ.' }, { status: 400 });
  }

  // Locking yourself out is unrecoverable without file access, so refuse it
  // before anything else.
  if (parsed.data.staffId === session.staff.id && !parsed.data.isActive) {
    return NextResponse.json(
      { message: 'Bạn không thể tự khoá tài khoản của chính mình.' },
      { status: 400 }
    );
  }

  const { verifyStaffPin } = await import('@/lib/staff-service');
  const proof = await verifyStaffPin(session.staff.email, parsed.data.managerPin);
  if (!proof.ok) {
    await audit('STAFF_ACCESS_DENIED', {
      ip: clientIpFrom(request),
      staffId: session.staff.id,
      email: session.staff.email,
      detail: `revoke access for ${parsed.data.staffId}: manager PIN rejected`,
    });
    return NextResponse.json(
      { message: proof.error, field: 'managerPin' },
      { status: proof.locked ? 429 : 400 }
    );
  }

  const result = await setStaffActive(parsed.data.staffId, parsed.data.isActive);
  if (!result) {
    return NextResponse.json({ message: 'Không tìm thấy tài khoản.' }, { status: 404 });
  }

  await audit('STAFF_ACCESS_DENIED', {
    ip: clientIpFrom(request),
    staffId: session.staff.id,
    email: session.staff.email,
    detail: `${parsed.data.isActive ? 'restored' : 'revoked'} access for ${parsed.data.staffId}`,
  });

  return NextResponse.json({ staff: { id: result.id, isActive: result.isActive } });
}