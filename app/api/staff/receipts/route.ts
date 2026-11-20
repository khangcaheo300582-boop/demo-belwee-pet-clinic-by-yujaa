import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireStaff, requireStaffAction } from '@/lib/staffSession';
import { dbMedicalRecords } from '@/lib/dbMedicalRecords';
import { dbBooking } from '@/lib/dbBooking';
import { canTransition, normalizeBookingStatus, STATUS_LABELS } from '@/lib/staffAppointments';
import { audit, clientIpFrom } from '@/security/audit';

const CREATE_SCHEMA = z.object({
  recordId: z.string().min(1),
  note: z.string().trim().max(500).nullable().optional(),
  items: z
    .array(
      z.object({
        name: z.string().trim().min(1),
        price: z.number().min(0),
        qty: z.number().int().min(1),
      })
    )
    .min(1)
    .max(100),
});

export async function GET() {
  const session = await requireStaff();
  if ('error' in session) return session.error;

  const records = await dbMedicalRecords.listWithReceipt();
  const receipts = records
    .filter(r => r.receipt)
    .map(r => ({ receipt: r.receipt, record: { id: r.id, petName: r.petName, petType: r.petType, service: r.service, ownerName: r.ownerName, ownerEmail: r.ownerEmail, staffName: r.staffName } }));
  return NextResponse.json({ receipts, total: receipts.length });
}

export async function POST(request: NextRequest) {
  // Issuing a receipt is a money action → billing:write (ADMIN + RECEPTIONIST).
  // A VET is refused with 403 before any validation or disk write happens.
  const session = await requireStaffAction('billing:write');
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
    return NextResponse.json({ message: first?.message || 'Dữ liệu hoá đơn không hợp lệ.' }, { status: 400 });
  }

  // ── Validate BEFORE writing anything ─────────────────────────────
  // Issuing a receipt completes the booking it belongs to, so it is a state
  // transition and must obey the same state machine as
  // PATCH /api/staff/appointments/[id]. Previously this route flipped the
  // booking unconditionally, so a CANCELLED booking that still had a medical
  // record could be pushed back to COMPLETED — a terminal state the PATCH route
  // forbids. Check first, then write.
  const record = await dbMedicalRecords.findById(parsed.data.recordId);
  if (!record) {
    return NextResponse.json({ message: 'Không tìm thấy bệnh án.' }, { status: 404 });
  }
  if (record.receipt) {
    return NextResponse.json({ message: 'Bệnh án này đã có hoá đơn.' }, { status: 409 });
  }

  let linkedBookingStatus: ReturnType<typeof normalizeBookingStatus> | null = null;
  if (record.bookingId) {
    const booking = await dbBooking.findById(record.bookingId);
    if (booking) {
      linkedBookingStatus = normalizeBookingStatus(booking.status);
      if (!canTransition(linkedBookingStatus, 'COMPLETED')) {
        return NextResponse.json(
          {
            message:
              `Lịch hẹn đang ${STATUS_LABELS[linkedBookingStatus]} — không thể xuất hoá đơn. ` +
              'Chỉ xuất hoá đơn cho lịch đã xác nhận.',
          },
          { status: 400 }
        );
      }
    }
  }

  const result = await dbMedicalRecords.createReceipt(parsed.data.recordId, parsed.data.items, parsed.data.note ?? null);
  if (result.error) {
    const conflict = result.error.includes('đã có hoá đơn');
    return NextResponse.json({ message: result.error }, { status: conflict ? 409 : 404 });
  }

  // Nếu bệnh án gốc từ một booking → đánh dấu lịch hẹn HOÀN THÀNH.
  // Skipped when already COMPLETED (canTransition treats that as a no-op).
  if (result.record?.bookingId && linkedBookingStatus && linkedBookingStatus !== 'COMPLETED') {
    await dbBooking.updateStatus(result.record.bookingId, 'COMPLETED');
  }

  await audit('STAFF_RECEIPT_CREATED', {
    ip: clientIpFrom(request),
    staffId: session.staff.id,
    email: session.staff.email,
    detail: `record=${result.record?.id} total=${result.record?.receipt?.totalAmount ?? '?'} items=${parsed.data.items.length}`,
  });
  if (result.record?.bookingId && linkedBookingStatus && linkedBookingStatus !== 'COMPLETED') {
    await audit('STAFF_APPOINTMENT_COMPLETED', {
      ip: clientIpFrom(request),
      staffId: session.staff.id,
      email: session.staff.email,
      detail: `booking=${result.record.bookingId} ${STATUS_LABELS[linkedBookingStatus]} -> COMPLETED (via receipt)`,
    });
  }

  return NextResponse.json({ record: result.record }, { status: 201 });
}
