'use client';

// components/staff/StaffProfileClient.tsx
// /staff/profile — the staff member's own "super profile".
//
// COUNT-UP NUMBERS
//   The stat tiles animate from 0 to their value once, when they first enter the
//   viewport. requestAnimationFrame rather than setInterval so the animation is
//   frame-aligned and stops cleanly on unmount — an interval left running on a
//   component the user navigated away from keeps re-rendering a dead tree.
//
// REDUCED MOTION
//   The count-up jumps straight to the final value. An animated number that
//   cannot be animated is worse than no animation at all: it leaves the figure
//   wrong for anyone whose OS requests reduced motion, which is the exact
//   opposite of what the setting is for.

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import {
  Activity,
  BadgeCheck,
  Ban,
  CalendarCheck2,
  Camera,
  KeyRound,
  Loader2,
  Mail,
  MapPin,
  Pencil,
  ReceiptText,
  Sparkles,
  Stethoscope,
  X,
} from 'lucide-react';
import LogoutButton from '@/components/LogoutButton';
import { prefersReducedMotion } from '@/lib/motion';
import { compressImage, approximateKb } from '@/lib/imageCompress';
import { cn } from '@/lib/utils';

export interface ProfilePayload {
  id: string;
  fullName: string;
  email: string;
  dateOfBirth: string | null;
  avatarUrl: string | null;
  bio: string;
  role: string;
  jobTitle: string | null;
  jobTitleLabel: string;
  branch: { id: string; code: string; name: string; type: string };
  lastLoginAt: string | null;
  createdAt: string;
  rulesAcknowledgedAt: string | null;
  rulesVersion: number | null;
  currentRulesVersion: number;
}

export interface StaffStats {
  confirmedCount: number;
  completedCount: number;
  cancelledCount: number;
  pendingCount: number;
  thisWeekShifts: number;
  receiptsIssued: number;
  recordCount: number;
  weekly: Array<{ label: string; value: number }>;
}

export interface ActivityItem {
  id: string;
  kind: 'confirmed' | 'diagnosis' | 'receipt';
  at: string;
  title: string;
  detail: string | null;
}

const ROLE_BADGE: Record<string, { label: string; className: string }> = {
  ADMIN: { label: 'Quản trị viên', className: 'border-rose-300/25 bg-rose-400/10 text-rose-300' },
  VET: { label: 'Bác sĩ thú y', className: 'border-emerald-300/25 bg-emerald-400/10 text-emerald-300' },
  SPA: { label: 'Spa & Grooming', className: 'border-sky-300/25 bg-sky-400/10 text-sky-300' },
  RECEPTIONIST: { label: 'Lễ tân', className: 'border-amber-300/25 bg-amber-400/10 text-amber-300' },
  INTERN: { label: 'Thực tập sinh', className: 'border-violet-300/25 bg-violet-400/10 text-violet-300' },
  MARKETING: { label: 'Marketing', className: 'border-cyan-300/25 bg-cyan-400/10 text-cyan-300' },
};

/** Animate 0 → target once, when `active` flips true. */
function useCountUp(target: number, active: boolean): number {
  const [value, setValue] = useState(0);
  const rafRef = useRef(0);

  useEffect(() => {
    if (!active) return;

    if (prefersReducedMotion()) {
      setValue(target);
      return;
    }
    if (target === 0) {
      setValue(0);
      return;
    }

    const DURATION = 900;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / DURATION);
      // easeOutCubic — fast start, gentle landing. Linear reads as a machine.
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, active]);

  return value;
}

function StatTile({
  label,
  value,
  icon: Icon,
  tone,
  active,
  delay,
}: {
  label: string;
  value: number;
  icon: typeof Activity;
  tone: string;
  active: boolean;
  delay: number;
}) {
  const shown = useCountUp(value, active);
  return (
    <div
      className="rounded-2xl border border-white/12 bg-white/[0.06] p-4 backdrop-blur-2xl transition-all duration-500"
      style={{ transitionDelay: `${delay}ms` }}
    >
      <div className="flex items-center gap-3">
        <Icon className={cn('size-5 shrink-0', tone)} aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-2xl font-extrabold tabular-nums text-white">{shown}</p>
          <p className="truncate text-[11px] text-white/50">{label}</p>
        </div>
      </div>
    </div>
  );
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[parts.length - 2][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function StaffProfileClient({
  initialProfile,
  stats,
  activity,
}: {
  initialProfile: ProfilePayload;
  stats: StaffStats;
  activity: ActivityItem[];
}) {
  const [profile, setProfile] = useState(initialProfile);
  const [editing, setEditing] = useState(false);
  const [changingPin, setChangingPin] = useState(false);
  const [visible, setVisible] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const statsRef = useRef<HTMLDivElement>(null);

  // Trigger the count-up when the stats block first scrolls into view.
  useEffect(() => {
    const el = statsRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { threshold: 0.25 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const badge = ROLE_BADGE[profile.role] ?? {
    label: profile.jobTitleLabel,
    className: 'border-white/15 bg-white/5 text-white/70',
  };

  const needsRulesReread =
    profile.rulesAcknowledgedAt !== null &&
    (profile.rulesVersion ?? 0) < profile.currentRulesVersion;

  const maxWeekly = Math.max(1, ...stats.weekly.map((d) => d.value));

  return (
    <div className="relative min-h-dvh bg-gradient-to-b from-[#070b16] via-[#0b1322] to-[#0d1526]">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-liquid-mesh" />

      {/* Cover banner */}
      <div
        aria-hidden="true"
        className="relative h-40 overflow-hidden sm:h-52"
        style={{
          background:
            'linear-gradient(120deg, #059669 0%, #0ea5e9 45%, #6366f1 100%)',
        }}
      >
        <div className="absolute inset-0 bg-glass-noise opacity-40" />
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#0b1322] to-transparent" />
      </div>

      <div className="relative mx-auto max-w-5xl px-4 pb-24 sm:px-6">
        {/* Identity card — overlaps the banner */}
        <div className="-mt-16 flex flex-col items-center gap-4 sm:-mt-20 sm:flex-row sm:items-end sm:gap-6">
          <div className="relative">
            {profile.avatarUrl ? (
              <span className="block size-28 overflow-hidden rounded-3xl border-4 border-[#0b1322] shadow-spatial-depth sm:size-36">
                <Image
                  src={profile.avatarUrl}
                  alt={profile.fullName}
                  fill
                  sizes="144px"
                  className="object-cover"
                />
              </span>
            ) : (
              <span
                aria-hidden="true"
                className="flex size-28 items-center justify-center rounded-3xl border-4 border-[#0b1322] bg-gradient-to-br from-emerald-400/25 to-sky-400/25 text-3xl font-extrabold text-white shadow-spatial-depth sm:size-36 sm:text-4xl"
              >
                {initials(profile.fullName)}
              </span>
            )}
            <button
              type="button"
              onClick={() => setEditing(true)}
              aria-label="Đổi ảnh đại diện"
              title="Đổi ảnh đại diện"
              className="absolute -bottom-1 -right-1 flex size-9 items-center justify-center rounded-full border-2 border-[#0b1322] bg-emerald-400 text-slate-950 transition-colors hover:bg-emerald-300"
            >
              <Camera className="size-4" />
            </button>
          </div>

          <div className="min-w-0 flex-1 pb-1 text-center sm:text-left">
            <h1 className="text-2xl font-extrabold text-white sm:text-3xl">{profile.fullName}</h1>
            <p className="mt-1 text-sm font-semibold text-emerald-300">{profile.jobTitleLabel}</p>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5 sm:justify-start">
              <span
                className={cn(
                  'rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                  badge.className
                )}
              >
                {badge.label}
              </span>
              <span className="flex items-center gap-1 rounded-full border border-white/12 bg-white/5 px-2.5 py-0.5 text-[10px] font-semibold text-white/65">
                <MapPin className="size-2.5" />
                {profile.branch.code}
              </span>
              {profile.rulesAcknowledgedAt && !needsRulesReread && (
                <span className="flex items-center gap-1 rounded-full border border-emerald-300/25 bg-emerald-400/10 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-300">
                  <BadgeCheck className="size-2.5" />
                  Đã đọc nội quy
                </span>
              )}
            </div>
          </div>

          <div className="flex shrink-0 gap-2 pb-1">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3.5 py-2 text-xs font-bold text-white/75 transition-colors hover:bg-white/10 hover:text-white"
            >
              <Pencil className="size-3.5" />
              Chỉnh sửa
            </button>
            <LogoutButton />
          </div>
        </div>

        {notice && (
          <div
            role="status"
            className={cn(
              'mt-5 flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-xs font-semibold',
              notice.kind === 'ok'
                ? 'border-emerald-300/25 bg-emerald-400/10 text-emerald-200'
                : 'border-red-400/25 bg-red-500/10 text-red-200'
            )}
          >
            <span>{notice.text}</span>
            <button type="button" onClick={() => setNotice(null)} aria-label="Đóng">
              <X className="size-3.5" />
            </button>
          </div>
        )}

        {needsRulesReread && (
          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-300/25 bg-amber-400/10 px-4 py-3.5">
            <BadgeCheck className="mt-0.5 size-5 shrink-0 text-amber-300" aria-hidden="true" />
            <p className="text-sm text-amber-100">
              Nội quy đã được cập nhật lên phiên bản {profile.currentRulesVersion}. Bạn cần
              đọc và xác nhận lại tại trang Nội quy tuân thủ.
            </p>
          </div>
        )}

        {/* Stats */}
        <div ref={statsRef} className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile
            label="Lịch đã xác nhận"
            value={stats.confirmedCount}
            icon={CalendarCheck2}
            tone="text-emerald-300"
            active={visible}
            delay={0}
          />
          <StatTile
            label="Lịch đã hoàn tất"
            value={stats.completedCount}
            icon={BadgeCheck}
            tone="text-sky-300"
            active={visible}
            delay={80}
          />
          <StatTile
            label="Lịch đã huỷ"
            value={stats.cancelledCount}
            icon={Ban}
            tone="text-rose-300"
            active={visible}
            delay={160}
          />
          <StatTile
            label="Ca làm việc tuần này"
            value={stats.thisWeekShifts}
            icon={Activity}
            tone="text-violet-300"
            active={visible}
            delay={240}
          />
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-5">
          {/* Details */}
          <section className="rounded-2xl border border-white/12 bg-white/[0.06] p-5 backdrop-blur-2xl lg:col-span-3">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-extrabold text-white">
              <Sparkles className="size-4 text-emerald-300" aria-hidden="true" />
              Thông tin cá nhân
            </h2>

            <dl className="space-y-3">
              {[
                { icon: Mail, label: 'Email', value: profile.email },
                { icon: MapPin, label: 'Chi nhánh', value: `${profile.branch.code} · ${profile.branch.name}` },
                {
                  icon: CalendarCheck2,
                  label: 'Ngày sinh',
                  value: profile.dateOfBirth
                    ? new Date(profile.dateOfBirth).toLocaleDateString('vi-VN', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                      })
                    : 'Chưa cập nhật',
                },
                { icon: Activity, label: 'Đăng nhập gần nhất', value: formatDateTime(profile.lastLoginAt) },
                { icon: BadgeCheck, label: 'Ngày vào làm', value: formatDateTime(profile.createdAt) },
              ].map((row) => (
                <div key={row.label} className="flex items-start gap-3">
                  <row.icon className="mt-0.5 size-4 shrink-0 text-white/35" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/40">
                      {row.label}
                    </dt>
                    <dd className="mt-0.5 break-words text-sm text-white/85">{row.value}</dd>
                  </div>
                </div>
              ))}

              <div className="flex items-start gap-3">
                <Stethoscope className="mt-0.5 size-4 shrink-0 text-white/35" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/40">
                    Giới thiệu
                  </dt>
                  <dd className="mt-0.5 text-sm leading-relaxed text-white/85">
                    {profile.bio || 'Chưa có giới thiệu.'}
                  </dd>
                </div>
              </div>
            </dl>
          </section>

          {/* Weekly sparkline */}
          <section className="rounded-2xl border border-white/12 bg-white/[0.06] p-5 backdrop-blur-2xl lg:col-span-2">
            <h2 className="mb-4 text-sm font-extrabold text-white">7 ngày qua</h2>
            <div className="flex h-28 items-end gap-1.5" role="img" aria-label="Biểu đồ lịch đã xác nhận trong 7 ngày qua">
              {stats.weekly.map((day) => (
                <div key={day.label} className="flex flex-1 flex-col items-center gap-1.5">
                  <span className="text-[10px] font-bold tabular-nums text-white/45">
                    {day.value}
                  </span>
                  <div
                    className="w-full rounded-t-md bg-gradient-to-t from-emerald-500/50 to-emerald-300/80 transition-all duration-500"
                    style={{ height: `${Math.max(6, (day.value / maxWeekly) * 100)}%` }}
                  />
                  <span className="text-[9px] font-semibold uppercase text-white/35">
                    {day.label}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2 border-t border-white/8 pt-4">
              <div>
                <p className="text-lg font-extrabold tabular-nums text-white">
                  {stats.receiptsIssued}
                </p>
                <p className="text-[10px] uppercase tracking-wide text-white/40">
                  Hoá đơn đã xuất
                </p>
              </div>
              <div>
                <p className="text-lg font-extrabold tabular-nums text-white">
                  {stats.recordCount}
                </p>
                <p className="text-[10px] uppercase tracking-wide text-white/40">Bệnh án</p>
              </div>
            </div>
          </section>
        </div>

        {/* Activity */}
        <section className="mt-4 rounded-2xl border border-white/12 bg-white/[0.06] p-5 backdrop-blur-2xl">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-extrabold text-white">
            <Activity className="size-4 text-emerald-300" aria-hidden="true" />
            Hoạt động gần đây
          </h2>

          {activity.length === 0 ? (
            <p className="py-6 text-center text-xs text-white/40">
              Chưa có hoạt động nào được ghi nhận.
            </p>
          ) : (
            <ol className="relative space-y-4 border-l border-white/10 pl-5">
              {activity.map((item) => {
                const Icon =
                  item.kind === 'receipt'
                    ? ReceiptText
                    : item.kind === 'diagnosis'
                      ? Stethoscope
                      : CalendarCheck2;
                return (
                  <li key={item.id} className="relative">
                    <span
                      aria-hidden="true"
                      className="absolute -left-[26px] flex size-3.5 items-center justify-center rounded-full border-2 border-[#0b1322] bg-emerald-400"
                    />
                    <div className="flex items-start gap-2.5">
                      <Icon className="mt-0.5 size-4 shrink-0 text-white/40" aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-white/90">{item.title}</p>
                        {item.detail && (
                          <p className="mt-0.5 text-xs leading-relaxed text-white/45">
                            {item.detail}
                          </p>
                        )}
                        <p className="mt-0.5 text-[10px] uppercase tracking-wide text-white/30">
                          {formatDateTime(item.at)}
                        </p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        {/* Security */}
        <section className="mt-4 rounded-2xl border border-white/12 bg-white/[0.06] p-5 backdrop-blur-2xl">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-white">
            <KeyRound className="size-4 text-emerald-300" aria-hidden="true" />
            Bảo mật
          </h2>
          <p className="mb-4 text-xs leading-relaxed text-white/45">
            Mã PIN dùng để đăng nhập và cấp tài khoản. Nếu nghi ngờ bị lộ, đổi ngay và báo
            quản lý để thu hồi phiên trên mọi thiết bị.
          </p>
          <button
            type="button"
            onClick={() => setChangingPin(true)}
            className="flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-400/10 px-4 py-2.5 text-xs font-bold text-emerald-300 transition-colors hover:bg-emerald-400/20"
          >
            <KeyRound className="size-3.5" />
            Đổi mã PIN
          </button>
        </section>
      </div>

      {editing && (
        <EditProfileModal
          profile={profile}
          onClose={() => setEditing(false)}
          onSaved={(next) => {
            setProfile(next);
            setEditing(false);
            setNotice({ kind: 'ok', text: 'Đã lưu hồ sơ.' });
          }}
        />
      )}

      {changingPin && (
        <ChangePinModal
          onClose={() => setChangingPin(false)}
          onDone={() => {
            setChangingPin(false);
            setNotice({ kind: 'ok', text: 'Đã đổi mã PIN.' });
          }}
        />
      )}
    </div>
  );
}

// ─── Edit profile ──────────────────────────────────────────────────────
function EditProfileModal({
  profile,
  onClose,
  onSaved,
}: {
  profile: ProfilePayload;
  onClose: () => void;
  onSaved: (next: ProfilePayload) => void;
}) {
  const [fullName, setFullName] = useState(profile.fullName);
  const [bio, setBio] = useState(profile.bio);
  const [dateOfBirth, setDateOfBirth] = useState(profile.dateOfBirth ?? '');
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl ?? '');
  const [busy, setBusy] = useState(false);
  // Errors render INSIDE this card. The page-level toast sits behind the modal
  // backdrop, so reporting there would put the message where nobody can see or
  // dismiss it while the dialog is open.
  const [localError, setLocalError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // The SAME compressor the chat uses (lib/imageCompress.ts). A second copy here
  // would drift within one release — different max edge, different quality
  // ladder — and the avatar would end up 4× the bytes for the same photo.
  const pick = useCallback(
    async (file: File) => {
      const dataUrl = await compressImage(file);
      if (!dataUrl) {
        setLocalError('Ảnh quá lớn hoặc không đọc được (HEIC chưa được hỗ trợ). Vui lòng chọn JPG/PNG.');
        return;
      }
      setAvatarUrl(dataUrl);
    },
    []
  );

  async function save() {
    if (busy) return;
    if (fullName.trim().length < 2) {
      setLocalError('Tên phải có ít nhất 2 ký tự.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/staff/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          fullName: fullName.trim(),
          bio: bio.trim(),
          dateOfBirth: dateOfBirth || null,
          // A data URL is rejected server-side (see sanitizeAvatarUrl), so only
          // send the field when it is a path/URL the browser can render.
          ...(avatarUrl.startsWith('/') || avatarUrl.startsWith('http')
            ? { avatarUrl }
            : {}),
        }),
      });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) {
        setLocalError(data.error || data.message || 'Không lưu được hồ sơ.');
        return;
      }
      onSaved({
        ...profile,
        fullName: fullName.trim(),
        bio: bio.trim(),
        dateOfBirth: dateOfBirth || null,
        avatarUrl: avatarUrl || null,
      });
    } catch {
      setLocalError('Không kết nối được máy chủ.');
    } finally {
      setBusy(false);
    }
  }

  const field =
    'w-full rounded-2xl border border-white/15 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none backdrop-blur-xl transition-colors placeholder:text-white/25 focus:border-emerald-300/60 focus:shadow-[0_0_0_4px_rgba(52,211,153,0.16)] [color-scheme:dark]';

  return (
    <div
      className="fixed inset-0 z-[95] flex justify-center overflow-y-auto bg-slate-950/75 p-4 py-[8vh] backdrop-blur-md"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-profile-title"
        style={{ margin: 'auto' }}
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto overscroll-contain rounded-[28px] border border-white/15 bg-[#0b1120]/90 p-6 shadow-spatial-depth backdrop-blur-3xl"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 id="edit-profile-title" className="text-lg font-extrabold text-white">
            Chỉnh sửa hồ sơ
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Đóng"
            className="flex size-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="size-4.5" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-4">
            {avatarUrl ? (
              <span className="block size-16 shrink-0 overflow-hidden rounded-2xl border border-white/15">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={avatarUrl} alt="" className="size-full object-cover" />
              </span>
            ) : (
              <span
                aria-hidden="true"
                className="flex size-16 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-gradient-to-br from-emerald-400/25 to-sky-400/25 text-lg font-extrabold text-white"
              >
                {initials(fullName)}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (file) void pick(file);
                }}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-2 text-xs font-bold text-white/75 transition-colors hover:bg-white/10"
              >
                <Camera className="size-3.5" />
                Chọn ảnh mới
              </button>
              <p className="mt-1.5 text-[11px] leading-snug text-white/35">
                Ảnh được nén về 1280px (~{approximateKb(avatarUrl)} KB) để xem trước. Để ảnh
                hiện sau khi lưu, tải ảnh lên <code className="text-white/50">/public</code>{' '}
                rồi dán đường dẫn bên dưới — ảnh nén trong trình duyệt không được gửi lên
                máy chủ.
              </p>
              <input
                value={avatarUrl.startsWith('data:') ? '' : avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="/anh-dai-dien.jpg"
                aria-label="Đường dẫn ảnh đại diện"
                className={cn(field, 'mt-2 py-2 text-xs')}
              />
            </div>
          </div>

          <div>
            <label htmlFor="pf-name" className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-white/55">
              Tên nhân viên
            </label>
            <input id="pf-name" value={fullName} onChange={(e) => setFullName(e.target.value)} className={field} />
          </div>

          <div>
            <label htmlFor="pf-dob" className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-white/55">
              Ngày sinh
            </label>
            <input
              id="pf-dob"
              type="date"
              value={dateOfBirth}
              max={new Date(Date.now() - 16 * 365.25 * 864e5).toISOString().slice(0, 10)}
              onChange={(e) => setDateOfBirth(e.target.value)}
              className={field}
            />
          </div>

          <div>
            <label htmlFor="pf-bio" className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-white/55">
              Giới thiệu
            </label>
            <textarea
              id="pf-bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={4}
              maxLength={600}
              placeholder="Kinh nghiệm, chuyên môn, sở thích…"
              className={cn(field, 'resize-none')}
            />
            <p className="mt-1 text-right text-[10px] text-white/30">{bio.length}/600</p>
          </div>

          {localError && (
            <p
              role="alert"
              className="rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200"
            >
              {localError}
            </p>
          )}

          <div className="flex flex-col gap-2.5 sm:flex-row-reverse">
            <button
              type="button"
              onClick={save}
              disabled={busy}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-400 py-3 text-sm font-extrabold text-slate-950 transition-colors hover:bg-emerald-300 disabled:opacity-60"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Pencil className="size-4" />}
              {busy ? 'Đang lưu…' : 'Lưu hồ sơ'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="flex-1 rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-bold text-white/75 transition-colors hover:bg-white/10"
            >
              Huỷ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Change PIN ────────────────────────────────────────────────────────
function ChangePinModal({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: () => void;
}) {
  const [currentPin, setCurrentPin] = useState('');
  const [nextPin, setNextPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  async function submit() {
    if (busy) return;
    setLocalError(null);
    if (!/^\d{6}$/.test(currentPin)) return setLocalError('Mã PIN hiện tại phải gồm 6 chữ số.');
    if (!/^\d{6}$/.test(nextPin)) return setLocalError('Mã PIN mới phải gồm 6 chữ số.');
    if (nextPin !== confirmPin) return setLocalError('Hai mã PIN mới không khớp.');

    setBusy(true);
    try {
      const res = await fetch('/api/staff/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pin', currentPin, nextPin }),
      });
      const data = (await res.json()) as { message?: string; error?: string };
      if (!res.ok) {
        setLocalError(data.message || data.error || 'Không đổi được mã PIN.');
        return;
      }
      onDone();
    } catch {
      setLocalError('Không kết nối được máy chủ.');
    } finally {
      setBusy(false);
    }
  }

  const field =
    'w-full rounded-2xl border border-white/15 bg-white/[0.06] px-4 py-3 text-center font-mono text-lg tracking-[0.4em] text-white outline-none backdrop-blur-xl transition-colors focus:border-emerald-300/60 focus:shadow-[0_0_0_4px_rgba(52,211,153,0.16)]';

  return (
    <div
      className="fixed inset-0 z-[95] flex justify-center overflow-y-auto bg-slate-950/75 p-4 py-[10vh] backdrop-blur-md"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="change-pin-title"
        style={{ margin: 'auto' }}
        className="w-full max-w-md rounded-[28px] border border-white/15 bg-[#0b1120]/90 p-6 shadow-spatial-depth backdrop-blur-3xl"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 id="change-pin-title" className="text-lg font-extrabold text-white">
              Đổi mã PIN
            </h2>
            <p className="mt-0.5 text-xs text-white/50">
              Cần mã PIN hiện tại để xác nhận — tránh bị đổi khi máy bị chiếm quyền.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Đóng"
            className="flex size-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="size-4.5" />
          </button>
        </div>

        <div className="space-y-4">
          {[
            { id: 'cur', label: 'Mã PIN hiện tại', value: currentPin, set: setCurrentPin },
            { id: 'new', label: 'Mã PIN mới', value: nextPin, set: setNextPin },
            { id: 'cfm', label: 'Nhập lại mã PIN mới', value: confirmPin, set: setConfirmPin },
          ].map((row) => (
            <div key={row.id}>
              <label
                htmlFor={`pin-${row.id}`}
                className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-white/55"
              >
                {row.label}
              </label>
              <input
                id={`pin-${row.id}`}
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={row.value}
                onChange={(e) => {
                  row.set(e.target.value.replace(/\D/g, '').slice(0, 6));
                  setLocalError(null);
                }}
                placeholder="••••••"
                className={field}
              />
            </div>
          ))}

          {localError && (
            <p role="alert" className="rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200">
              {localError}
            </p>
          )}

          <div className="flex flex-col gap-2.5 sm:flex-row-reverse">
            <button
              type="button"
              onClick={submit}
              disabled={busy}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-400 py-3 text-sm font-extrabold text-slate-950 transition-colors hover:bg-emerald-300 disabled:opacity-60"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
              {busy ? 'Đang đổi…' : 'Đổi mã PIN'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="flex-1 rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-bold text-white/75 transition-colors hover:bg-white/10"
            >
              Huỷ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}