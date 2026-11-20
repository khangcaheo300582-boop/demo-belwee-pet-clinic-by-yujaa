import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/authOptions';
import { buildPortalData } from '@/lib/portalData';
import PortalClient from '@/components/portal/PortalClient';

export const dynamic = 'force-dynamic';

export default async function ClientPortalPage() {
  const session = await getServerSession(authOptions);
  const email = (session?.user?.email as string | undefined) || null;
  const name = (session?.user?.name as string | undefined) || null;
  const data = await buildPortalData(email, name);

  return <PortalClient data={data} />;
}
