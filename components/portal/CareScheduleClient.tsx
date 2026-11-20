"use client";

// components/portal/CareScheduleClient.tsx
// /care-schedule – "Ống thuỷ tinh" (liquid stream) timeline.
// - Fluid pet tabs (Cún 🐶 / Mèo 🐱) with a sliding glass indicator (layoutId)
// - A glass rail whose emerald stream fills with page scroll (useScroll → useTransform)
// - Milestone bubble cards that pop in when they enter the viewport (once)

import { useRef, useState } from 'react';
import { motion, useScroll, useSpring, useTransform } from 'framer-motion';
import { CalendarRange, PawPrint, Sparkles, Stethoscope } from 'lucide-react';
import LiquidGlassCard from '@/components/ui/LiquidGlassCard';
import { cn } from '@/lib/utils';
import type { CareData, CareEvent, PortalStatus } from '@/lib/portalData';

const STATUS_META: Record<PortalStatus, { label: string; chip: string }> = {
  PENDING: { label: 'Chờ xác nhận', chip: 'border-amber-300/25 bg-amber-400/10 text-amber-300' },
  CONFIRMED: { label: 'Đã xác nhận', chip: 'border-emerald-300/25 bg-emerald-400/10 text-emerald-300' },
  COMPLETED: { label: 'Hoàn thành', chip: 'border-sky-300/25 bg-sky-400/10 text-sky-300' },
  CANCELLED: { label: 'Đã huỷ', chip: 'border-rose-300/25 bg-rose-400/10 text-rose-300' },
};

function dayTitle(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const today = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(d) - startOf(today)) / 86_400_000);
  if (diffDays === 0) return 'Hôm nay';
  if (diffDays === 1) return 'Ngày mai';
  if (diffDays === -1) return 'Hôm qua';
  return d.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit' });
}

function dayIsPast(iso: string): boolean {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() < Date.now() - 12 * 60 * 60 * 1000;
}

function timeOf(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function MilestoneCard({ event, index }: { event: CareEvent; index: number }) {
  const meta = STATUS_META[event.status];
  const past = dayIsPast(event.whenISO);
  return (
    <motion.div
      initial={{ y: 50, scale: 0.8, opacity: 0 }}
      whileInView={{ y: 0, scale: 1, opacity: 1 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ type: 'spring', stiffness: 260, damping: 24, delay: 0.04 * index }}
      className="relative pl-12 sm:pl-14"
    >
      {/* bubble pop-in */}
      <motion.div
        aria-hidden
        initial={{ scale: 0 }}
        whileInView={{ scale: [0, 1.25, 1] }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className={cn(
          'absolute left-0 top-5 flex size-8 items-center justify-center rounded-full border text-sm',
          past ? 'border-white/10 bg-white/5' : 'border-emerald-300/40 bg-[#0c1322] shadow-[0_0_18px_rgba(52,211,153,0.35),inset_0_1px_1px_rgba(255,255,255,0.3)]'
        )}
      >
        {event.petType === 'Mèo' ? '🐱' : '🐶'}
      </motion.div>

      <LiquidGlassCard flat className={cn('!rounded-2xl', past && 'opacity-75 saturate-50')}>
        <div className="px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-bold text-white">
              {event.service}
              <span className="ml-2 font-semibold text-white/45">· {event.petName}</span>
            </p>
            <span className={cn('rounded-full border px-2.5 py-0.5 text-[11px] font-semibold', meta.chip)}>{meta.label}</span>
          </div>
          {event.milestone && <p className="mt-1 text-sm text-emerald-300/90">{event.milestone}</p>}
          <div className="mt-2.5 flex items-center justify-between gap-2">
            <p className="text-xs text-white/45">
              <CalendarRange className="mr-1 inline size-3.5 align-[-2px]" />
              {dayTitle(event.whenISO)} · {timeOf(event.whenISO)}
            </p>
            {event.note && <p className="truncate pl-3 text-right text-xs italic text-white/40">{event.note}</p>}
          </div>
        </div>
      </LiquidGlassCard>
    </motion.div>
  );
}

export default function CareScheduleClient({ data }: { data: CareData }) {
  const [activeTab, setActiveTab] = useState(data.tabs[0]?.key ?? 'Cún');
  const listRef = useRef<HTMLDivElement>(null);

  // Emerald liquid level inside the glass stream grows as you scroll the timeline.
  const { scrollYProgress } = useScroll({ target: listRef, offset: ['start 0.82', 'end 0.45'] });
  const springProgress = useSpring(scrollYProgress, { stiffness: 90, damping: 24, mass: 0.6 });
  const fillHeight = useTransform(springProgress, [0, 1], ['0%', '100%']);

  const activeCat = data.tabs.find(t => t.key === activeTab) ?? data.tabs[0];
  const events = activeCat?.events ?? [];

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#070b16] via-[#0b1322] to-[#0d1526] px-4 pb-24 pt-10 sm:px-6 lg:px-8">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-liquid-mesh" />
      <div aria-hidden className="pointer-events-none absolute -top-32 right-0 h-[420px] w-[560px] rounded-full bg-cyan-400/10 blur-[120px]" />
      <div aria-hidden className="pointer-events-none absolute bottom-0 left-0 h-[380px] w-[520px] rounded-full bg-emerald-400/10 blur-[120px]" />

      <div className="relative mx-auto max-w-4xl">
        <div className="mb-8 text-center">
          <span className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-emerald-300/25 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">
            <Stethoscope className="size-3.5" /> Lịch chăm sóc thú cưng
          </span>
          <h1 className="bg-gradient-to-br from-white via-white/90 to-white/60 bg-clip-text text-4xl font-extrabold text-transparent sm:text-5xl">
            Dòng thời gian chăm sóc
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-white/55">
            Mỗi mốc là một lần hẹn, tiêm phòng hay tái khám – cuộn xuống để nhìn thấy dòng sáng xanh chảy trong ống thuỷ tinh.
          </p>
          {data.demo && (
            <div className="mx-auto mt-5 inline-flex items-center gap-2 rounded-full border border-sky-300/25 bg-sky-400/10 px-4 py-2 text-sm text-sky-200">
              <Sparkles className="size-4 shrink-0" />
              <span>
                Bạn đang xem lịch mẫu.
                <a href="/dang-nhap" className="ml-1 font-bold underline underline-offset-2">Đăng nhập</a> để xem lịch của thú cưng bạn.
              </span>
            </div>
          )}
        </div>

        {/* Fluid pet tabs */}
        <div className="mx-auto mb-10 flex w-fit rounded-full border border-white/10 bg-white/5 p-1.5 backdrop-blur-2xl shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]">
          {data.tabs.map(tab => {
            const active = tab.key === activeTab;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'relative flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition-colors sm:px-7',
                  active ? 'text-slate-900' : 'text-white/60 hover:text-white/85'
                )}
              >
                {active && (
                  <motion.span
                    layoutId="activeTabVision"
                    className="absolute inset-0 rounded-full bg-white/85 shadow-[inset_0_1px_1px_rgba(255,255,255,0.9),0_8px_24px_rgba(255,255,255,0.15)]"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="relative z-10">{tab.emoji}</span>
                <span className="relative z-10 hidden sm:inline">{tab.label}</span>
                <span className={cn('relative z-10 rounded-full px-1.5 text-[11px]', active ? 'bg-slate-900/10' : 'bg-white/10')}>
                  {tab.events.length}
                </span>
              </button>
            );
          })}
        </div>

        {/* Timeline */}
        {events.length === 0 ? (
          <LiquidGlassCard flat className="!rounded-3xl">
            <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
              <PawPrint className="size-10 text-white/25" />
              <p className="font-bold text-white/80">Chưa có lịch cho nhóm này</p>
              <p className="max-w-sm text-sm text-white/45">Đặt lịch khám / spa trên trang chủ để bắt đầu dòng thời gian chăm sóc cho {activeCat?.label.toLowerCase() ?? activeTab.toLowerCase()} của bạn.</p>
            </div>
          </LiquidGlassCard>
        ) : (
          <div ref={listRef} className="relative">
            {/* Glass stream rail */}
            <div aria-hidden className="absolute bottom-4 left-4 top-2 w-1.5 rounded-full bg-white/10 shadow-[inset_0_1px_2px_rgba(0,0,0,0.35)] backdrop-blur-md sm:left-5">
              <motion.div
                className="w-full origin-top rounded-full bg-gradient-to-b from-emerald-300 via-emerald-400 to-cyan-400 shadow-[0_0_14px_rgba(52,211,153,0.8)]"
                style={{ height: fillHeight }}
              />
            </div>

            <div key={activeTab} className="space-y-6">
              {events.map((event, i) => (
                <MilestoneCard key={event.id} event={event} index={i} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
