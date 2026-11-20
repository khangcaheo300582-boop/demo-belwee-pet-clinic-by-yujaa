import { NextResponse } from 'next/server';
import { requireStaff } from '@/lib/staffSession';

export async function GET() {
  const session = await requireStaff();
  if ('error' in session) return session.error;
  return NextResponse.json({ staff: session.staff });
}
