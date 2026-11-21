// app/api/push/unsubscribe/route.ts — hủy đăng ký Web Push (one-click).
//
// GET ?token=<unsubscribeToken> → delete row → 204. Token được lưu ở
// PushSubscription.unsubscribeToken (đã mã hóa động).

import { NextRequest, NextResponse } from 'next/server';
import { dbPushSubscriptions } from '@/lib/pushSubscriptions';

export async function GET(request: NextRequest): Promise<Response> {
  const token = (new URL(request.url).searchParams.get('token') || '').trim();
  if (!token) return NextResponse.json({ ok: false, error: 'Thiếu token' }, { status: 400 });
  const removed = await dbPushSubscriptions.removeByToken(token);
  return NextResponse.json({ ok: true, removed });
}
