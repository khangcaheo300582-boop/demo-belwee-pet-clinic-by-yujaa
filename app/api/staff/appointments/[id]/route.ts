// app/api/staff/appointments/[id]/route.ts
// PATCH a booking from the staff queue:
//   { status: 'CONFIRMED' }           → confirm + link medical record
//   { status: 'COMPLETED' }           → finish (only when a receipt exists)
//   { status: 'CANCELLED' }           → cancel
//   { diagnose, treatment, files }    → save diagnosis / attachments
// All responses return the updated appointment in dashboard shape.
//
// Authorisation is per-field, not per-route: one PATCH body can carry a status
// change AND a diagnosis, so the required permissions are collected from the
// parsed body and every one of them must be granted (see lib/staffPermissions.ts).

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireStaff } from '@/lib/staffSession';
import { roleCan, permissionDeniedMessage, type StaffAction } from '@/lib/staffPermissions';
import { dbBooking } from '@/lib/dbBooking';
import { dbMedicalRecords, type MedicalFile } from '@/lib/dbMedicalRecords';
import { notifyBookingStatus } from '@/lib/bookingEvents';
import { audit, clientIpFrom } from '@/security/audit';
import {
  canTransition,
  ensureLinkedRecord,
  normalizeBookingStatus,
  STATUS_LABELS,
  toConfirmedBy,
  toStaffAppointment,
} from '@/lib/staffAppointments';

const FILE_SCHEMA = z.object({
  id: z.string(),
  name: z.string(),
  fileUrl: z.string(),
  fileType: z.string(),
  size: z.number(),
  uploadedAt: z.string().optional(),
});

const PATCH_SCHEMA = z.object({
  status: z.enum(['CONFIRMED', 'COMPLETED', 'CANCELLED']).optional(),
  diagnose: z.string().trim().max(2000).nullable().optional(),
  treatment: z.string().trim().max(2000).nullable().optional(),
  files: z.array(FILE_SCHEMA).max(20).optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireStaff();
  if ('error' in session) return session.error;

  const booking = await dbBooking.findById(params.id);
  if (!booking) {
    return NextResponse.json({ message: 'Không tìm thấy lịch hẹn.' }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: 'Dữ liệu gửi lên không hợp lệ.' }, { status: 400 });
  }

  const parsed = PATCH_SCHEMA.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json({ message: first?.message || 'Dữ liệu không hợp lệ.' }, { status: 400 });
  }

  const nextStatus = parsed.data.status;
  const currentStatus = normalizeBookingStatus(booking.status);
  const hasMedicalPatch = parsed.data.diagnose !== undefined || parsed.data.treatment !== undefined || parsed.data.files !== undefined;

  // ── Authorisation: one PATCH can touch several domains ────────────
  // Completing a booking is a money action (it requires an existing receipt),
  // so it is gated by billing:write rather than by a made-up "complete" role.
  const requiredActions: StaffAction[] = [];
  if (nextStatus === 'CONFIRMED') requiredActions.push('appointment:confirm');
  if (nextStatus === 'CANCELLED') requiredActions.push('appointment:cancel');
  if (nextStatus === 'COMPLETED') requiredActions.push('billing:write');
  if (hasMedicalPatch) requiredActions.push('diagnosis:write');

  const denied = requiredActions.find(action => !roleCan(session.staff.role, action));
  if (denied) {
    await audit('STAFF_ACCESS_DENIED', {
      ip: clientIpFrom(request),
      staffId: session.staff.id,
      email: session.staff.email,
      detail: `${denied} on PATCH /api/staff/appointments/${booking.id}`,
    });
    return NextResponse.json({ message: permissionDeniedMessage(denied) }, { status: 403 });
  }

  // Explicit state machine – a booking can only move along allowed edges.
  // The ALLOWED matrix lives in lib/staffAppointments.ts so this route and
  // POST /api/staff/receipts can never drift apart again.
  if (nextStatus && !canTransition(currentStatus, nextStatus)) {
    return NextResponse.json(
      { message: `Không thể chuyển từ "${STATUS_LABELS[currentStatus]}" sang "${STATUS_LABELS[nextStatus]}".` },
      { status: 400 }
    );
  }

  // ── Xác nhận: booking → CONFIRMED + đảm bảo bệnh án liên kết ─────
  // `confirmedBy` records WHO confirmed it, so the customer sees a name and
  // avatar on their booking instead of a bare "Đã xác nhận".
  const confirmedBy = toConfirmedBy(session.staff);
  if (nextStatus === 'CONFIRMED') {
    const changed = await dbBooking.updateStatus(booking.id, 'CONFIRMED', confirmedBy);
    if (!changed) return NextResponse.json({ message: 'Lịch hẹn không còn tồn tại.' }, { status: 404 });
    const record = await ensureLinkedRecord({ ...booking, status: 'CONFIRMED' }, session.staff);
    if (record) {
      await dbMedicalRecords.update(record.id, {
        status: 'CONFIRMED',
        staffId: session.staff.id,
        staffName: session.staff.name,
      });
    }
  }

  // ── Hoàn tất: chỉ hợp lệ khi bệnh án liên kết đã có hoá đơn ──────
  if (nextStatus === 'COMPLETED') {
    // Booking ở trạng thái hiện tại đã là CONFIRMED (state machine ở trên),
    // nên truyền nguyên `booking` — không cần dựng object trung gian thêm lần nữa.
    const record = await ensureLinkedRecord(booking, session.staff);
    if (!record?.receipt) {
      return NextResponse.json(
        { message: 'Chưa có hoá đơn. Hãy dùng "Hoàn tất & hoá đơn" để xuất hoá đơn trước.' },
        { status: 400 }
      );
    }
    const updatedStatus = await dbBooking.updateStatus(booking.id, 'COMPLETED');
    if (!updatedStatus) {
      return NextResponse.json({ message: 'Không thể hoàn tất lịch hẹn ở trạng thái hiện tại.' }, { status: 409 });
    }
  }

  // ── Huỷ lịch: booking → CANCELLED (token xác nhận bị vô hiệu hoá) ─
  if (nextStatus === 'CANCELLED') {
    const updatedStatus = await dbBooking.updateStatus(booking.id, 'CANCELLED');
    if (!updatedStatus) {
      return NextResponse.json({ message: 'Không thể huỷ lịch hẹn ở trạng thái hiện tại.' }, { status: 409 });
    }
  }

  // ── Chẩn đoán / hướng điều trị / file ─────────────────────────────
  if (hasMedicalPatch) {
    const statusForRecord = nextStatus === 'CONFIRMED' ? 'CONFIRMED' : booking.status;
    // ensureLinkedRecord() returns null for PENDING / CANCELLED (not actionable),
    // so fall back to the record that already exists. Without this fallback a
    // diagnosis sent together with a cancellation was silently dropped.
    const ensured = await ensureLinkedRecord({ ...booking, status: statusForRecord }, session.staff);
    const record = ensured ?? (await dbMedicalRecords.findByBookingId(booking.id));
    if (!record) {
      return NextResponse.json(
        { message: 'Chỉ ghi chẩn đoán được sau khi lịch hẹn đã xác nhận.' },
        { status: 400 }
      );
    }
    await dbMedicalRecords.update(record.id, {
      ...(parsed.data.diagnose !== undefined ? { diagnose: parsed.data.diagnose } : {}),
      ...(parsed.data.treatment !== undefined ? { treatment: parsed.data.treatment } : {}),
      ...(parsed.data.files ? { files: parsed.data.files as MedicalFile[] } : {}),
      // Trạng thái bệnh án chỉ nhận CONFIRMED / COMPLETED (không có CANCELLED).
      ...(nextStatus === 'CONFIRMED' || nextStatus === 'COMPLETED' ? { status: nextStatus } : {}),
      staffId: session.staff.id,
      staffName: session.staff.name,
    });
    await audit('STAFF_DIAGNOSIS_SAVED', {
      ip: clientIpFrom(request),
      staffId: session.staff.id,
      email: session.staff.email,
      // Never log clinical text — only the fact that the record changed.
      detail: `record=${record.id} booking=${booking.id} files=${parsed.data.files?.length ?? 'unchanged'}`,
    });
  }

  // ── Audit the state changes ───────────────────────────────────────
  // Only events that actually mutated the booking are logged, so a plain
  // "create the record" no-op PATCH (status CONFIRMED on an already-CONFIRMED
  // booking) does not spam the log with a false "confirmed" event.
  if (nextStatus && nextStatus !== currentStatus) {
    const event =
      nextStatus === 'CONFIRMED'
        ? 'STAFF_APPOINTMENT_CONFIRMED'
        : nextStatus === 'CANCELLED'
          ? 'STAFF_APPOINTMENT_CANCELLED'
          : 'STAFF_APPOINTMENT_COMPLETED';
    await audit(event, {
      ip: clientIpFrom(request),
      staffId: session.staff.id,
      email: session.staff.email,
      detail: `booking=${booking.id} ${STATUS_LABELS[currentStatus]} -> ${STATUS_LABELS[nextStatus]}`,
    });
  }

  const updated = await dbBooking.findById(booking.id);
  if (!updated) return NextResponse.json({ message: 'Lịch hẹn không còn tồn tại.' }, { status: 404 });
  // Giữ bệnh án liên kết (nếu có từ trước) kể cả khi lịch đã bị huỷ.
  const ensured = await ensureLinkedRecord(updated, session.staff);
  const linked = ensured ?? (await dbMedicalRecords.findByBookingId(updated.id)) ?? null;

  // Tell the customer — persisted first, then pushed live. Only on a REAL
  // transition: the dashboard calls this route with `status: CONFIRMED` as a
  // no-op to materialise a medical record, and re-notifying on that would pop a
  // toast every time someone opened the diagnosis editor.
  if (nextStatus && nextStatus !== currentStatus) {
    await notifyBookingStatus(booking.id, nextStatus, session.staff);
  }

  return NextResponse.json({ appointment: toStaffAppointment(updated, linked) });
}