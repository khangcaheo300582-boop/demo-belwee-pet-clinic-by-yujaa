import { NextResponse } from 'next/server';
import { requireStaff, setStaffSessionCookie } from '@/lib/staffSession';

export async function POST() {
  const session = await requireStaff();
  if ('error' in session) return session.error;
  await setStaffSessionCookie(session.staff);
  return NextResponse.json({ ok: true });
}
