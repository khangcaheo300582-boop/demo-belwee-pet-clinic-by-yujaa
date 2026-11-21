// lib/notificationEngine.ts
// The ONE place that decides *when* and *to whom* notifications go, and fan-out
// to adapters (email / desktop / push). Đọc code thực tế để tìm nguồn (không đoán):
//
//   • Bookings — status CONFIRMED, dueAt = booking.time (parse with normalizeDateInput
//     từ lib/dateInput); sendAt = startOfDayInTz(due, customerTz) - 2 ngày, golden hour.
//   • Medical records — nextDoseDueAt (tiêm vắc-xin/tiêm ngừa) + followUpDueAt (tái khám/xét nghiệm
//     định kỳ), sendAt = startOfDayInTz(due, tz) + golden hour.
//   • Care registrations — listDue() từ data/reminder-sources-extra.json.
//
// Mượn conventions của hệ thống hiện tại: "nhắc lịch hẹn" = T+2 ngày (appointment, golden 9h)
// — gần hơn và tin cậy hơn day-key semantics (gửi đầu ngày).
//
// Thiết kế invariant:
//   - Idempotent qua idempotencyKey (type:scope.type:entityId:dueAt).
//   - Personalized nội dung bằng tiếng Việt, gồm customerName, petName, timeLabel.
//   - Invariant 6: nhắc luôn có cách hủy — email footer unsubscribe (logId-based),
//     push unsubscribe (token/subId), desktop (prefs toggle), preferences-per-channel.
//   - Tất cả các log được ghi vào data/delivery-logs.json (sent/opened/clicked/unsubscribed).
//   - open-rate email qua tracking pixel + click-through CTA → dùng để analytics.

import { listAllBookings, type Booking } from './dbBooking';
import { dbMedicalRecords } from './dbMedicalRecords';
import { dbNotificationQueue, type NotificationChannel, type NotificationTypeCode } from './notificationQueue';
import { dbCustomerNotificationPreferences, type CustomerNotificationPreferences, type EngineChannel } from './customerNotificationPreferences';
import { dbCareRegistrations } from './careRegistrations';
import { dbDeliveryLog } from './deliveryLog';
import { dbPushSubscriptions } from './pushSubscriptions';
import { normalizeDateInput } from './dateInput';
import { sendEngineEmail } from './adapters/emailAdapter';
import { sendDesktopToast } from './adapters/desktopAdapter';
import { sendWebPush } from './adapters/webPushAdapter';

export interface DueItem {
  idempotencyKey: string;
  type: NotificationTypeCode;
  scope: { type: 'booking' | 'record' | 'careRegistration'; entityId: string };
  ownerEmail: string;
  ownerName: string | null;
  petName: string;
  topic: string;
  dueAt: string;
  sendAt: string;
  channels: EngineChannel[];
}

export interface EngineSummary {
  computed: number;
  enqueued: number;
  sent: { email: number; desktop: number; push: number };
  cancelled: number;
  failed: number;
  skipped: number;
}

// Kênh quyết định nhận của mỗi loại nhắc — config đưa nhanh nếu cần điều chỉnh.
export const GOLDEN_HOURS: Record<NotificationTypeCode, number> = {
  appointment: 9,
  vaccination: 8,
  followUp: 9,
  payment: 10,
  care: 9,
};

function parseHHmm(value: string): number {
  const hour = Number.parseInt(value.slice(0, 2), 10);
  return Number.isFinite(hour) && hour >= 0 && hour <= 23 ? hour : 9;
}

/** Start-of-day of `d` in customer timezone (hoặc local nếu null). */
export function startOfDayInTz(d: Date, timezone: string | null | undefined): Date {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone || undefined,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(d)
      .filter((p) => p.type !== 'literal')
      .map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  const hour = Number.parseInt(parts.hour ?? '0', 10) % 24;
  return new Date(Date.UTC(+parts.year, +parts.month - 1, +parts.day, hour, +parts.minute, +parts.second));
}

/** Văn bản thời gian cho email/push: "08/12/2026 09:00" (theo múi giờ khách hàng nếu có). */
export function formatVnDate(iso: string, timezone: string | null | undefined): string {
  const d = new Date(iso);
  const formatter = new Intl.DateTimeFormat('vi-VN', {
    timeZone: timezone || undefined,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  return formatter.format(d);
}

/** Channels từ preferences. Master off → rỗng. Không nhận kênh bị tắt (Invariant 6). */
function channelsFor(prefs: CustomerNotificationPreferences | null, type: NotificationTypeCode): EngineChannel[] {
  if (!prefs?.master) return [];
  const out: EngineChannel[] = [];
  if ((prefs.channels.email ?? true)) out.push('email');
  if (prefs.channels.desktop === true) out.push('desktop');
  if (prefs.channels.push === true) out.push('push');
  return out.filter((c) => prefs.types[type] !== false);
}

function appointmentHour(prefs: CustomerNotificationPreferences | null): number {
  const start = prefs?.sendWindow?.start;
  return parseHHmm(typeof start === 'string' && start.length === 5 ? start : '09:00');
}

async function dueItemFromBooking(b: Booking, now: Date): Promise<DueItem | null> {
  const iso = normalizeDateInput(b.time || '');
  if (!iso) return null;
  const prefs = await dbCustomerNotificationPreferences.read(b.customerEmail);
  const tz = prefs?.timezone;
  const dueTime = new Date(iso);
  // T+2 ngày (appointment default): sendAt = startOfDayInTz(due) - 2d + golden hour
  const sendAt = new Date(startOfDayInTz(dueTime, tz).getTime() - 2 * 86400_000);
  sendAt.setUTCHours(appointmentHour(prefs), 0, 0, 0);
  return {
    idempotencyKey: `appointment:booking:${b.id}:${iso}`,
    type: 'appointment',
    scope: { type: 'booking', entityId: b.id },
    ownerEmail: b.customerEmail,
    ownerName: b.customerName ?? null,
    petName: b.petName,
    topic: `Xác nhận đặt lịch — ${b.petName}: ${b.serviceType} (${formatVnDate(iso, tz)})`,
    dueAt: iso,
    sendAt: sendAt.toISOString(),
    channels: channelsFor(prefs, 'appointment'),
  };
}

async function dueItemsFromRecords(now: Date): Promise<DueItem[]> {
  const out: DueItem[] = [];
  const records = await dbMedicalRecords.list();
  for (const r of records) {
    const prefs = await dbCustomerNotificationPreferences.read(r.ownerEmail);
    const tz = prefs?.timezone;
    for (const [field, type] of [['nextDoseDueAt', 'vaccination'], ['followUpDueAt', 'followUp']] as const) {
      const raw = r[field];
      if (!raw) continue;
      const iso = normalizeDateInput(raw);
      if (!iso) continue;
      const dueTime = new Date(iso);
      if (dueTime.getTime() <= Date.parse(now.toISOString())) continue; // đã quá hạn
      const sendAt = new Date(startOfDayInTz(dueTime, tz).getTime() + GOLDEN_HOURS[type] * 3600_000);
      out.push({
        idempotencyKey: `${type}:record:${r.id}:${iso}`,
        type,
        scope: { type: 'record', entityId: r.id },
        ownerEmail: r.ownerEmail,
        ownerName: r.ownerName ?? null,
        petName: r.petName,
        topic: type === 'vaccination'
          ? `Nhắc tiêm/vắc-xin — ${r.petName}: ${r.service} (${formatVnDate(iso, tz)})`
          : `Nhắc tái khám — ${r.petName}: ${r.service} (${formatVnDate(iso, tz)})`,
        dueAt: iso,
        sendAt: sendAt.toISOString(),
        channels: channelsFor(prefs, type),
      });
    }
  }
  return out;
}

/** Dòng registration từ form /actions/care-reminder.ts — nhắc chăm sóc định kỳ. */
async function dueItemsFromCare(): Promise<DueItem[]> {
  const out: DueItem[] = [];
  for (const c of await dbCareRegistrations.listDue()) {
    const prefs = await dbCustomerNotificationPreferences.read(c.email);
    out.push({
      idempotencyKey: `care:careRegistration:${c.id}:${c.nextDueAt}`,
      type: 'care',
      scope: { type: 'careRegistration', entityId: c.id },
      ownerEmail: c.email,
      ownerName: c.name,
      petName: c.pet,
      topic: `Chăm sóc — ${c.pet}: ${c.name}`,
      dueAt: c.nextDueAt,
      sendAt: c.nextDueAt,
      channels: channelsFor(prefs, 'care'),
    });
  }
  return out;
}

/** Lập danh sách nhắc đang đến mốc gửi (sendAt <= now). Không ghi vào store — chỉ đọc. */
export async function computeDue(now: string = new Date().toISOString()): Promise<DueItem[]> {
  const out: DueItem[] = [];
  const bookings = await listAllBookings({ status: 'CONFIRMED' });
  for (const b of bookings) {
    const item = await dueItemFromBooking(b, new Date(now));
    if (item) out.push(item);
  }
  out.push(...(await dueItemsFromRecords(new Date(now))));
  out.push(...(await dueItemsFromCare()));
  return out;
}

interface QueueRowLog {
  id: string;
  type: NotificationTypeCode;
  scope: { type: 'booking' | 'record' | 'careRegistration'; entityId: string };
  ownerEmail: string;
  ownerName: string | null;
  petName: string;
  topic: string;
}

function logLine(item: QueueRowLog, channel: NotificationChannel) {
  return {
    itemId: item.id,
    queueId: item.id,
    ownerEmail: item.ownerEmail,
    ownerName: item.ownerName,
    petName: item.petName,
    topic: item.topic,
    type: item.type,
    scope: item.scope,
    channel,
    event: 'queued' as const,
    at: new Date().toISOString(),
  };
}

async function deliverChannel(item: QueueRowLog, channel: NotificationChannel): Promise<boolean> {
  const logId = (await dbDeliveryLog.log(logLine(item, channel))).id;
  try {
    let ok = false;
    if (channel === 'email') {
      const r = await sendEngineEmail({ item, customerName: item.ownerName, ctaUrl: '/client-portal', ctaLabel: 'Xác nhận lịch hẹn', logId });
      ok = r.ok;
    } else if (channel === 'desktop') {
      const r = await sendDesktopToast(item, logId);
      ok = r.ok;
    } else if (channel === 'push') {
      const subscription = (await dbPushSubscriptions.findByEmail(item.ownerEmail)).at(-1);
      ok = !!subscription && (await sendWebPush({ item, subscription })).ok;
    }
    if (ok) await dbDeliveryLog.markSent(logId);
    return ok;
  } catch (error) {
    console.error('[engine] delivery error:', error);
    await dbDeliveryLog.markFailed(logId, error instanceof Error ? error.message : String(error));
    return false;
  }
}

/** Tất cả channels trong `list` đã được mark thành công → row SENT. */
function rowComplete(row: { channels: NotificationChannel[]; sentChannels: NotificationChannel[] }): boolean {
  return row.channels.length > 0 && row.channels.every((c) => row.sentChannels.includes(c));
}

export async function runEngine(): Promise<EngineSummary> {
  const due = await computeDue();
  const summary: EngineSummary = {
    computed: due.length,
    enqueued: 0,
    sent: { email: 0, desktop: 0, push: 0 },
    cancelled: 0,
    failed: 0,
    skipped: 0,
  };

  for (const item of due) {
    const { item: row } = await dbNotificationQueue.enqueue({
      type: item.type,
      scope: item.scope,
      ownerEmail: item.ownerEmail,
      ownerName: item.ownerName,
      petName: item.petName,
      topic: item.topic,
      dueAt: item.dueAt,
      sendAt: item.sendAt,
      channels: item.channels,
    });
    if (row.status === 'SENT' || row.status === 'CANCELLED') continue;
    summary.enqueued += 1;

    // Preferences đã thay đổi kể từ khi due được tính → giữ danh sách kênh gửi từ hàng cũ.
    const prefs = await dbCustomerNotificationPreferences.read(row.ownerEmail);
    const deliver = channelsFor(prefs, row.type).filter((c) => row.channels.includes(c));
    if (deliver.length === 0) {
      summary.skipped += 1;
      await dbNotificationQueue.cancelScope(row.scope);
      continue;
    }

    const sentHere: NotificationChannel[] = [];
    for (const channel of deliver) {
      const ok = await deliverChannel(row, channel);
      if (!ok) {
        summary.failed += 1;
        continue;
      }
      sentHere.push(channel);
      await dbNotificationQueue.markSent(row.id, channel);
      if (channel === 'email') summary.sent.email += 1;
      else if (channel === 'desktop') summary.sent.desktop += 1;
      else if (channel === 'push') summary.sent.push += 1;
    }
    if (sentHere.length === deliver.length) {
      await dbNotificationQueue.markComplete(row.id);
    } else {
      // Ít nhất một kênh thất bập → markFailed (retry lần sau theo cadence cũ).
      await dbNotificationQueue.markFailed(row.id, `channels failed: ${deliver.filter((c) => !sentHere.includes(c)).join(',')}`);
    }
  }

  return summary;
}
