// app/staff/team/page.tsx
// /staff/team — the employee directory.

import { redirect } from 'next/navigation';
import { getStaffSession } from '@/lib/staffSession';
import { listAllStaff, publicList } from '@/lib/staff-service';
import { buildStaffDirectory } from '@/lib/staffDirectory';
import { roleCan } from '@/lib/staffPermissions';
import StaffTeamClient, { type TeamMember } from '@/components/staff/StaffTeamClient';

export const dynamic = 'force-dynamic';

export default async function StaffTeamPage() {
  const session = await getStaffSession();
  if (!session) redirect('/staff/login');

  const records = await listAllStaff();
  const staff: TeamMember[] = buildStaffDirectory(publicList(records), session.staff.id);

  return (
    <StaffTeamClient
      initialStaff={staff}
      // Granting an account is the one action that hands out further access, so
      // it stays ADMIN-only. Passed down explicitly rather than re-derived in the
      // client, so the UI and the server read the same matrix.
      canGrant={roleCan(session.staff.role, 'staff:grant')}
    />
  );
}