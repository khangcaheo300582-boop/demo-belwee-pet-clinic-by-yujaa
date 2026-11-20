// app/staff/dashboard/page.tsx
// /staff/dashboard — hàng đợi lịch hẹn (phần lâm sàng + tài chính).
//
// Phải gate ở SERVER bằng đúng quyền mà API dùng (`appointment:view`), không
// chỉ ẩn nút trong UI: nếu vẫn render StaffDashboard cho một vai trò không có
// quyền (role lạ nằm ngoài ma trận), client sẽ gọi GET /api/staff/appointments
// lúc mount, mỗi 45 giây và mỗi lần quay lại tab — mỗi lần một 403 trong
// terminal, còn người dùng chỉ thấy banner "Lỗi 403" thay vì lý do.

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getStaffSession } from '@/lib/staffSession';
import { ensureSeedStaff } from '@/lib/staff-service';
import { permissionDeniedMessage, roleCan } from '@/lib/staffPermissions';
import StaffDashboard from '@/components/staff/StaffDashboard';

export const dynamic = 'force-dynamic';

export default async function StaffDashboardPage() {
  await ensureSeedStaff();
  const session = await getStaffSession();
  if (!session) redirect('/staff/login');

  if (!roleCan(session.staff.role, 'appointment:view')) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#070b16] via-[#0b1322] to-[#0d1526] px-4 pb-24 pt-10 sm:px-6 lg:px-8">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-liquid-mesh" />
        <div className="relative mx-auto flex min-h-[60vh] max-w-xl items-center">
          <div className="w-full rounded-[28px] border border-white/[0.08] bg-white/[0.04] p-8 text-center shadow-[0_32px_80px_-24px_rgba(2,6,23,0.6),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-2xl">
            <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-300/20 bg-amber-400/10 text-amber-300">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
                <rect x="4" y="10" width="16" height="10" rx="2.5" />
                <path d="M8 10V7a4 4 0 0 1 8 0v3" strokeLinecap="round" />
              </svg>
            </span>
            <h1 className="text-lg font-extrabold tracking-tight text-white">
              Không có quyền xem hàng đợi lịch hẹn
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-white/60">
              {permissionDeniedMessage('appointment:view')}{' '}
              Vai trò hiện tại: <strong className="font-semibold text-white/80">{session.staff.role}</strong>.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                href="/staff/team"
                className="rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 px-5 py-2.5 text-sm font-bold text-slate-950 shadow-[0_2px_16px_rgba(34,197,94,0.2)] transition hover:brightness-110"
              >
                Danh sách nhân viên
              </Link>
              <Link
                href="/staff/profile"
                className="rounded-full border border-white/[0.1] bg-white/[0.04] px-5 py-2.5 text-sm font-bold text-white/70 backdrop-blur-xl transition hover:bg-white/[0.08]"
              >
                Trang cá nhân
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <StaffDashboard staff={session.staff} />;
}
