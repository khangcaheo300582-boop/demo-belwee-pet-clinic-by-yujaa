import { NextResponse } from 'next/server';
import { requireStaffAction } from '@/lib/staffSession';
import { dbMedicalRecords } from '@/lib/dbMedicalRecords';

export async function GET() {
  const session = await requireStaffAction('appointment:view');
  if ('error' in session) return session.error;

  const records = await dbMedicalRecords.list();
  return NextResponse.json({ records, total: records.length });
}
