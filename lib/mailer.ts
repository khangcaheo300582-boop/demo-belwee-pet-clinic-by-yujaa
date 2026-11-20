// lib/mailer.ts
// Lớp tương thích cho các route cũ (liên hệ, xác nhận, cron nhắc lịch).
//
// WHY THIS FILE NO LONGER OWNS A TRANSPORTER
//   app/lib/mail-service.ts là nơi DUY NHẤT giữ SMTP pool. Trước đây file này
//   tự tạo một transporter thứ hai, nên mỗi tiến trình mở hai bộ socket tới
//   Gmail và không bộ nào có timeout kết nối/greeting/socket. Hai pool cũng
//   khiến việc reset sau lỗi chỉ áp dụng cho một nửa hệ thống. Giờ mọi đường
//   gửi mail đều đi qua mail-service, nơi có timeout cứng và retry có kiểm soát.
//
// API ở đây được giữ nguyên (`sendMail` trả boolean, `sendMailAsync` fire-and-
// forget) để các caller hiện có không phải sửa.

import { sendMail as sendTransactionalMail } from '../app/lib/mail-service';

interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Gửi email và trả về `true`/`false` thay vì ném lỗi.
 *
 * Retry/timeout đã nằm trong mail-service. Ở đây chỉ chuyển lỗi cuối cùng thành
 * `false` để các caller cũ (vốn đã xử lý boolean) tiếp tục chạy đúng.
 */
export async function sendMail({ to, subject, html, text }: SendMailOptions): Promise<boolean> {
  try {
    await sendTransactionalMail({ to, subject, html, text });
    return true;
  } catch (error) {
    console.error('📧 Lỗi gửi email:', error);
    return false;
  }
}

/**
 * Fire-and-forget email send – never blocks the caller.
 * Errors are logged but NOT thrown.
 */
export function sendMailAsync(options: SendMailOptions): void {
  // Intentionally not awaiting – fire-and-forget
  void sendMail(options);
}
