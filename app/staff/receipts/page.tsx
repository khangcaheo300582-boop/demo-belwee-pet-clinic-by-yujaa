import { redirect } from 'next/navigation';
import { getStaffSession } from '@/lib/staffSession';
import { dbMedicalRecords } from '@/lib/dbMedicalRecords';
import { ensureSeedStaff } from '@/lib/staff-service';
import ReceiptsClient from '@/components/staff/ReceiptsClient';

export const dynamic = 'force-dynamic';

export default async function StaffReceiptsPage() {
  await ensureSeedStaff();
  const session = await getStaffSession();
  if (!session) redirect('/staff/login');

  const records = await dbMedicalRecords.listWithReceipt();
  const receipts = records
    .filter(r => r.receipt)
    .map(r => ({ receipt: r.receipt!, record: { id: r.id, petName: r.petName, petType: r.petType, service: r.service, ownerName: r.ownerName, ownerEmail: r.ownerEmail, staffName: r.staffName } }));

  return <ReceiptsClient staff={session.staff} initialReceipts={receipts} />;
}
