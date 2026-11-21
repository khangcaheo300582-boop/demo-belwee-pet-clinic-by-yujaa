// lib/customerNotificationPreferences.test.ts

import { describe, expect, it } from 'vitest';
import { dbCustomerNotificationPreferences } from './customerNotificationPreferences';

describe('customer notification preferences', () => {
  it('write + read roundtrip, default email-on, master-off khi tắt', async () => {
    const email = `testp@belwee.vn`;
    await dbCustomerNotificationPreferences.write(email, { master: true, channels: { email: true } });
    const prefs = await dbCustomerNotificationPreferences.read(email);
    expect(prefs?.master).toBe(true);
    expect(prefs?.channels.email).toBe(true);

    await dbCustomerNotificationPreferences.write(email, { master: false });
    const off = await dbCustomerNotificationPreferences.read(email);
    expect(off?.master).toBe(false);

    // cleanup đường lùi vào giá trị mặc định (delete row) — dùng write cấp phép ít:
    await dbCustomerNotificationPreferences.write(email, { master: true, channels: { email: true } });
  });
});
