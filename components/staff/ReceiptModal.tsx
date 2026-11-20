"use client";

// components/staff/ReceiptModal.tsx
// Milky-glass receipt modal with:
// - Service item editor (create mode) + server-computed total
// - Ripple stamp: when completing, the "ĐÃ HOÀN TẤT" stamp slams onto the glass
//   (animate-stamp-drop) and a shockwave ring expands outward (animate-ripple-expand)
// - Flat, sharp PDF export via html2pdf.js (glass effects are outside the paper sheet)

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  BadgeCheck,
  Download,
  Loader2,
  PawPrint,
  Plus,
  Printer,
  ReceiptText,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import type { MedicalRecord, Receipt, ReceiptItem } from '@/lib/dbMedicalRecords';
import { cn } from '@/lib/utils';

interface ReceiptModalProps {
  mode: 'create' | 'view';
  record: Pick<MedicalRecord, 'id' | 'petName' | 'petType' | 'service' | 'ownerName' | 'ownerEmail' | 'staffName'>;
  receipt?: Receipt | null;
  onClose: () => void;
  onSaved?: (record: MedicalRecord) => void;
}

const vnd = (value: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value);

function emptyRow(): ReceiptItem {
  return { name: '', price: 0, qty: 1 };
}

// ─── The flat paper sheet captured for PDF ──────────────────────────
function PaperSheet({ record, receipt, compact = false }: { record: ReceiptModalProps['record']; receipt: Receipt; compact?: boolean }) {
  const when = receipt.createdAt
    ? new Date(receipt.createdAt).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div className={cn('mx-auto w-full rounded-2xl bg-white px-6 py-5 text-slate-900 shadow-[0_2px_10px_rgba(0,0,0,0.08)] sm:px-7', compact && 'text-[12px]')}>
      <div className="flex items-start justify-between border-b-2 border-dashed border-slate-200 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-600 text-white">
            <PawPrint className="size-5" />
          </div>
          <div>
            <p className="text-sm font-extrabold leading-tight">Belwee Pet Clinic</p>
            <p className="text-[11px] text-slate-500">Phòng khám & chăm sóc thú cưng</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[11px] text-slate-500">Hoá đơn</p>
          <p className="text-sm font-extrabold text-emerald-700">{receipt.id}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 border-b border-slate-100 py-3 text-[12px] sm:grid-cols-4">
        <div>
          <p className="font-bold text-slate-400">Khách hàng</p>
          <p className="font-semibold">{record.ownerName || record.ownerEmail}</p>
        </div>
        <div>
          <p className="font-bold text-slate-400">Thú cưng</p>
          <p className="font-semibold">
            {record.petName} ({record.petType})
          </p>
        </div>
        <div>
          <p className="font-bold text-slate-400">Dịch vụ</p>
          <p className="font-semibold">{record.service}</p>
        </div>
        <div>
          <p className="font-bold text-slate-400">Bác sĩ / NV</p>
          <p className="font-semibold">{record.staffName || '—'}</p>
        </div>
      </div>

      <p className="pt-3 text-[11px] font-bold text-slate-400">Thời gian: {when}</p>

      <table className="mt-1 w-full text-[12.5px]">
        <thead>
          <tr className="border-b border-slate-200 text-left text-[10.5px] uppercase tracking-wide text-slate-400">
            <th className="py-1.5 font-bold">Dịch vụ</th>
            <th className="py-1.5 text-right font-bold">Đơn giá</th>
            <th className="py-1.5 text-center font-bold">SL</th>
            <th className="py-1.5 text-right font-bold">Thành tiền</th>
          </tr>
        </thead>
        <tbody>
          {receipt.items.map((item, i) => (
            <tr key={i} className="border-b border-slate-100">
              <td className="py-2 font-semibold">{item.name}</td>
              <td className="py-2 text-right tabular-nums">{vnd(item.price)}</td>
              <td className="py-2 text-center tabular-nums">{item.qty}</td>
              <td className="py-2 text-right font-semibold tabular-nums">{vnd(item.price * item.qty)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-2 flex items-center justify-between rounded-xl bg-emerald-50 px-4 py-2.5">
        <span className="text-xs font-bold uppercase tracking-wide text-emerald-700">Tổng cộng</span>
        <span className="text-lg font-black tabular-nums text-emerald-700">{vnd(receipt.totalAmount)}</span>
      </div>

      {receipt.note && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[11.5px] text-amber-800">{receipt.note}</p>}

      <div className="mt-4 border-t border-dashed border-slate-200 pt-2 text-center text-[10px] text-slate-400">
        📍 Cảm ơn bạn đã tin tưởng Belwee Pet Clinic · Hotline 0772 003 915 · Hoá đơn xuất bởi hệ thống nội bộ
      </div>
    </div>
  );
}

// ─── Ripple stamp overlay (CSS-driven stampDrop + rippleExpand) ─────
function StampOverlay({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center overflow-hidden">
      <span className="absolute h-40 w-40 animate-ripple-expand rounded-full border-[3px] border-emerald-400/70" />
      <div className="absolute flex flex-col items-center">
        <span className="animate-stamp-drop flex items-center gap-1 rounded-2xl border-[3px] border-red-500/90 px-4 py-2 text-red-500 shadow-[0_0_24px_rgba(239,68,68,0.35)] backdrop-blur-[2px]">
          <BadgeCheck className="size-5" />
          <span className="text-sm font-black uppercase tracking-widest">Đã hoàn tất</span>
        </span>
        <span className="mt-1 text-[10px] font-bold uppercase tracking-widest text-emerald-600/80">đã thanh toán</span>
      </div>
    </div>
  );
}

export default function ReceiptModal({ mode, record, receipt: initialReceipt, onClose, onSaved }: ReceiptModalProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<ReceiptItem[]>(initialReceipt?.items?.length ? initialReceipt.items : [emptyRow()]);
  const [note, setNote] = useState(initialReceipt?.note ?? '');
  const [phase, setPhase] = useState<'edit' | 'stamped'>(mode === 'create' && !initialReceipt ? 'edit' : 'stamped');
  const [stamped, setStamped] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(initialReceipt ?? null);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Escape must not fire while a save is in flight: the record is already
      // marked COMPLETED server-side by then, and closing the card would hide
      // the only confirmation the staff member had.
      if (e.key === 'Escape' && !saving && !exporting) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, saving, exporting]);

  // Lock the page behind so it cannot scroll under the card.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const total = useMemo(() => items.reduce((sum, i) => sum + (Number(i.price) || 0) * (Number(i.qty) || 1), 0), [items]);
  const canComplete = useMemo(() => items.some(i => i.name.trim() && (Number(i.price) || 0) > 0), [items]);

  function updateItem(i: number, patch: Partial<ReceiptItem>) {
    setItems(prev => prev.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }

  async function completeAndStamp() {
    if (!canComplete) {
      setError('Cần ít nhất một dịch vụ với đơn giá hợp lệ.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/staff/receipts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordId: record.id,
          note: note.trim() || null,
          items: items
            .filter(i => i.name.trim())
            .map(i => ({ name: i.name.trim(), price: Math.max(0, Math.round(Number(i.price) || 0)), qty: Math.max(1, Math.round(Number(i.qty) || 1)) })),
        }),
      });
      const data = (await res.json()) as { record?: MedicalRecord; message?: string };
      if (!res.ok || !data.record?.receipt) {
        throw new Error(data.message || 'Không thể xuất hoá đơn.');
      }
      setReceipt(data.record.receipt);
      setPhase('stamped');
      // Trigger the stamp + ripple after the sheet is painted.
      window.setTimeout(() => setStamped(true), 60);
      onSaved?.(data.record);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể xuất hoá đơn.');
    } finally {
      setSaving(false);
    }
  }

  async function exportPdf() {
    const el = sheetRef.current;
    if (!el) return;
    setExporting(true);
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      await html2pdf()
        .set({
          margin: [6, 6, 6, 6],
          filename: `Hoa-don-${receipt?.id || record.id}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        })
        .from(el)
        .save();
    } catch {
      setError('Xuất PDF thất bại trên trình duyệt này. Hãy thử lại.');
    } finally {
      setExporting(false);
    }
  }

  return (
    // Centre both axes and let the OVERLAY scroll. `items-center` on a flex
    // container clips a child taller than the container at both ends, so a
    // receipt with many line items lost its own header above the fold and the
    // Save button below it. `margin: auto` centres when it fits and scrolls when
    // it does not.
    <div
      className="fixed inset-0 z-[95] flex justify-center overflow-y-auto bg-slate-950/75 p-4 py-[6vh] backdrop-blur-md"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="receipt-modal-title"
        style={{ margin: 'auto' }}
        initial={{ opacity: 0, y: 28, scale: 0.95, filter: 'blur(10px)' }}
        animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
        exit={{ opacity: 0, y: 18, scale: 0.96, filter: 'blur(8px)' }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        className="relative max-h-[85vh] w-full max-w-2xl overflow-y-auto overscroll-contain rounded-[28px] border border-white/15 bg-[#0b1120]/90 p-6 shadow-spatial-depth backdrop-blur-3xl sm:p-7"
        onClick={e => e.stopPropagation()}
      >
        {/* Ambient inner glow */}
        <div aria-hidden className="pointer-events-none absolute inset-0 rounded-[inherit] bg-glass-noise opacity-60" />

        <div className="relative z-10">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-emerald-300">
                <ReceiptText className="size-5" />
              </div>
              <div>
                <h2 id="receipt-modal-title" className="text-lg font-extrabold text-white">
                  {mode === 'create' && phase === 'edit' ? 'Xuất hoá đơn & hoàn tất' : 'Hoá đơn dịch vụ'}
                </h2>
                <p className="text-sm text-white/55">
                  {record.petName} · {record.service}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex size-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X className="size-4.5" />
            </button>
          </div>

          {/* ── Create mode: item editor ─────────────────────────── */}
          {mode === 'create' && phase === 'edit' && !receipt && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <p className="text-xs font-bold uppercase tracking-wider text-white/45">Dịch vụ trong hoá đơn</p>
                  <button
                    type="button"
                    onClick={() => setItems(prev => [...prev, emptyRow()])}
                    className="flex items-center gap-1 rounded-full border border-emerald-300/25 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300 transition-colors hover:bg-emerald-400/20"
                  >
                    <Plus className="size-3.5" /> Thêm dòng
                  </button>
                </div>

                <div className="hidden grid-cols-[1fr_110px_64px_110px_32px] gap-2 px-1 text-[10.5px] font-bold uppercase tracking-wider text-white/35 sm:grid">
                  <span>Dịch vụ</span>
                  <span className="text-right">Đơn giá (₫)</span>
                  <span className="text-center">SL</span>
                  <span className="text-right">Thành tiền</span>
                  <span />
                </div>

                {items.map((item, i) => (
                  <div key={i} className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-white/5 p-2.5 sm:grid-cols-[1fr_110px_64px_110px_32px] sm:items-center">
                    <input
                      value={item.name}
                      onChange={e => updateItem(i, { name: e.target.value })}
                      placeholder="VD: Khám tổng quát"
                      className="col-span-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-emerald-300/40 sm:col-span-1"
                    />
                    <input
                      value={item.price || ''}
                      onChange={e => updateItem(i, { price: Number(e.target.value.replace(/\D/g, '')) })}
                      inputMode="numeric"
                      placeholder="250000"
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-emerald-300/40"
                    />
                    <input
                      value={item.qty}
                      onChange={e => updateItem(i, { qty: Math.max(1, Number(e.target.value.replace(/\D/g, '')) || 1) })}
                      inputMode="numeric"
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-center text-sm text-white outline-none focus:border-emerald-300/40"
                    />
                    <p className="flex items-center justify-end pr-1 text-sm font-bold tabular-nums text-emerald-300">{vnd((Number(item.price) || 0) * (Number(item.qty) || 1))}</p>
                    <button
                      type="button"
                      onClick={() => setItems(prev => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev))}
                      disabled={items.length === 1}
                      className="flex size-8 items-center justify-center self-center justify-self-end rounded-full border border-red-300/20 bg-red-500/10 text-red-300 transition-colors hover:bg-red-500/25 disabled:opacity-30 sm:justify-self-auto"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}

                <div className="flex items-center justify-end gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-white/45">Tổng cộng</span>
                  <span className="text-lg font-black tabular-nums text-emerald-300">{vnd(total)}</span>
                </div>
              </div>

              <input
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Ghi chú (tuỳ chọn) — VD: Đã thanh toán chuyển khoản"
                className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white outline-none backdrop-blur-xl placeholder:text-white/30 focus:border-emerald-300/50"
              />

              {error && (
                <p className="rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300">{error}</p>
              )}

              <button
                type="button"
                onClick={completeAndStamp}
                disabled={saving}
                className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-emerald-400 py-3.5 text-sm font-extrabold text-slate-950 shadow-liquid-glow-emerald transition-all hover:bg-emerald-300 disabled:opacity-60"
              >
                {saving ? <Loader2 className="size-4.5 animate-spin" /> : <Sparkles className="size-4.5" />}
                {saving ? 'Đang đóng dấu…' : 'Hoàn tất & đóng dấu'}
              </button>
            </div>
          )}

          {/* ── Receipt sheet (+ stamp when freshly completed) ─────── */}
          {(phase === 'stamped' || mode === 'view') && receipt && (
            <div className="relative">
              <div ref={sheetRef} className="relative rounded-2xl">
                <PaperSheet record={record} receipt={receipt} />
              </div>
              {/* Static faint stamp when re-viewing a historical receipt */}
              {mode === 'view' && !stamped && (
                <div aria-hidden className="pointer-events-none absolute inset-x-0 top-8 z-20 flex justify-center">
                  <span className="flex rotate-[-15deg] items-center gap-1 rounded-2xl border-[3px] border-red-400/45 px-4 py-2 text-red-400/70">
                    <BadgeCheck className="size-4" />
                    <span className="text-xs font-black uppercase tracking-widest">Đã hoàn tất</span>
                  </span>
                </div>
              )}
              <StampOverlay show={stamped} />

              {error && (
                <p className="mt-3 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300">{error}</p>
              )}

              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={exportPdf}
                  disabled={exporting}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/10 py-3 text-sm font-bold text-white backdrop-blur-xl transition-colors hover:bg-white/15 disabled:opacity-60"
                >
                  {exporting ? <Loader2 className="size-4.5 animate-spin" /> : <Printer className="size-4.5" />}
                  {exporting ? 'Đang tạo PDF…' : 'In / xuất PDF'}
                </button>
                {mode === 'view' ? (
                  <a
                    href="/staff/receipts"
                    className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-400 py-3 text-sm font-extrabold text-slate-950 shadow-liquid-glow-emerald transition-colors hover:bg-emerald-300"
                  >
                    <Download className="size-4.5" /> Danh sách hoá đơn
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-400 py-3 text-sm font-extrabold text-slate-950 shadow-liquid-glow-emerald transition-colors hover:bg-emerald-300"
                  >
                    <BadgeCheck className="size-4.5" /> Hoàn tất
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
