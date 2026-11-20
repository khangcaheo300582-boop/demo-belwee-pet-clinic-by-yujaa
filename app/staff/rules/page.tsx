// app/staff/rules/page.tsx
// /staff/rules — the code of conduct.

import { redirect } from 'next/navigation';
import { getStaffSession } from '@/lib/staffSession';
import { RULES_VERSION } from '@/lib/staffRules';
import StaffRulesClient from '@/components/staff/StaffRulesClient';

export const dynamic = 'force-dynamic';

export default async function StaffRulesPage() {
  const session = await getStaffSession();
  if (!session) redirect('/staff/login');

  return <StaffRulesClient version={RULES_VERSION} />;
}