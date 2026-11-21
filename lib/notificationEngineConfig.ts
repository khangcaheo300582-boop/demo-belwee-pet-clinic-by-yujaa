// lib/notificationEngineConfig.ts
// Runtime-sourced engine config values (VAPID public key for the client).
//
// NEXT_PUBLIC_VAPID_PUBLIC_KEY: VAPID_PUBLIC_KEY đã tạo trước đó bởi web-push (X.509 P-256 point).
// Đây là *public* key — không phải secret, bảo toàn cho page client (Sw subscription).

export const NEXT_PUBLIC_VAPID_PUBLIC_KEY: string | null = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() || null;
