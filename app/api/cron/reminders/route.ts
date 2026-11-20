// Scheduled job for appointment reminders.

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { listAllBookings, type Booking } from '@/lib/dbBooking';
import { dbReminderQueue } from '@/lib/dbReminderQueue';
import { buildReminderEmail } from '@/lib/emailTemplates';
import { sendMail } from '@/lib/mailer';
import { normalizeDateInput } from '@/lib/portalData';

function cronSecret(): string {
  return process.env.CRON_SECRET || process.env.NEXTAUTH_SECRET || '';
}

function isAuthorized(request: NextRequest): boolean {
  const secret = cronSecret();
  if (!secret) return false;

  const header = request.headers.get('authorization') || '';
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function localDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Give up on a reminder after this many failed delivery attempts.
 *
 * Retrying forever would hammer a dead SMTP endpoint and a permanently invalid
 * address on every cron tick. Three days of retries at the cron cadence is
 * plenty for a transient outage; past that the item is left PENDING with its
 * error recorded so an operator can see it in the queue.
 */
const MAX_SEND_ATTEMPTS = 8;

function bookingTimeLabel(booking: Booking, iso: string | null): string {
  if (iso) {
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleString('vi-VN', {
        weekday: 'long',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  }
  return booking.time || 'theo lịch của phòng khám';
}

export async function GET(request: NextRequest) {
  return runReminderCron(request);
}

export async function POST(request: NextRequest) {
  return runReminderCron(request);
}

async function runReminderCron(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const target = new Date();
  target.setDate(target.getDate() + 2);
  const targetDay = localDayKey(target);

  const bookings = await listAllBookings({ status: 'CONFIRMED' });
  const due: Booking[] = [];
  for (const booking of bookings) {
    const iso = normalizeDateInput(booking.time || '');
    if (!iso) continue;
    if (localDayKey(new Date(iso)) === targetDay) due.push(booking);
  }

  const summary = {
    targetDay,
    dueFound: due.length,
    enqueued: 0,
    sent: 0,
    failed: 0,
    skippedDuplicates: 0,
    skippedExhausted: 0,
    retried: 0,
  };

  for (const booking of due) {
    // enqueue() is idempotent per booking and returns the existing row when one
    // is already there, so a reminder whose mail failed on a previous run comes
    // back as PENDING and is retried below instead of being skipped forever.
    const item = await dbReminderQueue.enqueue({
      bookingId: booking.id,
      petName: booking.petName,
      petType: booking.petType,
      userEmail: booking.customerEmail,
      service: booking.serviceType,
      remindDate: target.toISOString(),
    });

    if (item.status === 'SENT' || item.status === 'CANCELLED') {
      summary.skippedDuplicates += 1;
      continue;
    }

    const attempts = item.attempts ?? 0;
    if (attempts > 0) summary.retried += 1;
    if (attempts >= MAX_SEND_ATTEMPTS) {
      summary.skippedExhausted += 1;
      continue;
    }
    summary.enqueued += 1;

    const iso = normalizeDateInput(booking.time || '');
    const email = buildReminderEmail({
      petName: booking.petName,
      petType: booking.petType,
      service: booking.serviceType,
      bookingId: booking.id,
      timeLabel: bookingTimeLabel(booking, iso),
    });

    const ok = await sendMail({ to: booking.customerEmail, subject: email.subject, html: email.html });
    if (ok) {
      await dbReminderQueue.markSent(item.id);
      summary.sent += 1;
    } else {
      // Record the failure. Without this the item stays indistinguishable from a
      // fresh one and, worse, the old existsByBookingId() check counted it as a
      // duplicate on every later run — so a single transient SMTP error meant
      // the customer was never reminded at all.
      await dbReminderQueue.markFailed(item.id, `sendMail returned false for ${booking.customerEmail}`);
      summary.failed += 1;
    }
  }

  return NextResponse.json({ ok: true, summary });
}
