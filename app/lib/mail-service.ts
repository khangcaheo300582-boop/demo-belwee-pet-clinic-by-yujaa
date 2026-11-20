// app/lib/mail-service.ts
// Single SMTP transport for the whole app (OTP + transactional mail).
//
// WHY THIS FILE OWNS THE TRANSPORT
//   It used to create a Nodemailer transporter at module scope and another one
//   lived in lib/mailer.ts. Two pools meant two sets of sockets, and neither had
//   connection/greeting/socket timeouts — a sleeping laptop or a blocked port
//   465 left the request hanging until Next.js gave up, which the browser showed
//   as "không kết nối được máy chủ" with no useful server log.
//
//   The transport is now created lazily, has hard timeouts, and is discarded
//   after any failure so the next attempt opens a fresh connection instead of
//   reusing a socket Gmail has already closed. lib/mailer.ts delegates here.

import nodemailer, { type SentMessageInfo, type Transporter } from 'nodemailer';
import type { Options as SMTPTransportOptions } from 'nodemailer/lib/smtp-transport';

/**
 * Hard ceilings so a dead SMTP endpoint cannot hang an API route forever.
 * 5s là đủ cho localhost / mạng nội bộ; mọi lần vượt quá đó đều xem như
 * SMTP không reachable hoặc bị chặn và.fail nhanh thay vì đọng request 20s+.
 */
const CONNECTION_TIMEOUT_MS = 5_000;
const GREETING_TIMEOUT_MS = 5_000;
const SOCKET_TIMEOUT_MS = 10_000;

let transporterInstance: Transporter | null = null;

interface MailCredentials {
  user: string;
  pass: string;
}

/**
 * Read the Gmail credentials and fail with a message that names the missing
 * variable. `requireEnv()` normally catches this first, but the mailer is also
 * used by cron/contact routes that do not call it.
 */
function mailCredentials(): MailCredentials {
  const user = process.env.EMAIL_USER?.trim();
  // Google shows app passwords as four groups separated by spaces; users paste
  // them verbatim. SMTP accepts the password without those spaces.
  const pass = process.env.EMAIL_PASS?.replace(/\s+/g, '');
  if (!user || !pass) {
    throw new Error('Thiếu cấu hình email: cần EMAIL_USER và EMAIL_PASS trong .env.local.');
  }
  return { user, pass };
}

function getTransporter(): Transporter {
  if (transporterInstance) return transporterInstance;

  const { user, pass } = mailCredentials();
  // Use Ethereal for testing in dev if using dummy credentials
  if (process.env.NODE_ENV === 'development' && (user.includes('example.com') || user.includes('test') || pass === 'test')) {
    const etherealConfig: SMTPTransportOptions = {
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: user,
        pass: pass,
      },
    };
    transporterInstance = nodemailer.createTransport(etherealConfig);
    return transporterInstance;
  }

  const gmailConfig: SMTPTransportOptions = {
    // Cấu hình SMTP Gmail tường minh — không phụ thuộc vào bảng dịch
    // của service: 'gmail' (mà Nodemailer có thể không nới rộng đúng
    // host/port trên một số thiết lập mạng).
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user, pass },
    // Pool tạm thời tắt (đây cũng là mặc định của Nodemailer, không cần khai
    // báo `pool: false`): trên mạng Windows dev, kết nối pool bị treo
    // và chờ 20-70s cho mỗi request. Mỗi lần gửi mở kết nối mới,
    // đợi 5s, rồi đóng — tin cậy hơn là nhả socket treo lại pool.
    connectionTimeout: CONNECTION_TIMEOUT_MS,
    greetingTimeout: GREETING_TIMEOUT_MS,
    socketTimeout: SOCKET_TIMEOUT_MS,
    // TLS: chỉ nới lỏng ở môi trường dev (antivirus/proxy trên máy dev chèn
    // chứng chỉ self-signed vào TLS chain), production vẫn xác thực chứng chỉ.
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === 'production',
    },
  };
  transporterInstance = nodemailer.createTransport(gmailConfig);

  return transporterInstance;
}

/** Drop the pool so the next send opens a fresh connection. */
function resetTransporter(): void {
  const current = transporterInstance;
  transporterInstance = null;
  try {
    current?.close();
  } catch {
    /* already closed */
  }
}

function errorCode(error: unknown): string {
  return String((error as { code?: unknown } | null)?.code ?? '');
}

/**
 * Only transport-level failures are retried. A bad app password (`EAUTH`) or a
 * rejected recipient (`EENVELOPE`) will fail identically on the second attempt
 * and retrying just doubles the time the user waits for the error.
 */
function isRetryable(error: unknown): boolean {
  return ['ETIMEDOUT', 'ECONNRESET', 'ECONNECTION', 'ESOCKET', 'EDNS', 'ENOTFOUND'].includes(
    errorCode(error)
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendWithRetry(options: nodemailer.SendMailOptions): Promise<SentMessageInfo> {
  const maxAttempts = 2;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await getTransporter().sendMail(options);
    } catch (error) {
      lastError = error;
      // Discard the pooled connection even when we do not retry: a socket that
      // timed out once is not safe to reuse for the next request.
      resetTransporter();
      if (attempt >= maxAttempts || !isRetryable(error)) break;
      await delay(600 * attempt);
    }
  }

  throw lastError;
}

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/** Generic transactional send used by lib/mailer.ts (contact, cron, …). */
export async function sendMail({ to, subject, html, text }: MailMessage): Promise<SentMessageInfo> {
  const { user } = mailCredentials();
  return sendWithRetry({
    from: `"Belwee Pet Clinic" <${user}>`,
    to,
    subject,
    html,
    ...(text ? { text } : {}),
  });
}

/**
 * Optional diagnostic. Not on the send path: `verify()` opens its own
 * connection, and calling it before every OTP would double the SMTP round-trip.
 */
export async function verifyMailer(): Promise<boolean> {
  try {
    await getTransporter().verify();
    return true;
  } catch (error) {
    console.error('[mail-service] SMTP verify thất bại:', error);
    resetTransporter();
    return false;
  }
}

/**
 * Gửi mã xác thực OTP về email của khách hàng/nhân viên.
 *
 * @param toEmail Email người nhận
 * @param otpCode Mã OTP 6 số
 * @param type    Luồng đang yêu cầu mã
 */
export async function sendOtpEmail(
  toEmail: string,
  otpCode: string,
  type: 'register' | 'reset' | 'staff-reset' = 'register'
): Promise<SentMessageInfo> {
  const isReset = type !== 'register';
  const isStaffReset = type === 'staff-reset';

  // In development with fallback credentials, log OTP to console for easy testing
  if (process.env.NODE_ENV === 'development') {
    const user = process.env.EMAIL_USER?.trim();
    const pass = process.env.EMAIL_PASS?.replace(/\s+/g, '');
    if (!user || !pass || user.includes('example.com') || pass.includes('dev')) {
      console.log('\n========================================');
      console.log(`[DEV] OTP for ${toEmail} (${type}): ${otpCode}`);
      console.log('========================================\n');
    }
  }

  return sendMail({
    to: toEmail,
    subject: isStaffReset
      ? '[Belwee Pet Clinic] - Mã OTP Cấp Lại PIN Nhân Viên'
      : isReset
        ? '[Belwee Pet Clinic] - Mã OTP Cấp Lại Mật Khẩu'
        : '[Belwee Pet Clinic] - Mã Xác Thực Kích Hoạt Tài Khoản',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 12px; background-color: #fcfcfc;">
        <h2 style="color: #0ea5e9; text-align: center; text-transform: uppercase;">${isStaffReset ? 'Mã OTP Cấp Lại PIN Nhân Viên' : isReset ? 'Mã OTP Cấp Lại Mật Khẩu' : 'Mã Xác Thực Đăng Ký'}</h2>
        <p>Xin chào,</p>
        <p>Bạn vừa yêu cầu ${isStaffReset ? 'cấp lại mã PIN nhân viên' : isReset ? 'cấp lại mật khẩu' : 'cấp mã xác thực để khởi tạo tài khoản'} tại <b>Belwee Pet Clinic</b>.</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <span style="font-family: monospace; font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #1e293b; background: #e0f2fe; padding: 12px 28px; border-radius: 8px; border: 1px dashed #38bdf8;">
            ${otpCode}
          </span>
        </div>
        
        <p style="font-size: 13px; color: #64748b;">* Mã OTP này có thời hạn hiệu lực trong vòng <b>5 phút</b>. Vui lòng tuyệt đối không chia sẻ mã này cho bất kỳ ai để bảo vệ an toàn danh tính dữ liệu.</p>
        <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 20px 0;" />
        <p style="font-size: 11px; color: #94a3b8; text-align: center;">Đây là email tự động từ máy chủ dịch vụ đám mây của Belwee. Vui lòng không phản hồi trực tiếp thư này.</p>
      </div>
    `,
  });
}

/** Minimal HTML escaping for a value interpolated into the message body. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Web password reset: send a clickable link, not a six-digit code.
 *
 * The v1 web flow used to push the raw reset token through the OTP template,
 * which asked the customer to retype 64 hex characters into a form built for
 * six digits. The link lands on /auth/reset-password?token=…, which the page
 * already reads.
 */
export async function sendPasswordResetEmail(
  toEmail: string,
  resetUrl: string
): Promise<SentMessageInfo> {
  const safeUrl = escapeHtml(resetUrl);

  return sendMail({
    to: toEmail,
    subject: '[Belwee Pet Clinic] - Đặt Lại Mật Khẩu',
    text: [
      'Xin chào,',
      '',
      'Bạn vừa yêu cầu đặt lại mật khẩu tại Belwee Pet Clinic.',
      'Mở liên kết dưới đây để tạo mật khẩu mới:',
      resetUrl,
      '',
      'Liên kết có hiệu lực trong 15 phút và chỉ dùng được một lần.',
      'Nếu bạn không yêu cầu, hãy bỏ qua email này — mật khẩu của bạn không thay đổi.',
    ].join('\n'),
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 12px; background-color: #fcfcfc;">
        <h2 style="color: #0ea5e9; text-align: center; text-transform: uppercase;">Đặt Lại Mật Khẩu</h2>
        <p>Xin chào,</p>
        <p>Bạn vừa yêu cầu đặt lại mật khẩu tại <b>Belwee Pet Clinic</b>. Nhấn vào nút bên dưới để tạo mật khẩu mới.</p>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${safeUrl}" style="display: inline-block; background: #0ea5e9; color: #ffffff; text-decoration: none; font-weight: bold; padding: 14px 32px; border-radius: 8px;">
            Đặt lại mật khẩu
          </a>
        </div>

        <p style="font-size: 13px; color: #64748b;">Nếu nút không hoạt động, hãy sao chép liên kết này vào trình duyệt:</p>
        <p style="font-size: 12px; color: #0ea5e9; word-break: break-all;">${safeUrl}</p>
        <p style="font-size: 13px; color: #64748b;">* Liên kết có hiệu lực trong vòng <b>15 phút</b> và chỉ sử dụng được một lần. Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này — mật khẩu hiện tại vẫn giữ nguyên.</p>
        <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 20px 0;" />
        <p style="font-size: 11px; color: #94a3b8; text-align: center;">Đây là email tự động từ máy chủ dịch vụ đám mây của Belwee. Vui lòng không phản hồi trực tiếp thư này.</p>
      </div>
    `,
  });
}
