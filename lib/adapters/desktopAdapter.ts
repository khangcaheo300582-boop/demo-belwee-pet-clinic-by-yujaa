// lib/adapters/desktopAdapter.ts
// Desktop notification adapter — in-app toast via SSE (existing hot path).
//
// Uses dbNotifications (the customer's toast inbox) + lib/realtime.publish on
// userChannel — identical shape to bookingEvents.notifyBookingStatus so the
// existing BookingNotificationListener + toast UI render it unchanged.

import { dbNotifications } from '../dbNotifications';
import { publish } from '../realtime';
import { userChannel } from '../channels';
import type { NotificationQueueItem, NotificationTypeCode } from '../notificationQueue';
import type { EngineItem } from './emailAdapter';

export const TYPE_LABELS: Record<NotificationTypeCode, string> = {
  appointment: 'NHẮC LỊCH HẸN',
  vaccination: 'NHẮC TIÊM VẮC-XIN',
  followUp: 'NHẮC TÁI KHÁM',
  payment: 'NHẮC THANH TOÁN',
  care: 'NHẮC CHĂM SÓC',
};

const TYPE_TITLES = TYPE_LABELS;

export interface DesktopAdapterResult {
  ok: boolean;
  error?: string;
}

/**
 * Toast thông báo cho khách đang mở tab/browser (desktop/iPad/laptop).
 * Toast chỉ hiển thị khi khách đã đăng nhập — giống hệ thống toast hiện có.
 */
export async function sendDesktopToast(item: EngineItem, logId?: string): Promise<DesktopAdapterResult> {
  const title = TYPE_TITLES[item.type] || item.type;
  const body = [item.petName, item.topic].filter(Boolean).join(' · ');

  const notification = await dbNotifications.create({
    email: item.ownerEmail,
    kind: 'booking-confirmed',
    bookingId: item.scope.entityId,
    title,
    body,
    staffName: null,
    staffAvatarUrl: null,
  });

  // Live toast (SSE). Lục hoặc logId nếu hệ thống sau này muốn tracking cho toast.
  void logId;
  publish(userChannel(item.ownerEmail), 'booking-status', {
    ...notification,
    petName: item.petName,
    time: item.topic,
    service: item.topic,
    status: 'CONFIRMED',
    confirmedBy: null,
  });
  return { ok: true };
}
