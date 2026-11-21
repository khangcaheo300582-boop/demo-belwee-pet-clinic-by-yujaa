// lib/notificationEngine.test.ts — smoke nhẹ cho engine computeDue + startOfDayInTz.

import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { computeDue, startOfDayInTz } from './notificationEngine';

describe('startOfDayInTz', () => {
  it('start of day UTC+7 trên Asia/Ho_Chi_Minh', () => {
    const d = new Date('2026-12-08T10:00:00Z');
    const start = startOfDayInTz(d, 'Asia/Ho_Chi_Minh');
    // Sàng 14:00 phút... bình thường day start UTC 17:00 UTC+7
    expect(start.getTime()).toBe(Date.UTC(2026, 11, 8, 17, 0, 0));
  });

  it('tự động hoạt động khi timezone null (server local)', () => {
    const d = new Date('2026-12-08T10:00:00Z');
    expect(Number.isNaN(startOfDayInTz(d, null).getTime())).toBe(false);
  });
});

describe('computeDue', () => {
  it('trả appointment item cho fake CONFIRMED booking (read-only, restore file)', async () => {
    const bookingsFile = path.join(process.cwd(), 'data', 'bookings.json');
    const backup = bookingsFile + '.engine-test-bak';
    fs.copyFileSync(bookingsFile, backup);
    try {
      // Prefs cho khách hàng fake — master ON, email ON (để engine cho cần nhận).
      fs.writeFileSync(
        path.join(process.cwd(), 'data', 'customer-notification-preferences.json'),
        JSON.stringify(
          [{
            email: 'teste1@belwee.vn',
            master: true,
            channels: { email: true },
            types: { appointment: true, vaccination: true, followUp: true, payment: true, care: true },
            sendWindow: { start: '09:00', end: '22:00' },
            timezone: null,
            consent: null,
            updatedAt: new Date().toISOString(),
          }],
          null,
          2,
        ),
      );

      const bookings = JSON.parse(fs.readFileSync(bookingsFile, 'utf8')) as Record<string, unknown>[];
      bookings.push({
        id: 'BW_TESTE1',
        customerEmail: 'teste1@belwee.vn',
        customerName: 'Tester',
        customerPhone: '0912345678',
        petName: 'Bông',
        petType: 'Cún',
        serviceType: 'Khám tổng quát',
        time: '2026-12-08 08:25',
        addressName: '',
        status: 'CONFIRMED',
        confirmToken: null,
        confirmedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        tokenExpiresAt: null,
        clientRequestId: 'teste-1',
      });
      fs.writeFileSync(bookingsFile, JSON.stringify(bookings, null, 2));

      const due = await computeDue();
      const mine = due.filter((d) => d.scope.entityId === 'BW_TESTE1');
      expect(mine.length).toBeGreaterThan(0);
      expect(mine[0].type).toBe('appointment');
      expect(mine[0].channels).toContain('email');
      expect(mine[0].sendAt).toBe('2026-12-06T09:00:00.000Z');
    } finally {
      fs.copyFileSync(backup, bookingsFile);
      fs.unlinkSync(backup);
      const prefsFile = path.join(process.cwd(), 'data', 'customer-notification-preferences.json');
      if (fs.existsSync(prefsFile)) fs.unlinkSync(prefsFile);
    }
  });
});
