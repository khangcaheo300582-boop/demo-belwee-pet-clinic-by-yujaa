// lib/notificationQueue.test.ts — smoke nhẹ cho engine queue.

import { describe, expect, it } from 'vitest';
import { dbNotificationQueue } from './notificationQueue';

const TEST_ID = `BW_TESTQ_${Date.now().toString(36).slice(-6)}`;

const base = (suffix: string) => ({
  type: 'appointment' as const,
  scope: { type: 'booking' as const, entityId: `${TEST_ID}_${suffix}` },
  ownerEmail: 'testq@belwee.vn',
  ownerName: null as string | null,
  petName: 'Bông',
  topic: `test queue ${suffix}`,
  dueAt: new Date(Date.now() + 60_000).toISOString(),
  sendAt: new Date(Date.now() + 30_000).toISOString(),
  channels: ['email' as const],
});

describe('notification queue', () => {
  it('enqueue idempotent theo idempotencyKey (cùng key → created=false)', async () => {
    const scope = { type: 'booking' as const, entityId: `${TEST_ID}_a` };
    const input = { ...base('a'), scope };
    const a = await dbNotificationQueue.enqueue(input);
    const b = await dbNotificationQueue.enqueue(input);
    expect(a.created).toBe(true);
    expect(b.created).toBe(false);
    expect(b.item.id).toBe(a.item.id);
    expect(a.item.status).toBe('QUEUED');
    expect(a.item.idempotencyKey).toContain(scope.entityId);
  });

  it('cancelScope nhắc theo scope → CANCELLED (invariant 6: không nhắc người đã từ chối)', async () => {
    const scope = { type: 'booking' as const, entityId: `${TEST_ID}_b` };
    const { item } = await dbNotificationQueue.enqueue({ ...base('b'), scope });
    const modified = await dbNotificationQueue.cancelScope(scope);
    expect(modified).toBe(1);
    const after = await dbNotificationQueue.findById(item.id);
    expect(after?.status).toBe('CANCELLED');
  });

  it('markSent + markComplete → SENT', async () => {
    const { item } = await dbNotificationQueue.enqueue(base('c'));
    await dbNotificationQueue.markSent(item.id, 'email');
    await dbNotificationQueue.markComplete(item.id);
    const after = await dbNotificationQueue.findById(item.id);
    expect(after?.status).toBe('SENT');
  });

  it('list filters theo status/type/email', async () => {
    const { item } = await dbNotificationQueue.enqueue(base('d'));
    const queued = await dbNotificationQueue.list({ status: 'QUEUED', type: 'appointment' });
    expect(queued.some((r) => r.id === item.id)).toBe(true);
  });
});
