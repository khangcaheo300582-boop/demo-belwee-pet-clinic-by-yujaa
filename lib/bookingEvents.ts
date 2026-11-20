// lib/bookingEvents.ts
// The ONE place a booking status change turns into a customer notification.
//
// Called from every route that can move a booking (the staff PATCH route, the
// receipts route, and the email confirmation link). Centralised because the
// requirement is that the customer hears about a confirmation on TWO devices —
// a live toast AND something that survives their tab being closed — and three
// call sites each remembering half of that is how one of them ends up missing.
//
// ORDER MATTERS
//   1. persist to data/notifications.json  (survives a closed tab)
//   2. publish on the customer's SSE channel (live toast)
//
// Persisting first means a crash between the two still leaves a durable record;
// the profile page picks it up as "unseen" on the next visit.

import { dbBooking, type BookingStatus } from './dbBooking';
import {
  dbNotifications,
  NOTIFICATION_COPY,
  bookingNotificationDetail,
  type NotificationKind,
} from './dbNotifications';
import { publish } from './realtime';
import { userChannel } from './channels';

const KIND_BY_STATUS: Partial<Record<BookingStatus, NotificationKind>> = {
  CONFIRMED: 'booking-confirmed',
  CANCELLED: 'booking-cancelled',
  COMPLETED: 'booking-completed',
};

/**
 * Notify the customer that `bookingId` reached `status`.
 *
 * `staffName` / `staffAvatarUrl` are the actor, not the customer — the customer
 * needs to see WHO confirmed so they know who to ask for on arrival.
 *
 * Returns the stored notification, or null when the status is one the customer
 * does not need to hear about (PENDING) or the booking no longer exists.
 */
export async function notifyBookingStatus(
  bookingId: string,
  status: BookingStatus,
  staff: { name?: string | null; avatarUrl?: string | null } | null
): Promise<void> {
  const kind = KIND_BY_STATUS[status];
  if (!kind) return;

  const booking = await dbBooking.findById(bookingId);
  if (!booking) return;

  const copy = NOTIFICATION_COPY[kind];

  // Prefer the confirmed-by recorded on the booking: it is the authoritative
  // answer and survives even if the caller passed nothing.
  const actorName = staff?.name ?? booking.confirmedBy?.name ?? null;
  const actorAvatar = staff?.avatarUrl ?? booking.confirmedBy?.avatarUrl ?? null;

  const notification = await dbNotifications.create({
    email: booking.customerEmail,
    kind,
    bookingId: booking.id,
    title: copy.title,
    body: copy.body(bookingNotificationDetail(booking.petName, booking.time, actorName)),
    staffName: actorName,
    staffAvatarUrl: actorAvatar,
  });

  // Deliver live. The customer channel is keyed by a hash of their email, so
  // the raw address never appears in a URL or an access log.
  publish(userChannel(booking.customerEmail), 'booking-status', {
    ...notification,
    petName: booking.petName,
    time: booking.time,
    service: booking.serviceType,
    status,
    confirmedBy: booking.confirmedBy ?? null,
  });
}