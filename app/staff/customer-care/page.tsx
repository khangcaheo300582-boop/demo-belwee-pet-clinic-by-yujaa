// app/staff/customer-care/page.tsx
// /staff/customer-care?session=SESS_… — trang nhân viên thực hiện "trò chuyện
// với khách hàng" sau TIẾP NHẬN. Server xác thực phiên đăng nhập staff trước,
// client component chỉ vẽ chuyên để luồng khách (lib/dbCare nội quy).
//
// Vì sao tách khỏi /staff/chat: trang đó là group chat nội bộ với reply,
// reaction, recall — phiên chăm sóc khách chỉ cần hội thoại một-một và nút
// gửi; tách nhánh cho phép chặn phản hồi/emoji/thu hồi ở tầng dữ liệu thay vì
// ở tầng UI.

import { redirect } from 'next/navigation';
import { getStaffSession } from '@/lib/staffSession';
import { staffBranch } from '@/lib/staff-service';
import StaffCustomerCareChat from '@/components/staff/StaffCustomerCareChat';

export const dynamic = 'force-dynamic';

const SESSION_ID_RE = /^SESS_[0-9A-F]{20}$/;

export default async function StaffCustomerCarePage({
  searchParams,
}: {
  searchParams?: { session?: string | string[] };
}) {
  const session = await getStaffSession();
  if (!session) redirect('/staff/login');

  const raw = Array.isArray(searchParams?.session) ? searchParams?.session[0] : searchParams?.session;
  const sessionId = typeof raw === 'string' && SESSION_ID_RE.test(raw) ? raw : null;
  if (!sessionId) redirect('/staff/dashboard');

  const branch = staffBranch(session.staff.branchId);

  return (
    <StaffCustomerCareChat
      staff={{
        id: session.staff.id,
        name: session.staff.name,
        email: session.staff.email,
        avatarUrl: session.staff.avatarUrl,
        branchId: branch.id,
      }}
      sessionId={sessionId}
    />
  );
}
