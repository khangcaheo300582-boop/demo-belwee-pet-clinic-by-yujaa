/**
 * tests/api/auth-contract.spec.ts
 *
 * Contract tests cho REST API v1 auth (không cần browser, dùng request fixture).
 * Chạy trước dev server (`npm run dev`).
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3001';

test.describe('Auth API Contract', () => {
  const TEST_EMAIL = `contract_${Date.now()}@belwee.test`;
  const TEST_PASSWORD = 'Contract@Test123!';

  test('POST /api/v1/auth/login - missing credentials', async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/v1/auth/login`, {
      data: {},
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.message).toBeTruthy();
  });

  test('POST /api/v1/auth/login - wrong credentials', async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/v1/auth/login`, {
      data: { identity: TEST_EMAIL, password: TEST_PASSWORD },
    });
    // 401 for wrong credentials or user not found
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('POST /api/v1/auth/forgot-password - always returns 200', async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/v1/auth/forgot-password`, {
      data: { identity: TEST_EMAIL, platform: 'web' },
    });
    // No email enumeration: always 200
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.message).toContain('email');
  });

  test('POST /api/v1/auth/forgot-password - missing identity', async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/v1/auth/forgot-password`, {
      data: {},
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('POST /api/v1/auth/reset-password - missing token/otp', async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/v1/auth/reset-password`, {
      data: { new_password: 'New@Test123!', platform: 'web' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('POST /api/v1/auth/reset-password - weak password', async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/v1/auth/reset-password`, {
      data: {
        token: 'dummy-token',
        new_password: 'weak',
        platform: 'web',
      },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('GET /api/health - healthy', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/health`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.status).toBe('healthy');
    expect(body.db.status).toBe('connected');
    expect(body.responseTimeMs).toBeGreaterThanOrEqual(0);
  });

  test('GET /api/v1/metrics - returns metrics', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/v1/metrics`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.metrics)).toBe(true);
  });
});
