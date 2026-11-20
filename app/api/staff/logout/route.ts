import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { clearStaffSessionCookie, getStaffSession } from '@/lib/staffSession';
import { audit, clientIpFrom } from '@/security/audit';

export async function POST(request: NextRequest) {
  const session = await getStaffSession();
  await clearStaffSessionCookie();
  if (session) {
    await audit('STAFF_LOGOUT', {
      ip: clientIpFrom(request),
      staffId: session.staff.id,
      email: session.staff.email,
    });
  }
  return NextResponse.json({ ok: true });
}
