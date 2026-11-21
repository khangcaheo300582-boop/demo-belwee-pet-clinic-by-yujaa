// app/api/notifications/unsubscribe/route.ts — one-click unsubscribe (kênh email).
//
// Invariant 6: mọi kênh nhắc có cách hủy. Footer email để dành liên kết
// /api/notifications/unsubscribe?id=<deliveryLogId> — log row chứa ownerEmail
// server-side (không đưa thông tin cá nhân vào URL).
//
// Trả về 204 No Content cho one-click unsubscribe pattern.

import { NextRequest } from 'next/server';
import { dbDeliveryLog } from '@/lib/deliveryLog';
import { dbCustomerNotificationPreferences } from '@/lib/customerNotificationPreferences';

export async function GET(request: NextRequest): Promise<Response> {
  const id = new URL(request.url).searchParams.get('id') || '';
  const log = await dbDeliveryLog.findByLogId(id);
  if (!log) return new Response(null, { status: 404 });

  const email = log.ownerEmail.toLowerCase().trim();
  if (email) {
    await dbCustomerNotificationPreferences.unsubscribe(email, 'email');
    await dbDeliveryLog.markUnsubscribed(log.id);
  }
  return new Response(null, { status: 204 });
}
