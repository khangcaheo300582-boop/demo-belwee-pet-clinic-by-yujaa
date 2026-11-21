// app/api/push/unsubscribe/route.ts — hủy đăng ký Web Push (one-click).
//
// GET ?token=<unsubscribeToken> → delete row → 204. Token được lưu ở
// PushSubscription.unsubscribeToken (đã mã hóa động).

import { NextRequest, NextResponse } from 'next/server';
import { dbPushSubscriptions } from '@/lib/pushSubscriptions';

export async function GET(request: NextRequest): Promise<Response> {
  const searchParams = new URL(request.url).searchParams;
  const token = (searchParams.get('token') || '').trim();
  const subId = (searchParams.get('subId') || '').trim();
  if (!token && !subId) {
    return NextResponse.json({ ok: false, error: 'Thiếu token hoặc subId' }, { status: 400 });
  }
  if (token) {
    const removed = await dbPushSubscriptions.removeByToken(token);
    return NextResponse.json({ ok: true, removed });
  }
  const removed = await dbPushSubscriptions.removeBySubId(subId);
  return NextResponse.json({ ok: true, removed });
}
