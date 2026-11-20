'use client';

// components/staff/StaffAuthCard.tsx
// /staff/login + /staff/register — one liquid-glass card, two modes.
//
// DESIGN
//   A single centred card on a slow paw-print drift. The two modes are the
//   SAME card with a sliding indicator behind the tab row, so switching modes
//   cross-fades the body instead of unmounting two separate forms — which
//   keeps the field focus position and the card height continuous.
//
// CREDENTIALS
//   PIN is the only credential (see lib/staff-service.ts). The 6-box input
//   handles paste, arrow navigation, Backspace-into-the-previous-box, and an
//   auto-submit once the 6th digit lands. A wrong PIN shakes the card and
//   clears the boxes; a locked account disables the boxes and counts down.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BadgeCheck,
  Eye,
  EyeOff,
  Home,
  Loader2,
  LogIn,
  Mail,
  PawPrint,
  ShieldCheck,
  UserPlus,
  type LucideIcon,
} from 'lucide-react';
import { BRANCHES } from '@/lib/clinics';
// Client-safe: lib/staffShared.ts, NOT lib/staff-service.ts. The latter imports
// bcrypt + node:crypto + fs via jsonStore, none of which can be bundled for the
// browser — the build fails outright on "Can't resolve 'fs'".
import {
  JOB_TITLE_LABELS,
  PIN_LENGTH,
  AuthMode,
  type StaffJobTitle,
} from '@/lib/staffShared';
import { cn } from '@/lib/utils';

// G7: `SPRING` từng là transition cho viên thuốc trượt giữa hai tab
// (Đăng nhập / Tạo tài khoản). Tab switcher đã bị gỡ nên hằng này không còn
// dùng — đã xoá thay vì để lại biến chết.

const JOB_ICON: Record<StaffJobTitle, string> = {
  QUAN_TRI: '🛡️',
  BAC_SI: '🩺',
  CHUYEN_GIA_SPA: '✂️',
  LE_TAN: '🛎️',
  THUC_TAP_SINH: '🎓',
  MARKETING: '📣',
};

type FieldName =
  | 'email'
  | 'pin'
  | 'confirmPin'
  | 'fullName'
  | 'dateOfBirth'
  | 'branchId'
  | 'jobTitle'
  | 'managerPin';

type Errors = Partial<Record<FieldName, string>>;

// ─── Floating-label glass field ───────────────────────────────────────
function GlassField({
  id,
  label,
  icon: Icon,
  error,
  children,
  hint,
}: {
  id: FieldName;
  label: string;
  icon?: LucideIcon;
  error?: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="min-w-0">
      <label
        htmlFor={`staff-${id}`}
        className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-white/55"
      >
        {Icon && <Icon className="size-3.5 shrink-0 text-emerald-300/80" aria-hidden="true" />}
        {label}
      </label>
      {children}
      {hint && !error && <p className="mt-1.5 text-[11px] leading-snug text-white/35">{hint}</p>}
      {error && (
        <p className="mt-1.5 text-[11px] font-semibold leading-snug text-red-300">{error}</p>
      )}
    </div>
  );
}

const fieldBase =
  'w-full rounded-2xl border bg-white/[0.06] px-4 py-3 text-sm text-white outline-none backdrop-blur-xl transition-[border-color,box-shadow,background-color] duration-200 placeholder:text-white/25 shadow-[inset_0_1px_1px_rgba(255,255,255,0.10)] focus:bg-white/[0.12]';
const fieldOk = 'border-white/15 focus:border-emerald-300/60 focus:shadow-[0_0_0_4px_rgba(52,211,153,0.16),inset_0_1px_1px_rgba(255,255,255,0.16)]';
const fieldBad = 'border-red-400/60 focus:border-red-300/70 focus:shadow-[0_0_0_4px_rgba(248,113,113,0.16)]';

// ─── 6-box PIN input ─────────────────────────────────────────────────
function PinInputs({
  value,
  onChange,
  disabled,
  invalid,
  masked,
  label,
  onComplete,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  /**
   * Render dots instead of digits. Six single-character boxes cannot use
   * `type="password"`, so masking has to happen here — and it is why the
   * show/hide control is wired to `masked` rather than to a type swap.
   */
  masked?: boolean;
  label: string;
  onComplete?: (pin: string) => void;
  autoFocus?: boolean;
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = value.split('');

  useEffect(() => {
    if (!autoFocus) return;
    // Wait for the enter animation to settle so the box does not steal focus
    // mid-transition on mount.
    const t = window.setTimeout(() => refs.current[0]?.focus(), 260);
    return () => window.clearTimeout(t);
  }, [autoFocus]);

  // Jump to the first empty box whenever the PIN is cleared (after a failure).
  useEffect(() => {
    if (value.length > 0) return;
    const t = window.setTimeout(() => refs.current[0]?.focus(), 120);
    return () => window.clearTimeout(t);
  }, [value]);

  function setAt(index: number, char: string) {
    const next = (value.slice(0, index) + char + value.slice(index + 1)).slice(0, PIN_LENGTH);
    onChange(next);
    if (char && index < PIN_LENGTH - 1) refs.current[index + 1]?.focus();
    if (next.length === PIN_LENGTH) {
      refs.current[PIN_LENGTH - 1]?.blur();
      onComplete?.(next);
    }
  }

  return (
    <div
      className="flex justify-center gap-1.5 sm:gap-2"
      role="group"
      aria-label={label}
      onPaste={(event) => {
        if (disabled) return;
        event.preventDefault();
        const text = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, PIN_LENGTH);
        if (!text) return;
        onChange(text);
        if (text.length === PIN_LENGTH) onComplete?.(text);
        else refs.current[text.length]?.focus();
      }}
    >
      {Array.from({ length: PIN_LENGTH }).map((_, index) => (
        <input
          key={index}
          id={index === 0 ? 'staff-pin-anchor' : undefined}
          ref={(el) => {
            refs.current[index] = el;
          }}
          value={digits[index] || ''}
          disabled={disabled}
          // `type="password"` cannot be used: it would make the browser replace
          // the digit with its own glyph at unpredictable sizes. Instead the box
          // stays type=text and the digit is hidden with -webkit-text-security,
          // which is paint-only — the value, caret and key handling are intact.
          style={
            masked
              ? ({ caretColor: '#6ee7b7', WebkitTextSecurity: 'disc' } as React.CSSProperties)
              : { caretColor: '#6ee7b7' }
          }
          autoFocus={index === 0 && autoFocus}
          onChange={(e) => {
            const raw = e.target.value.replace(/\D/g, '');
            if (raw) setAt(index, raw[raw.length - 1]);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !digits[index] && index > 0) {
              e.preventDefault();
              setAt(index - 1, '');
              refs.current[index - 1]?.focus();
            } else if (e.key === 'ArrowLeft' && index > 0) {
              e.preventDefault();
              refs.current[index - 1]?.focus();
            } else if (e.key === 'ArrowRight' && index < PIN_LENGTH - 1) {
              e.preventDefault();
              refs.current[index + 1]?.focus();
            } else if (e.key === 'Enter' && value.length === PIN_LENGTH) {
              e.preventDefault();
              onComplete?.(value);
            }
          }}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d*"
          maxLength={1}
          aria-label={`${label} — số ${index + 1}`}
          className={cn(
            'size-10 rounded-xl border text-center text-xl font-extrabold text-white outline-none backdrop-blur-xl transition-all duration-200 sm:size-12 sm:rounded-2xl sm:text-2xl',
            'shadow-[inset_0_1px_1px_rgba(255,255,255,0.18)] disabled:cursor-not-allowed disabled:opacity-50',
            invalid ? 'border-red-400/70' : 'border-white/15 focus:border-emerald-300/60 focus:bg-white/[0.14]'
          )}
        />
      ))}
    </div>
  );
}

// ─── PIN strength ────────────────────────────────────────────────────
// 6 digits have 1,000,000 combinations, so "strength" here cannot mean
// entropy — 6 digits is fixed. What actually matters is whether the PIN is
// one of the handful an attacker tries first, because the 5-attempt lock is
// time-based and a weak PIN only has to survive the lock's cooldown.
function pinStrength(pin: string): { score: 0 | 1 | 2 | 3; label: string; hint: string } {
  if (!pin) return { score: 0, label: 'Chưa nhập', hint: '6 chữ số' };
  if (/^(\d)\1+$/.test(pin)) return { score: 0, label: 'Rất yếu', hint: 'Tránh số lặp lại' };
  if (/^(012345|123456|234567|345678|456789|567890|987654|654321)/.test(pin)) {
    return { score: 0, label: 'Rất yếu', hint: 'Tránh dãy số liên tiếp' };
  }
  if (pin.length < PIN_LENGTH) return { score: 1, label: 'Yếu', hint: 'Cần đủ 6 chữ số' };

  const unique = new Set(pin).size;
  // A PIN the clinic's own staff could guess (same digits, simple patterns)
  // still counts as weak; anything with ≥4 distinct digits in a non-run order
  // passes.
  if (unique <= 2) return { score: 1, label: 'Yếu', hint: 'Nên dùng nhiều chữ số khác nhau' };
  if (unique === 3) return { score: 2, label: 'Khá', hint: 'Ổn, nhưng nên phức tạp hơn' };
  return { score: 3, label: 'Tốt', hint: 'Mã PIN hợp lệ' };
}

const STRENGTH_COLOR = ['bg-white/15', 'bg-red-400', 'bg-amber-400', 'bg-emerald-400'];

// ─── Component ───────────────────────────────────────────────────────
export default function StaffAuthCard({
  mode,
  nextRedirect,
  initialLock,
}: {
  mode: AuthMode;
  nextRedirect?: string | null;
  initialLock?: { locked: boolean; retryAfterSeconds: number };
}) {
  const router = useRouter();
  const [active, setActive] = useState<AuthMode>(mode);
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState<{ kind: 'error' | 'ok'; text: string } | null>(null);
  const [shake, setShake] = useState(false);
  const [showPin, setShowPin] = useState(true);

  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [fullName, setFullName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [branchId, setBranchId] = useState<string>(BRANCHES[0].id);
  const [jobTitle, setJobTitle] = useState<StaffJobTitle>('BAC_SI');
  const [managerPin, setManagerPin] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [lockSeconds, setLockSeconds] = useState(initialLock?.locked ? initialLock.retryAfterSeconds : 0);

  const isRegister = active === AuthMode.Register;
  const locked = lockSeconds > 0;

  const strength = useMemo(() => pinStrength(pin), [pin]);

  // Countdown for the 5-minute lock. Runs on an interval rather than per-frame
  // setTimeout so a long cooldown does not queue thousands of timers.
  useEffect(() => {
    if (lockSeconds <= 0) return;
    const id = window.setInterval(() => {
      setLockSeconds((current) => (current <= 1 ? 0 : current - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [lockSeconds]);

  const triggerShake = useCallback(() => {
    setShake(true);
    window.setTimeout(() => setShake(false), 520);
  }, []);

  const switchMode = useCallback(
    (next: AuthMode) => {
      setActive(next);
      setErrors({});
      setBanner(null);
      setPin('');
      setConfirmPin('');
      setShake(false);
    },
    []
  );

  const validateLogin = useCallback((candidatePin: string): Errors => {
    const next: Errors = {};
    const trimmed = email.trim();
    if (!trimmed) next.email = 'Email không được để trống.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed)) next.email = 'Email không hợp lệ.';
    if (!/^\d{6}$/.test(candidatePin)) next.pin = 'Vui lòng nhập đủ 6 chữ số.';
    return next;
  }, [email]);

  const validateRegister = useCallback((): Errors => {
    const next: Errors = {};
    if (fullName.trim().length < 2) next.fullName = 'Tên nhân viên phải có ít nhất 2 ký tự.';
    const dob = dateOfBirth.trim();
    if (!dob) next.dateOfBirth = 'Vui lòng nhập ngày sinh.';
    else {
      const parsed = new Date(dob);
      if (Number.isNaN(parsed.getTime())) next.dateOfBirth = 'Ngày sinh không hợp lệ.';
      else if (parsed.getTime() > Date.now()) next.dateOfBirth = 'Ngày sinh không ở tương lai.';
      else if ((Date.now() - parsed.getTime()) / (365.25 * 24 * 3600 * 1000) < 16) {
        next.dateOfBirth = 'Ngày sinh không hợp lệ với tài khoản nhân viên.';
      }
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) next.email = 'Email không hợp lệ.';
    if (!branchId) next.branchId = 'Vui lòng chọn chi nhánh.';
    if (!jobTitle) next.jobTitle = 'Vui lòng chọn chức danh.';
    if (!/^\d{6}$/.test(pin)) next.pin = 'Vui lòng nhập đủ 6 chữ số.';
    else if (pin !== confirmPin) next.confirmPin = 'Hai mã PIN không khớp.';
    else if (strength.score === 0) next.pin = 'Mã PIN quá dễ đoán. Hãy tránh dãy số liên tiếp hoặc số lặp lại.';
    if (managerPin.trim() && !/^\d{6}$/.test(managerPin.trim())) {
      next.managerPin = 'Mã PIN quản lý phải gồm đúng 6 chữ số.';
    }
    return next;
  }, [fullName, dateOfBirth, email, branchId, jobTitle, pin, confirmPin, managerPin, strength.score]);

  async function submitLogin(pinValue: string) {
    if (loading || locked) return;
    const found = validateLogin(pinValue);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      triggerShake();
      return;
    }

    setBanner(null);
    setLoading(true);
    try {
      const res = await fetch('/api/staff/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), pin: pinValue }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        message?: string;
        locked?: boolean;
        retryAfterSeconds?: number;
      };
      if (res.ok && data.ok) {
        // Relative redirect — stays on the current origin (never a stale port).
        // Respect the ?next= destination set by the middleware so staff land on
        // the page they originally tried to open.
        const target = nextRedirect && nextRedirect.startsWith('/staff/') ? nextRedirect : '/staff/dashboard';
        router.replace(target);
        return;
      }
      triggerShake();
      setPin('');
      if (data.locked) {
        setLockSeconds(data.retryAfterSeconds ?? 300);
      }
      setBanner({ kind: 'error', text: data.message || 'Mã PIN không chính xác.' });
    } catch {
      triggerShake();
      setPin('');
      setBanner({ kind: 'error', text: 'Không kết nối được máy chủ. Vui lòng thử lại.' });
    } finally {
      setLoading(false);
    }
  }

  async function submitRegister() {
    if (loading) return;
    const found = validateRegister();
    setErrors(found);
    if (Object.keys(found).length > 0) {
      triggerShake();
      // Move focus to the first offending field so keyboard and screen-reader
      // users are not left guessing which input was rejected.
      const firstBad = document.querySelector<HTMLElement>('[data-invalid="true"]');
      firstBad?.focus();
      return;
    }

    setBanner(null);
    setLoading(true);
    try {
      const res = await fetch('/api/staff/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: fullName.trim(),
          dateOfBirth: dateOfBirth.trim(),
          email: email.trim(),
          branchId,
          jobTitle,
          pin: pin.trim(),
          managerPin: managerPin.trim() || undefined,
        }),
      });
      const data = (await res.json()) as { message?: string; field?: string };
      if (!res.ok) {
        setErrors(data.field ? { [data.field as FieldName]: data.message || '' } : {});
        triggerShake();
        setBanner({ kind: 'error', text: data.message || 'Không tạo được tài khoản.' });
        return;
      }
      // Carry the email into the login tab so the user types a PIN, not an email.
      setBanner({ kind: 'ok', text: data.message || 'Đã tạo tài khoản.' });
      setPin('');
      setConfirmPin('');
      setManagerPin('');
      window.setTimeout(() => switchMode(AuthMode.Login), 900);
    } catch {
      triggerShake();
      setBanner({ kind: 'error', text: 'Không kết nối được máy chủ. Vui lòng thử lại.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-gradient-to-b from-[#05080f] via-[#0a1120] to-[#0c1526] px-4 py-14">
      {/* Slow paw-print drift. 14 marks on a long loop, opacity ≤ 0.07 so they
          read as texture rather than as decoration competing with the card. */}
      <PawDrift />

      <div className="relative w-full max-w-lg">
        <motion.div
          initial={{ opacity: 0, scale: 0.94, filter: 'blur(10px)' }}
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mb-7 text-center"
        >
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-3xl border border-white/20 bg-white/10 shadow-vision-glass backdrop-blur-2xl">
            <ShieldCheck className="size-8 text-emerald-300" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">Cổng nhân viên Belwee</h1>
          <p className="mt-1 text-sm text-white/50">
            {isRegister ? 'Tạo tài khoản nhân viên riêng của bạn' : 'Đăng nhập nội bộ bằng mã PIN 6 số'}
          </p>
        </motion.div>

        <motion.div
          animate={shake ? { x: [0, -11, 11, -8, 8, 0], rotate: [0, -0.4, 0.4, -0.2, 0.2, 0] } : { x: 0 }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
          style={
            shake
              ? { boxShadow: '0 0 30px rgba(239,68,68,0.42), 0 24px 60px -18px rgba(0,0,0,0.75)' }
              : undefined
          }
          className="relative"
        >
          {/* ── G7: tab "Tạo tài khoản" đã bị gỡ ───────────────────────────────
              Cổng tự đăng ký nhân viên công khai đã đóng. Trước đây đây là tab
              switcher 2 chế độ (Đăng nhập / Tạo tài khoản) và là đường vào để
              bất kỳ ai tự tạo tài khoản staff — nguồn gốc của các thẻ rác/trùng
              trong dữ liệu và của tài khoản tự chọn vai trò quản trị.

              Thay bằng một dòng thông báo nói rõ tài khoản do ai cấp, để người
              nhân viên mới biết phải liên hệ ai thay vì tưởng trang bị lỗi. */}
          <p className="mb-4 rounded-2xl border border-white/12 bg-white/[0.06] px-4 py-3 text-center text-xs font-medium leading-relaxed text-white/70">
            Chưa có tài khoản hoặc quên mã PIN?{' '}
            <span className="font-bold text-emerald-200">
              Liên hệ Quản trị viên / HR
            </span>{' '}
            để được cấp tài khoản.
          </p>

          <div className="overflow-hidden rounded-[28px] border border-white/15 bg-white/[0.07] p-6 shadow-vision-glass backdrop-blur-3xl sm:p-7">
            <AnimatePresence mode="wait" initial={false}>
              {isRegister ? (
                <motion.div
                  key="register"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
                  className="space-y-4"
                >
                  <div className="mb-1 flex items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-emerald-300">
                      <UserPlus className="size-4.5" aria-hidden="true" />
                    </div>
                    <p className="text-sm font-bold text-white">
                      Tài khoản nhân viên
                      <span className="mt-0.5 block text-xs font-normal text-white/50">
                        Mỗi người một mã PIN riêng — không dùng chung tài khoản.
                      </span>
                    </p>
                  </div>

                  <GlassField id="fullName" label="Tên nhân viên" error={errors.fullName}>
                    <input
                      id="staff-fullName"
                      data-invalid={errors.fullName ? 'true' : undefined}
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      autoComplete="name"
                      placeholder="Nguyễn Văn A"
                      className={cn(fieldBase, errors.fullName ? fieldBad : fieldOk)}
                    />
                  </GlassField>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <GlassField id="dateOfBirth" label="Ngày sinh" error={errors.dateOfBirth}>
                      <input
                        id="staff-dateOfBirth"
                        data-invalid={errors.dateOfBirth ? 'true' : undefined}
                        type="date"
                        value={dateOfBirth}
                        max={new Date(Date.now() - 16 * 365.25 * 864e5).toISOString().slice(0, 10)}
                        onChange={(e) => setDateOfBirth(e.target.value)}
                        className={cn(
                          fieldBase,
                          'scheme-dark [color-scheme:dark]',
                          errors.dateOfBirth ? fieldBad : fieldOk
                        )}
                      />
                    </GlassField>

                    <GlassField
                      id="email"
                      label="Email"
                      error={errors.email}
                      hint="Chỉ dùng để định danh — không gửi mã OTP."
                    >
                      <input
                        id="staff-email"
                        data-invalid={errors.email ? 'true' : undefined}
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoComplete="email"
                        placeholder="ban@belwee.vn"
                        className={cn(fieldBase, errors.email ? fieldBad : fieldOk)}
                      />
                    </GlassField>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <GlassField id="branchId" label="Chi nhánh làm việc" error={errors.branchId}>
                      <div className="relative">
                        <select
                          id="staff-branchId"
                          data-invalid={errors.branchId ? 'true' : undefined}
                          value={branchId}
                          onChange={(e) => setBranchId(e.target.value)}
                          className={cn(
                            fieldBase,
                            'appearance-none pr-10 [color-scheme:dark]',
                            errors.branchId ? fieldBad : fieldOk
                          )}
                        >
                          {BRANCHES.map((branch) => (
                            <option key={branch.id} value={branch.id} className="bg-[#0b1120] text-white">
                              {branch.code} · {branch.addressShort}
                            </option>
                          ))}
                        </select>
                        <svg
                          className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-white/40"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2.5}
                          aria-hidden="true"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
                        </svg>
                      </div>
                    </GlassField>

                    <GlassField id="jobTitle" label="Chức danh" error={errors.jobTitle}>
                      <div className="relative">
                        <select
                          id="staff-jobTitle"
                          data-invalid={errors.jobTitle ? 'true' : undefined}
                          value={jobTitle}
                          onChange={(e) => setJobTitle(e.target.value as StaffJobTitle)}
                          className={cn(
                            fieldBase,
                            'appearance-none pr-10 [color-scheme:dark]',
                            errors.jobTitle ? fieldBad : fieldOk
                          )}
                        >
                          {(Object.keys(JOB_TITLE_LABELS) as StaffJobTitle[]).map((key) => (
                            <option key={key} value={key} className="bg-[#0b1120] text-white">
                              {JOB_ICON[key]} {JOB_TITLE_LABELS[key]}
                            </option>
                          ))}
                        </select>
                        <svg
                          className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-white/40"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2.5}
                          aria-hidden="true"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
                        </svg>
                      </div>
                    </GlassField>
                  </div>

                  {/* PIN + strength + confirm */}
                  <div className="rounded-2xl border border-white/12 bg-white/[0.04] p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/55">
                        Mã PIN nhân viên
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowPin((v) => !v)}
                        aria-label={showPin ? 'Ẩn mã PIN' : 'Hiện mã PIN'}
                        aria-pressed={showPin}
                        className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                      >
                        {showPin ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                        {showPin ? 'Ẩn' : 'Hiện'}
                      </button>
                    </div>

                    <PinInputs
                      value={pin}
                      disabled={loading}
                      onChange={(v) => {
                        setPin(v);
                        setErrors((prev) => ({ ...prev, pin: undefined }));
                      }}
                      invalid={Boolean(errors.pin)}
                      masked={!showPin}
                      label="Mã PIN nhân viên"
                    />

                    {/* Strength meter — 3 segments, width driven by score. */}
                    <div className="mt-3 flex items-center gap-2">
                      <div className="flex h-1.5 flex-1 gap-1" aria-hidden="true">
                        {[0, 1, 2].map((segment) => (
                          <span
                            key={segment}
                            className={cn(
                              'h-full flex-1 rounded-full transition-colors duration-300',
                              segment < strength.score
                                ? STRENGTH_COLOR[strength.score]
                                : 'bg-white/12'
                            )}
                          />
                        ))}
                      </div>
                      <span className="w-24 shrink-0 text-right text-[11px] font-semibold text-white/50">
                        {strength.label}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-white/30">{strength.hint}</p>
                    {errors.pin && <p className="mt-1 text-[11px] font-semibold text-red-300">{errors.pin}</p>}
                  </div>

                  <GlassField
                    id="confirmPin"
                    label="Nhập lại mã PIN"
                    error={errors.confirmPin}
                  >
                    <input
                      id="staff-confirmPin"
                      data-invalid={errors.confirmPin ? 'true' : undefined}
                      type={showPin ? 'text' : 'password'}
                      inputMode="numeric"
                      autoComplete="off"
                      value={confirmPin}
                      maxLength={PIN_LENGTH}
                      onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, PIN_LENGTH))}
                      placeholder="••••••"
                      className={cn(
                        fieldBase,
                        'tracking-[0.5em]',
                        errors.confirmPin ? fieldBad : fieldOk
                      )}
                    />
                  </GlassField>

                  <details className="group rounded-2xl border border-white/12 bg-white/[0.03] px-4 py-3">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-xs font-semibold text-white/55 transition-colors hover:text-white/85">
                      <span className="flex items-center gap-2">
                        <BadgeCheck className="size-3.5 text-emerald-300/80" aria-hidden="true" />
                        Tôi có mã PIN của quản trị viên
                      </span>
                      <span aria-hidden="true" className="transition-transform group-open:rotate-180">
                        ▾
                      </span>
                    </summary>
                    <div className="pt-3">
                      <GlassField
                        id="managerPin"
                        label="Mã PIN quản lý (không bắt buộc)"
                        error={errors.managerPin}
                        hint="Để trống: tài khoản nhận quyền theo chức danh. Có mã PIN quản trị: tài khoản được cấp quyền quản trị viên."
                      >
                        <input
                          id="staff-managerPin"
                          data-invalid={errors.managerPin ? 'true' : undefined}
                          type="text"
                          inputMode="numeric"
                          autoComplete="off"
                          value={managerPin}
                          maxLength={PIN_LENGTH}
                          onChange={(e) =>
                            setManagerPin(e.target.value.replace(/\D/g, '').slice(0, PIN_LENGTH))
                          }
                          placeholder="••••••"
                          className={cn(
                            fieldBase,
                            'tracking-[0.5em]',
                            errors.managerPin ? fieldBad : fieldOk
                          )}
                        />
                      </GlassField>
                    </div>
                  </details>

                  <button
                    type="button"
                    onClick={submitRegister}
                    disabled={loading}
                    className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-300 py-3.5 text-sm font-extrabold text-slate-950 shadow-liquid-glow-emerald transition-all duration-300 hover:brightness-110 active:scale-[0.985] disabled:opacity-60"
                  >
                    {loading ? <Loader2 className="size-4.5 animate-spin" /> : <UserPlus className="size-4.5" />}
                    {loading ? 'Đang tạo tài khoản…' : 'Tạo tài khoản'}
                    <span
                      aria-hidden
                      className="absolute inset-y-0 -left-1/2 w-1/3 -skew-x-12 bg-white/35 opacity-0 transition-all duration-500 group-hover:left-[120%] group-hover:opacity-100"
                    />
                  </button>

                  <div className="flex flex-col gap-2.5 pt-1 sm:flex-row">
                    <Link
                      href="/"
                      className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-xs font-bold text-white/70 transition-all duration-200 hover:bg-white/10 hover:text-white active:scale-[0.985]"
                    >
                      <Home className="size-3.5" aria-hidden="true" />
                      Quay lại trang chủ
                    </Link>
                    <button
                      type="button"
                      onClick={() => switchMode(AuthMode.Login)}
                      className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-300 px-4 py-3 text-xs font-extrabold text-slate-950 transition-all duration-200 hover:brightness-110 active:scale-[0.985]"
                    >
                      <LogIn className="size-3.5" aria-hidden="true" />
                      Đăng nhập ngay cho nhân viên
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="login"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
                  className="space-y-5"
                >
                  <div className="mb-1 flex items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-emerald-300">
                      <LogIn className="size-4.5" aria-hidden="true" />
                    </div>
                    <p className="text-sm font-bold text-white">
                      Đăng nhập nhân viên
                      <span className="mt-0.5 block text-xs font-normal text-white/50">
                        Email định danh + mã PIN 6 số của riêng bạn.
                      </span>
                    </p>
                  </div>

                  <GlassField id="email" label="Email" error={errors.email}>
                    <div className="relative">
                      <Mail
                        className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-white/30"
                        aria-hidden="true"
                      />
                      <input
                        id="staff-email"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          setErrors((prev) => ({ ...prev, email: undefined }));
                        }}
                        type="email"
                        autoComplete="username"
                        placeholder="ban@belwee.vn"
                        className={cn(fieldBase, 'pl-11', errors.email ? fieldBad : fieldOk)}
                      />
                    </div>
                  </GlassField>

                  <div>
                    <div className="mb-1.5 flex items-center justify-between gap-3">
                      <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/55">
                        Mã PIN 6 số
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowPin((v) => !v)}
                        aria-label={showPin ? 'Ẩn mã PIN' : 'Hiện mã PIN'}
                        aria-pressed={showPin}
                        className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                      >
                        {showPin ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                        {showPin ? 'Ẩn' : 'Hiện'}
                      </button>
                    </div>

                    {locked ? (
                      <div className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-5 text-center">
                        <p className="text-sm font-bold text-red-200">
                          Tài khoản đang tạm khoá do nhập sai mã PIN nhiều lần.
                        </p>
                        <p className="mt-1 text-xs text-red-200/75">
                          Thử lại sau{' '}
                          <span className="font-mono font-bold tabular-nums text-red-100">
                            {Math.floor(lockSeconds / 60)}:
                            {String(lockSeconds % 60).padStart(2, '0')}
                          </span>
                        </p>
                      </div>
                    ) : (
                      <PinInputs
                        value={pin}
                        disabled={loading}
                        onChange={(v) => {
                          setPin(v);
                          setErrors((prev) => ({ ...prev, pin: undefined }));
                        }}
                        invalid={Boolean(errors.pin)}
                        masked={!showPin}
                        label="Mã PIN đăng nhập"
                        onComplete={submitLogin}
                        autoFocus
                      />
                    )}
                    {errors.pin && !locked && (
                      <p className="mt-2 text-center text-[11px] font-semibold text-red-300">{errors.pin}</p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => submitLogin(pin)}
                    disabled={loading || locked}
                    className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-300 py-3.5 text-sm font-extrabold text-slate-950 shadow-liquid-glow-emerald transition-all duration-300 hover:brightness-110 active:scale-[0.985] disabled:opacity-55"
                  >
                    {loading ? (
                      <Loader2 className="size-4.5 animate-spin" />
                    ) : (
                      <LogIn className="size-4.5" aria-hidden="true" />
                    )}
                    {loading ? 'Đang kiểm tra…' : 'Đăng nhập'}
                    <span
                      aria-hidden
                      className="absolute inset-y-0 -left-1/2 w-1/3 -skew-x-12 bg-white/35 opacity-0 transition-all duration-500 group-hover:left-[120%] group-hover:opacity-100"
                    />
                  </button>

                  <div className="text-center">
                    <Link href="/staff/forgot-pin" className="text-xs font-semibold text-emerald-200/75 transition-colors hover:text-emerald-100 hover:underline">
                      Quên mã PIN?
                    </Link>
                  </div>

                  {/* G7: nút "Đăng nhập ngay cho nhân viên" (mở chế độ đăng ký) đã bị gỡ.
                      Không thay bằng nút khác — người dùng cần biết tài khoản do
                      Admin/HR cấp, thông báo ở đầu thẻ đã nói rõ điều đó. */}
                  <div className="pt-1">
                    <Link
                      href="/"
                      className="flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-xs font-bold text-white/70 transition-all duration-200 hover:bg-white/10 hover:text-white active:scale-[0.985]"
                    >
                      <Home className="size-3.5" aria-hidden="true" />
                      Quay lại trang chủ
                    </Link>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Banner — role="status" for the success case so a screen reader
                announces it without stealing focus. */}
            <div aria-live="polite" className="mt-4 empty:mt-0">
              <AnimatePresence mode="wait">
                {banner && (
                  <motion.p
                    key={banner.text}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    role={banner.kind === 'error' ? 'alert' : 'status'}
                    className={cn(
                      'rounded-xl border px-3 py-2.5 text-center text-xs font-semibold',
                      banner.kind === 'error'
                        ? 'border-red-400/30 bg-red-500/10 text-red-200'
                        : 'border-emerald-300/30 bg-emerald-400/10 text-emerald-200'
                    )}
                  >
                    {banner.text}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>

        <p className="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-white/30">
          <PawPrint className="size-3.5" aria-hidden="true" />
          <span>Belwee Pet Clinic · mỗi nhân viên một tài khoản riêng</span>
        </p>
      </div>
    </div>
  );
}

/**
 * Slow drifting paw prints.
 *
 * Positions are generated once from a fixed seed (not Math.random per render)
 * so React StrictMode's double-mount does not reshuffle the field, and so the
 * server and client agree on the markup.
 */
const PAW_POSITIONS = Array.from({ length: 14 }, (_, index) => {
  // Deterministic LCG — stable across renders and builds.
  const seed = (index + 1) * 2654435761 % 4294967296;
  const a = ((seed >>> 8) % 1000) / 1000;
  const b = (((seed >>> 18) % 1000) + 1000) % 1000 / 1000;
  const c = (((seed >>> 3) % 1000) + 1000) % 1000 / 1000;
  return {
    left: `${a * 96}%`,
    top: `${b * 92}%`,
    size: 14 + c * 26,
    duration: 26 + c * 22,
    delay: -a * 20,
    drift: (b - 0.5) * 90,
  };
});

function PawDrift() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {PAW_POSITIONS.map((paw, index) => (
        <span
          key={index}
          className="absolute select-none text-white/[0.07] motion-safe:animate-pawdrift"
          style={{
            left: paw.left,
            top: paw.top,
            fontSize: paw.size,
            animationDuration: `${paw.duration}s`,
            animationDelay: `${paw.delay}s`,
            // Per-element drift distance, kept in a CSS var so the keyframe is
            // shared rather than duplicated 14 times.
            ['--paw-drift' as string]: `${paw.drift}px`,
          }}
        >
          🐾
        </span>
      ))}
    </div>
  );
}