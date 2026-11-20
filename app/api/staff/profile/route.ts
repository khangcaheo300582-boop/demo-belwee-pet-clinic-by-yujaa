// app/api/staff/profile/route.ts
// The signed-in staff member's own profile.
//
//   GET   → profile + statistics
//   PATCH → { action: 'update' | 'pin' }
//
// Deliberately `/me` semantics: there is no id in the path, so there is no
// missing-authorisation bug class here. `staff:grant` is what lets someone edit
// ANOTHER person's account, and that lives on a separate route.

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireStaff } from '@/lib/staffSession';
import {
  changeStaffPin,
  updateStaffProfile,
  validateDateOfBirth,
  findStaffById,
  sanitizeStaff,
  JOB_TITLE_LABELS,
  type StaffJobTitle,
} from '@/lib/staff-service';
import { staffBranch } from '@/lib/staff-service';
import { listAllBookings } from '@/lib/dbBooking';
import { dbMedicalRecords } from '@/lib/dbMedicalRecords';
import { audit, clientIpFrom } from '@/security/audit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const UPDATE_SCHEMA = z.object({
  action: z.literal('update'),
  fullName: z.string().trim().min(2, 'Tên phải có ít nhất 2 ký tự.').max(100).optional(),
  bio: z.string().trim().max(600, 'Giới thiệu tối đa 600 ký tự.').optional(),
  dateOfBirth: z.string().trim().nullable().optional(),
  /**
   * Only paths that already exist under /public (or a full https URL the clinic
   * hosts) are accepted. An arbitrary string here would become an <img src>
   * that fetches from anywhere — including an internal host the browser can
   * reach but the server cannot.
   */
  avatarUrl: z.string().trim().max(500).nullable().optional(),
});

const PIN_SCHEMA = z.object({
  action: z.literal('pin'),
  currentPin: z.string().trim(),
  nextPin: z.string().trim(),
});

export interface StaffProfileStats {
  confirmedCount: number;
  completedCount: number;
  cancelledCount: number;
  pendingCount: number;
  /** Appointments handled in the last 7 days. */
  thisWeekShifts: number;
  /** Receipts this member issued — the money-side contribution. */
  receiptsIssued: number;
  /** Most recent actions, newest first. */
  recentActivity: Array<{
    id: string;
    kind: 'confirmed' | 'cancelled' | 'completed' | 'diagnosis' | 'receipt';
    at: string;
    title: string;
    detail: string | null;
  }>;
}

/**
 * Statistics derived from the booking + medical-record stores.
 *
 * Counted by `confirmedBy.staffId` rather than `record.staffName`, because the
 * name is free text and two staff could be spelled differently. The name field
 * on a record is also set by whoever last EDITED it, not who first confirmed the
 * booking, so it would attribute a booking to the wrong person.
 */
async function computeStats(staffId: string): Promise<StaffProfileStats> {
  const bookings = await listAllBookings();
  const mine = bookings.filter((b) => b.confirmedBy?.staffId === staffId);

  const byStatus = (status: string) => mine.filter((b) => b.status === status).length;

  const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
  const thisWeekShifts = mine.filter((b) => {
    const at = b.confirmedAt ? new Date(b.confirmedAt).getTime() : 0;
    return at >= weekAgo;
  }).length;

  const records = await dbMedicalRecords.list();
  const myRecords = records.filter((r) => r.staffId === staffId);
  const receiptsIssued = myRecords.filter((r) => r.receipt).length;

  const recentActivity: StaffProfileStats['recentActivity'] = [];

  for (const booking of mine) {
    const at = booking.confirmedAt ?? booking.createdAt;
    if (!booking.confirmedAt) continue;
    recentActivity.push({
      id: `c-${booking.id}`,
      kind: 'confirmed',
      at,
      title: `Xác nhận lịch ${booking.petName}`,
      detail: `${booking.serviceType} · ${booking.time}`,
    });
  }

  for (const record of myRecords) {
    const updatedAt = record.updatedAt ?? record.createdAt;
    if (record.diagnose || record.treatment) {
      recentActivity.push({
        id: `d-${record.id}`,
        kind: 'diagnosis',
        at: updatedAt,
        title: `Cập nhật bệnh án ${record.petName}`,
        detail: record.diagnose ? record.diagnose.slice(0, 80) : null,
      });
    }
    if (record.receipt) {
      recentActivity.push({
        id: `r-${record.id}`,
        kind: 'receipt',
        at: record.receipt.createdAt,
        title: `Xuất hoá đơn ${record.petName}`,
        detail: record.service,
      });
    }
  }

  for (const booking of bookings) {
    if (booking.status !== 'CANCELLED' || !booking.confirmedBy?.staffId || booking.confirmedBy.staffId !== staffId) {
      continue;
    }
    // A cancellation has no separate timestamp column; createdAt + a comment
    // would be a guess, so use the booking's own creation time and label it as
    // the booking rather than pretending it is the cancel time.
    recentActivity.push({
      id: `x-${booking.id}`,
      kind: 'cancelled',
      at: booking.createdAt,
      title: `Huỷ lịch ${booking.petName}`,
      detail: booking.serviceType,
    });
  }

  recentActivity.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return {
    confirmedCount: byStatus('CONFIRMED') + byStatus('COMPLETED'),
    completedCount: byStatus('COMPLETED'),
    cancelledCount: byStatus('CANCELLED'),
    pendingCount: bookings.filter((b) => b.status === 'PENDING').length,
    thisWeekShifts,
    receiptsIssued,
    recentActivity: recentActivity.slice(0, 12),
  };
}

/** Only allow an avatar we can actually render without leaking an arbitrary URL. */
function sanitizeAvatarUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('/')) return trimmed.startsWith('//') ? null : trimmed;
  try {
    const url = new URL(trimmed);
    // http is allowed so a clinic-hosted image over plain HTTP still works on a
    // LAN deployment; the protocol check is what blocks `javascript:` and
    // `data:` payloads, which are the actual XSS vectors for an <img src>.
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return url.toString();
  } catch {
    return null;
  }
}

export async function GET() {
  const session = await requireStaff();
  if ('error' in session) return session.error;

  const record = await findStaffById(session.staff.id);
  if (!record) {
    return NextResponse.json({ message: 'Không tìm thấy tài khoản.' }, { status: 404 });
  }

  const branch = staffBranch(record.branchId);

  return NextResponse.json({
    staff: {
      ...session.staff,
      jobTitleLabel: JOB_TITLE_LABELS[record.jobTitle as StaffJobTitle] ?? record.jobTitle,
      branch: {
        id: branch.id,
        code: branch.code,
        name: branch.address,
        type: branch.type,
      },
    },
    stats: await computeStats(record.id),
  });
}

export async function PATCH(request: NextRequest) {
  const session = await requireStaff();
  if ('error' in session) return session.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: 'Dữ liệu gửi lên không hợp lệ.' }, { status: 400 });
  }

  const action = (body as { action?: unknown } | null)?.action;

  if (action === 'pin') {
    const parsed = PIN_SCHEMA.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: 'Dữ liệu đổi mã PIN không hợp lệ.' }, { status: 400 });
    }
    const result = await changeStaffPin(
      session.staff.id,
      parsed.data.currentPin,
      parsed.data.nextPin
    );
    if (!result.ok) return NextResponse.json({ message: result.error }, { status: 400 });

    await audit('STAFF_PIN_CHANGED', {
      ip: clientIpFrom(request),
      staffId: session.staff.id,
      email: session.staff.email,
      detail: 'self-service PIN change',
    });
    return NextResponse.json({ success: true, message: 'Đã đổi mã PIN.' });
  }

  const parsed = UPDATE_SCHEMA.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      { message: first?.message || 'Dữ liệu không hợp lệ.', field: first?.path[0] },
      { status: 400 }
    );
  }

  if (parsed.data.dateOfBirth) {
    const dobError = validateDateOfBirth(parsed.data.dateOfBirth);
    if (dobError) {
      return NextResponse.json({ message: dobError, field: 'dateOfBirth' }, { status: 400 });
    }
  }

  const patch: Parameters<typeof updateStaffProfile>[1] = {};
  if (parsed.data.fullName !== undefined) patch.fullName = parsed.data.fullName;
  if (parsed.data.bio !== undefined) patch.bio = parsed.data.bio;
  if (parsed.data.dateOfBirth !== undefined) patch.dateOfBirth = parsed.data.dateOfBirth;
  if (parsed.data.avatarUrl !== undefined) patch.avatarUrl = sanitizeAvatarUrl(parsed.data.avatarUrl);

  const updated = await updateStaffProfile(session.staff.id, patch);
  if (!updated) {
    return NextResponse.json({ message: 'Không cập nhật được hồ sơ.' }, { status: 400 });
  }

  // Return the record as it is NOW on disk, not `session.staff`. The session
  // was materialised BEFORE this write, so echoing it back re-sent the pre-edit
  // fullName/bio/avatarUrl and the pre-edit updatedAt — the response described a
  // profile that no longer existed. Any client that trusted the response instead
  // of re-fetching would render the old name until it reloaded, and a caller
  // diffing `updatedAt` to detect a change would see a timestamp that had not
  // moved. sanitizeStaff() keeps the credential columns out, exactly as the
  // session payload was sanitised.
  return NextResponse.json({
    success: true,
    staff: sanitizeStaff(updated),
    message: 'Đã lưu hồ sơ.',
  });
}