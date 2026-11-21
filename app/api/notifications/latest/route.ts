// app/api/notifications/latest/route.ts — SW fetch: lấy nội dung nhắc mới nhất của subscription.
//
// SW (public/sw.js) call khi push đến mà không có payload (Chrome): server tra
// content từ DeliveryLog (latest row event='sent' cho ownerEmail của subscription).
// SubscriptionId (subId) là hash của endpoint — SW không biết email, server
// map ra subscription row (lưu email + subId).

import { NextRequest, NextResponse } from 'next/server';
import { dbPushSubscriptions } from '@/lib/pushSubscriptions';
import { dbDeliveryLog } from '@/lib/deliveryLog';
import { TYPE_LABELS } from '@/lib/adapters/desktopAdapter';

export async function GET(request: NextRequest): Promise<Response> {
  const subId = (new URL(request.url).searchParams.get('subId') || '').trim();
  if (!subId) return NextResponse.json({ ok: false, error: 'Thiếu subId' }, { status: 400 });
  const sub = await dbPushSubscriptions.findBySubId(subId);
  if (!sub) return NextResponse.json({ ok: false, error: 'Không tìm thấy subscription' }, { status: 404 });

  const rows = await dbDeliveryLog.list({ ownerEmail: sub.email, event: 'sent', limit: 3 });
  const row = rows[0];
  if (!row) return NextResponse.json({ ok: false, error: 'Không có nội dung mới' }, { status: 404 });

  return NextResponse.json({
    ok: true,
    id: row.id,
    title: `${TYPE_LABELS[row.type] || row.type} — ${row.petName}`,
    body: row.topic,
    url: '/client-portal',
    icon: '/icon-512.png',
    subId,
  });
}
