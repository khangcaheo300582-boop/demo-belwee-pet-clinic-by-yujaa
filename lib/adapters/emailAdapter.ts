// lib/adapters/emailAdapter.ts
// Engine email adapter — gửi một notification nhắc lịch qua SMTP (app/lib/mail-service).
//
// Nội dung email:
//   - Cá nhân hóa: tên khách hàng (customerName), tên thú cưng, loại nhắc, chủ đề.
//   - Escape HTML cho mọi dữ liệu do người dùng/booking nhập (petName, topic, customerName...).
//   - Nút CTA trỏ thẳng tới trang đích (ctaUrl). Hiện chưa có route /api/notifications/track-click
//     nên chưa theo dõi lượt bấm; khi có route đó có thể bọc lại ở biến ctaHref.
//   - Pixel theo dõi lượt mở: /api/notifications/track?id=<logId>&action=open
//   - Chân email: link hủy đăng ký /api/notifications/unsubscribe?logId=<logId>
//
// Quan trọng:
//   - Mọi link trong email PHẢI là URL tuyệt đối (https://tên-miền/...). Đường dẫn tương đối
//     như "/api/..." không mở được trong Gmail/Outlook. Tên miền lấy từ NEXT_PUBLIC_BASE_URL
//     (fallback NEXTAUTH_URL), nên cần đặt đúng giá trị này ở môi trường chạy thật.
//   - Không hứa "đã gửi" khi chưa gửi thật: sendEngineEmail trả về { ok, error } và không throw.

import { sendMail } from "../../app/lib/mail-service";
import { escapeHtml } from "../escapeHtml";
import type {
  NotificationQueueItem,
  NotificationTypeCode,
} from "../notificationQueue";

/**
 * Engine chỉ cần một tập con của NotificationQueueItem ở ranh giới adapter —
 * dùng Pick tối thiểu để không ràng buộc vào các trường chưa cần.
 */
export type EngineItem = Pick<
  NotificationQueueItem,
  "id" | "type" | "scope" | "ownerEmail" | "ownerName" | "petName" | "topic"
>;

const CLINIC_NAME = "Belwee Pet Clinic";
const CLINIC_PHONE_DISPLAY = "0772 003 915";
const CLINIC_PHONE_TEL = "0772003915";

const TYPE_LABELS: Record<NotificationTypeCode, string> = {
  appointment: "Nhắc lịch hẹn",
  vaccination: "Nhắc tiêm vắc-xin",
  followUp: "Nhắc tái khám",
  payment: "Nhắc thanh toán",
  care: "Nhắc chăm sóc",
};

export interface EngineEmail {
  subject: string;
  html: string;
  text?: string;
}

export interface EngineEmailInput {
  item: EngineItem;
  customerName?: string | null;
  ctaUrl: string;
  ctaLabel: string;
  logId?: string;
}

/** Kết quả gửi của adapter (boolean, không throw). */
export interface SendEngineEmailResult {
  ok: boolean;
  error?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Tên miền gốc của site, không có dấu "/" ở cuối. Rỗng nếu chưa cấu hình. */
function getBaseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXTAUTH_URL || "";
  return raw.trim().replace(/\/+$/, "");
}

/** Biến đường dẫn tương đối thành URL tuyệt đối; URL đã tuyệt đối thì giữ nguyên. */
function toAbsoluteUrl(path: string, baseUrl: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  if (!baseUrl) return path;
  return `${baseUrl}${path.startsWith("/") ? "" : "/"}${path}`;
}

/** Chuẩn hóa thành chuỗi một dòng (bỏ xuống dòng, cắt khoảng trắng). */
function plain(value: unknown): string {
  return String(value ?? "")
    .replace(/[\r\n]+/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// Build email
// ---------------------------------------------------------------------------

export function buildEngineReminderEmail(input: EngineEmailInput): EngineEmail {
  const { item } = input;
  const baseUrl = getBaseUrl();
  const abs = (path: string) => toAbsoluteUrl(path, baseUrl);

  // Dữ liệu thô (dùng cho subject và bản text) và dữ liệu đã escape (dùng cho HTML).
  const labelRaw = TYPE_LABELS[item.type] || plain(item.type);
  const petNameRaw = plain(item.petName);
  const topicRaw = plain(item.topic);
  const customerNameRaw = plain(input.customerName);
  const ctaLabelRaw = plain(input.ctaLabel) || "Xem chi tiết";

  const label = escapeHtml(labelRaw);
  const pet = escapeHtml(petNameRaw);
  const topic = escapeHtml(topicRaw);
  const ctaLabel = escapeHtml(ctaLabelRaw);

  const opening = customerNameRaw
    ? `Chào ${escapeHtml(customerNameRaw)}`
    : "Xin chào";
  const openingText = customerNameRaw ? `Chào ${customerNameRaw}` : "Xin chào";

  // --- Các đường link (đều là URL tuyệt đối) ---------------------------------
  // Nút CTA trỏ thẳng tới trang đích.
  const ctaHref = abs(input.ctaUrl);

  // Chỉ có link hủy đăng ký và pixel theo dõi khi có logId.
  const unsubscribeHref = input.logId
    ? abs(
        `/api/notifications/unsubscribe?logId=${encodeURIComponent(input.logId)}`,
      )
    : null;

  const trackPixelSrc = input.logId
    ? abs(
        `/api/notifications/track?id=${encodeURIComponent(input.logId)}&action=open`,
      )
    : null;

  // --- Các khối HTML ---------------------------------------------------------
  const headingText = pet ? `🐾 ${label} — ${pet}` : `🐾 ${label}`;
  const preheader = escapeHtml(
    `${labelRaw}${petNameRaw ? ` · ${petNameRaw}` : ""}: ${topicRaw}`,
  );

  const trackPixel = trackPixelSrc
    ? `<img src="${escapeHtml(trackPixelSrc)}" width="1" height="1" style="display:none;border:0;" alt="">`
    : "";

  const unsubscribeBlock = unsubscribeHref
    ? `<a href="${escapeHtml(unsubscribeHref)}" style="color:#64748b;text-decoration:underline;">Nhấn vào đây để hủy đăng ký nhắc lịch qua email.</a>`
    : `Nếu muốn ngừng nhận nhắc lịch qua email, vui lòng liên hệ phòng khám.`;

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(`${labelRaw} — ${CLINIC_NAME}`)}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1f5f9;">
  <tr>
    <td align="center" style="padding:24px 12px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#f8fafc;border-radius:16px;overflow:hidden;font-family:'Segoe UI',Arial,sans-serif;">
        <tr>
          <td align="center" style="background:#2563eb;background-image:linear-gradient(135deg,#1e3a8a,#2563eb,#0ea5e9);color:#ffffff;padding:28px;">
            <h2 style="margin:0;font-size:20px;letter-spacing:0.5px;font-weight:800;color:#ffffff;">${headingText}</h2>
            <p style="margin:8px 0 0;font-size:13px;color:#e0f2fe;">${escapeHtml(CLINIC_NAME)}${topic ? ` · ${topic}` : ""}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:24px;color:#1e293b;">
            <p style="margin:0 0 12px;font-size:14px;">${opening},</p>
            <p style="margin:0;font-size:14px;line-height:1.7;">${topic}</p>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:28px auto 0;">
              <tr>
                <td align="center" style="background:#10b981;border-radius:12px;">
                  <a href="${escapeHtml(ctaHref)}" style="display:inline-block;padding:16px 32px;color:#ffffff;text-decoration:none;font-weight:bold;font-size:16px;border-radius:12px;">${ctaLabel}</a>
                </td>
              </tr>
            </table>
            <div style="margin-top:24px;padding:12px 16px;border-radius:8px;background:#ecfdf5;border:1px solid #a7f3d0;text-align:center;font-size:13px;color:#065f46;font-weight:600;">
              💡 Cần đổi lịch hẹn? Gọi trực tiếp: <a href="tel:${CLINIC_PHONE_TEL}" style="color:#065f46;text-decoration:underline;">${CLINIC_PHONE_DISPLAY}</a>
            </div>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:16px 24px;font-size:11px;line-height:1.6;color:#94a3b8;border-top:1px solid #e2e8f0;">
            © ${new Date().getFullYear()} ${escapeHtml(CLINIC_NAME)} · Email tự động, vui lòng không trả lời trực tiếp.<br>
            ${unsubscribeBlock}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
${trackPixel}
</body>
</html>`;

  // --- Bản chữ thuần (cho trình đọc mail không hỗ trợ HTML) ------------------
  const text = [
    `${openingText},`,
    "",
    `[${labelRaw}]${petNameRaw ? ` ${petNameRaw}:` : ""} ${topicRaw}`,
    "",
    `${ctaLabelRaw}: ${ctaHref}`,
    "",
    `Cần đổi lịch hẹn? Gọi ${CLINIC_PHONE_DISPLAY}.`,
    "",
    `Email tự động từ ${CLINIC_NAME}.`,
    unsubscribeHref
      ? `Hủy đăng ký nhắc lịch qua email: ${unsubscribeHref}`
      : "Nếu muốn ngừng nhận nhắc lịch qua email, vui lòng liên hệ phòng khám.",
  ].join("\n");

  // Subject là chữ thuần (không phải HTML) nên không escape, chỉ bỏ xuống dòng.
  const subject = `⏰ ${labelRaw}${topicRaw ? `: ${topicRaw}` : ""} — ${CLINIC_NAME}`;

  return { subject, html, text };
}

// ---------------------------------------------------------------------------
// Send email
// ---------------------------------------------------------------------------

export async function sendEngineEmail(
  input: EngineEmailInput,
): Promise<SendEngineEmailResult> {
  const to = plain(input.item.ownerEmail);
  if (!to) {
    return { ok: false, error: "Thiếu địa chỉ email người nhận." };
  }

  try {
    const email = buildEngineReminderEmail(input);
    await sendMail({
      to,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
