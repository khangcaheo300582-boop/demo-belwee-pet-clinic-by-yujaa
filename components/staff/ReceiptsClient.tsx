"use client";

// components/staff/ReceiptsClient.tsx
// /staff/receipts – archive of issued receipts; opens each in the milky-glass
// ReceiptModal (view + flat PDF export).

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, ReceiptText, Search } from 'lucide-react';
import type { MedicalRecord, Receipt } from '@/lib/dbMedicalRecords';
import type { StaffPublic } from '@/lib/staff-service';
import LiquidGlassCard from '@/components/ui/LiquidGlassCard';
import ReceiptModal from '@/components/staff/ReceiptModal';
import LogoutButton from '@/components/LogoutButton';

export interface ReceiptEntry {
  receipt: Receipt;
  record: Pick<MedicalRecord, 'id' | 'petName' | 'petType' | 'service' | 'ownerName' | 'ownerEmail' | 'staffName'>;
}

const vnd = (v: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(v);

interface Props {
  staff: StaffPublic;
  initialReceipts: ReceiptEntry[];
}

export default function ReceiptsClient({ staff, initialReceipts }: Props) {
  const router = useRouter();
  const [receipts, setReceipts] = useState<ReceiptEntry[]>(initialReceipts);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<ReceiptEntry | null>(null);
  const [busy, setBusy] = useState(false);

  // Lọc chỉ chạy lại khi receipts hoặc query đổi (không re-filter mỗi render).
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return receipts;
    return receipts.filter(e =>
      [e.receipt.id, e.record.petName, e.record.service, e.record.ownerName].join(' ').toLowerCase().includes(q)
    );
  }, [receipts, query]);

  async function refresh() {
    setBusy(true);
    try {
      const res = await fetch('/api/staff/receipts');
      if (res.ok) {
        const data = (await res.json()) as { receipts: ReceiptEntry[] };
        setReceipts(data.receipts);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#070b16] via-[#0b1322] to-[#0d1526] px-4 pb-24 pt-10 sm:px-6 lg:px-8">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-liquid-mesh" />
      <div aria-hidden className="pointer-events-none absolute -top-36 left-1/2 h-[400px] w-[640px] -translate-x-1/2 rounded-full bg-cyan-400/10 blur-[130px]" />

      <div className="relative mx-auto max-w-5xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <button
              type="button"
              onClick={() => router.push('/staff/dashboard')}
              className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            >
              <ArrowLeft className="size-3.5" /> Dashboard
            </button>
            <h1 className="flex items-center gap-2.5 text-3xl font-extrabold text-white sm:text-4xl">
              <ReceiptText className="size-8 text-emerald-300" /> Kho hoá đơn
            </h1>
            <p className="mt-1 text-sm text-white/50">
              {staff.name} · {staff.role} · {receipts.length} hoá đơn đã xuất
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={refresh}
              className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white/80 transition-colors hover:bg-white/10"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <ReceiptText className="size-4" />}
              Làm mới
            </button>
            <LogoutButton />
          </div>
        </div>

        <div className="mb-6">
          <label className="relative block max-w-md">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-white/35" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Tìm theo mã hoá đơn, thú cưng, dịch vụ…"
              className="w-full rounded-full border border-white/15 bg-white/10 py-3 pl-11 pr-4 text-sm text-white outline-none backdrop-blur-2xl transition-all placeholder:text-white/35 focus:border-emerald-300/40 focus:shadow-[0_0_0_4px_rgba(52,211,153,0.12)]"
            />
          </label>
        </div>

        {visible.length === 0 ? (
          <LiquidGlassCard flat className="!rounded-3xl">
            <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
              <ReceiptText className="size-10 text-white/25" />
              <p className="font-bold text-white/80">Chưa có hoá đơn nào</p>
              <p className="text-sm text-white/45">Hoàn tất một bệnh án từ dashboard để xuất hoá đơn đầu tiên.</p>
            </div>
          </LiquidGlassCard>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {visible.map(entry => (
              <LiquidGlassCard key={entry.receipt.id} flat className="!rounded-2xl">
                <button type="button" onClick={() => setOpen(entry)} className="block w-full px-5 py-4 text-left">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-white">
                        {entry.receipt.id}
                        <span className="ml-2 rounded-full border border-emerald-300/25 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                          ĐÃ THANH TOÁN
                        </span>
                      </p>
                      <p className="mt-1 text-sm text-white/65">
                        {entry.record.petName} ({entry.record.petType}) · {entry.record.service}
                      </p>
                      <p className="text-xs text-white/40">
                        {entry.record.ownerName || entry.record.ownerEmail} · {entry.receipt.items.length} dịch vụ
                      </p>
                    </div>
                    <p className="shrink-0 text-lg font-black text-emerald-300">{vnd(entry.receipt.totalAmount)}</p>
                  </div>
                  <p className="mt-3 border-t border-white/10 pt-2.5 text-xs text-white/45">
                    {new Date(entry.receipt.createdAt).toLocaleString('vi-VN', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}{' '}
                    · Xuất bởi {entry.record.staffName || 'hệ thống'}
                  </p>
                </button>
              </LiquidGlassCard>
            ))}
          </div>
        )}

        {open && <ReceiptModal mode="view" record={open.record} receipt={open.receipt} onClose={() => setOpen(null)} />}
      </div>
    </div>
  );
}
