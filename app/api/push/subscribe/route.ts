// app/api/push/subscribe/route.ts — subscribe Web Push (cần session).
//
// Post body: { endpoint, p256dh?, auth?, deviceType? }
// GET → list subscriptions của khách đang dùng session.

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/authOptions';
import { dbPushSubscriptions } from '@/lib/pushSubscriptions';

interface SubscribeBody {
  endpoint?: string;
  p256dh?: string;
  auth?: string;
  deviceType?: string;
}

export async function POST(request: NextRequest): Promise<Response> {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ ok: false, error: 'Cần đăng nhập để đăng ký nhận thông báo Web Push' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as SubscribeBody | null;
  if (!body || typeof body.endpoint !== 'string' || !body.endpoint.trim()) {
    return NextResponse.json({ ok: false, error: 'Thiếu endpoint' }, { status: 400 });
  }

  const sub = await dbPushSubscriptions.upsert({
    email,
    endpoint: body.endpoint.trim(),
    p256dh: body.p256dh,
    auth: body.auth,
    deviceType: body.deviceType,
  });
  return NextResponse.json({ ok: true, sub });
}

export async function GET(): Promise<Response> {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ subs: [] });
  return NextResponse.json({ subs: await dbPushSubscriptions.findByEmail(email) });
}
