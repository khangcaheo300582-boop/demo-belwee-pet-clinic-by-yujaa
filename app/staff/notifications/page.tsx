// app/staff/notifications/page.tsx — /staff/notifications — màn hình quản trị hệ thống nhắc lịch & thông báo.

import { getStaffSession } from '@/lib/staffSession';
import { redirect } from 'next/navigation';
import StaffNotificationsPanel from '@/components/staff/StaffNotificationsPanel';

export const dynamic = 'force-dynamic';

export default async function StaffNotificationsPage() {
  const session = await getStaffSession();
  if (!session) redirect('/staff/login');

  return (
    <div className="mx-auto min-h-dvh max-w-4xl bg-[#070b16] px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-5">
        <h1 className="text-lg font-bold text-white">Cổng nhắc lịch &amp; thông báo</h1>
        <p className="mt-1 text-xs text-white/50">
          Trạng thái nhắc lịch hẹn/tiêm vắc-xin cho khách (engine cron: POST /api/cron/notifications), hàng đợi, preferences và Web Push subscriptions.
        </p>
      </header>
      <StaffNotificationsPanel />
    </div>
  );
}
