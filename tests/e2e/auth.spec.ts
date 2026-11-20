/**
 * tests/e2e/auth.spec.ts
 *
 * End-to-end tests cho module Auth & Password Reset.
 * Chạy trước dev server (`npm run dev` trên http://localhost:3001).
 *
 * Chú ý: Các test này cần database có sẵn ít nhất 1 tài khoản test.
 * Thiết lập MONGODB_URI trong .env.local trước khi chạy.
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3001';

test.describe('Auth Module E2E', () => {
  const TEST_EMAIL = `e2e_${Date.now()}@belwee.test`;
  const TEST_PASSWORD = 'E2e@Test123!';
  const WRONG_PASSWORD = 'Wrong@Pass1!';

  test.beforeEach(async ({ page }) => {
    // Mở trang login
    await page.goto(`${BASE_URL}/auth/login`);
  });

  test('should display login page correctly', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Belwee');
    await expect(page.locator('input[type="text"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole('button', { name: /đăng nhập/i })).toBeVisible();
  });

  test('should show validation error for empty fields', async ({ page }) => {
    await page.getByRole('button', { name: /đăng nhập/i }).click();
    // HTML5 validation should prevent submission
    await expect(page.locator('input[type="text"]')).toHaveAttribute('required');
    await expect(page.locator('input[type="password"]')).toHaveAttribute('required');
  });

  test('should reject wrong credentials with error message', async ({ page }) => {
    await page.locator('input[type="text"]').fill(TEST_EMAIL);
    await page.locator('input[type="password"]').fill(WRONG_PASSWORD);
    await page.getByRole('button', { name: /đăng nhập/i }).click();

    // Kiểm tra xem có thông báo lỗi xuất hiện hay không
    const errorLocator = page.locator('.bg-red-50, .text-red-700, [role="alert"]');
    // Nếu API trả về 401, hiển thị lỗi
    await expect(page.locator('text=Email hoặc mật khẩu không chính xác').first()).toBeVisible({
      timeout: 10000,
    });
  });

  test('should navigate to forgot password page', async ({ page }) => {
    await page.getByRole('button', { name: /quên mật khẩu/i }).click();
    await expect(page).toHaveURL(/.*forgot-password/);
    await expect(page.locator('h2')).toContainText('Quên mật khẩu');
  });

  test('should navigate back to login from forgot password', async ({ page }) => {
    await page.getByRole('button', { name: /quên mật khẩu/i }).click();
    await page.getByRole('button', { name: /quay lại đăng nhập/i }).click();
    await expect(page).toHaveURL(/.*login/);
  });
});

test.describe('Forgot Password E2E', () => {
  const TEST_EMAIL = `e2e_forgot_${Date.now()}@belwee.test`;

  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/auth/forgot-password`);
  });

  test('should display forgot password form', async ({ page }) => {
    await expect(page.locator('h2')).toContainText('Quên mật khẩu');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.getByRole('button', { name: /gửi mã khôi phục/i })).toBeVisible();
  });

  test('should submit forgot password and show success', async ({ page }) => {
    await page.locator('input[type="email"]').fill(TEST_EMAIL);
    await page.getByRole('button', { name: /gửi mã khôi phục/i }).click();

    // Hệ thống luôn trả về 200 (không leak email), nên hiển thị thông báo thành công
    await expect(page.locator('h2')).toContainText('Đã gửi', { timeout: 10000 });
    await expect(page.getByText(/kiểm tra hộp thư email/i)).toBeVisible();
  });

  test('should navigate back to login', async ({ page }) => {
    await page.getByRole('button', { name: /đăng nhập/i }).click();
    await expect(page).toHaveURL(/.*login/);
  });
});

test.describe('Reset Password E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/auth/reset-password`);
  });

  test('should show error when no token provided', async ({ page }) => {
    await expect(page.locator('h2')).toContainText('Lỗi');
    await expect(page.getByText(/không tìm thấy mã khôi phục/i)).toBeVisible();
  });
});

test.describe('Health Check E2E', () => {
  test('should return healthy status', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/health`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.status).toBe('healthy');
    expect(body.db.status).toBe('connected');
  });
});
