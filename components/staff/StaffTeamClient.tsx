'use client';

// components/staff/StaffTeamClient.tsx
// /staff/team — the employee directory.
//
// The photographed public profiles and login accounts are merged into one
// directory card per person.

import { useMemo, useState } from 'react';
import Image from 'next/image';
import {
  BadgeCheck,
  ChevronDown,
  Loader2,
  Mail,
  Search,
  ShieldCheck,
  ShieldOff,
  UserPlus,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import LiquidGlassCard from '@/components/ui/LiquidGlassCard';
import { BRANCHES } from '@/lib/clinics';
// Client-safe module — see lib/staffShared.ts for why this is not staff-service.
import { JOB_TITLE_LABELS, type StaffJobTitle } from '@/lib/staffShared';
import { cn } from '@/lib/utils';

export interface TeamMember {
  id: string;
  profileId?: string;
  fullName: string;
  dateOfBirth?: string | null;
  email: string | null;
  avatarUrl: string | null;
  bio: string;
  role: string | null;
  jobTitle: string | null;
  jobTitleLabel: string;
  branchId: string | null;
  isActive: boolean;
  isSelf: boolean;
  online: boolean;
  lastLoginAt: string | null;
  rulesAcknowledgedAt: string | null;
  rulesVersion: number | null;
  isPublicProfile?: boolean;
}

const ROLE_BADGE: Record<string, { label: string; className: string }> = {
  ADMIN: { label: 'Quản trị', className: 'border-rose-300/25 bg-rose-400/10 text-rose-300' },
  VET: { label: 'Bác sĩ', className: 'border-emerald-300/25 bg-emerald-400/10 text-emerald-300' },
  SPA: { label: 'Spa & Grooming', className: 'border-sky-300/25 bg-sky-400/10 text-sky-300' },
  RECEPTIONIST: { label: 'Lễ tân', className: 'border-amber-300/25 bg-amber-400/10 text-amber-300' },
  INTERN: { label: 'Thực tập sinh', className: 'border-violet-300/25 bg-violet-400/10 text-violet-300' },
  MARKETING: { label: 'Marketing', className: 'border-cyan-300/25 bg-cyan-400/10 text-cyan-300' },
};

const roleBadge = (role: string | null) =>
  (role && ROLE_BADGE[role]) || {
    label: 'Nhân sự',
    className: 'border-white/15 bg-white/5 text-white/60',
  };

/** First letters for the fallback avatar — "Lê Nguyên Vũ" → "LN". */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[parts.length - 2][0] + parts[parts.length - 1][0]).toUpperCase();
}

function Avatar({ member, size = 'md' }: { member: TeamMember; size?: 'md' | 'lg' }) {
  const box = size === 'lg' ? 'size-20 text-xl' : 'size-14 text-base';
  if (member.avatarUrl) {
    return (
      <span className={`relative block shrink-0 overflow-hidden rounded-2xl border border-white/15 bg-white/5 ${box}`}>
        <Image
          src={member.avatarUrl}
          alt={member.fullName}
          fill
          sizes={size === 'lg' ? '80px' : '56px'}
          className="object-cover"
          loading="lazy"
        />
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-gradient-to-br from-emerald-400/20 to-sky-400/20 font-extrabold text-white',
        box
      )}
    >
      {initials(member.fullName)}
    </span>
  );
}

/** ── Grant-account form ─────────────────────────────────────────────── */
function GrantForm({
  onClose,
  onDone,
  initialName = '',
  initialDateOfBirth = '',
  initialBranchId,
  initialJobTitle,
  profileId,
}: {
  onClose: () => void;
  onDone: () => void;
  initialName?: string;
  initialDateOfBirth?: string;
  initialBranchId?: string | null;
  initialJobTitle?: StaffJobTitle;
  profileId?: string;
}) {
  const [fullName, setFullName] = useState(initialName);
  const [dateOfBirth, setDateOfBirth] = useState(initialDateOfBirth);
  const [email, setEmail] = useState('');
  const [branchId, setBranchId] = useState(initialBranchId ?? BRANCHES[0].id);
  const [jobTitle, setJobTitle] = useState<StaffJobTitle>(initialJobTitle ?? 'LE_TAN');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [managerPin, setManagerPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ field?: string; text: string } | null>(null);

  async function submit() {
    if (busy) return;
    setError(null);

    // Client-side checks first so the obvious mistakes never cost a round trip;
    // the server re-validates everything regardless.
    if (!profileId && fullName.trim().length < 2)
      return setError({ field: 'fullName', text: 'Tên quá ngắn.' });
    if (!profileId && !dateOfBirth)
      return setError({ field: 'dateOfBirth', text: 'Vui lòng chọn ngày sinh.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim()))
      return setError({ field: 'email', text: 'Email không hợp lệ.' });
    if (!/^\d{6}$/.test(pin)) return setError({ field: 'pin', text: 'Mã PIN phải gồm 6 chữ số.' });
    if (pin !== confirmPin)
      return setError({ field: 'confirmPin', text: 'Hai mã PIN không khớp.' });
    if (!/^\d{6}$/.test(managerPin))
      return setError({ field: 'managerPin', text: 'Mã PIN của bạn không đúng định dạng.' });

    setBusy(true);
    try {
      const res = await fetch('/api/staff/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          profileId
            ? { profileId, email: email.trim(), pin, managerPin }
            : {
                fullName: fullName.trim(),
                dateOfBirth,
                email: email.trim(),
                branchId,
                jobTitle,
                pin,
                managerPin,
              }
        ),
      });
      const data = (await res.json()) as { message?: string; field?: string };
      if (!res.ok) {
        setError({ field: data.field, text: data.message || 'Không tạo được tài khoản.' });
        return;
      }
      onDone();
    } catch {
      setError({ text: 'Không kết nối được máy chủ. Vui lòng thử lại.' });
    } finally {
      setBusy(false);
    }
  }

  const field =
    'w-full rounded-2xl border border-white/15 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none backdrop-blur-xl transition-colors placeholder:text-white/25 focus:border-emerald-300/60 focus:shadow-[0_0_0_4px_rgba(52,211,153,0.16)] [color-scheme:dark]';

  const label = 'mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-white/55';

  return (
    <div
      className="fixed inset-0 z-[95] flex justify-center overflow-y-auto bg-slate-950/75 p-4 py-[6vh] backdrop-blur-md"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="grant-account-title"
        style={{ margin: 'auto' }}
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto overscroll-contain rounded-[28px] border border-white/15 bg-[#0b1120]/90 p-6 shadow-spatial-depth backdrop-blur-3xl"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-emerald-300/25 bg-emerald-400/10 text-emerald-300">
              <UserPlus className="size-5" />
            </span>
            <div>
              <h2 id="grant-account-title" className="text-lg font-extrabold text-white">
                {profileId ? `Cấp tài khoản cho ${initialName}` : 'Cấp tài khoản nhân viên'}
              </h2>
              <p className="text-xs text-white/50">
                Nhân viên sẽ đăng nhập bằng email + mã PIN này.
              </p>
            </div>
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
          {profileId && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs text-white/60">
              <p>{fullName} · {JOB_TITLE_LABELS[jobTitle]}</p>
              {dateOfBirth && <p className="mt-1">Ngày sinh: {dateOfBirth}</p>}
              {initialBranchId && (
                <p className="mt-1">
                  Chi nhánh: {BRANCHES.find((branch) => branch.id === initialBranchId)?.addressShort}
                </p>
              )}
            </div>
          )}
          {!profileId && (
            <div>
              <label htmlFor="grant-name" className={label}>
                Tên nhân viên
              </label>
              <input
                id="grant-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Nguyễn Văn A"
                className={field}
              />
            </div>
          )}

          <div className={cn('grid grid-cols-1 gap-4', !profileId && 'sm:grid-cols-2')}>
            {!profileId && (
              <div>
                <label htmlFor="grant-dob" className={label}>
                  Ngày sinh
                </label>
                <input
                  id="grant-dob"
                  type="date"
                  value={dateOfBirth}
                  max={new Date(Date.now() - 16 * 365.25 * 864e5).toISOString().slice(0, 10)}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  className={field}
                />
              </div>
            )}
            <div>
              <label htmlFor="grant-email" className={label}>
                Email
              </label>
              <input
                id="grant-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ban@belwee.vn"
                className={field}
              />
            </div>
          </div>

          {!profileId && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="grant-branch" className={label}>
                  Chi nhánh
                </label>
                <select
                  id="grant-branch"
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  className={field}
                >
                  {BRANCHES.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.code} · {branch.addressShort}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="grant-title" className={label}>
                  Chức danh
                </label>
                <select
                  id="grant-title"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value as StaffJobTitle)}
                  className={field}
                >
                  {(Object.keys(JOB_TITLE_LABELS) as StaffJobTitle[]).map((key) => (
                    <option key={key} value={key}>
                      {JOB_TITLE_LABELS[key]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="grant-pin" className={label}>
                Mã PIN (6 số)
              </label>
              <input
                id="grant-pin"
                inputMode="numeric"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="••••••"
                className={cn(field, 'text-center font-mono tracking-[0.4em]')}
              />
            </div>
            <div>
              <label htmlFor="grant-pin2" className={label}>
                Nhập lại PIN
              </label>
              <input
                id="grant-pin2"
                inputMode="numeric"
                maxLength={6}
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="••••••"
                className={cn(field, 'text-center font-mono tracking-[0.4em]')}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-amber-300/25 bg-amber-400/10 px-4 py-3">
            <label htmlFor="grant-manager" className={cn(label, 'text-amber-200/80')}>
              Mã PIN của bạn (xác nhận quyền cấp tài khoản)
            </label>
            <input
              id="grant-manager"
              inputMode="numeric"
              maxLength={6}
              value={managerPin}
              onChange={(e) => setManagerPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="••••••"
              className={cn(field, 'text-center font-mono tracking-[0.4em]')}
            />
            <p className="mt-2 text-[11px] text-amber-200/70">
              Bắt buộc — mỗi lần cấp tài khoản đều được ghi vào nhật ký bảo mật.
            </p>
          </div>

          {error && (
            <p role="alert" className="rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200">
              {error.text}
            </p>
          )}

          <div className="flex flex-col gap-2.5 sm:flex-row-reverse">
            <button
              type="button"
              onClick={submit}
              disabled={busy}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-400 py-3 text-sm font-extrabold text-slate-950 transition-all hover:bg-emerald-300 disabled:opacity-60"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
              {busy ? 'Đang tạo…' : 'Cấp tài khoản'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="flex-1 rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-bold text-white/75 transition-colors hover:bg-white/10 hover:text-white"
            >
              Huỷ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * ── Per-employee provisioning card ───────────────────────────────────
 * Opens when an employee card is clicked. Liquid-glass sheet that mirrors
 * the account state of ONE person — grant for a public profile that has no
 * account yet, or manage the existing account in place.
 */
function ProvisionCard({
  member,
  canGrant,
  onClose,
  onGrantNew,
  onToggle,
  busy,
}: {
  member: TeamMember;
  canGrant: boolean;
  onClose: () => void;
  onGrantNew: (member: TeamMember) => void;
  onToggle: (member: TeamMember) => void;
  busy: boolean;
}) {
  const badge = roleBadge(member.role);
  const branch = BRANCHES.find((b) => b.id === member.branchId);
  const copyEmail = () => {
    if (!member.email) return;
    void navigator.clipboard?.writeText(member.email);
  };

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
        aria-labelledby="provision-title"
        style={{ margin: 'auto' }}
        className="relative max-h-[85vh] w-full max-w-md overflow-y-auto overscroll-contain rounded-[28px] border border-white/15 bg-gradient-to-br from-white/[0.10] to-white/[0.03] bg-[#0b1120]/85 p-6 shadow-[0_32px_80px_-16px_rgba(2,6,23,0.65),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-3xl"
      >
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          aria-label="Đóng"
          className="absolute right-4 top-4 flex size-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X className="size-4.5" />
        </button>

        <div className="flex items-center gap-4">
          <Avatar member={member} size="lg" />
          <div className="min-w-0">
            <h2 id="provision-title" className="truncate text-xl font-extrabold text-white">
              {member.fullName}
            </h2>
            <p className="mt-0.5 truncate text-sm font-semibold text-emerald-300">
              {member.jobTitleLabel}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide', badge.className)}>
                {badge.label}
              </span>
              {branch && (
                <span className="rounded-full border border-white/12 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-white/60">
                  {branch.code} · {branch.addressShort}
                </span>
              )}
              {member.isActive ? (
                <span className="rounded-full border border-emerald-300/25 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                  Đang hoạt động
                </span>
              ) : (
                <span className="rounded-full border border-red-300/25 bg-red-400/10 px-2 py-0.5 text-[10px] font-bold text-red-300">
                  Đã khoá
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-5 space-y-2.5 rounded-2xl border border-white/10 bg-white/[0.05] p-4">
          {member.email ? (
            <div className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2 text-xs text-white/60">
                <Mail className="size-3.5 shrink-0" />
                <span className="truncate">{member.email}</span>
              </span>
              <button
                type="button"
                onClick={copyEmail}
                className="shrink-0 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[10px] font-bold text-white/65 transition-colors hover:bg-white/10 hover:text-white"
              >
                Sao chép
              </button>
            </div>
          ) : (
            <p className="text-xs text-white/55">
              Chưa có tài khoản — hồ sơ công khai từ trang Đội ngũ.
            </p>
          )}
          {member.lastLoginAt && (
            <p className="text-xs text-white/45">
              Đăng nhập gần nhất:{' '}
              <span className="text-white/70">
                {new Date(member.lastLoginAt).toLocaleString('vi-VN')}
              </span>
            </p>
          )}
          {member.bio && <p className="text-xs leading-relaxed text-white/50">{member.bio}</p>}
        </div>

        {canGrant && !member.isSelf && (
          <div className="mt-5 space-y-2.5">
            {!member.email ? (
              <button
                type="button"
                onClick={() => onGrantNew(member)}
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-400 py-3 text-sm font-extrabold text-slate-950 transition-all hover:bg-emerald-300 disabled:opacity-60"
              >
                <UserPlus className="size-4" />
                Cấp tài khoản cho nhân viên này
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onToggle(member)}
                disabled={busy}
                className={cn(
                  'flex w-full items-center justify-center gap-2 rounded-2xl border py-3 text-sm font-extrabold transition-colors disabled:opacity-60',
                  member.isActive
                    ? 'border-red-300/25 bg-red-400/10 text-red-300 hover:bg-red-400/20'
                    : 'border-emerald-300/25 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/20'
                )}
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : member.isActive ? (
                  <ShieldOff className="size-4" />
                ) : (
                  <ShieldCheck className="size-4" />
                )}
                {member.isActive ? 'Thu hồi quyền truy cập' : 'Khôi phục quyền truy cập'}
              </button>
            )}
            <p className="text-center text-[11px] text-white/40">
              Yêu cầu mã PIN quản trị của bạn để xác nhận.
            </p>
          </div>
        )}

        {!canGrant && (
          <p className="mt-5 rounded-xl border border-amber-300/25 bg-amber-400/10 px-3 py-2 text-xs text-amber-200/80">
            Bạn không có quyền cấp tài khoản.
          </p>
        )}
      </div>
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────
export default function StaffTeamClient({
  initialStaff,
  canGrant,
}: {
  initialStaff: TeamMember[];
  canGrant: boolean;
}) {
  const [staff, setStaff] = useState<TeamMember[]>(initialStaff);
  const [query, setQuery] = useState('');
  const [branchFilter, setBranchFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [showGrant, setShowGrant] = useState(false);
  const [provisionFor, setProvisionFor] = useState<TeamMember | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const branchesInUse = useMemo(
    () => Array.from(new Set(staff.map((m) => m.branchId).filter((b): b is string => Boolean(b)))),
    [staff]
  );
  const rolesInUse = useMemo(
    () => Array.from(new Set(staff.map((m) => m.role).filter((r): r is string => Boolean(r)))),
    [staff]
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return staff.filter((member) => {
      if (branchFilter !== 'all' && member.branchId !== branchFilter) return false;
      if (roleFilter !== 'all' && member.role !== roleFilter) return false;
      if (!q) return true;
      return [member.fullName, member.email, member.jobTitleLabel, member.bio]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [staff, query, branchFilter, roleFilter]);

  const onlineCount = staff.filter((m) => m.online).length;

  async function reload() {
    try {
      const res = await fetch('/api/staff/team');
      if (!res.ok) return;
      const data = (await res.json()) as { staff: TeamMember[] };
      setStaff(data.staff);
    } catch {
      /* keep the server-rendered list */
    }
  }

  /** Grant / revoke access. Both need the admin's own PIN — see the route. */
  async function toggleActive(member: TeamMember) {
    const nextActive = !member.isActive;
    const pin = window.prompt(
      nextActive
        ? `Nhập mã PIN của bạn để KHÔI PHỤC quyền truy cập cho ${member.fullName}:`
        : `Nhập mã PIN của bạn để THU HỒI quyền truy cập của ${member.fullName}:`
    );
    if (!pin) return;
    if (!/^\d{6}$/.test(pin.trim())) {
      setNotice({ kind: 'error', text: 'Mã PIN phải gồm đúng 6 chữ số.' });
      return;
    }

    setBusyId(member.id);
    try {
      const res = await fetch('/api/staff/team', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffId: member.id, isActive: nextActive, managerPin: pin.trim() }),
      });
      const data = (await res.json()) as { message?: string };
      if (!res.ok) {
        setNotice({ kind: 'error', text: data.message || 'Không cập nhật được.' });
        return;
      }
      setNotice({
        kind: 'ok',
        text: nextActive
          ? `Đã khôi phục quyền truy cập cho ${member.fullName}.`
          : `Đã thu hồi quyền truy cập của ${member.fullName}.`,
      });
      await reload();
    } catch {
      setNotice({ kind: 'error', text: 'Không kết nối được máy chủ.' });
    } finally {
      setBusyId(null);
    }
  }

  const select =
    'rounded-full border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-white/70 outline-none backdrop-blur-xl transition-colors hover:bg-white/10 focus:border-emerald-300/50';

  return (
    <div className="relative min-h-dvh overflow-hidden bg-gradient-to-b from-[#070b16] via-[#0b1322] to-[#0d1526] px-4 pb-24 sm:px-6 lg:px-8">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-liquid-mesh" />

      <div className="relative mx-auto max-w-6xl">
        <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/25 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">
              Nhân viên Belwee
            </span>
            <h1 className="mt-2 text-3xl font-extrabold text-white">Đội ngũ nhân viên</h1>
            <p className="mt-1 text-sm text-white/50">
              {staff.length} thành viên · {onlineCount} đang online
            </p>
          </div>

          {canGrant && (
            <button
              type="button"
              onClick={() => setShowGrant(true)}
              className="flex items-center gap-2 rounded-full bg-emerald-400 px-4 py-2.5 text-sm font-extrabold text-slate-950 transition-colors hover:bg-emerald-300"
            >
              <UserPlus className="size-4" />
              Cấp tài khoản
            </button>
          )}
        </div>

        {/* Search + filters */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-white/35" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm theo tên, email, chức danh…"
              aria-label="Tìm nhân viên"
              className="w-full rounded-full border border-white/15 bg-white/10 py-3 pl-11 pr-4 text-sm text-white outline-none backdrop-blur-2xl transition-all placeholder:text-white/35 focus:border-emerald-300/40 focus:shadow-[0_0_0_4px_rgba(52,211,153,0.12)]"
            />
          </label>

          <div className="relative">
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              aria-label="Lọc theo chi nhánh"
              className={cn(select, 'appearance-none pr-9')}
            >
              <option value="all" className="bg-[#0b1120]">
                Tất cả chi nhánh
              </option>
              {branchesInUse.map((id) => {
                const branch = BRANCHES.find((b) => b.id === id);
                return (
                  <option key={id} value={id} className="bg-[#0b1120]">
                    {branch ? `${branch.code} · ${branch.addressShort}` : id}
                  </option>
                );
              })}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-white/40" />
          </div>

          <div className="relative">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              aria-label="Lọc theo vai trò"
              className={cn(select, 'appearance-none pr-9')}
            >
              <option value="all" className="bg-[#0b1120]">
                Tất cả vai trò
              </option>
              {rolesInUse.map((role) => (
                <option key={role} value={role} className="bg-[#0b1120]">
                  {roleBadge(role).label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-white/40" />
          </div>
        </div>

        {notice && (
          <div
            role="status"
            className={cn(
              'mb-5 flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-xs font-semibold',
              notice.kind === 'ok'
                ? 'border-emerald-300/25 bg-emerald-400/10 text-emerald-200'
                : 'border-red-400/25 bg-red-500/10 text-red-200'
            )}
          >
            <span>{notice.text}</span>
            <button type="button" onClick={() => setNotice(null)} aria-label="Đóng thông báo">
              <X className="size-3.5" />
            </button>
          </div>
        )}

        {visible.length === 0 ? (
          <LiquidGlassCard flat className="!rounded-3xl">
            <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
              <Search className="size-8 text-white/25" />
              <p className="font-bold text-white/80">Không tìm thấy nhân viên</p>
              <p className="text-sm text-white/45">
                Thử đổi từ khoá hoặc bỏ bớt bộ lọc đang áp dụng.
              </p>
            </div>
          </LiquidGlassCard>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((member) => {
              const badge = roleBadge(member.role);
              const branch = BRANCHES.find((b) => b.id === member.branchId);
              return (
                <LiquidGlassCard
                  key={member.id}
                  flat
                  className="!rounded-2xl"
                >
                  <div
                    role="button"
                    tabIndex={0}
                    aria-label={`Cấp tài khoản cho ${member.fullName}`}
                    onClick={() => setProvisionFor(member)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setProvisionFor(member);
                      }
                    }}
                    className="flex cursor-pointer items-start gap-3 p-4 outline-none transition-colors hover:bg-white/[0.03] focus-visible:ring-2 focus-visible:ring-emerald-300/50"
                  >
                    <div className="relative">
                      <Avatar member={member} />
                      {/* Presence dot: colour + icon, never colour alone. */}
                      <span
                        className={cn(
                          'absolute -bottom-0.5 -right-0.5 flex size-5 items-center justify-center rounded-full border-2 border-[#0b1120]',
                          member.online ? 'bg-emerald-400' : 'bg-white/25'
                        )}
                        title={member.online ? 'Đang online' : 'Offline'}
                      >
                        {member.online ? (
                          <Wifi className="size-2.5 text-slate-950" />
                        ) : (
                          <WifiOff className="size-2.5 text-white/60" />
                        )}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h2 className="truncate text-sm font-bold text-white">{member.fullName}</h2>
                        {member.isSelf && (
                          <span className="shrink-0 rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] font-bold text-white/55">
                            Bạn
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs font-semibold text-emerald-300">
                        {member.jobTitleLabel}
                      </p>

                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <span
                          className={cn(
                            'rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                            badge.className
                          )}
                        >
                          {badge.label}
                        </span>
                        {branch && (
                          <span className="rounded-full border border-white/12 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-white/60">
                            {branch.code}
                          </span>
                        )}
                        {!member.isActive && (
                          <span className="rounded-full border border-red-300/25 bg-red-400/10 px-2 py-0.5 text-[10px] font-bold text-red-300">
                            Đã khoá
                          </span>
                        )}
                        {member.rulesAcknowledgedAt && (
                          <BadgeCheck className="size-3.5 text-emerald-300/80" aria-label="Đã đọc nội quy" />
                        )}
                      </div>

                      {member.email && (
                        <a
                          href={`mailto:${member.email}`}
                          onClick={(e) => e.stopPropagation()}
                          className="mt-2 flex items-center gap-1.5 truncate text-[11px] text-white/45 transition-colors hover:text-emerald-300"
                        >
                          <Mail className="size-3 shrink-0" />
                          <span className="truncate">{member.email}</span>
                        </a>
                      )}

                      {member.bio && (
                        <p className="mt-2 line-clamp-3 text-[11px] leading-relaxed text-white/45">
                          {member.bio}
                        </p>
                      )}

                      {canGrant && !member.isSelf && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (member.email) {
                              void toggleActive(member);
                            } else {
                              setProvisionFor(member);
                            }
                          }}
                          disabled={busyId === member.id}
                          className={cn(
                            'mt-3 flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold transition-colors disabled:opacity-50',
                            !member.email || !member.isActive
                              ? 'border-emerald-300/25 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/20'
                              : 'border-red-300/25 bg-red-400/10 text-red-300 hover:bg-red-400/20'
                          )}
                        >
                          {member.email && busyId === member.id ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : member.email && member.isActive ? (
                            <ShieldOff className="size-3" />
                          ) : member.email ? (
                            <ShieldCheck className="size-3" />
                          ) : (
                            <UserPlus className="size-3" />
                          )}
                          {member.email
                            ? member.isActive
                              ? 'Thu hồi quyền'
                              : 'Khôi phục quyền'
                            : 'Cấp tài khoản'}
                        </button>
                      )}
                    </div>
                  </div>
                </LiquidGlassCard>
              );
            })}
          </div>
        )}
      </div>

      {showGrant && !provisionFor && (
        <GrantForm
          onClose={() => setShowGrant(false)}
          onDone={() => {
            setShowGrant(false);
            setNotice({ kind: 'ok', text: 'Đã tạo tài khoản. Nhân viên có thể đăng nhập ngay.' });
            void reload();
          }}
        />
      )}

      {/* Per-employee provisioning: opened by clicking any employee card. */}
      {provisionFor && !showGrant && (
        <ProvisionCard
          member={provisionFor}
          canGrant={canGrant}
          busy={busyId === provisionFor.id}
          onClose={() => setProvisionFor(null)}
          onGrantNew={() => {
            setShowGrant(true);
          }}
          onToggle={(member) => {
            setProvisionFor(null);
            void toggleActive(member);
          }}
        />
      )}

      {/* Grant form pre-filled from the employee card that opened it. */}
      {showGrant && provisionFor && (
        <GrantForm
          initialName={provisionFor.fullName}
          initialDateOfBirth={provisionFor.dateOfBirth ?? ''}
          initialBranchId={provisionFor.branchId}
          initialJobTitle={
            provisionFor.jobTitle ? (provisionFor.jobTitle as StaffJobTitle) : undefined
          }
          profileId={provisionFor.profileId}
          onClose={() => {
            setShowGrant(false);
            setProvisionFor(null);
          }}
          onDone={() => {
            setShowGrant(false);
            setProvisionFor(null);
            setNotice({ kind: 'ok', text: 'Đã tạo tài khoản. Nhân viên có thể đăng nhập ngay.' });
            void reload();
          }}
        />
      )}
    </div>
  );
}