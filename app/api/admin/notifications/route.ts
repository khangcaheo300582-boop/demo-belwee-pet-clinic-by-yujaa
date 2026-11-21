// app/api/admin/notifications/route.ts — Tổng hợp cho màn hình quản trị nhắc lịch.

import { NextResponse } from 'next/server';
import { requireStaffAction } from '@/lib/staffSession';
import { dbNotificationQueue } from '@/lib/notificationQueue';
import { dbCustomerNotificationPreferences } from '@/lib/customerNotificationPreferences';
import { dbPushSubscriptions } from '@/lib/pushSubscriptions';
import { dbDeliveryLog } from '@/lib/deliveryLog';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const session = await requireStaffAction('appointment:view');
  if ('error' in session) return session.error;

  const [summary, prefs, subscriptions, deliveryStats, deliveryEvents] = await Promise.all([
    dbNotificationQueue.summary(),
    dbCustomerNotificationPreferences.list(),
    dbPushSubscriptions.listAll(),
    dbDeliveryLog.countBy('type_channel'),
    dbDeliveryLog.countBy('event'),
  ]);

  return NextResponse.json({ summary, prefs, subscriptions, deliveryStats, deliveryEvents });
}
