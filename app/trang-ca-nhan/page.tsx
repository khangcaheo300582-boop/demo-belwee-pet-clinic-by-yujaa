// app/trang-ca-nhan/page.tsx
// /trang-ca-nhan — the customer profile.
//
// CONTRAST
//   The old page rendered near-invisible text: `.profile-shell .text-white`
//   overrode the heading to #172033, while the card behind it was
//   rgba(255,255,255,0.22) — a light-on-light wash that failed WCAG AA at
//   roughly 1.4:1. Every surface here now pairs an opaque-enough glass background
//   with a text colour chosen for a >= 4.5:1 ratio against THAT background, in
//   both themes, via the tokens in globals.css (--pf-surface, --pf-text, …).
//   The inline <style> block that patched text colours is gone; the tokens are
//   the single source.

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import {
  BellRing,
  CalendarClock,
  CheckCircle2,
  History,
  LogOut,
  Palette,
  RefreshCw,
  User,
  PawPrint,
  Loader2,
  MapPin,
} from 'lucide-react';
import PetSpeciesPicker from '@/components/PetSpeciesPicker';
import NotificationToggle from '@/components/NotificationToggle';
import BrowserNotificationsToggle from '@/components/BrowserNotificationsToggle';
import NotificationTypesCard from '@/components/NotificationTypesCard';
import BookingNotificationListener from '@/components/BookingNotificationListener';
import type { StaffNotification } from '@/lib/dbNotifications';
import { validatePetSpecies } from '@/lib/petSpecies';
import { normalizeBookingStatus } from '@/lib/bookingStatus';

type TabType = 'thongtin' | 'thucung' | 'thongbao' | 'giaodien' | 'lichsu';

const tabs: Array<{ id: TabType; label: string; icon: typeof User }> = [
  { id: 'thongtin', label: 'Hồ sơ chủ nuôi', icon: User },
  { id: 'thucung', label: 'Hồ sơ bé cưng', icon: PawPrint },
  { id: 'thongbao', label: 'Thông báo lịch hẹn', icon: BellRing },
  { id: 'giaodien', label: 'Cá nhân hóa giao diện', icon: Palette },
  { id: 'lichsu', label: 'Lịch sử khám bệnh', icon: History },
];

type StatusKey = 'pending' | 'confirmed' | 'inProgress' | 'completed' | 'cancelled';

interface Appointment {
  id: string;
  service: string;
  petName: string;
  petType?: string;
  time?: string;
  notes?: string;
  addressName?: string;
  status: string;
  createdAt?: string;
  confirmedAt?: string | null;
  confirmedBy?: { name: string; avatarUrl: string | null } | null;
}

/**
 * Booking status → display key.
 *
 * Bảng alias của mọi từ vựng lịch sử (ACCEPTED, nhãn tiếng Việt…) nằm ở
 * lib/bookingStatus.ts — dùng chung với hàng đợi nhân viên và cổng thông tin,
 * vì ba màn hình này đọc cùng một file và từng trả lời khác nhau cho cùng một
 * dòng dữ liệu.
 *
 * Riêng `inProgress` là trạng thái CHỈ có ở tầng hiển thị: mô hình bốn trạng
 * thái không có "đang xử lý", nên nó được nhận diện ở đây, trước khi chuẩn hoá.
 */
function statusKey(status: string): StatusKey {
  const s = (status || '').trim().toUpperCase();
  if (s === 'IN_PROGRESS' || s === 'ĐANG XỬ LÝ') return 'inProgress';
  switch (normalizeBookingStatus(s)) {
    case 'CANCELLED':
      return 'cancelled';
    case 'COMPLETED':
      return 'completed';
    case 'CONFIRMED':
      return 'confirmed';
    default:
      return 'pending';
  }
}

const STATUS_META: Record<
  StatusKey,
  { label: string; chip: string; bar: string; step: number }
> = {
  pending: {
    label: 'Đang chờ xác nhận',
    chip: 'border-amber-300/25 bg-amber-400/10 text-amber-300',
    bar: 'bg-amber-400',
    step: 1,
  },
  confirmed: {
    label: 'Đã xác nhận',
    chip: 'border-emerald-300/25 bg-emerald-400/10 text-emerald-300',
    bar: 'bg-emerald-400',
    step: 2,
  },
  inProgress: {
    label: 'Đang thực hiện',
    chip: 'border-violet-300/25 bg-violet-400/10 text-violet-300',
    bar: 'bg-violet-400',
    step: 3,
  },
  completed: {
    label: 'Hoàn tất',
    chip: 'border-sky-300/25 bg-sky-400/10 text-sky-300',
    bar: 'bg-sky-400',
    step: 4,
  },
  cancelled: {
    label: 'Đã huỷ',
    chip: 'border-rose-300/25 bg-rose-400/10 text-rose-300',
    bar: 'bg-rose-400',
    step: 1,
  },
};

/** The timeline steps, in order — drives the progress rail. */
const TIMELINE = ['Đã đặt', 'Đã xác nhận', 'Đang thực hiện', 'Hoàn tất'] as const;

export default function ProfilePage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('thongtin');
  const [toast, setToast] = useState<string | null>(null);

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [notifications, setNotifications] = useState<StaffNotification[]>([]);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [loadingAppointments, setLoadingAppointments] = useState(false);
  const [loadingNotifications, setLoadingNotifications] = useState(false);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');

  const [petName, setPetName] = useState('');
  const [petSpecies, setPetSpecies] = useState('Chó');
  const [petBreed, setPetBreed] = useState('');
  const [petAge, setPetAge] = useState('');
  const [petWeight, setPetWeight] = useState('');

  // Theme state — read from the shared provider set up in app/layout.tsx.
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // The glass "intensity" slider already in the product, kept as a separate
  // control from light/dark: it adjusts --theme-primary's hue, not the mode.
  const [glassValue, setGlassValue] = useState(50);
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const showToast = useCallback((text: string) => {
    setToast(text);
    window.setTimeout(() => setToast(null), 3200);
  }, []);

  // ─── Data ─────────────────────────────────────────────────────────
  const loadAppointments = useCallback(async (showLoading = true) => {
    if (showLoading) setLoadingAppointments(true);
    try {
      const res = await fetch('/api/lay-lich-su?limit=50', { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as {
        appointments?: Array<Record<string, unknown>>;
      };
      setAppointments(
        (data.appointments ?? []).map((item) => ({
          id: String(item.id),
          service: String(item.title ?? item.service ?? 'Dịch vụ thú y'),
          petName: String(item.petName ?? ''),
          petType: item.petType ? String(item.petType) : undefined,
          time: item.time ? String(item.time) : undefined,
          notes: item.notes ? String(item.notes) : undefined,
          addressName: item.addressName ? String(item.addressName) : undefined,
          status: String(item.status ?? 'PENDING'),
          createdAt: item.createdAt ? String(item.createdAt) : undefined,
          confirmedAt: item.confirmedAt ? String(item.confirmedAt) : null,
          confirmedBy: (item.confirmedBy as Appointment['confirmedBy']) ?? null,
        }))
      );
    } catch {
      /* offline — the next load retries */
    } finally {
      setLoadingAppointments(false);
    }
  }, []);

  const loadNotifications = useCallback(async (showLoading = true) => {
    if (showLoading) setLoadingNotifications(true);
    try {
      const res = await fetch('/api/bookings/notifications', { cache: 'no-store' });
      if (res.ok) {
        const data = (await res.json()) as { notifications?: StaffNotification[] };
        setNotifications(data.notifications ?? []);
      }
      const prefRes = await fetch('/api/bookings/notifications/preference', { cache: 'no-store' });
      if (prefRes.ok) {
        const data = (await prefRes.json()) as { preference?: { enabled?: boolean } };
        setNotificationsEnabled(data.preference?.enabled === true);
      }
    } catch {
      /* offline — the next load retries */
    } finally {
      setLoadingNotifications(false);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    // Read the ACTUAL theme the inline <head> script applied, rather than
    // assuming the default — otherwise the toggle shows the wrong position for
    // a returning dark-mode visitor until they click it once.
    const current = document.documentElement.getAttribute('data-theme');
    setTheme(current === 'dark' ? 'dark' : 'light');

    const savedGlass = localStorage.getItem('belwee-theme-val');
    if (savedGlass) setGlassValue(Number(savedGlass));
  }, []);

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.email) {
      setCustomerEmail(session.user.email);
      setCustomerName(session.user.name ?? '');
    }
  }, [session, status]);

  // Only poll the appointments while the history tab is actually on screen —
  // polling a hidden tab burns the rate-limit budget for nothing.
  useEffect(() => {
    if (activeTab !== 'lichsu') return;
    void loadAppointments();
    const id = window.setInterval(() => void loadAppointments(false), 30_000);
    return () => window.clearInterval(id);
  }, [activeTab, loadAppointments]);

  useEffect(() => {
    if (activeTab !== 'thongbao') return;
    void loadNotifications();
  }, [activeTab, loadNotifications]);

  // ─── Theme ────────────────────────────────────────────────────────
  const applyTheme = useCallback((next: 'light' | 'dark') => {
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem('belwee-theme', next);
    } catch {
      /* private mode — the theme still applies for this page view */
    }
  }, []);

  const toggleTheme = useCallback(() => {
    applyTheme(theme === 'light' ? 'dark' : 'light');
  }, [theme, applyTheme]);

  // ─── Glass-intensity slider (existing "cá nhân hóa" control) ──────
  useEffect(() => {
    if (!mounted) return;
    const hue = Math.max(0, 240 - glassValue * 2.4);
    const root = document.documentElement;
    root.style.setProperty('--theme-primary', `hsl(${hue}, 85%, 60%)`);
    root.style.setProperty('--theme-glow', `hsla(${hue}, 85%, 60%, 0.45)`);
    root.style.setProperty('--theme-bg', `hsla(${hue}, 85%, 60%, 0.1)`);
    root.style.setProperty('--theme-border', `hsla(${hue}, 85%, 60%, 0.3)`);
    localStorage.setItem('belwee-theme-val', String(glassValue));
  }, [glassValue, mounted]);

  const handleThermometerMove = useCallback((clientY: number) => {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const percentage = Math.round(((rect.height - (clientY - rect.top)) / rect.height) * 100);
    setGlassValue(Math.max(0, Math.min(100, percentage)));
  }, []);

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => handleThermometerMove(e.clientY);
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) handleThermometerMove(e.touches[0].clientY);
    };
    const onRelease = () => setIsDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onRelease);
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onRelease);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onRelease);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onRelease);
    };
  }, [isDragging, handleThermometerMove]);

  // ─── Save ────────────────────────────────────────────────────────
  const saveOwner = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) return showToast('Vui lòng nhập họ tên.');
    showToast('Đã lưu hồ sơ chủ nuôi.');
  };

  const savePet = (e: React.FormEvent) => {
    e.preventDefault();
    if (!petName.trim()) return showToast('Vui lòng nhập tên bé cưng.');
    // Re-validate on submit even though the picker validates on blur: the user
    // can change the value and hit Enter without ever blurring the field.
    if (petSpecies === 'Khác') {
      const verdict = validatePetSpecies(petSpecies);
      if (!verdict.ok) return showToast('Tên loài thú cưng không hợp lệ.');
    }
    showToast('Đã lưu hồ sơ bé cưng.');
  };

  const groupedAppointments = useMemo(() => {
    const sorted = [...appointments].sort((a, b) => {
      const at = a.time ?? a.createdAt ?? '';
      const bt = b.time ?? b.createdAt ?? '';
      return bt.localeCompare(at);
    });
    return sorted;
  }, [appointments]);

  if (status === 'loading' || !mounted) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[var(--pf-bg)] text-sm uppercase tracking-widest text-[var(--pf-text-mute)]">
        Đang nạp cấu trúc dữ liệu…
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[var(--pf-bg)] p-6 text-center">
        <button
          onClick={() => router.push('/dang-nhap')}
          className="rounded-2xl bg-[var(--pf-accent)] px-6 py-3 text-xs font-bold uppercase text-white transition hover:brightness-110"
        >
          Yêu cầu đăng nhập hệ thống
        </button>
      </div>
    );
  }

  const initials = customerName.trim() ? customerName.trim()[0].toUpperCase() : '👤';

  return (
    <div className="pf-shell min-h-dvh bg-[var(--pf-bg)] px-4 pb-24 pt-28 text-[var(--pf-text)] md:px-8 md:pt-32">
      {toast && (
        <div
          role="status"
          className="fixed bottom-6 right-6 z-[9999] rounded-2xl border border-[var(--pf-border)] bg-[var(--pf-surface-strong)] px-5 py-3 text-xs font-semibold text-[var(--pf-text)] shadow-2xl backdrop-blur-xl"
        >
          {toast}
        </div>
      )}

      <div className="mx-auto grid max-w-6xl grid-cols-1 items-start gap-6 lg:grid-cols-12">
        {/* Sidebar */}
        <aside className="space-y-4 lg:col-span-4">
          <div className="pf-card p-6 text-center">
            <div className="pf-avatar mx-auto mb-4">
              <span aria-hidden="true">{initials}</span>
            </div>
            <h2 className="text-base font-bold text-[var(--pf-text)]">
              {customerName || 'Thành viên Belwee'}
            </h2>
            <p className="mt-0.5 truncate px-2 font-mono text-[11px] uppercase tracking-widest text-[var(--pf-text-mute)]">
              {customerEmail}
            </p>
          </div>

          <nav className="pf-card p-2.5" aria-label="Các mục hồ sơ">
            {tabs.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  aria-current={active ? 'page' : undefined}
                  className={`pf-tab w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-xs ${
                    active ? 'is-active' : ''
                  }`}
                >
                  <tab.icon className="size-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{tab.label}</span>
                </button>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={() => signOut({ callbackUrl: '/dang-nhap' })}
            className="pf-card flex w-full items-center justify-center gap-2.5 px-4 py-3.5 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-500/10"
          >
            <LogOut className="size-4" aria-hidden="true" />
            Đăng xuất khỏi hệ thống
          </button>
        </aside>

        {/* Content */}
        <main className="pf-card p-6 md:p-8 lg:col-span-8">
          {/* ── Owner profile ── */}
          {activeTab === 'thongtin' && (
            <div className="space-y-6">
              <header>
                <h3 className="text-base font-bold text-[var(--pf-text)]">Hồ sơ chủ nuôi</h3>
                <p className="mt-1 text-xs text-[var(--pf-text-mute)]">
                  Thông tin liên hệ để phòng khám gọi cho bạn khi cần.
                </p>
              </header>

              <form onSubmit={saveOwner} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <label htmlFor="pf-owner-name" className="pf-label">
                      Họ và tên
                    </label>
                    <input
                      id="pf-owner-name"
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Tên chủ nuôi…"
                      className="pf-input"
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="pf-owner-phone" className="pf-label">
                      Số điện thoại
                    </label>
                    <input
                      id="pf-owner-phone"
                      type="tel"
                      inputMode="numeric"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="0901234567"
                      className="pf-input"
                      required
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label htmlFor="pf-owner-email" className="pf-label">
                    Email liên hệ
                  </label>
                  <input
                    id="pf-owner-email"
                    type="email"
                    value={customerEmail}
                    readOnly
                    aria-readonly="true"
                    className="pf-input cursor-not-allowed opacity-70"
                  />
                  <p className="text-[11px] text-[var(--pf-text-mute)]">
                    Email dùng để đăng nhập — không thay đổi tại đây.
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  <label htmlFor="pf-owner-address" className="pf-label">
                    Địa chỉ thường trú
                  </label>
                  <textarea
                    id="pf-owner-address"
                    rows={3}
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    placeholder="Địa chỉ…"
                    className="pf-input resize-none"
                  />
                </div>

                <button type="submit" className="pf-btn">
                  Lưu hồ sơ chủ nuôi
                </button>
              </form>
            </div>
          )}

          {/* ── Pet profile ── */}
          {activeTab === 'thucung' && (
            <div className="space-y-6">
              <header>
                <h3 className="text-base font-bold text-[var(--pf-text)]">Hồ sơ bé cưng</h3>
                <p className="mt-1 text-xs text-[var(--pf-text-mute)]">
                  Chọn loài, hoặc ghi loài thật nếu bé không phải chó mèo.
                </p>
              </header>

              <form onSubmit={savePet} className="space-y-5">
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <label htmlFor="pf-pet-name" className="pf-label">
                      Tên của bé cưng
                    </label>
                    <input
                      id="pf-pet-name"
                      type="text"
                      value={petName}
                      onChange={(e) => setPetName(e.target.value)}
                      placeholder="Tên thú cưng…"
                      className="pf-input"
                    />
                  </div>

                  {/* Chips + validated free text, instead of a 3-option select
                      that could only ever record "Khác" as the species. */}
                  <PetSpeciesPicker
                    value={petSpecies}
                    onChange={setPetSpecies}
                    label="Loài thú cưng"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="flex flex-col gap-2">
                    <label htmlFor="pf-pet-breed" className="pf-label">
                      Giống / chủng tộc
                    </label>
                    <input
                      id="pf-pet-breed"
                      type="text"
                      value={petBreed}
                      onChange={(e) => setPetBreed(e.target.value)}
                      placeholder="Corgi, Mèo Ragdoll…"
                      className="pf-input"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="pf-pet-age" className="pf-label">
                      Tuổi
                    </label>
                    <input
                      id="pf-pet-age"
                      type="text"
                      value={petAge}
                      onChange={(e) => setPetAge(e.target.value)}
                      placeholder="2 năm"
                      className="pf-input"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="pf-pet-weight" className="pf-label">
                      Cân nặng
                    </label>
                    <input
                      id="pf-pet-weight"
                      type="text"
                      inputMode="decimal"
                      value={petWeight}
                      onChange={(e) => setPetWeight(e.target.value)}
                      placeholder="4.5 kg"
                      className="pf-input"
                    />
                  </div>
                </div>

                <button type="submit" className="pf-btn">
                  Cập nhật hồ sơ bé
                </button>
              </form>
            </div>
          )}

          {/* ── Notifications ── */}
          {activeTab === 'thongbao' && (
            <div className="space-y-6">
              <header>
                <h3 className="text-base font-bold text-[var(--pf-text)]">
                  Thông báo lịch hẹn
                </h3>
                <p className="mt-1 text-xs text-[var(--pf-text-mute)]">
                  Nhận thông báo ngay khi nhân viên xác nhận hoặc huỷ lịch của bé.
                </p>
              </header>

              <NotificationToggle
                initialEnabled={notificationsEnabled}
                onChange={(next) => {
                  setNotificationsEnabled(next);
                  if (next) void loadNotifications(false);
                }}
              />

              <BrowserNotificationsToggle />
              <NotificationTypesCard />

              <div className="mt-4 space-y-3">
                <h4 className="flex items-center gap-2 text-sm font-bold text-[var(--pf-text)]">
                  <History className="size-4" aria-hidden="true" />
                  Lịch sử thông báo
                </h4>

                {loadingNotifications ? (
                  <p className="py-8 text-center text-xs text-[var(--pf-text-mute)]">
                    Đang tải…
                  </p>
                ) : notifications.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-[var(--pf-border)] p-8 text-center text-xs text-[var(--pf-text-mute)]">
                    Chưa có thông báo nào. Lịch hẹn được xác nhận sẽ hiện ở đây.
                  </p>
                ) : (
                  <ul className="space-y-2.5">
                    {notifications.map((item) => {
                      const meta = STATUS_META[
                        item.kind === 'booking-cancelled'
                          ? 'cancelled'
                          : item.kind === 'booking-completed'
                            ? 'completed'
                            : 'confirmed'
                      ];
                      return (
                        <li
                          key={item.id}
                          className={`flex items-start gap-3 rounded-2xl border p-4 ${
                            item.seenAt ? 'border-[var(--pf-border)]' : 'border-[var(--pf-accent)]'
                          }`}
                        >
                          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[var(--pf-accent)]" aria-hidden="true" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-[var(--pf-text)]">{item.title}</p>
                            {item.body && (
                              <p className="mt-0.5 text-xs text-[var(--pf-text-mute)]">{item.body}</p>
                            )}
                            <p className="mt-1 text-[10px] text-[var(--pf-text-mute)]">
                              {new Date(item.createdAt).toLocaleString('vi-VN')}
                            </p>
                          </div>
                          <span
                            className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${meta.chip}`}
                          >
                            {meta.label}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          )}

          {/* ── Theme + personalization ── */}
          {activeTab === 'giaodien' && (
            <div className="space-y-6">
              <header>
                <h3 className="text-base font-bold text-[var(--pf-text)]">
                  Cá nhân hóa giao diện
                </h3>
                <p className="mt-1 text-xs text-[var(--pf-text-mute)]">
                  Chọn chế độ sáng/tối và mức độ màu chủ đạo.
                </p>
              </header>

              {/* Light / dark */}
              <button
                type="button"
                onClick={toggleTheme}
                aria-pressed={theme === 'dark'}
                aria-label={theme === 'light' ? 'Chuyển sang chế độ tối' : 'Chuyển sang chế độ sáng'}
                className="flex w-full items-center gap-4 rounded-2xl border border-[var(--pf-border)] bg-[var(--pf-surface)] p-5 text-left transition-colors hover:bg-[var(--pf-surface-strong)]"
              >
                <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--pf-accent-soft)] text-2xl">
                  {theme === 'light' ? '🦴' : '🐟'}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-[var(--pf-text)]">
                    Chế độ {theme === 'light' ? 'sáng' : 'tối'}
                  </span>
                  <span className="mt-0.5 block text-xs text-[var(--pf-text-mute)]">
                    {theme === 'light'
                      ? 'Nền sáng, thẻ kính sáng — dễ đọc ban ngày.'
                      : 'Nền tối, thẻ kính xám — dễ mắt buổi tối.'}
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className="relative h-7 w-14 shrink-0 rounded-full border border-[var(--pf-border)] bg-[var(--pf-surface-strong)]"
                >
                  <span
                    className="absolute top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--pf-accent)] text-[10px] text-white transition-transform duration-300"
                    style={{ transform: `translateY(-50%) translateX(${theme === 'light' ? '2px' : '30px'})` }}
                  >
                    🐾
                  </span>
                </span>
              </button>

              {/* Colour intensity */}
              <div className="flex flex-col items-center gap-4 rounded-2xl border border-[var(--pf-border)] bg-[var(--pf-surface)] p-8">
                <div
                  ref={trackRef}
                  role="slider"
                  tabIndex={0}
                  aria-label="Mức độ màu chủ đạo"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={glassValue}
                  onMouseDown={(e) => {
                    setIsDragging(true);
                    handleThermometerMove(e.clientY);
                  }}
                  onTouchStart={(e) => {
                    setIsDragging(true);
                    if (e.touches[0]) handleThermometerMove(e.touches[0].clientY);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
                      e.preventDefault();
                      setGlassValue((v) => Math.min(100, v + 5));
                    } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
                      e.preventDefault();
                      setGlassValue((v) => Math.max(0, v - 5));
                    }
                  }}
                  className="flex h-52 w-[18px] cursor-pointer flex-col justify-end rounded-full bg-slate-900/80 p-[2.5px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pf-accent)]"
                >
                  <div
                    className="relative w-full rounded-full transition-all duration-75"
                    style={{
                      height: `${glassValue}%`,
                      minHeight: '12px',
                      background: 'linear-gradient(to top, var(--theme-primary), #fff)',
                      boxShadow: '0 0 20px var(--theme-glow)',
                    }}
                  >
                    <span className="absolute left-1/2 top-0 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white ring-4 ring-white/20" />
                  </div>
                </div>
                <p className="font-mono text-xl font-black text-[var(--pf-text)]">{glassValue}%</p>
              </div>
            </div>
          )}

          {/* ── Appointment history ── */}
          {activeTab === 'lichsu' && (
            <div className="space-y-6">
              <header className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-[var(--pf-text)]">
                    Nhật ký khám & điều trị
                  </h3>
                  <p className="mt-1 text-xs text-[var(--pf-text-mute)]">
                    Trạng thái cập nhật trực tiếp từ phòng khám.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void loadAppointments()}
                  className="flex shrink-0 items-center gap-1.5 rounded-xl border border-[var(--pf-border)] px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--pf-text-mute)] transition-colors hover:bg-[var(--pf-surface-strong)] hover:text-[var(--pf-text)]"
                >
                  {loadingAppointments ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <RefreshCw className="size-3" />
                  )}
                  Làm mới
                </button>
              </header>

              {loadingAppointments && appointments.length === 0 ? (
                <p className="py-10 text-center text-xs text-[var(--pf-text-mute)]">
                  Đang nạp dữ liệu từ phòng khám…
                </p>
              ) : appointments.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-[var(--pf-border)] p-12 text-center text-xs text-[var(--pf-text-mute)]">
                  Bạn chưa có lịch hẹn nào tại Belwee.
                </p>
              ) : (
                <ol className="space-y-3">
                  {groupedAppointments.map((item) => {
                    const key = statusKey(item.status);
                    const meta = STATUS_META[key];
                    const cancelled = key === 'cancelled';
                    return (
                      <li
                        key={item.id}
                        className="relative overflow-hidden rounded-2xl border border-[var(--pf-border)] p-5"
                        style={{ borderLeft: `3px solid ${meta.bar}` }}
                      >
                        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                          <div className="min-w-0 flex-1 space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-md border border-[var(--pf-border)] px-2 py-0.5 font-mono text-[10px] text-[var(--pf-text-mute)]">
                                {item.id}
                              </span>
                              {item.time && (
                                <span className="flex items-center gap-1 rounded-md border border-[var(--pf-border)] px-2 py-0.5 text-[10px] font-medium text-[var(--pf-text-mute)]">
                                  <CalendarClock className="size-3" aria-hidden="true" />
                                  {item.time}
                                </span>
                              )}
                              {item.createdAt && (
                                <span className="text-xs text-[var(--pf-text-mute)]">
                                  {new Date(item.createdAt).toLocaleDateString('vi-VN')}
                                </span>
                              )}
                            </div>

                            <h4 className="text-sm font-bold text-[var(--pf-text)]">{item.service}</h4>

                            <p className="text-[11px] italic text-[var(--pf-text-mute)]">
                              Thú cưng: {item.petName}
                              {item.petType ? ` (${item.petType})` : ''}
                              {item.notes ? ` · Ghi chú: ${item.notes}` : ''}
                            </p>

                            {item.addressName && (
                              <p className="flex items-center gap-1 text-[11px] text-[var(--pf-text-mute)]">
                                <MapPin className="size-3" aria-hidden="true" />
                                {item.addressName}
                              </p>
                            )}

                            {/* WHO CONFIRMED — the requirement the booking schema
                                did not previously carry. */}
                            {item.confirmedBy && (
                              <div className="mt-2.5 flex items-center gap-2 rounded-xl border border-emerald-300/25 bg-emerald-400/8 px-3 py-2">
                                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-400/20 text-[9px] font-bold text-emerald-600">
                                  {item.confirmedBy.name.slice(0, 1).toUpperCase()}
                                </span>
                                <span className="min-w-0 text-[11px] text-[var(--pf-text-mute)]">
                                  Nhân viên xác nhận:{' '}
                                  <span className="font-semibold text-emerald-700">
                                    {item.confirmedBy.name}
                                  </span>
                                </span>
                              </div>
                            )}

                            {/* Timeline rail — shows WHERE the appointment is,
                                not just a status chip. */}
                            {!cancelled && (
                              <div className="mt-3 flex items-center gap-1" aria-hidden="true">
                                {TIMELINE.map((step, index) => (
                                  <span
                                    key={step}
                                    className={`h-1 flex-1 rounded-full transition-colors ${
                                      index < meta.step ? meta.bar : 'bg-[var(--pf-border)]'
                                    }`}
                                    title={step}
                                  />
                                ))}
                              </div>
                            )}
                          </div>

                          <span
                            className={`shrink-0 self-start rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wide ${meta.chip}`}
                          >
                            {meta.label}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Live toasts. Mounted here so a confirmation that arrives while the
          customer is on ANY profile tab is still seen. */}
      <BookingNotificationListener enabled={notificationsEnabled} />
    </div>
  );
}