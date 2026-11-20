// lib/env-check.ts
// Kiểm tra các biến môi trường bắt buộc khi khởi động.
// Gọi `requireEnv()` ở đầu các route cần thiết để báo lỗi rõ ràng
// thay vì trả 503 khi cấu hình chưa đủ.

export interface EnvCheckResult {
  ok: boolean;
  missing: string[];
}

/**
 * Danh sách biến bắt buộc cho toàn hệ thống.
 * Ở production mọi biến phải có giá trị thật (không được rỗng).
 * Ở development, các biến có fallback local được bù tự động — xem DEV_FALLBACKS.
 */
const REQUIRED_ENV: readonly string[] = [
  'NEXTAUTH_SECRET',
  'EMAIL_USER',
  'EMAIL_PASS',
  'OTP_HASH_SECRET',
  'STAFF_RECOVERY_CODE',
];

/**
 * Fallback môi trường development, trùng với fallback đã có trong code:
 * - lib/otpPolicy.ts      → DEV_OTP_HASH_SECRET (qua chuỗi fallback OTP)
 * - lib/staff-service.ts  → 'belwee-development-only-staff-secret'
 *
 * Chỉ được dùng khi NODE_ENV === 'development' VÀ biến đó chưa được cấu hình.
 * Production không bao giờ dùng fallback này.
 *
 * LƯU Ý: EMAIL_USER / EMAIL_PASS KHÔNG có fallback. `app/lib/mail-service.ts`
 * không có giá trị mặc định, nên nếu ta bù ở đây thì requireEnv() cho qua và
 * lỗi thật nổi lên muộn hơn dưới dạng 502 khó hiểu. Thiếu email phải trả 503
 * ngay và nêu đúng tên biến.
 */
const DEV_FALLBACKS: Readonly<Record<string, string>> = {
  OTP_HASH_SECRET: 'belwee-development-only-otp-hash-secret',
  STAFF_RECOVERY_CODE: 'belwee-development-only-staff-recovery',
};

/** Trả về danh sách các biến còn thiếu. */
export function checkRequiredEnv(): EnvCheckResult {
  const missing: string[] = [];
  const isDev = process.env.NODE_ENV === 'development';
  for (const key of REQUIRED_ENV) {
    const value = process.env[key];
    if (value && value.trim() !== '') continue;
    // Development: honor the local-only fallbacks so a fresh clone without
    // .env.local can still run the OTP / login / password-recovery flows.
    // Production: strict — no silent fallbacks.
    if (isDev && DEV_FALLBACKS[key]) continue;
    missing.push(key);
  }
  return { ok: missing.length === 0, missing };
}

/**
 * Nếu thiếu bất kỳ biến bắt buộc nào → trả Response 503 với danh sách rõ ràng.
 * Ngược lại → trả null (yêu cầu được phép tiếp tục).
 */
export function requireEnv(): Response | null {
  const result = checkRequiredEnv();
  if (!result.ok) {
    console.error(
      `[env-check] Thiếu biến môi trường bắt buộc: ${result.missing.join(', ')}`
    );
    return new Response(
      JSON.stringify({
        success: false,
        message: `Hệ thống chưa được cấu hình đầy đủ. Thiếu: ${result.missing.join(', ')}`,
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
  return null;
}
