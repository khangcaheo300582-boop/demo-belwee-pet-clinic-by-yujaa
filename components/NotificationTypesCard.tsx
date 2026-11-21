'use client';

/**
 * components/NotificationTypesCard.tsx
 * Checkbox theo loại nhắc (appointment / vaccination / followUp / payment / care)
 * — khách chủ động chọn loại nhắc nhận qua kênh chính (email/desktop/push),
 * theo Invariant 6 (không nhận loại đang tắt + có cách hủy qua Preferences).
 */

import { useCallback, useEffect, useState } from 'react';

interface PrefsResponse {
  ok: boolean;
  prefs: {
    email: string;
    master: boolean;
    channels: Record<string, boolean>;
    types: Record<string, boolean>;
  } | null;
}

interface ToggleSpec {
  key: string;
  label: string;
  description: string;
}

const TYPE_SPECS: ToggleSpec[] = [
  { key: 'appointment', label: 'Nhắc lịch hẹn', description: 'Xác nhận đặt lịch (cắt tóc, gâm răng...) sẵn sàng 2 ngày trước.' },
  { key: 'vaccination', label: 'Nhắc tiêm vắc-xin', description: 'Tiêm vắc-xin/tiêm ngừa theo phác đồ (tiêm lại sau 1 năm...).' },
  { key: 'followUp', label: 'Nhắc tái khám/xét nghiệm', description: 'Kiểm tra định kỳ (xét nghiệm, thị lực, khiếm khuyết...).' },
  { key: 'payment', label: 'Nhắc thanh toán', description: 'Thanh toán sau tiêu chuẩn (dữ liệu cho phép sau).' },
  { key: 'care', label: 'Nhắc chăm sóc', description: 'Nhắc chăm sóc định kỳ từ form "Chăm sóc cho bé cưng".' },
];

function defaultPrefs() {
  return {
    master: true,
    channels: { email: true } as Record<string, boolean>,
    types: Object.fromEntries(TYPE_SPECS.map((s) => [s.key, true])) as Record<string, boolean>,
  };
}

export default function NotificationTypesCard() {
  const [prefs, setPrefs] = useState(defaultPrefs);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/customer/notification-preferences', { cache: 'no-store' });
      const data = (await res.json()) as PrefsResponse;
      if (data.ok && data.prefs) {
        setPrefs({
          master: data.prefs.master,
          channels: data.prefs.channels,
          types: { ...defaultPrefs().types, ...data.prefs.types },
        });
      }
    } catch {
      /* offline — keep defaults */
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(async (patch: Partial<typeof prefs>) => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch('/api/customer/notification-preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error('Lưu thông báo thất bập');
      const data = (await res.json()) as PrefsResponse;
      if (data.ok && data.prefs) {
        setPrefs({ master: data.prefs.master, channels: data.prefs.channels, types: { ...defaultPrefs().types, ...data.prefs.types } });
      }
      setMessage('Đã lưu.');
    } catch (e) {
      setMessage((e instanceof Error ? e.message : 'Lỗi lưu.') + ' — Các thay đổi chưa được lưu.');
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <h4 className="text-sm font-bold text-[var(--pf-text)]">Chọn loại nhắc lịch bạn muốn nhận</h4>
      <ul className="space-y-2.5">
        {TYPE_SPECS.map((spec) => {
          const on = prefs.types[spec.key] !== false;
          return (
            <li key={spec.key} className="flex items-start justify-between gap-3">
              <div>
                <span className="block text-sm font-semibold text-[var(--pf-text)]">{spec.label}</span>
                <span className="text-xs text-[var(--pf-text-mute)]">{spec.description}</span>
              </div>
              <button
                type="button"
                onClick={() => void save({ types: { ...prefs.types, [spec.key]: !on } })}
                disabled={busy}
                role="switch"
                aria-checked={on}
                className={`ml-2 grid h-5 w-9 place-items-center rounded-full border transition-colors ${on ? 'border-emerald-300/50 bg-emerald-400/40' : 'border-white/20 bg-white/10'}`}
                aria-label={`Bật/Tắt ${spec.label}`}
              >
                {busy ? '…' : on ? '✓' : '✕'}
              </button>
            </li>
          );
        })}
      </ul>
      {message && (
        <p className="text-xs" style={{ color: message === 'Đã lưu.' ? undefined : '#fca5a5' }}>
          {message}
        </p>
      )}
    </div>
  );
}
