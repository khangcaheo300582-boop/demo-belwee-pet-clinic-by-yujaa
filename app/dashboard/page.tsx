'use client';

/**
 * /dashboard — Customer dashboard.
 *
 * Tổng quan lịch hẹn sắp đến, thao tác nhanh và trạng thái sức khỏe thú cưng.
 * Yêu cầu đăng nhập (dùng next-auth session). Nếu chưa đăng nhập, chuyển hướng
 * về trang đăng nhập.
 */

import { useCallback, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import {
  CalendarClock,
  CheckCircle2,
  Clock,
  PawPrint,
  Plus,
  User,
  AlertCircle,
  Mail,
  Phone,
} from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';

interface Appointment {
  id: string;
  service: string;
  petName: string;
  petType?: string;
  time: string;
  date: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  branchName: string;
  doctor?: string;
}

interface Pet {
  id: string;
  name: string;
  species: string;
  breed?: string;
  age?: string;
  lastVisit?: string;
  nextVaccine?: string;
}

const MOCK_APPOINTMENTS: Appointment[] = [
  {
    id: 'appt-001',
    service: 'Khám tổng quát',
    petName: 'Milu',
    petType: 'Chó',
    time: '09:00',
    date: format(new Date(Date.now() + 86400000), 'dd/MM/yyyy'),
    status: 'confirmed',
    branchName: 'Chi nhánh Gò Vấp',
    doctor: 'B.S. Nguyễn Thị Lan',
  },
  {
    id: 'appt-002',
    service: 'Tiêm phòng',
    petName: 'Milu',
    petType: 'Chó',
    time: '14:30',
    date: format(new Date(Date.now() + 7 * 86400000), 'dd/MM/yyyy'),
    status: 'pending',
    branchName: 'Chi nhánh Thủ Đức',
    doctor: 'B.S. Trần Văn Nam',
  },
];

const MOCK_PETS: Pet[] = [
  {
    id: 'pet-001',
    name: 'Milu',
    species: 'Chó',
    breed: 'Golden Retriever',
    age: '3 tuổi',
    lastVisit: '15/10/2026',
    nextVaccine: '20/11/2026',
  },
];

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // All hooks must be called unconditionally at the top.
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login');
    }
  }, [status, router]);

  const handleSignOut = useCallback(() => {
    void signOut({ callbackUrl: '/' });
    router.push('/');
  }, [router]);

  const upcoming = useMemo(
    () => MOCK_APPOINTMENTS.filter((a) => a.status !== 'cancelled'),
    []
  );

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-lg">
              U
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Chào, {session.user?.name || 'Khách hàng'}</h1>
              <p className="text-sm text-gray-500">{session.user?.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSignOut}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Đăng xuất
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 font-medium">Lịch hẹn sắp đến</p>
                <p className="text-2xl font-bold text-gray-900">{upcoming.length}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                <CalendarClock size={24} />
              </div>
            </div>
            {upcoming.length > 0 && (
              <p className="mt-3 text-sm text-gray-500">
                Sớm nhất: {upcoming[0].date} {upcoming[0].time}
              </p>
            )}
          </div>

          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 font-medium">Thú cưng</p>
                <p className="text-2xl font-bold text-gray-900">{MOCK_PETS.length}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center text-green-600">
                <PawPrint size={24} />
              </div>
            </div>
            <p className="mt-3 text-sm text-gray-500">
              Tiêm phòng sắp tới: {MOCK_PETS[0]?.nextVaccine || '—'}
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 font-medium">Đã khám hoàn tất</p>
                <p className="text-2xl font-bold text-gray-900">
                  {MOCK_APPOINTMENTS.filter((a) => a.status === 'completed').length}
                </p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                <CheckCircle2 size={24} />
              </div>
            </div>
            <p className="mt-3 text-sm text-gray-500">
              Lần cuối: {MOCK_PETS[0]?.lastVisit || '—'}
            </p>
          </div>
        </div>

        {/* Upcoming Appointments */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-gray-900">Lịch hẹn sắp đến</h2>
            <Link
              href="/booking/kham-benh"
              className="text-sm font-medium text-blue-600 hover:underline"
            >
              Đặt lịch mới →
            </Link>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {upcoming.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Clock size={32} className="mx-auto mb-3 opacity-50" />
                <p className="font-medium">Bạn chưa có lịch hẹn nào.</p>
                <p className="text-sm">Hãy đặt lịch khám cho bé cưng của bạn.</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {upcoming.map((appt) => (
                  <li key={appt.id} className="p-6 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-600">
                        <PawPrint size={20} />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{appt.petName}</p>
                        <p className="text-sm text-gray-500">{appt.petType}</p>
                      </div>
                    </div>
                    <div className="hidden md:flex flex-col items-end gap-1">
                      <p className="font-medium text-gray-900">{appt.date}</p>
                      <p className="text-sm text-gray-500">{appt.time}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                          appt.status === 'confirmed'
                            ? 'bg-green-100 text-green-700'
                            : appt.status === 'pending'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {appt.status === 'confirmed' ? 'Đã xác nhận' : 'Đang chờ'}
                      </span>
                      <div className="flex items-end gap-2 text-sm">
                        <span className="text-gray-500">{appt.branchName}</span>
                        {appt.doctor && (
                          <span className="text-blue-600 font-medium">{appt.doctor}</span>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Quick Actions */}
        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-6">Thao tác nhanh</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <QuickActionCard
              icon={<Plus size={24} />}
              iconBg="bg-blue-50"
              iconColor="text-blue-600"
              title="Đặt lịch khám"
              desc="Chọn dịch vụ và đặt lịch cho bé cưng"
              href="/booking/kham-benh"
            />
            <QuickActionCard
              icon={<User size={24} />}
              iconBg="bg-indigo-50"
              iconColor="text-indigo-600"
              title="Hồ sơ cá nhân"
              desc="Cập nhật thông tin chủ nuôi"
              href="/trang-ca-nhan"
            />
            <QuickActionCard
              icon={<Mail size={24} />}
              iconBg="bg-purple-50"
              iconColor="text-purple-600"
              title="Liên hệ phòng khám"
              desc="Gọi hoặc nhắn tin hỗ trợ"
              href="/lien-he"
            />
            <QuickActionCard
              icon={<AlertCircle size={24} />}
              iconBg="bg-red-50"
              iconColor="text-red-600"
              title="Cấp cứu 24/7"
              desc="Hotline hỗ trợ khẩn cấp"
              href="tel:0281234567"
            />
          </div>
        </section>

        {/* Pets */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-gray-900">Bé cưng của bạn</h2>
            <Link
              href="/trang-ca-nhan?tab=thucung"
              className="text-sm font-medium text-blue-600 hover:underline"
            >
              Quản lý hồ sơ →
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {MOCK_PETS.map((pet) => (
              <div key={pet.id} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-600">
                    <PawPrint size={18} />
                  </div>
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {pet.species}
                  </span>
                </div>
                <h3 className="font-bold text-gray-900 text-lg">{pet.name}</h3>
                <p className="text-sm text-gray-500">{pet.breed || '—'} • {pet.age}</p>
                <div className="mt-3 space-y-1 text-sm text-gray-600">
                  <p>
                    Lần khám cuối: <span className="font-medium">{pet.lastVisit}</span>
                  </p>
                  <p>
                    Tiêm phòng sắp tới: <span className="font-medium">{pet.nextVaccine}</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Contact Info */}
        <section className="bg-blue-900 rounded-xl p-6 text-white">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-blue-800 flex items-center justify-center text-blue-300">
              <Phone size={20} />
            </div>
            <div>
              <h3 className="font-bold text-lg">Cần hỗ trợ ngay?</h3>
              <p className="text-blue-200 text-sm">
                Liên hệ phòng khám Belwee Pet Clinic để được tư vấn miễn phí.
              </p>
            </div>
          </div>
          <div className="mt-4 flex gap-4">
            <a
              href="tel:0281234567"
              className="px-5 py-2.5 bg-white text-blue-900 font-medium rounded-lg hover:bg-blue-200 transition-colors"
            >
              Gọi ngay
            </a>
            <a
              href="/lien-he"
              className="px-5 py-2.5 border border-blue-300 font-medium rounded-lg hover:bg-blue-800/30 transition-colors"
            >
              Gửi tin nhắn
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}

function QuickActionCard({
  icon,
  iconBg,
  iconColor,
  title,
  desc,
  href,
}: {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  title: string;
  desc: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all group"
    >
      <div className={`w-10 h-10 rounded-lg ${iconBg} flex items-center justify-center ${iconColor} mb-3 group-hover:scale-110 transition-transform`}>
        {icon}
      </div>
      <h3 className="font-bold text-gray-900 text-sm">{title}</h3>
      <p className="text-xs text-gray-500 mt-1">{desc}</p>
    </Link>
  );
}
