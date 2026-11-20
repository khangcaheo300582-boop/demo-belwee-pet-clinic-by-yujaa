// app/api/bookings/notifications/route.ts
//   GET  → this customer's notifications (newest first)
//   POST → mark every notification as seen
//
// Auth is the next-auth session; the email is read from it, never from the query
// string. Taking an email as a parameter would let anyone read (and clear) any
// customer's notifications by guessing an address.

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/authOptions';
import { dbNotifications } from '@/lib/dbNotifications';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ error: 'Vui lòng đăng nhập để xem thông báo.' }, { status: 401 });
  }

  const notifications = await dbNotifications.listForEmail(email, 50);
  const unseen = await dbNotifications.listUnseenForEmail(email, 100);

  return NextResponse.json({
    notifications,
    unseenCount: unseen.length,
    email,
  });
}

export async function POST() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ error: 'Vui lòng đăng nhập.' }, { status: 401 });
  }

  const marked = await dbNotifications.markSeenForEmail(email);
  return NextResponse.json({ success: true, marked });
}