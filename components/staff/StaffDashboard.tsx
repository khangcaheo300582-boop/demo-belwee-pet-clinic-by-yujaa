"use client";

// components/staff/StaffDashboard.tsx
// Staff queue over the REAL booking store (data/bookings.json):
//   - Fetch:      GET  /api/staff/appointments  (no seeded/mock data)
//   - Actions:    PATCH /api/staff/appointments/:id  (confirm / diagnose / files)
//                 POST  /api/staff/receipts           (finish + invoice)
// Every status button updates server state and merges the response into the UI,
// so the queue, stat tiles and filters always reflect the live database.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  BadgeCheck,
  Ban,
  CalendarCheck2,
  ClipboardList,
  FilePlus2,
  HeartPulse,
  LayoutDashboard,
  Loader2,
  Phone,
  ReceiptText,
  Search,
  Stethoscope,
} from 'lucide-react';
import type { MedicalRecord } from '@/lib/dbMedicalRecords';
import type { StaffPublic } from '@/lib/staff-service';
import type { AppointmentStatus, StaffAppointment } from '@/lib/staffAppointments';
import { roleCan } from '@/lib/staffPermissions';
import LiquidGlassCard from '@/components/ui/LiquidGlassCard';
import Skeleton, { SkeletonAppointmentCard, SkeletonStatus } from '@/components/ui/Skeleton';
import FileUploadModal from '@/components/staff/FileUploadModal';
import ReceiptModal from '@/components/staff/ReceiptModal';
import CancelBookingModal from '@/components/staff/CancelBookingModal';
import LogoutButton from '@/components/LogoutButton';
import { cn } from '@/lib/utils';

const STATUS_META: Record<AppointmentStatus, { label: string; chip: string }> = {
  PENDING: { label: 'Chờ xác nhận', chip: 'border-amber-300/25 bg-amber-400/10 text-amber-300' },
  CONFIRMED: { label: 'Đã xác nhận', chip: 'border-emerald-300/25 bg-emerald-400/10 text-emerald-300' },
  COMPLETED: { label: 'Hoàn thành', chip: 'border-sky-300/25 bg-sky-400/10 text-sky-300' },
  CANCELLED: { label: 'Đã huỷ', chip: 'border-rose-300/25 bg-rose-400/10 text-rose-300' },
};

const FILTERS = ['ALL', 'PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'] as const;
type FilterKey = (typeof FILTERS)[number];

const vnd = (v: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(v);

const petEmoji = (petType: string) => {
  const t = petType.toLowerCase();
  if (t.includes('mèo') || t.includes('meo') || t.includes('cat')) return '🐱';
  if (t.includes('cún') || t.includes('cun') || t.includes('chó') || t.includes('cho') || t.includes('dog')) return '🐶';
  return '🐾';
};

interface Props {
  staff: StaffPublic;
}

export default function StaffDashboard({ staff }: Props) {
  const [appointments, setAppointments] = useState<StaffAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterKey>('ALL');
  const [busy, setBusy] = useState<string | null>(null);

  const [editAppt, setEditAppt] = useState<StaffAppointment | null>(null);
  const [createReceiptFor, setCreateReceiptFor] = useState<StaffAppointment | null>(null);
  const [viewReceiptFor, setViewReceiptFor] = useState<{ appointment: StaffAppointment; receipt: NonNullable<MedicalRecord['receipt']> } | null>(null);
  const [cancelTarget, setCancelTarget] = useState<StaffAppointment | null>(null);

  /**
   * Which card has the cancel dialog open. Tracked as an id rather than by
   * comparing the appointment object, because PATCH returns a NEW object for the
   * same row — comparing by reference would silently clear the dialog the moment
   * any background refresh landed mid-confirmation.
   */
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // ─── Role capabilities ───────────────────────────────────────────
  // The server already enforces this (lib/staffPermissions.ts → 403), so hiding
  // the buttons is UX, not security. Both read the SAME matrix, so the UI can
  // never offer an action the API would reject — and, more importantly, a vet
  // is not shown a "Huỷ lịch" button that would always fail.
  const can = useMemo(
    () => ({
      confirm: roleCan(staff.role, 'appointment:confirm'),
      cancel: roleCan(staff.role, 'appointment:cancel'),
      diagnose: roleCan(staff.role, 'diagnosis:write'),
      bill: roleCan(staff.role, 'billing:write'),
    }),
    [staff.role]
  );

  // ─── Data fetching (Loading / Error / Success) ───────────────────
  const loadAppointments = useCallback(async (mode?: 'initial' | 'background') => {
    if (mode === 'initial') setLoading(true);
    else setRefreshing(true);
    try {
      const res = await fetch('/api/staff/appointments');
      if (!res.ok) throw new Error(`Lỗi ${res.status}: không tải được danh sách lịch hẹn.`);
      const data = (await res.json()) as { appointments: StaffAppointment[] };
      setAppointments(data.appointments);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Có lỗi khi kết nối tới máy chủ.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadAppointments('initial');
  }, [loadAppointments]);

  // ─── Auto-refresh: poll 45s + refresh khi quay lại tab ──────────
  // Nhân viên để mở dashboard lâu; dữ liệu phải tự cập nhật khi đồng nghiệp
  // xác nhận/xuất hoá đơn từ máy khác mà không cần bấm F5.
  const loadingRef = useRef(false);
  useEffect(() => {
    loadingRef.current = loading || refreshing;
  }, [loading, refreshing]);

  useEffect(() => {
    const tick = () => {
      if (!document.hidden && !loadingRef.current) void loadAppointments('background');
    };
    const interval = window.setInterval(tick, 45_000);
    const onVisible = () => {
      if (!document.hidden) tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [loadAppointments]);

  // ─── State merge helpers (keep UI synced after each action) ──────
  const applyAppointment = useCallback((updated: StaffAppointment) => {
    setAppointments(prev => prev.map(a => (a.id === updated.id ? updated : a)));
  }, []);

  const applyRecordUpdate = useCallback((apptId: string, record: MedicalRecord) => {
    setAppointments(prev =>
      prev.map(a => {
        if (a.id !== apptId) return a;
        const completed = record.status === 'COMPLETED';
        return {
          ...a,
          status: completed ? 'COMPLETED' : a.status,
          price: record.receipt?.totalAmount ?? a.price,
          record,
        };
      })
    );
  }, []);

  // ─── Actions ─────────────────────────────────────────────────────
  // GET /api/staff/appointments là pure read nên bệnh án chỉ tồn tại sau khi
  // staff hành động lần đầu. Hai helper dưới đây tạo bệnh án một cách tường
  // minh bằng PATCH CONFIRMED (no-op về trạng thái, tạo + gắn record) thay vì
  // để server âm thầm ghi file trong một GET.
  const ensureRecord = useCallback(
    async (appt: StaffAppointment): Promise<StaffAppointment> => {
      if (appt.record) return appt;
      setBusy(appt.id);
      try {
        const res = await fetch(`/api/staff/appointments/${appt.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'CONFIRMED' }),
        });
        const data = (await res.json()) as { appointment?: StaffAppointment; message?: string };
        if (!res.ok || !data.appointment) throw new Error(data.message || 'Không tạo được bệnh án.');
        applyAppointment(data.appointment);
        if (!data.appointment.record) throw new Error('Bệnh án chưa sẵn sàng. Vui lòng thử lại.');
        return data.appointment;
      } finally {
        setBusy(null);
      }
    },
    [applyAppointment]
  );

  const openRecordEditor = useCallback(
    async (appt: StaffAppointment) => {
      try {
        setEditAppt(await ensureRecord(appt));
      } catch (e) {
        alert(e instanceof Error ? e.message : 'Không mở được bệnh án. Vui lòng thử lại.');
      }
    },
    [ensureRecord]
  );

  const openReceiptCreator = useCallback(
    async (appt: StaffAppointment) => {
      try {
        setCreateReceiptFor(await ensureRecord(appt));
      } catch (e) {
        alert(e instanceof Error ? e.message : 'Không mở được hoá đơn. Vui lòng thử lại.');
      }
    },
    [ensureRecord]
  );

  async function confirmAppointment(appt: StaffAppointment) {
    setBusy(appt.id);
    try {
      const res = await fetch(`/api/staff/appointments/${appt.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CONFIRMED' }),
      });
      const data = (await res.json()) as { appointment?: StaffAppointment; message?: string };
      if (!res.ok || !data.appointment) throw new Error(data.message || 'Xác nhận thất bại.');
      applyAppointment(data.appointment);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Không thể xác nhận lịch hẹn. Vui lòng thử lại.');
    } finally {
      setBusy(null);
    }
  }

  /**
   * Perform the cancellation. Called by CancelBookingModal after its two-step
   * confirmation, and re-throws so the modal can show the error IN PLACE instead
   * of the window.alert this used to use — an alert blocks the main thread and
   * hides the queue behind a system dialog.
   */
  async function cancelAppointment(appt: StaffAppointment): Promise<void> {
    setBusy(appt.id);
    try {
      const res = await fetch(`/api/staff/appointments/${appt.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CANCELLED' }),
      });
      const data = (await res.json()) as { appointment?: StaffAppointment; message?: string };
      if (!res.ok || !data.appointment) {
        throw new Error(data.message || 'Huỷ lịch thất bại. Vui lòng thử lại.');
      }
      applyAppointment(data.appointment);
    } finally {
      setBusy(null);
      setCancellingId(null);
    }
  }

  function requestCancel(appt: StaffAppointment) {
    setCancelTarget(appt);
    setCancellingId(appt.id);
  }

  // ─── Derived data ────────────────────────────────────────────────
  const counts = useMemo(() => {
    const tally: Record<'ALL' | AppointmentStatus, number> = { ALL: 0, PENDING: 0, CONFIRMED: 0, COMPLETED: 0, CANCELLED: 0 };
    appointments.forEach(a => {
      tally[a.status] += 1;
    });
    tally.ALL = appointments.length;
    return tally;
  }, [appointments]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return appointments.filter(a => {
      if (filter !== 'ALL' && a.status !== filter) return false;
      if (!q) return true;
      return [a.id, a.petName, a.petType, a.service, a.ownerName, a.ownerEmail, a.ownerPhone, a.time]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [appointments, query, filter]);

  const hasData = appointments.length > 0;

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#070b16] via-[#0b1322] to-[#0d1526] px-4 pb-24 pt-10 sm:px-6 lg:px-8">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-liquid-mesh" />
      <div aria-hidden className="pointer-events-none absolute -top-36 right-0 h-[420px] w-[560px] rounded-full bg-emerald-400/10 blur-[130px]" />

      <div className="relative mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/25 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                <LayoutDashboard className="size-3.5" /> Staff Dashboard
              </span>
            </div>
            <h1 className="flex items-center gap-2 text-3xl font-extrabold text-white sm:text-4xl">
              Xin chào, {staff.name} <span className="text-2xl">👋</span>
            </h1>
            <p className="mt-1 text-sm text-white/50">
              Vai trò: <span className="font-semibold text-white/75">{staff.role}</span> · Hàng đợi lịch hẹn thực tế từ hệ thống đặt lịch
            </p>
            {/* Nói rõ quyền bị giới hạn, thay vì để nhân viên tưởng bị lỗi nút. */}
            {!can.cancel || !can.diagnose || !can.bill ? (
              <p className="mt-1.5 text-xs text-white/40">
                Quyền của vai trò này:{' '}
                {[
                  can.confirm ? 'xác nhận' : null,
                  can.cancel ? 'huỷ lịch' : null,
                  can.diagnose ? 'chẩn đoán' : null,
                  can.bill ? 'xuất hoá đơn' : null,
                ]
                  .filter(Boolean)
                  .join(' · ') || 'chỉ xem'}
                .
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => loadAppointments('background')}
              disabled={loading}
              className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white/80 backdrop-blur-xl transition-colors hover:bg-white/10 disabled:opacity-50"
            >
              {refreshing ? <Loader2 className="size-4 animate-spin" /> : <ClipboardList className="size-4" />}
              Làm mới
            </button>
            <a
              href="/staff/receipts"
              className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white/80 backdrop-blur-xl transition-colors hover:bg-white/10"
            >
              <ReceiptText className="size-4" /> Hoá đơn
            </a>
            <LogoutButton />
          </div>
        </div>

        {/* Stat tiles – computed from live data */}
        <div className="mb-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Tất cả', value: counts.ALL, icon: ClipboardList, tone: 'text-white' },
            { label: 'Chờ xác nhận', value: counts.PENDING, icon: HeartPulse, tone: 'text-amber-300' },
            { label: 'Đã xác nhận', value: counts.CONFIRMED, icon: CalendarCheck2, tone: 'text-emerald-300' },
            { label: 'Hoàn thành', value: counts.COMPLETED, icon: BadgeCheck, tone: 'text-sky-300' },
          ].map(t => (
            <LiquidGlassCard key={t.label} flat className="!rounded-2xl">
              <div className="flex items-center gap-3 px-4 py-4">
                <t.icon className={cn('size-5 shrink-0', t.tone)} />
                <div>
                  <p className="text-2xl font-extrabold text-white">
                    {/* `as="span"`: khối xương phải nằm TRONG <p> — một div ở
                        đây sẽ bị trình duyệt tự đóng thẻ <p> và cắt bố cục.
                        h-6 (24px) = đúng line-height của `text-2xl`, w-10 (40px)
                        = bề rộng một con số hai chữ số ⇒ chiều cao khối không
                        đổi khi số thật hiện ra. */}
                    {loading && !hasData ? (
                      <Skeleton
                        as="span"
                        variant="text"
                        width={40}
                        height={24}
                        tone="ondark"
                        className="inline-block align-middle"
                      />
                    ) : (
                      t.value
                    )}
                  </p>
                  <p className="text-[11px] text-white/50">{t.label}</p>
                </div>
              </div>
            </LiquidGlassCard>
          ))}
        </div>

        {/* Search + filter */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-white/35" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Tìm thú cưng, chủ, dịch vụ, mã lịch hẹn…"
              className="w-full rounded-full border border-white/15 bg-white/10 py-3 pl-11 pr-4 text-sm text-white outline-none backdrop-blur-2xl transition-all placeholder:text-white/35 focus:border-emerald-300/40 focus:shadow-[0_0_0_4px_rgba(52,211,153,0.12)]"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            {FILTERS.map(k => (
              <button
                key={k}
                type="button"
                onClick={() => setFilter(k)}
                className={cn(
                  'relative rounded-full border px-4 py-2 text-sm font-semibold transition-colors',
                  filter === k ? 'border-transparent text-slate-900' : 'border-white/15 bg-white/5 text-white/65 hover:bg-white/10'
                )}
              >
                {filter === k && (
                  <motion.span
                    layoutId="staff-filter-pill"
                    className="absolute inset-0 rounded-full bg-emerald-300"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="relative z-10">{k === 'ALL' ? 'Tất cả' : STATUS_META[k].label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Queue – Loading / Error / Success */}
        {loading && !hasData ? (
          <SkeletonStatus label="Đang tải danh sách lịch hẹn" className="space-y-3">
            {[0, 1, 2, 3].map(i => (
              <LiquidGlassCard key={i} flat className="!rounded-2xl">
                <SkeletonAppointmentCard tone="ondark" />
              </LiquidGlassCard>
            ))}
          </SkeletonStatus>
        ) : error ? (
          <LiquidGlassCard flat className="!rounded-3xl">
            <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
              <div className="flex size-12 items-center justify-center rounded-2xl border border-red-300/25 bg-red-500/10">
                <AlertTriangle className="size-6 text-red-300" />
              </div>
              <p className="font-bold text-white/85">Không tải được danh sách lịch hẹn</p>
              <p className="max-w-md text-sm text-white/50">{error}</p>
              <button
                type="button"
                onClick={() => loadAppointments('initial')}
                className="mt-1 flex items-center gap-2 rounded-full border border-red-300/30 bg-red-400/15 px-4 py-2 text-sm font-bold text-red-200 transition-colors hover:bg-red-400/25"
              >
                {loading ? <Loader2 className="size-4 animate-spin" /> : <ClipboardList className="size-4" />}
                Thử lại
              </button>
            </div>
          </LiquidGlassCard>
        ) : visible.length === 0 ? (
          <LiquidGlassCard flat className="!rounded-3xl">
            <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
              <Stethoscope className="size-10 text-white/25" />
              <p className="font-bold text-white/80">Hàng đợi trống</p>
              <p className="text-sm text-white/45">
                {hasData ? 'Không có lịch hẹn khớp với bộ lọc hiện tại.' : 'Chưa có khách hàng nào đặt lịch. Khi khách đặt lịch trên website, lịch hẹn sẽ xuất hiện ở đây.'}
              </p>
            </div>
          </LiquidGlassCard>
        ) : (
          <div className="space-y-3">
            <AnimatePresence initial={false} mode="popLayout">
              {visible.map(appt => {
                const meta = STATUS_META[appt.status];
                const rc = appt.record?.receipt;
                const canWork = appt.status === 'CONFIRMED' || appt.status === 'COMPLETED';
                return (
                  <motion.div
                    key={appt.id}
                    layout
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  >
                    <LiquidGlassCard className="!rounded-2xl" maxTilt={4}>
                      <div className="flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center">
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-lg">
                            {petEmoji(appt.petType)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-bold text-white">{appt.petName}</p>
                              <span className={cn('rounded-full border px-2.5 py-0.5 text-[11px] font-semibold', meta.chip)}>{meta.label}</span>
                            </div>
                            <p className="truncate text-sm text-white/60">
                              {appt.service}
                              {appt.ownerName ? ` · Chủ: ${appt.ownerName}` : ''}
                            </p>
                            <p className="truncate text-xs text-white/35">
                              {appt.id} · {appt.petType} · {appt.time}
                              {appt.record?.staffName ? ` · Phụ trách: ${appt.record.staffName}` : ''}
                            </p>

                            {/* WHO CONFIRMED — recorded on the booking itself
                                (dbBooking.confirmedBy), not on the medical
                                record: the record's staffName is whoever last
                                EDITED the notes, which is a different person
                                from whoever confirmed the appointment. */}
                            {appt.confirmedBy && (
                              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-white/60">
                                {appt.confirmedBy.avatarUrl ? (
                                  <span className="relative size-4 shrink-0 overflow-hidden rounded-full border border-white/20">
                                    <Image
                                      src={appt.confirmedBy.avatarUrl}
                                      alt=""
                                      fill
                                      sizes="16px"
                                      className="object-cover"
                                    />
                                  </span>
                                ) : (
                                  <span
                                    aria-hidden="true"
                                    className="flex size-4 shrink-0 items-center justify-center rounded-full border border-emerald-300/30 bg-emerald-400/15 text-[8px] font-bold text-emerald-300"
                                  >
                                    {appt.confirmedBy.name.slice(0, 1).toUpperCase()}
                                  </span>
                                )}
                                <span className="truncate">
                                  Xác nhận bởi{' '}
                                  <span className="font-semibold text-emerald-300">
                                    {appt.confirmedBy.name}
                                  </span>
                                </span>
                              </p>
                            )}

                            {appt.ownerPhone && (
                              <p className="mt-0.5 flex items-center gap-1 text-xs text-white/45">
                                <Phone className="size-3" /> {appt.ownerPhone}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                          {appt.status === 'PENDING' && (
                            <>
                              {can.confirm && (
                                <button
                                  type="button"
                                  disabled={busy === appt.id}
                                  onClick={() => confirmAppointment(appt)}
                                  className="flex items-center gap-1.5 rounded-full border border-emerald-300/30 bg-emerald-400/15 px-3.5 py-2 text-xs font-bold text-emerald-300 transition-colors hover:bg-emerald-400/25 disabled:opacity-50"
                                >
                                  {busy === appt.id ? <Loader2 className="size-3.5 animate-spin" /> : <CalendarCheck2 className="size-3.5" />}
                                  Xác nhận
                                </button>
                              )}
                              {can.cancel && (
                                <button
                                  type="button"
                                  disabled={busy === appt.id || cancellingId === appt.id}
                                  onClick={() => requestCancel(appt)}
                                  className="flex items-center gap-1.5 rounded-full border border-rose-300/30 bg-rose-400/15 px-3.5 py-2 text-xs font-bold text-rose-300 transition-colors hover:bg-rose-400/25 disabled:opacity-50"
                                >
                                  {busy === appt.id ? <Loader2 className="size-3.5 animate-spin" /> : <Ban className="size-3.5" />}
                                  Huỷ lịch
                                </button>
                              )}
                            </>
                          )}

                          {canWork && can.diagnose && (
                            <>
                              <button
                                type="button"
                                disabled={busy === appt.id}
                                onClick={() => void openRecordEditor(appt)}
                                className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3.5 py-2 text-xs font-bold text-white/80 transition-colors hover:bg-white/10 disabled:opacity-50"
                              >
                                {busy === appt.id ? <Loader2 className="size-3.5 animate-spin" /> : <FilePlus2 className="size-3.5" />}
                                Chẩn đoán & file
                              </button>
                            </>
                          )}
                          {canWork && can.bill && (
                            <>
                              {appt.status === 'CONFIRMED' && (
                                <button
                                  type="button"
                                  disabled={busy === appt.id}
                                  onClick={() => void openReceiptCreator(appt)}
                                  className="flex items-center gap-1.5 rounded-full border border-sky-300/30 bg-sky-400/15 px-3.5 py-2 text-xs font-bold text-sky-300 transition-colors hover:bg-sky-400/25 disabled:opacity-50"
                                >
                                  {busy === appt.id ? <Loader2 className="size-3.5 animate-spin" /> : <ReceiptText className="size-3.5" />}
                                  Hoàn tất & hoá đơn
                                </button>
                              )}
                              {appt.status === 'COMPLETED' && rc && (
                                <button
                                  type="button"
                                  onClick={() => rc && setViewReceiptFor({ appointment: appt, receipt: rc })}
                                  className="flex items-center gap-1.5 rounded-full border border-emerald-300/30 bg-emerald-400/15 px-3.5 py-2 text-xs font-bold text-emerald-300 transition-colors hover:bg-emerald-400/25"
                                >
                                  <ReceiptText className="size-3.5" /> {vnd(rc.totalAmount)}
                                </button>
                              )}
                            </>
                          )}

                          {appt.status === 'CONFIRMED' && can.cancel && (
                            <button
                              type="button"
                              disabled={busy === appt.id || cancellingId === appt.id}
                              onClick={() => requestCancel(appt)}
                              className="flex items-center gap-1.5 rounded-full border border-rose-300/30 bg-rose-400/15 px-3.5 py-2 text-xs font-bold text-rose-300 transition-colors hover:bg-rose-400/25 disabled:opacity-50"
                            >
                              {busy === appt.id ? <Loader2 className="size-3.5 animate-spin" /> : <Ban className="size-3.5" />}
                              Huỷ lịch
                            </button>
                          )}
                        </div>
                      </div>
                    </LiquidGlassCard>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}

        {/* Modals */}
        {editAppt?.record && (
          <FileUploadModal
            record={editAppt.record}
            onClose={() => setEditAppt(null)}
            onSaved={record => {
              applyRecordUpdate(editAppt.id, record);
              setEditAppt(null);
            }}
          />
        )}
        {createReceiptFor?.record && (
          <ReceiptModal
            mode="create"
            record={createReceiptFor.record}
            onClose={() => setCreateReceiptFor(null)}
            onSaved={record => {
              applyRecordUpdate(createReceiptFor.id, record);
              setCreateReceiptFor(null);
            }}
          />
        )}
        {viewReceiptFor && (
          <ReceiptModal
            mode="view"
            record={viewReceiptFor.appointment.record!}
            receipt={viewReceiptFor.receipt}
            onClose={() => setViewReceiptFor(null)}
          />
        )}
        {cancelTarget && (
          <CancelBookingModal
            appointment={cancelTarget}
            allowed={can.cancel}
            onClose={() => {
              setCancelTarget(null);
              setCancellingId(null);
            }}
            onConfirm={() => cancelAppointment(cancelTarget)}
          />
        )}
      </div>
    </div>
  );
}