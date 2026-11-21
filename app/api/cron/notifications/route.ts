// app/api/cron/notifications/route.ts — engine tick (the NEW notification system).
//
// Tương tự /api/cron/reminders (auth CRON_SECRET), nhưng mục tiêu là hệ thống
// nhắc đa kênh + đo lường:
//   POST/GET → runEngine() → summary { computed, enqueued, sent{email,desktop,push}, cancelled, failed, skipped }

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { runEngine } from '@/lib/notificationEngine';

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET || process.env.NEXTAUTH_SECRET || '';
  if (!secret) return false;
  const header = request.headers.get('authorization') || '';
  const a = Buffer.from(header);
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function GET(request: NextRequest): Promise<Response> {
  return runEngineRoute(request);
}

export async function POST(request: NextRequest): Promise<Response> {
  return runEngineRoute(request);
}

async function runEngineRoute(request: NextRequest): Promise<Response> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401 });
  }
  try {
    const summary = await runEngine();
    return NextResponse.json({ ok: true, summary });
  } catch (error) {
    console.error('[engine-cron] error:', error);
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 });
  }
}
