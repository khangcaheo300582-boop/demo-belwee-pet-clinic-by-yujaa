// app/api/bookings/notifications/preference/route.ts
//   GET  → is this customer opted in to booking notifications?
//   POST → opt in / opt out
//
// WHY THE PREFERENCE IS STORED PER CUSTOMER
//   The browser Notification permission is per-origin and can be granted or
//   revoked at any time, and it does NOT survive "clear site data". Storing the
//   choice server-side means the profile page can still say "you have 3 unseen
//   confirmations" after a reload on a new device, and — more importantly — it
//   gives the clinic a list of who actually wants hearing about their pets.
//
// The stored flag gates the TOAST, not the notification record. A confirmation
// is persisted either way: the customer should be able to read it on their
// profile next visit even if they declined the browser prompt.

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/authOptions';
import { dbNotificationPreference } from '@/lib/dbNotificationPreference';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ error: 'Vui lòng đăng nhập.' }, { status: 401 });
  }
  return NextResponse.json({ preference: await dbNotificationPreference.read(email) });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ error: 'Vui lòng đăng nhập.' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Dữ liệu gửi lên không hợp lệ.' }, { status: 400 });
  }

  const enabled = (body as { enabled?: unknown } | null)?.enabled;
  if (typeof enabled !== 'boolean') {
    return NextResponse.json({ error: 'Thiếu trường enabled (boolean).' }, { status: 400 });
  }

  const preference = await dbNotificationPreference.write(email, enabled);
  return NextResponse.json({ preference });
}