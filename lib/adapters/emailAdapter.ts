// lib/adapters/emailAdapter.ts
// Engine email adapter — gửi một notification qua SMTP (app/lib/mail-service).
//
// Personalization v2 của Template 3 (buildReminderEmail trong lib/emailTemplates.ts):
//   - thêm tên khách hàng (customerName), thú cưng, phận màu chuỗi lịch hẹn
//   - escape HTML (scope rộng hơn: petName từ booking được ghi thô).
//   - CTA "Xác nhận lịch hẹn" → /client-portal?notifId=... trên toàn bộ engine
//     (bookingId mới cho quyền vào appointment). Tracking: click → route
//     /api/notifications/track-click?id=<logId>&to=... mark logged + redirect.
//   - Open tracking pixel: img /api/notifications/track?id=<logId>&action=open
//     (dễ chấp nhận — mỗi tin được một id unique).
//   - Footer: Email tự động — unsubscribe link /api/notifications/unsubscribe?token=...
//   - Invariant: Không hứa "đã gửi" khi không gửi thật (mailAdapter nhận boolean).

import { sendMail } from '../../app/lib/mail-service';
import { escapeHtml } from '../escapeHtml';
import type { NotificationQueueItem, NotificationTypeCode } from '../notificationQueue';

/** Engine chỉ cần một subset của NotificationQueueItem ở boundary adapter — Pick tối thiểu để chống lên type ràng buộc chưa cần thiết. */
export type EngineItem = Pick<
  NotificationQueueItem,
  'id' | 'type' | 'scope' | 'ownerEmail' | 'ownerName' | 'petName' | 'topic'
>;

const TYPE_LABELS: Record<NotificationTypeCode, string> = {
  appointment: 'Nhắc lịch hẹn',
  vaccination: 'Nhắc tiêm vắc-xin',
  followUp: 'Nhắc tái khám',
  payment: 'Nhắc thanh toán',
  care: 'Nhắc chăm sóc',
};

export interface EngineEmail {
  subject: string;
  html: string;
  text?: string;
}

export function buildEngineReminderEmail(input: { item: EngineItem; customerName?: string | null; ctaUrl: string; ctaLabel: string; logId?: string }): EngineEmail {
  const { item } = input;
  const customerName = input.customerName?.trim();
  const pet = escapeHtml(item.petName);
  const topic = escapeHtml(item.topic);
  const label = escapeHtml(TYPE_LABELS[item.type] || item.type);

  const opening = customerName ? `Chào ${escapeHtml(customerName)}` : 'Xin chào';

  // CTA link: track click then redirect to target page.
  const to = encodeURIComponent(input.ctaUrl);
  const ctaHref = input.logId
    ? `/api/notifications/track-click?id=${input.logId}&to=${to}`
    : input.ctaUrl;
  // Unsubscribe link (per-channel, stateless token lookup in route).
  const unsubscribeHref = input.logId ? `/api/notifications/unsubscribe?logId=${input.logId}` : '#';

  // Tracking pixel (open rate) — appended at the very top of the body.
  const trackPixel = input.logId
    ? `<img src="/api/notifications/track?id=${encodeURIComponent(input.logId)}&action=open" width="1" height="1" style="display:none" alt="">`
    : '';

  const baseStyle = `font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 0; background: #f8fafc;`;
  const headerStyle = `background: linear-gradient(135deg, #1e3a8a, #2563eb, #0ea5e9); color: white; padding: 28px; text-align: center; border-radius: 16px 16px 0 0;`;
  const bodyStyle = `color: #1e293b; padding: 24px;`;

  const html = `
<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="${baseStyle}">
${trackPixel}
<div style="${headerStyle}">
  <h2 style="margin:0; font-size:20px; letter-spacing:0.5px; font-weight:800;">🐾 ${label} — ${escapeHtml(item.petName)}</h2>
  <p style="margin:8px 0 0; font-size:13px; opacity:0.85;">Belwee Pet Clinic · ${topic}</p>
</div>
<div style="${bodyStyle}">
  <p style="font-size:14px;">${opening},</p>
  <p style="font-size:14px; line-height:1.7;">${topic}</p>
  <p style="text-align:center; margin-top:28px;">
    <a href="${escapeHtml(ctaHref)}" style="background-color:#10b981; color:white; padding:16px 32px; text-decoration:none; border-radius:12px; font-weight:bold; font-size:16px; display:inline-block;">${escapeHtml(input.ctaLabel)}</a>
  </p>
  <p style="text-align:center; font-size:12px; color:#94a3b8; margin-top:16px;">📎 Dành cho nhân viên quản lý lịch hẹn nếu là email quản trị.</p>
  <div style="margin-top:20px; padding:12px 16px; border-radius:8px; background:#ecfdf5; border:1px solid #a7f3d0; text-align:center; font-size:13px; color:#065f46; font-weight:600;">
    💡 Cần đổi lịch hẹn? Gọi trực tiếp: <a href="tel:0772003915" style="color:#065f46; text-decoration:underline;">0772 003 915</a>
  </div>
</div>
<div style="padding:16px 24px; text-align:center; font-size:11px; color:#94a3b8; border-top:1px solid #e2e8f0;">
  © ${new Date().getFullYear()} Belwee Pet Clinic · Email tự động, vui lòng không trả lời trực tiếp.<br>
  <a href="/api/notifications/unsubscribe?logId=${input.logId ?? ''}">Nhấn vào đây để hủy đăng ký nhắc lịch email này.</a>
</div>
</body></html>`;

  const text = [
    `${opening},`,
    '',
    `[${label}] ${item.petName}: ${item.topic}`,
    '',
    `📍 ${input.ctaUrl}`,
    '',
    'Email tự động từ Belwee Pet Clinic. Nếu muốn hủy đăng ký, bấm vào liên kết hủy để phòng khám ghi nhận.',
  ].join('\n');

  return {
    subject: `⏰ ${label}: ${escapeHtml(item.topic)} — Belwee Pet Clinic`,
    html,
    text,
  };
}

/** Kết quả gửi của adapter (boolean, không throw). */
export interface SendEngineEmailResult {
  ok: boolean;
  error?: string;
}

export async function sendEngineEmail(input: { item: EngineItem; customerName?: string | null; ctaUrl: string; ctaLabel: string; logId?: string }): Promise<SendEngineEmailResult> {
  const email = buildEngineReminderEmail(input);
  try {
    await sendMail({ to: input.item.ownerEmail, subject: email.subject, html: email.html, text: email.text });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
