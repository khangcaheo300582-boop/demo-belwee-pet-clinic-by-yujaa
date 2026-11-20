// app/staff/profile/page.tsx
// /staff/profile — the signed-in staff member's own page.

import { redirect } from 'next/navigation';
import { getStaffSession } from '@/lib/staffSession';
import { findStaffById, JOB_TITLE_LABELS, staffBranch, type StaffJobTitle } from '@/lib/staff-service';
import { listAllBookings } from '@/lib/dbBooking';
import { dbMedicalRecords } from '@/lib/dbMedicalRecords';
import { RULES_VERSION } from '@/lib/staffRules';
import StaffProfileClient, {
  type ProfilePayload,
  type StaffStats,
  type ActivityItem,
} from '@/components/staff/StaffProfileClient';

export const dynamic = 'force-dynamic';

const WEEK_MS = 7 * 24 * 3600 * 1000;

export default async function StaffProfilePage() {
  const session = await getStaffSession();
  if (!session) redirect('/staff/login');

  const record = await findStaffById(session.staff.id);
  if (!record) redirect('/staff/login');

  const branch = staffBranch(record.branchId);

  /**
   * Statistics are attributed by `confirmedBy.staffId`, never by name.
   *
   * The medical record's `staffName` field is set by whoever LAST EDITED the
   * record, not by whoever confirmed the booking — a receptionist adding a file
   * to a vet's appointment would otherwise take all of the vet's numbers. The
   * id is the only stable join.
   */
  const bookings = await listAllBookings();
  const mine = bookings.filter((b) => b.confirmedBy?.staffId === record.id);
  const byStatus = (status: string) => mine.filter((b) => b.status === status).length;

  const weekAgo = Date.now() - WEEK_MS;
  const thisWeekShifts = mine.filter((b) => {
    const at = b.confirmedAt ? new Date(b.confirmedAt).getTime() : 0;
    return at >= weekAgo;
  }).length;

  const myRecords = await dbMedicalRecords.list({ staffId: record.id });

  const stats: StaffStats = {
    confirmedCount: byStatus('CONFIRMED') + byStatus('COMPLETED'),
    completedCount: byStatus('COMPLETED'),
    cancelledCount: byStatus('CANCELLED'),
    pendingCount: bookings.filter((b) => b.status === 'PENDING').length,
    thisWeekShifts,
    receiptsIssued: myRecords.filter((r) => r.receipt).length,
    recordCount: myRecords.length,
    // Seven-day sparkline: bookings this member confirmed, per day.
    weekly: Array.from({ length: 7 }, (_, index) => {
      const day = new Date();
      day.setHours(0, 0, 0, 0);
      day.setDate(day.getDate() - (6 - index));
      const next = day.getTime() + 24 * 3600 * 1000;
      return {
        label: day.toLocaleDateString('vi-VN', { weekday: 'short' }).replace('.', ''),
        value: mine.filter((b) => {
          const at = b.confirmedAt ? new Date(b.confirmedAt).getTime() : 0;
          return at >= day.getTime() && at < next;
        }).length,
      };
    }),
  };

  const activity: ActivityItem[] = [];
  for (const booking of mine) {
    if (!booking.confirmedAt) continue;
    activity.push({
      id: `c-${booking.id}`,
      kind: 'confirmed',
      at: booking.confirmedAt,
      title: `Xác nhận lịch ${booking.petName}`,
      detail: `${booking.serviceType} · ${booking.time}`,
    });
  }
  for (const rec of myRecords) {
    if (rec.diagnose || rec.treatment) {
      activity.push({
        id: `d-${rec.id}`,
        kind: 'diagnosis',
        at: rec.updatedAt ?? rec.createdAt,
        title: `Cập nhật bệnh án ${rec.petName}`,
        detail: rec.diagnose ? rec.diagnose.slice(0, 90) : null,
      });
    }
    if (rec.receipt) {
      activity.push({
        id: `r-${rec.id}`,
        kind: 'receipt',
        at: rec.receipt.createdAt,
        title: `Xuất hoá đơn ${rec.petName}`,
        detail: rec.service,
      });
    }
  }
  activity.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  const payload: ProfilePayload = {
    id: record.id,
    fullName: record.fullName,
    email: record.email,
    dateOfBirth: record.dateOfBirth,
    avatarUrl: record.avatarUrl,
    bio: record.bio,
    role: record.role,
    jobTitle: record.jobTitle,
    jobTitleLabel: JOB_TITLE_LABELS[record.jobTitle as StaffJobTitle] ?? record.jobTitle,
    branch: { id: branch.id, code: branch.code, name: branch.address, type: branch.type },
    lastLoginAt: record.lastLoginAt,
    createdAt: record.createdAt,
    rulesAcknowledgedAt: record.rulesAcknowledgedAt,
    rulesVersion: record.rulesVersion,
    currentRulesVersion: RULES_VERSION,
  };

  return <StaffProfileClient initialProfile={payload} stats={stats} activity={activity.slice(0, 12)} />;
}