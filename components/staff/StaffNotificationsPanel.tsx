'use client';

/**
 * components/staff/StaffNotificationsPanel.tsx
 * Màn hình quản trị nhắc lịch & thông báo (app/staff/notifications).
 *
 * Hiển thị:
 *   - Summary: hàng đợi (QUEUED/SENT/FAILED/CANCELLED) + cộng dụng kênh (email/desktop/push).
 *   - Hàng đợi: đường dẫn loại, pet, owner, channels (badge), trạng thái, sendAt — nút Retry cho FAILED.
 *   - Preferences khách: master, kênh, loại nhắc — editable (PUT preferences).
 *   - Subscriptions: list push subscriptions + status.
 *   - Analytics: open rate email, cộng theo (type, channel).
 */

import { useCallback, useEffect, useState } from 'react';

interface Summary {
  total: number; queued: number; sent: number; cancelled: number; failed: number; sentByChannel: Record<string, number>;
}
interface PrefRow {
  email: string; master: boolean; channels: Record<string, boolean>; types: Record<string, boolean>;
}
interface SubRow { id: string; email: string; endpoint: string; subId: string; deviceType: string | null; status: string }
interface QueueRow {
  id: string; type: string; scope: { type: string; entityId: string }; ownerEmail: string; petName: string;
  topic: string; dueAt: string; sendAt: string; status: string; channels: string[]; sentChannels: string[]; attempts: number; lastError: string | null;
}
interface AdminPayload {
  summary: Summary; prefs: PrefRow[]; subscriptions: SubRow[];
  deliveryStats: Array<{ key: string; value: number }>;
  deliveryEvents: Array<{ key: string; value: number }>;
}

const TYPE_LABELS: Record<string, string> = {
  appointment: 'Nhắc lịch',
  vaccination: 'Tiêm vắc-xin',
  followUp: 'Tái khám/XN',
  payment: 'Thanh toán',
  care: 'Chăm sóc',
};
const STATUS_STYLES: Record<string, string> = {
  QUEUED: 'border-amber-300/30 bg-amber-400/10 text-amber-200',
  SENT: 'border-emerald-300/30 bg-emerald-400/10 text-emerald-200',
  FAILED: 'border-rose-300/30 bg-rose-400/10 text-rose-200',
  CANCELLED: 'border-slate-300/30 bg-slate-400/10 text-slate-200',
};

function useAdmin(): { data: AdminPayload | null; loading: boolean; refetch: () => void; message: string | null } {
  const [data, setData] = useState<AdminPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/notifications', { cache: 'no-store' });
      if (res.ok) {
        const payload = (await res.json()) as AdminPayload;
        setData(payload);
      } else {
        setMessage('Không thể tải dữ liệu.');
      }
    } catch {
      setMessage('Không thể tải dữ liệu.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return { data, loading, refetch: load, message };
}

export default function StaffNotificationsPanel() {
  const { data, loading, refetch, message } = useAdmin();
  const [queueFilter, setQueueFilter] = useState('');
  const [queueRows, setQueueRows] = useState<QueueRow[]>([]);
  const [retrying, setRetrying] = useState<string | null>(null);

  const loadQueue = useCallback(async () => {
    try {
      const params = new URLSearchParams(queueFilter ? { entityId: queueFilter } : {});
      const res = await fetch(`/api/admin/notifications/queue?${params.toString()}`, { cache: 'no-store' });
      if (res.ok) {
        const payload = await res.json();
        setQueueRows(payload.rows ?? []);
      }
    } catch {
      /* ignore */
    }
  }, [queueFilter]);

  useEffect(() => { void loadQueue(); }, [loadQueue]);

  const retry = async (id: string) => {
    setRetrying(id);
    try {
      const res = await fetch('/api/admin/notifications/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'retry' }),
      });
      const out = await res.json();
      if (out.ok) {
        void loadQueue();
        void refetch();
      }
    } finally {
      setRetrying(null);
    }
  };

  if (loading) return <p className="text-sm text-white/50">Đang tải…</p>;
  const summary = data?.summary;

  return (
    <div className="space-y-6">
      {message && <p className="text-sm text-amber-200">{message}</p>}

      {/* ── Summary cards ── */}
      {summary && (
        <div className="grid gap-3 sm:grid-cols-5">
          {[
            { label: 'Tổng', value: summary.total },
            { label: 'Đang chờ', value: summary.queued },
            { label: 'Đã gửi', value: summary.sent },
            { label: 'Đã hủy', value: summary.cancelled },
            { label: 'Lỗi', value: summary.failed },
          ].map((card) => (
            <div key={card.label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xs font-semibold text-white/50">{card.label}</p>
              <p className="mt-1 text-xl font-bold text-white">{card.value}</p>
            </div>
          ))}
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:col-span-5">
            <p className="text-xs font-semibold text-white/50">Cộng dụng gửi (sentByChannel)</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {Object.entries(summary.sentByChannel).map(([channel, count]) => (
                <span key={channel} className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs text-white/80">
                  {channel}: {count}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Delivery stats ── */}
      {data?.deliveryStats && data.deliveryStats.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <p className="text-xs font-bold text-white/70">Stats: sent theo loại/kênh · events: open/click/unsubscribe</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {data.deliveryStats.map((row) => (
              <span key={row.key} className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs text-white/70">
                {row.key}: {row.value}
              </span>
            ))}
          </div>
          {data.deliveryEvents.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {data.deliveryEvents.map((row) => (
                <span key={row.key} className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs text-white/70">
                  {row.key}: {row.value}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Hàng đợi lịch hẹn ── */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">Hàng đợi nhắc lịch &amp; thông báo (QUEUE)</h3>
          <div className="flex gap-2">
            <input
              placeholder="Tìm theo mã học hẹn/booking (ví dụ: BW_...)"
              value={queueFilter}
              onChange={(e) => setQueueFilter(e.target.value)}
              className="rounded-lg border border-white/10 bg-white/[0.05] px-2 py-1 text-xs text-white/80 placeholder:text-white/30 focus:outline-none"
              onKeyDown={(e) => { if (e.key === 'Enter') void loadQueue(); }}
            />
            <button className="rounded-lg border border-white/10 bg-white/[0.05] px-2 py-1 text-xs text-white/70" onClick={() => void loadQueue()}>
              Tìm
            </button>
          </div>
        </div>
        {queueRows.length === 0 ? (
          <p className="mt-3 text-xs text-white/50">Rỗng — hàng đợi sẽ được cập nhật khi engine chạy (POST /api/cron/notifications).</p>
        ) : (
          <div className="mt-3 space-y-2">
            {queueRows.map((row) => (
              <div key={row.id} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-xs font-semibold text-white/90">
                      {row.id} · {TYPE_LABELS[row.type] ?? row.type} · {row.petName}
                    </div>
                    <div className="truncate text-[11px] text-white/50">
                      {row.ownerEmail} · {row.topic}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLES[row.status] ?? ''}`}>
                      {row.status}{row.status === 'FAILED' && row.lastError ? ` (${row.lastError.slice(0, 40)})` : ''}
                    </span>
                    {row.status === 'FAILED' && (
                      <button
                        className="rounded-full border border-emerald-300/40 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-200 disabled:opacity-50"
                        onClick={() => void retry(row.id)}
                        disabled={retrying === row.id}
                      >
                        {retrying === row.id ? '…' : 'Retry'}
                      </button>
                    )}
                  </div>
                </div>
                <div className="mt-1 text-[11px] text-white/50">
                  sendAt: {row.sendAt} · dueAt: {row.dueAt} · kênh: {row.channels.join(',') || '(none)'} · đã gửi: {row.sentChannels.join(',') || '(không)'} · lượt thử: {row.attempts}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Preferences khách ── */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
        <h3 className="text-sm font-bold text-white">Preferences của khách hàng</h3>
        {data?.prefs && data.prefs.length > 0 ? (
          <div className="mt-3 space-y-2">
            {data.prefs.map((pref) => (
              <div key={pref.email} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                <p className="text-xs font-semibold text-white/90">{pref.email} · master: {pref.master ? 'ON' : 'OFF'}</p>
                <p className="text-[10px] text-white/40">
                  kênh: {Object.entries(pref.channels).filter(([, v]) => v).map(([k]) => k).join(',') || '(không)'} · loại: {Object.entries(pref.types).filter(([, v]) => v).map(([k]) => k).join(',') || '(không)'}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-xs text-white/50">Không có preferences — khách chưa set trên trang cá nhân (mặc định: email on).</p>
        )}
      </div>

      {/* ── Subscriptions push ── */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
        <h3 className="text-sm font-bold text-white">Subscriptions Web Push</h3>
        {data?.subscriptions && data.subscriptions.length > 0 ? (
          <div className="mt-3 space-y-2">
            {data.subscriptions.map((sub) => (
              <div key={sub.id} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                <p className="truncate text-xs font-semibold text-white/90">{sub.email} · {sub.status}</p>
                <p className="truncate text-[10px] text-white/40">
                  subId: {sub.subId} · endpoint: {sub.endpoint?.slice(0, 60)}{sub.endpoint.length > 60 ? '…' : ''}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-xs text-white/50">Không có subscription đăng ký push.</p>
        )}
      </div>
    </div>
  );
}
