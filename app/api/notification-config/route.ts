// app/api/notification-config/route.ts — public key cho client:
// NEXT_PUBLIC_VAPID_PUBLIC_KEY (VAPID public key — không là secret, dùng để
// subscription theo đúng key engine dùng để gửi push).

import { NextResponse } from 'next/server';
import { NEXT_PUBLIC_VAPID_PUBLIC_KEY } from '@/lib/notificationEngineConfig';

export async function GET(): Promise<Response> {
  return NextResponse.json({ vapidPublicKey: NEXT_PUBLIC_VAPID_PUBLIC_KEY });
}
