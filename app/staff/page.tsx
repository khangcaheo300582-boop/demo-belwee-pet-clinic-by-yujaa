import { redirect } from 'next/navigation';
import { getStaffSession } from '@/lib/staffSession';
import { ensureSeedStaff } from '@/lib/staff-service';

export const dynamic = 'force-dynamic';

export default async function StaffRootPage() {
  await ensureSeedStaff();
  const session = await getStaffSession();

  if (!session) redirect('/staff/login');
  redirect('/staff/dashboard');
}
