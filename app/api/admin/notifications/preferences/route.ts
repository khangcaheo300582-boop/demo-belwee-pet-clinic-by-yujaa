// app/api/admin/notifications/preferences/route.ts — Quản trị preferences khách hàng.
//   GET        → list prefs (staff)
//   PUT /{email} → patch prefs: { master?, channels?, types?, sendWindow?, timezone? }
//                (staff; không chạm vào consent — dữ liệu đồng ý thuộc nhóm opt-in lâu dài)

import { NextRequest, NextResponse } from 'next/server';
import { requireStaffAction } from '@/lib/staffSession';
import { dbCustomerNotificationPreferences, type CustomerNotificationPreferences } from '@/lib/customerNotificationPreferences';

export const dynamic = 'force-dynamic';

type PatchBody = Partial<Pick<CustomerNotificationPreferences, 'master' | 'channels' | 'types' | 'sendWindow' | 'timezone'>>;

export async function GET(): Promise<Response> {
  const session = await requireStaffAction('appointment:view');
  if ('error' in session) return session.error;
  return NextResponse.json({ prefs: await dbCustomerNotificationPreferences.list() });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ email: string }> }): Promise<Response> {
  const session = await requireStaffAction('appointment:view');
  if ('error' in session) return session.error;
  const { email } = await params;

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'Dữ liệu không hợp lệ' }, { status: 400 });
  }

  const patch: PatchBody = {};
  if (body.master !== undefined) patch.master = body.master;
  if (body.channels) patch.channels = body.channels;
  if (body.types) patch.types = body.types;
  if (body.sendWindow) patch.sendWindow = body.sendWindow;
  if (body.timezone !== undefined) patch.timezone = body.timezone;

  const prefs = await dbCustomerNotificationPreferences.write(decodeURIComponent(email), patch);
  return NextResponse.json({ ok: true, prefs });
}
