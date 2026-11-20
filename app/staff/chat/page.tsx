// app/staff/chat/page.tsx
// /staff/chat — the internal group chat.

import { redirect } from 'next/navigation';
import { getStaffSession } from '@/lib/staffSession';
import { staffBranch } from '@/lib/staff-service';
import StaffChatClient from '@/components/staff/StaffChatClient';

export const dynamic = 'force-dynamic';

export default async function StaffChatPage() {
  const session = await getStaffSession();
  if (!session) redirect('/staff/login');

  const branch = staffBranch(session.staff.branchId);

  return (
    <StaffChatClient
      staff={{
        id: session.staff.id,
        name: session.staff.name,
        email: session.staff.email,
        avatarUrl: session.staff.avatarUrl,
        branchId: branch.id,
        branchCode: branch.code,
      }}
    />
  );
}