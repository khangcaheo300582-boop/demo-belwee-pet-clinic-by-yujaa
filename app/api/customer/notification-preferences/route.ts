// app/api/customer/notification-preferences/route.ts — Pref của khách (session).
//   GET  → { prefs } (prefs null nếu chưa set — client dùng defaults)
//   PUT  → body { master?, channels?, types?, sendWindow?, timezone? } → { prefs }

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/authOptions';
import { dbCustomerNotificationPreferences, type CustomerNotificationPreferences } from '@/lib/customerNotificationPreferences';

export const dynamic = 'force-dynamic';

async function sessionEmail(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return session?.user?.email ?? null;
}

export async function GET(): Promise<Response> {
  const email = await sessionEmail();
  if (!email) return NextResponse.json({ ok: false, error: 'Cần đăng nhập' }, { status: 401 });
  const prefs = await dbCustomerNotificationPreferences.read(email);
  return NextResponse.json({ ok: true, prefs });
}

export async function PUT(request: NextRequest): Promise<Response> {
  const email = await sessionEmail();
  if (!email) return NextResponse.json({ ok: false, error: 'Cần đăng nhập' }, { status: 401 });

  let body: Partial<Pick<CustomerNotificationPreferences, 'master' | 'channels' | 'types' | 'sendWindow' | 'timezone'>>;
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: 'Dữ liệu không hợp lệ' }, { status: 400 });
  }

  const patch: Partial<Pick<CustomerNotificationPreferences, 'master' | 'channels' | 'types' | 'sendWindow' | 'timezone'>> = {};
  if (body.master !== undefined) patch.master = body.master;
  if (body.channels) patch.channels = body.channels;
  if (body.types) patch.types = body.types;
  if (body.sendWindow) patch.sendWindow = body.sendWindow;
  if (body.timezone !== undefined) patch.timezone = body.timezone;

  const prefs = await dbCustomerNotificationPreferences.write(email, patch);
  return NextResponse.json({ ok: true, prefs });
}
