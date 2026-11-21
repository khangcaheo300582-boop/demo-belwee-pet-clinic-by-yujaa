// lib/adapters/webPushAdapter.ts
// Web Push adapter — Gửi push qua web-push (VAPID) tới PushSubscription của khách.
//
// Design quan trọng về web-push v4:
//   - Signature: sendNotification(subscription, payload, options).
//   - Chrome (dùng VAPID): subscription.keys === null → gửi không có payload;
//     nội dung được lưu server-side và SW sẽ fetch /api/notifications/latest
//     qua subscriptionId → SW showNotification của chính nó.
//   - Safari/Firefox hỗ trợ payload; SW tương lai có thể giải mã payload.
//   - Nếu thiếu VAPID key → { ok:false, retryable:false } (tách riêng — không có
//     đừng nhận push nên tái thử sẽ không giải quyết được vấn đề cấu hình).

import webPush from 'web-push';
import { dbPushSubscriptions } from '../pushSubscriptions';
import type { EngineItem } from './emailAdapter';

export interface WebPushSendInput {
  item: EngineItem;
  subscription: { endpoint: string; p256dh: string | null; auth: string | null };
}

export interface WebPushSendResult {
  ok: boolean;
  retryable?: boolean;
  error?: string;
}

function vapidDetails() {
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim() || 'mailto:noreply@belwee.vn';
  if (!privateKey || !publicKey) {
    return null;
  }
  return { subject, privateKey, publicKey };
}

/** Send a push to a subscription. Returns { ok } — errors become retryable/failed per adapter policy. */
export async function sendWebPush(input: WebPushSendInput): Promise<WebPushSendResult> {
  const details = vapidDetails();
  if (!details) {
    return { ok: false, retryable: false, error: 'VAPID keys not configured (VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY)' };
  }
  const { subscription } = input;
  try {
    await webPush.sendNotification(
      {
        endpoint: subscription.endpoint,
        // Chrome desktop (VAPID): keys undefined → no payload; SW fetches content.
        keys: subscription.p256dh && subscription.auth ? { p256dh: subscription.p256dh, auth: subscription.auth } : undefined,
      },
      undefined,
      {
        vapidDetails: details,
        TTL: 3600,
        urgency: 'high',
        contentEncoding: 'aes128gcm',
      },
    );
    await dbPushSubscriptions.markSuccess(subscription.endpoint);
    return { ok: true };
  } catch (error) {
    const err = error instanceof Error ? error.message : String(error);
    console.error('[webpush] send failed:', err);
    await dbPushSubscriptions.markFailed(subscription.endpoint, err);
    return { ok: false, retryable: true, error: err };
  }
}

export function appPushPublicKey(): string | null {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  return key || null;
}
