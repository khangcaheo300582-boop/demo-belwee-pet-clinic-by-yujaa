"use client";

// components/portal/PortalClient.tsx
// /client-portal – medical record & appointment portal in Apple Liquid Glass.
// - Capsule search input with focus glow sweep
// - Breathing PENDING dot, emerald CONFIRMED, completed liquid accordions

import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Search,
  CalendarCheck2,
  ClipboardList,
  HeartPulse,
  BadgeCheck,
  ChevronDown,
  Paperclip,
  Sparkles,
  Inbox,
  Ban,
} from 'lucide-react';
import LiquidGlassCard from '@/components/ui/LiquidGlassCard';
import BookingStatusTimeline from '@/components/portal/BookingStatusTimeline';
import { cn } from '@/lib/utils';
import type { PortalData, PortalItem, PortalStatus } from '@/lib/portalData';

const STATUS_META: Record<PortalStatus, { label: string; dot: string; text: string; chip: string }> = {
  PENDING: { label: 'Chờ xác nhận', dot: 'bg-amber-500', text: 'text-amber-300', chip: 'bg-amber-400/10 text-amber-300 border-amber-300/25' },
  CONFIRMED: { label: 'Đã xác nhận', dot: 'bg-emerald-400', text: 'text-emerald-300', chip: 'bg-emerald-400/10 text-emerald-300 border-emerald-300/25' },
  COMPLETED: { label: 'Hoàn thành', dot: 'bg-sky-400', text: 'text-sky-300', chip: 'bg-sky-400/10 text-sky-300 border-sky-300/25' },
  CANCELLED: { label: 'Đã huỷ', dot: 'bg-rose-400', text: 'text-rose-300', chip: 'bg-rose-400/10 text-rose-300 border-rose-300/25' },
};

function vnd(value: number) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value);
}

function whenLabel(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function BreathingDot({ status }: { status: PortalStatus }) {
  const meta = STATUS_META[status];
  if (status === 'PENDING') {
    return (
      <motion.span
        className={cn('inline-block size-2.5 rounded-full', meta.dot)}
        animate={{ scale: [1, 1.25, 1], opacity: [0.65, 1, 0.65] }}
        transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
      />
    );
  }
  return <span className={cn('inline-block size-2.5 rounded-full', meta.dot)} />;
}

function StatusChip({ status }: { status: PortalStatus }) {
  const meta = STATUS_META[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold', meta.chip)}>
      <BreathingDot status={status} />
      {meta.label}
    </span>
  );
}

// ─── Completed-record liquid accordion row ─────────────────────────
function RecordAccordion({ item }: { item: PortalItem }) {
  const [open, setOpen] = useState(false);
  return (
    <LiquidGlassCard flat className="!rounded-2xl">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center gap-4 px-5 py-4 text-left"
      >
        <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-emerald-400/15 text-emerald-300 shadow-[inset_0_1px_1px_rgba(255,255,255,0.25)]">
          <BadgeCheck className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-white">{item.service}</p>
          <p className="truncate text-sm text-white/60">
            {item.petName} · {item.petType} {item.staffName ? `· BS: ${item.staffName}` : ''}
          </p>
        </div>
        <div className="hidden text-right sm:block">
          <p className="text-xs text-white/45">{whenLabel(item.whenISO)}</p>
          {item.receipt && <p className="mt-0.5 text-sm font-bold text-emerald-300">{vnd(item.receipt.totalAmount)}</p>}
        </div>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ type: 'spring', stiffness: 400, damping: 30 }}>
          <ChevronDown className="size-5 text-white/50" />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0, filter: 'blur(4px)' }}
            animate={{ height: 'auto', opacity: 1, filter: 'blur(0px)' }}
            exit={{ height: 0, opacity: 0, filter: 'blur(4px)' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/10 px-5 py-4">
              {item.diagnose && (
                <div className="mb-3">
                  <p className="mb-1 text-xs font-bold uppercase tracking-wider text-white/40">Chẩn đoán</p>
                  <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm leading-relaxed text-white/80">{item.diagnose}</p>
                </div>
              )}
              {item.treatment && (
                <div className="mb-3">
                  <p className="mb-1 text-xs font-bold uppercase tracking-wider text-white/40">Hướng điều trị</p>
                  <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm leading-relaxed text-white/80">{item.treatment}</p>
                </div>
              )}
              {item.files.length > 0 && (
                <div className="mb-3">
                  <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-white/40">Hồ sơ đính kèm</p>
                  <div className="flex flex-wrap gap-2">
                    {item.files.map(f => (
                      <a
                        key={f.id}
                        href={f.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/75 transition-colors hover:bg-white/10"
                      >
                        <Paperclip className="size-3.5" />
                        {f.name}
                      </a>
                    ))}
                  </div>
                </div>
              )}
              {item.receipt && (
                <div className="flex items-center justify-between rounded-xl border border-emerald-300/20 bg-emerald-400/10 px-3 py-2.5">
                  <p className="text-sm text-emerald-200">
                    Hoá đơn <span className="font-bold">{item.receipt.id}</span> · {item.receipt.itemCount} dịch vụ ·{' '}
                    <span className="text-white/50">{whenLabel(item.receipt.createdAt)}</span>
                  </p>
                  <p className="font-extrabold text-emerald-300">{vnd(item.receipt.totalAmount)}</p>
                </div>
              )}
              {!item.diagnose && !item.receipt && item.files.length === 0 && (
                <p className="text-sm text-white/45">Bệnh án chưa có ghi chú thêm.</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </LiquidGlassCard>
  );
}

// ─── Appointment (pending / confirmed) card ─────────────────────────
function AppointmentCard({ item }: { item: PortalItem }) {
  const [open, setOpen] = useState(false);
  return (
    <LiquidGlassCard className="!rounded-2xl" maxTilt={6}>
      <div className="px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-sky-400/10 text-sky-300">
            {item.status === 'CONFIRMED' ? <CalendarCheck2 className="size-5" /> : <ClipboardList className="size-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold text-white">{item.service}</p>
            <p className="truncate text-sm text-white/60">
              {item.petName} · {item.petType}
              {/* CHI NHÁNH, không phải bác sĩ. Trước đây chỗ này in ra
                  `addressName` (chi nhánh) mà không nói rõ là gì, đọc như tên
                  người khám. Bác sĩ thật đã hiện ở bước "Phòng khám xác nhận"
                  của dòng tiến trình. */}
              {item.branchName ? ` · ${item.branchName}` : ''}
            </p>
          </div>
          <StatusChip status={item.status} />
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
          <p className="text-white/55">{whenLabel(item.whenISO) ?? 'Đang chờ chốt giờ'}</p>
          <button
            type="button"
            onClick={() => setOpen(v => !v)}
            aria-expanded={open}
            className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/70 transition-colors hover:bg-white/10"
          >
            Ghi chú
            <ChevronDown className={cn('size-3.5 transition-transform', open && 'rotate-180')} />
          </button>
        </div>

        {/*
          Tiến trình để MỞ SẴN. Đây là câu trả lời cho câu hỏi đầu tiên của
          khách ("lịch của tôi thế nào rồi?"); giấu nó sau một nút thì người
          dùng phải bấm mới biết — tức là không ai thấy.
        */}
        {item.timeline && item.timeline.length > 0 && (
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4">
            <BookingStatusTimeline steps={item.timeline} />
          </div>
        )}

        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              key="notes"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              className="overflow-hidden"
            >
              <p className="mt-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm leading-relaxed text-white/70">
                {item.note || 'Chưa có ghi chú.'}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </LiquidGlassCard>
  );
}

// ─── Search pill with focus glow ────────────────────────────────────
function SearchPill({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="group relative block">
      <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-white/40 transition-colors group-focus-within:text-emerald-300">
        <Search className="size-4.5" />
      </span>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        type="search"
        placeholder="Tìm theo tên thú cưng, dịch vụ, trạng thái…"
        className="w-full rounded-full border border-white/15 bg-white/10 py-3.5 pl-11 pr-5 text-sm text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)] outline-none backdrop-blur-2xl transition-all duration-300 placeholder:text-white/35 focus:border-emerald-300/40 focus:bg-white/15 focus:shadow-[0_0_0_4px_rgba(52,211,153,0.15),inset_0_1px_1px_rgba(255,255,255,0.25)]"
      />
    </label>
  );
}

const FILTERS: { key: 'ALL' | PortalStatus; label: string }[] = [
  { key: 'ALL', label: 'Tất cả' },
  { key: 'PENDING', label: 'Chờ xác nhận' },
  { key: 'CONFIRMED', label: 'Đã xác nhận' },
  { key: 'COMPLETED', label: 'Hoàn thành' },
  // Thêm nút lọc "Đã huỷ" cùng lúc thêm nhóm hiển thị tương ứng. Trước đây cả
  // hai đều thiếu: không có nhóm render, cũng không có nút lọc, nên lịch đã huỷ
  // chỉ hiện khi chọn "Tất cả" — dễ bị hiểu là đã bị xoá.
  { key: 'CANCELLED', label: 'Đã huỷ' },
];

/**
 * Lịch đã huỷ — hiển thị gọn hơn lịch đang chạy.
 *
 * Lịch đã huỷ không còn hành động nào cho khách, nên chiếm chỗ tương xương với
 * lịch đang theo dõi là sai. Giữ một dòng tóm tắt và để dòng tiến trình ẩn sau
 * nút: khách thường chỉ cần biết "lịch nào đã huỷ", và mở ra khi muốn xem vì
 * sao.
 */
function CancelledCard({ item }: { item: PortalItem }) {
  const [open, setOpen] = useState(false);
  return (
    <LiquidGlassCard className="!rounded-2xl" maxTilt={4} flat>
      <div className="px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-rose-400/10 text-rose-300">
            <Ban className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold text-white/85">{item.service}</p>
            <p className="truncate text-sm text-white/60">
              {item.petName} · {item.petType}
              {item.branchName ? ` · ${item.branchName}` : ''}
            </p>
          </div>
          <StatusChip status={item.status} />
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
          <p className="text-white/55">{whenLabel(item.whenISO) ?? 'Đã chỉ huỷ khung giờ'}</p>
          {item.timeline && item.timeline.length > 0 && (
            <button
              type="button"
              onClick={() => setOpen(v => !v)}
              aria-expanded={open}
              className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/70 transition-colors hover:bg-white/10"
            >
              Tiến trình
              <ChevronDown className={cn('size-3.5 transition-transform', open && 'rotate-180')} />
            </button>
          )}
        </div>

        <AnimatePresence initial={false}>
          {open && item.timeline && (
            <motion.div
              key="timeline"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              className="overflow-hidden"
            >
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4">
                <BookingStatusTimeline steps={item.timeline} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </LiquidGlassCard>
  );
}

export default function PortalClient({ data }: { data: PortalData }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'ALL' | PortalStatus>('ALL');

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.items.filter(item => {
      if (filter !== 'ALL' && item.status !== filter) return false;
      if (!q) return true;
      return [item.petName, item.petType, item.service, item.id, item.status]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [data.items, query, filter]);

  const pendingItems = visible.filter(i => i.status === 'PENDING' || i.status === 'CONFIRMED');
  const doneItems = visible.filter(i => i.status === 'COMPLETED');
  // Phần còn lại của `visible` — trạng thái chuẩn chỉ còn CANCELLED. Ghi rõ
  // thay vì `else` để thêm một trạng thái mới sau này không lặng lẽ rơi vào
  // đây rồi biến mất lần nữa — đúng loại lỗi vừa sửa.
  const closedItems = visible.filter(i => i.status === 'CANCELLED');

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#070b16] via-[#0a1020] to-[#0d1526] px-4 pb-20 pt-10 sm:px-6 lg:px-8">
      {/* ambient liquid mesh */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-liquid-mesh" />
      <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[720px] -translate-x-1/2 rounded-full bg-emerald-400/10 blur-[120px]" />

      <div className="relative mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-10 text-center">
          <span className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-emerald-300/25 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">
            <HeartPulse className="size-3.5" /> Cổng thông tin bệnh án
          </span>
          <h1 className="bg-gradient-to-br from-white via-white/90 to-white/60 bg-clip-text text-4xl font-extrabold text-transparent sm:text-5xl">
            Hồ sơ & lịch hẹn của thú cưng
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-white/55">
            Theo dõi trạng thái lịch hẹn, bệnh án hoàn thành và hoá đơn trong một không gian kính mượt.
          </p>
          {data.demo && (
            <div className="mx-auto mt-5 inline-flex max-w-xl items-center gap-2 rounded-full border border-sky-300/25 bg-sky-400/10 px-4 py-2 text-sm text-sky-200">
              <Sparkles className="size-4 shrink-0" />
              <span>
                Bạn đang xem dữ liệu mẫu.
                <a href="/dang-nhap" className="ml-1 font-bold underline underline-offset-2">Đăng nhập</a> để xem lịch sử thật của bạn.
              </span>
            </div>
          )}
        </div>

        {/* Summary tiles */}
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Tổng hồ sơ', value: data.summary.total, icon: ClipboardList, tone: 'text-white' },
            { label: 'Chờ xác nhận', value: data.summary.pending, icon: HeartPulse, tone: 'text-amber-300' },
            { label: 'Đã xác nhận', value: data.summary.confirmed, icon: CalendarCheck2, tone: 'text-emerald-300' },
            { label: 'Hoàn thành', value: data.summary.completed, icon: BadgeCheck, tone: 'text-sky-300' },
          ].map(t => (
            <LiquidGlassCard key={t.label} flat className="!rounded-2xl">
              <div className="flex items-center gap-3 px-4 py-4">
                <t.icon className={cn('size-5 shrink-0', t.tone)} />
                <div>
                  <p className="text-2xl font-extrabold text-white">{t.value}</p>
                  <p className="text-[11px] text-white/50">{t.label}</p>
                </div>
              </div>
            </LiquidGlassCard>
          ))}
        </div>

        {/* Search + filters */}
        <div className="mb-10 space-y-4">
          <SearchPill value={query} onChange={setQuery} />
          <div className="flex flex-wrap gap-2">
            {FILTERS.map(f => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={cn(
                  'relative rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors',
                  filter === f.key
                    ? 'border-transparent text-slate-900'
                    : 'border-white/15 bg-white/5 text-white/65 hover:bg-white/10'
                )}
              >
                {filter === f.key && (
                  <motion.span
                    layoutId="portal-filter-pill"
                    className="absolute inset-0 rounded-full bg-emerald-300"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="relative z-10">{f.label}</span>
              </button>
            ))}
          </div>
        </div>

        {visible.length === 0 ? (
          <LiquidGlassCard flat className="!rounded-3xl">
            <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
              <Inbox className="size-10 text-white/25" />
              <p className="font-bold text-white/80">Không tìm thấy hồ sơ nào</p>
              <p className="text-sm text-white/45">Thử đổi từ khoá tìm kiếm hoặc bộ lọc trạng thái.</p>
            </div>
          </LiquidGlassCard>
        ) : (
          <div className="space-y-12">
            {pendingItems.length > 0 && (
              <section>
                <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-white/45">
                  <span className="inline-block size-2 rounded-full bg-emerald-300" />
                  Lịch hẹn & điều trị đang theo dõi
                  <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-xs text-white/60">{pendingItems.length}</span>
                </h2>
                <div className="space-y-3">
                  <AnimatePresence initial={false} mode="popLayout">
                    {pendingItems.map(item => (
                      <motion.div
                        key={item.id}
                        layout
                        initial={{ opacity: 0, y: 18, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95, filter: 'blur(6px)' }}
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      >
                        <AppointmentCard item={item} />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </section>
            )}

            {doneItems.length > 0 && (
              <section>
                <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-white/45">
                  <span className="inline-block size-2 rounded-full bg-sky-300" />
                  Bệnh án hoàn thành
                  <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-xs text-white/60">{doneItems.length}</span>
                </h2>
                <div className="space-y-3">
                  {doneItems.map(item => (
                    <RecordAccordion key={item.id} item={item} />
                  ))}
                </div>
              </section>
            )}

            {/* Nhóm thứ BA. Trước đây chỉ có pending và completed, nên bấm bộ lọc
                "Đã huỷ" lọc ra được các lịch đã huỷ rồi… không render gì cả:
                `visible` khác rỗng nên empty-state không hiện, còn cả hai nhóm
                đều rỗng — kết quả là một trang trắng dù dữ liệu có. */}
            {closedItems.length > 0 && (
              <section>
                <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-white/45">
                  <span className="inline-block size-2 rounded-full bg-rose-300" />
                  Lịch đã huỷ
                  <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-xs text-white/60">{closedItems.length}</span>
                </h2>
                <div className="space-y-3">
                  {closedItems.map(item => (
                    <CancelledCard key={item.id} item={item} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
