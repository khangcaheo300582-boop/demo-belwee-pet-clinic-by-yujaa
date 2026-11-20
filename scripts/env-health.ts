/**
 * scripts/env-health.ts
 *
 * Kiểm tra nhanh cấu hình `.env.local` mà KHÔNG cần khởi động server.
 *
 * Vì sao cần: Next.js chỉ nạp biến môi trường lúc process khởi động. Một
 * `.env.local` được sửa/khôi phục sau khi `npm run dev` đã chạy sẽ KHÔNG có
 * tác dụng, và triệu chứng duy nhất là /api/auth/send-otp trả 502 "Thiếu cấu
 * hình email". Script này chỉ ra đúng biến nào thiếu và secret nào bị dùng lại,
 * trước khi phải đoán qua log trình duyệt.
 *
 * Chạy:
 *   npm run env:check                          # chỉ kiểm tra sự hiện diện + secret dùng lại
 *   npm run env:check -- --smtp                # thêm kiểm tra đăng nhập SMTP thật (không gửi thư)
 *   npm run env:check -- --smtp --send=EMAIL   # gửi một thư thật để chứng minh thư đến được hộp thư
 */

import './load-env';
import { checkRequiredEnv } from '../lib/env-check';

const REQUIRED = [
  'NEXTAUTH_SECRET',
  'EMAIL_USER',
  'EMAIL_PASS',
  'OTP_HASH_SECRET',
  'STAFF_RECOVERY_CODE',
] as const;

/** Các secret phải khác nhau: dùng chung một giá trị làm giảm độ mạnh của cả hệ. */
const SECRETS = [
  'NEXTAUTH_SECRET',
  'STAFF_SESSION_SECRET',
  'OTP_HASH_SECRET',
  'JWT_SECRET',
  'RESET_TOKEN_HASH_SECRET',
] as const;

const OPTIONAL_HINTS: Record<string, string> = {
  RESET_TOKEN_HASH_SECRET: 'để trống sẽ fallback sang NEXTAUTH_SECRET',
  NEXT_PUBLIC_API_BASE_URL: 'để trống = gọi API cùng origin',
  NEXT_PUBLIC_BASE_URL: 'link trong email dùng NEXTAUTH_URL nếu trống',
  STAFF_COOKIE_SECURE: 'để trống = tự theo giao thức HTTPS',
};

const pad = (text: string, width: number) => text.padEnd(width);
const ok = (value?: string) => Boolean(value && value.trim() !== '');

function line(label: string, value: string) {
  console.log(`  ${pad(label, 30)} ${value}`);
}

const args = new Set(process.argv.slice(2));

console.log('\nBelwee Pet Clinic — kiểm tra biến môi trường (.env.local)\n');

line('NODE_ENV', process.env.NODE_ENV || '(chưa đặt)');
line('Cổng dự kiến', process.env.PORT || '3000');
line('NEXTAUTH_URL', process.env.NEXTAUTH_URL || '(trống)');
line('NEXT_PUBLIC_BASE_URL', process.env.NEXT_PUBLIC_BASE_URL || '(trống)');
console.log('');

// ── 1. Biến bắt buộc ────────────────────────────────────────────────────
const missing = REQUIRED.filter((key) => !ok(process.env[key]));
let failed = false;

console.log('Bắt buộc:');
for (const key of REQUIRED) {
  const present = ok(process.env[key]);
  const secret = SECRETS.includes(key as (typeof SECRETS)[number]);
  const shown = !present ? 'THIẾU' : secret ? `đã đặt (${process.env[key]!.length} ký tự)` : 'đã đặt';
  line(key, present ? `✓ ${shown}` : `✗ ${shown}`);
}
if (missing.length) {
  failed = true;
  console.log(`\n  → Thiếu: ${missing.join(', ')}`);
  console.log('  → Các route dùng requireEnv() sẽ trả 503 cho tới khi bổ sung.');
}

// ── 2. Secret dùng chung ────────────────────────────────────────────────
console.log('\nSecret:');
const groups = new Map<string, string[]>();
for (const key of SECRETS) {
  const value = process.env[key];
  if (!ok(value)) continue;
  const keys = groups.get(value!) || [];
  keys.push(key);
  groups.set(value!, keys);
}
const reused = [...groups.values()].filter((keys) => keys.length > 1);
const shortSecrets = SECRETS.filter((key) => ok(process.env[key]) && process.env[key]!.length < 32);
if (shortSecrets.length) {
  failed = true;
  line('quá ngắn (<32 ký tự)', `✗ ${shortSecrets.join(', ')}`);
} else {
  line('độ dài', '✓ mọi secret đã đặt đều >= 32 ký tự');
}
if (reused.length) {
  failed = true;
  for (const keys of reused) line('dùng chung giá trị', `✗ ${keys.join(' = ')}`);
  console.log('  → Tạo giá trị riêng: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64url\'))"');
} else {
  line('tính riêng biệt', '✓ không có secret nào dùng chung');
}

// ── 3. Biến tùy chọn nhưng dễ gây lỗi khi thiếu ─────────────────────────
console.log('\nTùy chọn:');
for (const [key, hint] of Object.entries(OPTIONAL_HINTS)) {
  line(key, ok(process.env[key]) ? '✓ đã đặt' : `– trống (${hint})`);
}
if (!ok(process.env.GOOGLE_CLIENT_ID) || !ok(process.env.GOOGLE_CLIENT_SECRET)) {
  line('Google OAuth', '– chưa cấu hình (nút đăng nhập Google sẽ không dùng được)');
} else {
  line('Google OAuth', '✓ đã cấu hình');
}

// ── 4. Đối chiếu với requireEnv() của app ───────────────────────────────
const gate = checkRequiredEnv();
line(
  'requireEnv()',
  gate.ok ? '✓ cho phép request đi tiếp' : `✗ sẽ chặn: ${gate.missing.join(', ')}`,
);
if (!gate.ok) failed = true;

// ── 5. SMTP (tùy chọn) ──────────────────────────────────────────────────
/**
 * `tsx` biên dịch script này sang CommonJS, nơi top-level await không được hỗ
 * trợ — nên phần SMTP (bất đồng bộ) được tách ra và nối bằng promise.
 */
async function checkSmtp(): Promise<boolean> {
  console.log('\nSMTP:');
  if (!ok(process.env.EMAIL_USER) || !ok(process.env.EMAIL_PASS)) {
    console.log('  ✗ bỏ qua — cần EMAIL_USER và EMAIL_PASS');
    return false;
  }
  try {
    const { verifyMailer } = await import('../app/lib/mail-service');
    const reachable = await verifyMailer();
    console.log(reachable ? '  ✓ đăng nhập SMTP thành công' : '  ✗ SMTP không phản hồi');
    return reachable;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`  ✗ ${message}`);
    return false;
  }
}

function finish(failed: boolean): never {
  console.log(
    failed
      ? '\nKết luận: cấu hình CHƯA sẵn sàng. Sửa .env.local rồi chạy lại lệnh này.\n'
      : '\nKết luận: cấu hình đầy đủ. Nếu vừa sửa .env.local, hãy restart dev server.\n',
  );
  process.exit(failed ? 1 : 0);
}

// ── 6. Gửi thư thật (tùy chọn) ──────────────────────────────────────────
/**
 * `verify()` chỉ chứng minh đăng nhập SMTP đúng. Nó KHÔNG chứng minh thư thật
 * sự rời khỏi máy chủ và đến được hộp thư — đúng loại lỗi khiến khách báo
 * "bấm gửi mã mà không thấy thư". `--send=EMAIL` gửi một thư thật để kiểm
 * chứng đầu-cuối (kiểm tra cả hộp thư rác).
 */
async function sendTestMail(target: string): Promise<boolean> {
  console.log('\nGửi thử:');
  try {
    const { sendMail } = await import('../app/lib/mail-service');
    const info = await sendMail({
      to: target,
      subject: '[Belwee Pet Clinic] - Thư kiểm tra cấu hình email',
      text: [
        'Đây là thư kiểm tra cấu hình SMTP của Belwee Pet Clinic.',
        '',
        'Nếu bạn đọc được thư này, hệ thống gửi email đang hoạt động và mã OTP',
        'sẽ đến được hộp thư của khách hàng.',
      ].join('\n'),
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 12px;">
          <h2 style="color: #0ea5e9; margin-top: 0;">Kiểm tra cấu hình email</h2>
          <p>Đây là thư kiểm tra cấu hình SMTP của <b>Belwee Pet Clinic</b>.</p>
          <p>Nếu bạn đọc được thư này, hệ thống gửi email đang hoạt động và mã OTP sẽ đến được hộp thư của khách hàng.</p>
        </div>
      `,
    });
    console.log(`  ✓ đã gửi tới ${target} (messageId=${info.messageId ?? 'n/a'})`);
    console.log('  → Mở hộp thư (và cả mục Thư rác) để xác nhận.');
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`  ✗ gửi thất bại: ${message}`);
    return false;
  }
}

const sendArg = process.argv.slice(2).find((arg) => arg.startsWith('--send='));

if (args.has('--smtp')) {
  checkSmtp().then(async (smtpOk) => {
    if (!smtpOk) finish(true);
    const target = (sendArg ? sendArg.slice('--send='.length) : process.env.EMAIL_USER || '').trim();
    const mailOk = target ? await sendTestMail(target) : true;
    finish(failed || !smtpOk || !mailOk);
  });
} else {
  finish(failed);
}

