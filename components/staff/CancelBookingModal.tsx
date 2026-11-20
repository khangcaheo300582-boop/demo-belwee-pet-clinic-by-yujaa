'use client';

// components/staff/CancelBookingModal.tsx
// Confirm-before-cancelling dialog for the staff queue.
//
// Cancelling is irreversible from the UI (the state machine treats CANCELLED as
// terminal and voids the customer's email confirmation link), so the old
// window.confirm() was the wrong tool twice over: it blocks the main thread,
// cannot be styled, and — the real problem — it showed a single interpolated
// sentence. The staff member needed to actually SEE the customer's name, phone,
// pet, service, time and branch before pulling the appointment.
//
// Two-step: review → type-to-confirm. The second step exists because the button
// that destroys a booking should not be one stray click away from the button
// that opens this dialog.

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  CalendarClock,
  Loader2,
  MapPin,
  MessageSquare,
  Phone,
  RotateCcw,
  StickyNote,
  X,
} from 'lucide-react';
import type { StaffAppointment } from '@/lib/staffAppointments';
import { cn } from '@/lib/utils';

interface Props {
  appointment: StaffAppointment;
  /** Cancelling is a permission-gated action; the button hides when false. */
  allowed: boolean;
  onClose: () => void;
  onConfirm: (id: string) => Promise<void>;
}

function Row({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Phone;
  label: string;
  value: string | null | undefined;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-emerald-300/80" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-white/40">
          {label}
        </span>
        <span className="mt-0.5 block break-words text-sm font-semibold text-white/90">{value}</span>
      </span>
    </div>
  );
}

export default function CancelBookingModal({ appointment, allowed, onClose, onConfirm }: Props) {
  const [step, setStep] = useState<'review' | 'confirm'>('review');
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const word = 'HUỶ';

  // Esc closes only from the review step — from the confirm step the user has
  // already stated intent and a stray Esc should not silently discard it.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (step === 'confirm' || busy) return;
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step, busy, onClose]);

  // Lock body scroll so the page behind cannot move while the card is up.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    if (step !== 'confirm') return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 220);
    return () => window.clearTimeout(t);
  }, [step]);

  async function run() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm(appointment.id);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể huỷ lịch. Vui lòng thử lại.');
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[95] flex items-start justify-center overflow-y-auto bg-slate-950/75 p-4 py-[8vh] backdrop-blur-md sm:items-center sm:py-8"
      onClick={(e) => {
        if (e.target !== e.currentTarget) return;
        if (step === 'review' && !busy) onClose();
      }}
    >
      <motion.div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-booking-title"
        initial={{ opacity: 0, y: 24, scale: 0.96, filter: 'blur(8px)' }}
        animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
        exit={{ opacity: 0, y: 16, scale: 0.97, filter: 'blur(6px)' }}
        transition={{ type: 'spring', stiffness: 340, damping: 30 }}
        className="w-full max-w-lg overflow-hidden rounded-[28px] border border-white/15 bg-white/[0.07] shadow-spatial-depth backdrop-blur-3xl"
        // Centre the card itself, not just the overlay box: `items-center` on a
        // scrollable overlay pushes a tall card to the top on short viewports.
        // margin: auto centres it and still allows scrolling.
        style={{ margin: 'auto' }}
      >
        {/* Danger header */}
        <div className="relative overflow-hidden border-b border-rose-300/20 bg-gradient-to-r from-rose-500/18 via-rose-500/10 to-transparent px-6 py-5">
          <div className="relative z-10 flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-rose-300/30 bg-rose-500/15">
                <AlertTriangle className="size-5 text-rose-300" aria-hidden="true" />
              </span>
              <div>
                <h2
                  id="cancel-booking-title"
                  className="text-lg font-extrabold tracking-tight text-white"
                >
                  Huỷ lịch hẹn
                </h2>
                <p className="mt-0.5 text-xs text-white/55">
                  Mã lịch: <span className="font-mono text-white/75">{appointment.id}</span>
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              aria-label="Đóng"
              className="flex size-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/60 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
            >
              <X className="size-4.5" />
            </button>
          </div>
        </div>

        <AnimatePresence mode="wait" initial={false}>
          {step === 'review' ? (
            <motion.div
              key="review"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="space-y-4 px-6 py-5"
            >
              {/* Full booking detail — the reason this dialog exists at all. */}
              <div className="space-y-2">
                <Row icon={StickyNote} label="Khách hàng" value={appointment.ownerName} />
                {appointment.ownerPhone && (
                  <a
                    href={`tel:${appointment.ownerPhone}`}
                    className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 transition-colors hover:border-emerald-300/30 hover:bg-white/[0.08]"
                  >
                    <Phone className="mt-0.5 size-4 shrink-0 text-emerald-300/80" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-white/40">
                        Số điện thoại
                      </span>
                      <span className="mt-0.5 block text-sm font-semibold text-white/90">
                        {appointment.ownerPhone}
                      </span>
                    </span>
                  </a>
                )}
                <Row
                  icon={StickyNote}
                  label="Thú cưng"
                  value={`${appointment.petName} · ${appointment.petType}`}
                />
                <Row icon={StickyNote} label="Dịch vụ" value={appointment.service} />
                <Row icon={CalendarClock} label="Ngày giờ" value={appointment.time} />
                <Row icon={MapPin} label="Chi nhánh" value={appointment.addressName} />
                <Row icon={MessageSquare} label="Ghi chú" value={appointment.notes} />
              </div>

              <p className="rounded-xl border border-amber-300/25 bg-amber-400/10 px-3 py-2.5 text-[11px] leading-relaxed text-amber-200">
                Huỷ lịch là <strong>không thể hoàn tác</strong> từ hệ thống và link xác nhận qua
                email sẽ bị vô hiệu hoá. Khách hàng sẽ nhận được thông báo ngay.
              </p>

              <div className="flex flex-col gap-2.5 pt-1 sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={() => setStep('confirm')}
                  disabled={!allowed || busy}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-extrabold transition-all duration-200 active:scale-[0.985]',
                    allowed
                      ? 'bg-rose-500 text-white shadow-[0_14px_34px_-14px_rgba(244,63,94,0.7)] hover:bg-rose-400'
                      : 'cursor-not-allowed border border-white/10 bg-white/5 text-white/30'
                  )}
                >
                  <X className="size-4" aria-hidden="true" />
                  Huỷ lịch
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={busy}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-bold text-white/75 transition-all duration-200 hover:bg-white/10 hover:text-white active:scale-[0.985]"
                >
                  <RotateCcw className="size-4" aria-hidden="true" />
                  Quay lại
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="confirm"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="space-y-4 px-6 py-5"
            >
              <p className="text-sm leading-relaxed text-white/80">
                Để xác nhận, nhập{' '}
                <span className="rounded-md border border-rose-300/30 bg-rose-500/15 px-2 py-0.5 font-mono text-xs font-bold text-rose-200">
                  {word}
                </span>{' '}
                bên dưới.
              </p>

              <div>
                <label htmlFor="cancel-typing" className="sr-only">
                  Nhập HUỶ để xác nhận
                </label>
                <input
                  ref={inputRef}
                  id="cancel-typing"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value.toUpperCase())}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={word}
                  className={cn(
                    'w-full rounded-2xl border border-white/15 bg-white/[0.06] px-4 py-3 text-center font-mono text-lg font-extrabold tracking-[0.3em] text-white outline-none backdrop-blur-xl transition-colors placeholder:text-white/20',
                    'focus:border-rose-300/60 focus:shadow-[0_0_0_4px_rgba(244,63,94,0.16)]'
                  )}
                />
              </div>

              {error && (
                <p
                  role="alert"
                  className="rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200"
                >
                  {error}
                </p>
              )}

              <div className="flex flex-col gap-2.5 pt-1 sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={run}
                  disabled={typed.trim() !== word || busy}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-extrabold transition-all duration-200 active:scale-[0.985]',
                    typed.trim() === word && !busy
                      ? 'bg-rose-500 text-white shadow-[0_14px_34px_-14px_rgba(244,63,94,0.7)] hover:bg-rose-400'
                      : 'cursor-not-allowed bg-white/10 text-white/35'
                  )}
                >
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <AlertTriangle className="size-4" aria-hidden="true" />
                  )}
                  {busy ? 'Đang huỷ…' : 'Xác nhận huỷ lịch'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTyped('');
                    setError(null);
                    setStep('review');
                  }}
                  disabled={busy}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-bold text-white/75 transition-all duration-200 hover:bg-white/10 hover:text-white active:scale-[0.985]"
                >
                  Quay lại
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}