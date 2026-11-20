import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/authOptions';
import { buildCareData } from '@/lib/portalData';
import CareScheduleClient from '@/components/portal/CareScheduleClient';

export const dynamic = 'force-dynamic';

export default async function CareSchedulePage() {
  const session = await getServerSession(authOptions);
  const email = (session?.user?.email as string | undefined) || null;
  const data = await buildCareData(email);

  return <CareScheduleClient data={data} />;
}
