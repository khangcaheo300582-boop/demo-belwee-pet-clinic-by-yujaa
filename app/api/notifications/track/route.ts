// app/api/notifications/track/route.ts — tracking pixel + click-through redirect.
//
// Mối quan hệ đo lường:
//   - email-open: pixel (1x1 GIF) gửi ẩn trong email.
//   - CTA click: action=click → mark "clicked" và redirect tới `to`.
// ID dùng là DeliveryLog.id (không lộ email).

import { NextRequest, NextResponse } from 'next/server';
import { dbDeliveryLog } from '@/lib/deliveryLog';

// 1x1 transparent GIF (chuẩn base64, màu đen tương đương transparent).
const GIF_1X1 = 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

export async function GET(request: NextRequest): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const id = (searchParams.get('id') || '').trim();
  const action = searchParams.get('action') || 'open';
  const to = searchParams.get('to') || '/client-portal';

  const log = await dbDeliveryLog.findByLogId(id);
  if (!log) {
    // Return a gif anyway (tracking pixel must not break the CTA flow);
    // the caller cannot retry if we return 404 for the click — but clicks
    // go through redirect, so missing log means 404 is right.
    if (action === 'click') return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    return new Response(Buffer.from(GIF_1X1, 'base64'), {
      headers: { 'Content-Type': 'image/gif', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
    });
  }

  if (action === 'click') {
    await dbDeliveryLog.markClicked(log.id);
    const safeTo = to.startsWith('/') ? to : '/client-portal';
    return NextResponse.redirect(safeTo, 307);
  }
  await dbDeliveryLog.markOpened(log.id);
  return new Response(Buffer.from(GIF_1X1, 'base64'), {
    headers: { 'Content-Type': 'image/gif', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}
