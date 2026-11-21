// app/api/admin/notifications/stats/route.ts — Thống kê delivery (open rate, clicked, unsubscribed).

import { NextResponse } from 'next/server';
import { requireStaffAction } from '@/lib/staffSession';
import { dbDeliveryLog } from '@/lib/deliveryLog';
import { NotificationTypeCode } from '@/lib/notificationQueue';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const session = await requireStaffAction('appointment:view');
  if ('error' in session) return session.error;

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [all7, byType, events] = await Promise.all([
    dbDeliveryLog.countBy('type_channel', { since }),
    dbDeliveryLog.countBy('type', { since }),
    dbDeliveryLog.countBy('event', { since }),
  ]);

  const counts = new Map<string, number>();
  for (const { key, value } of all7) counts.set(key, value);
  const stats = {
    byType: byType as Array<{ key: NotificationTypeCode; value: number }>,
    events,
    openRate:
      counts.get('email:opened') ?? 0
        ? (counts.get('email:opened') ?? 0) / (counts.get('email:sent') ?? 1)
        : 0,
  };

  return NextResponse.json(stats);
}
