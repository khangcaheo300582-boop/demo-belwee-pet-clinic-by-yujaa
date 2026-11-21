// lib/adapters/webPushTypes.d.ts
// Minimal ambient declaration cho web-push@4 (gói không tự điền d.ts vào context CJS).
// Có giữ type-only cho các điểm cần thiết, bất cứ điều gì thiếu sẽ được thêm khi dùng thật.

declare module 'web-push' {
  interface vapidDetailsType {
    subject: string;
    privateKey: string;
    publicKey: string;
  }

  interface WebPushOptions {
    vapidDetails?: vapidDetailsType | null;
    TTL?: number;
    urgency?: string;
    contentEncoding?: string;
    headers?: Record<string, string>;
  }

  interface WebPushSubscription {
    endpoint: string;
    keys?: { p256dh: string; auth: string } | null;
    expirationTime?: number | null;
  }

  export function sendNotification(
    subscription: WebPushSubscription,
    payload?: string | Buffer,
    options?: WebPushOptions,
  ): Promise<void>;

  export function generateVAPIDKeys(): { publicKey: string; privateKey: string };

  export function getVapidHeaders(...args: unknown[]): Record<string, string>;
}
