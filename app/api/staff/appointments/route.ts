// app/api/staff/appointments/route.ts
// Staff queue API – returns EVERY real customer booking (data/bookings.json),
// enriched with the medical record (diagnosis / files / receipt) linked to it.
// No seeded demo data: an empty store means an empty queue.
//
// ⚠ This GET is a PURE READ. It must never write to data/records.json.
//
// It used to call ensureLinkedRecord() for every CONFIRMED/COMPLETED booking,
// which created a missing record on the fly — one full atomic write per
// booking, so a queue of 20 freshly confirmed appointments meant 20 rewrites of
// records.json inside a single GET, and every write bumped the mtime and
// invalidated the read cache for the next iteration. It also made the endpoint
// non-idempotent and invisible to the CSRF/size guards, which only apply to
// mutating methods.
//
// Records are now created explicitly by PATCH /api/staff/appointments/[id]
// (the route that already owns booking mutations) via ensureLinkedRecord().
// The dashboard calls that on demand the first time staff act on a booking.

import { NextResponse } from 'next/server';
import { requireStaffAction } from '@/lib/staffSession';
import { listAllBookings } from '@/lib/dbBooking';
import { dbMedicalRecords } from '@/lib/dbMedicalRecords';
import { toStaffAppointment } from '@/lib/staffAppointments';

export async function GET() {
  const session = await requireStaffAction('appointment:view');
  if ('error' in session) return session.error;

  const bookings = await listAllBookings();
  // Một lần đọc records.json cho cả queue thay vì 2 lookup (ensureLinkedRecord +
  // findByBookingId) trên từng booking → O(n) thay vì O(2n) lần parse file.
  const recordByBookingId = await dbMedicalRecords.listByBookingIds(bookings.map((b) => b.id));

  // Read-only: a booking without a record yet simply reports record: null.
  const appointments = bookings.map((b) =>
    toStaffAppointment(b, recordByBookingId.get(b.id) ?? null)
  );

  return NextResponse.json({ appointments, total: appointments.length });
}
