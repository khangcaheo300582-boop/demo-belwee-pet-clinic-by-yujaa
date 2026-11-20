"use client";

// components/staff/StaffLoginClient.tsx
// /staff/login – Spatial depth-layered auth flow.
// Phase 1: super-glass email/password form.
// Phase 2: 6-box PIN panel flies in while the credentials panel recedes (scale 0.9, z 0).
// Wrong PIN → fluid error wave (shake) + red glow that fades.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { KeyRound, Lock, LogIn, Mail, PawPrint, ShieldCheck, ArrowLeft, Loader2, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

const CRED_SCHEMA = z.object({
  email: z.string().min(1, 'Email không được để trống.').email('Email không hợp lệ.'),
  password: z.string().min(1, 'Mật khẩu không được để trống.'),
});

type CredValues = z.infer<typeof CRED_SCHEMA>;

const APPLE_SPRING = { type: 'spring', stiffness: 400, damping: 30, mass: 0.8 } as const;

interface LoginResponse {
  ok?: boolean;
  next?: 'pin';
  stepToken?: string;
  staffName?: string;
  message?: string;
  expired?: boolean;
}

// ─── 6-box PIN input ────────────────────────────────────────────────
function PinInputs({
  value,
  onChange,
  shake,
  onComplete,
  masked,
}: {
  value: string;
  onChange: (v: string) => void;
  shake: boolean;
  onComplete: (pin: string) => void;
  masked?: boolean;
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = value.split('');

  useEffect(() => {
    // Focus the first empty box when mounted / after shake clears the PIN.
    const idx = Math.min(value.length, 5);
    const t = window.setTimeout(() => refs.current[idx]?.focus(), 180);
    return () => window.clearTimeout(t);
  }, [value.length, shake]);

  function setAt(i: number, char: string) {
    const next = value.slice(0, i) + char + value.slice(i + 1);
    onChange(next.length > 6 ? next.slice(0, 6) : next);
    if (char && i < 5) refs.current[i + 1]?.focus();
    if (next.length === 6) {
      refs.current[5]?.blur();
      onComplete(next);
    }
  }

  return (
    <div className="flex justify-center gap-2.5 sm:gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <motion.input
          key={i}
          ref={el => {
            refs.current[i] = el;
          }}
          value={digits[i] || ''}
          onChange={e => {
            const v = e.target.value.replace(/\D/g, '');
            if (v) setAt(i, v[v.length - 1]);
          }}
          onKeyDown={e => {
            if (e.key === 'Backspace' && !digits[i] && i > 0) {
              e.preventDefault();
              setAt(i - 1, '');
              refs.current[i - 1]?.focus();
            }
            // Arrow-key navigation between the 6 boxes.
            else if (e.key === 'ArrowLeft' && i > 0) {
              e.preventDefault();
              refs.current[i - 1]?.focus();
            } else if (e.key === 'ArrowRight' && i < 5) {
              e.preventDefault();
              refs.current[i + 1]?.focus();
            }
          }}
          onPaste={e => {
            e.preventDefault();
            const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
            if (text) {
              onChange(text);
              if (text.length === 6) onComplete(text);
              else refs.current[text.length]?.focus();
            }
          }}
          inputMode="numeric"
          maxLength={1}
          className={cn(
            'size-12 rounded-2xl border bg-white/10 text-center text-2xl font-extrabold text-white outline-none backdrop-blur-xl transition-all duration-200',
            'shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)] focus:border-emerald-300/60 focus:bg-white/15',
            shake ? 'border-red-400/70' : 'border-white/15'
          )}
          style={{ caretColor: '#6ee7b7', ...(masked ? ({ WebkitTextSecurity: 'disc' } as React.CSSProperties) : {}) }}
        />
      ))}
    </div>
  );
}

export default function StaffLoginClient({ nextRedirect }: { nextRedirect?: string | null }) {
  const router = useRouter();
  const [step, setStep] = useState<'creds' | 'pin'>('creds');
  const [stepToken, setStepToken] = useState<string | null>(null);
  const [stepTokenExpired, setStepTokenExpired] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ kind: 'error' | 'ok'; text: string } | null>(null);
  const [pin, setPin] = useState('');
  const [shake, setShake] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPin, setShowPin] = useState(false);

  const {
    register,
    handleSubmit,
    getValues,
    setError,
    formState: { errors },
  } = useForm<CredValues>({ defaultValues: { email: '', password: '' } });

  const triggerShake = useCallback(() => {
    setShake(true);
    window.setTimeout(() => setShake(false), 550);
  }, []);

  const clearPin = useCallback(() => {
    setPin('');
  }, []);

  async function submitCredentials(values: CredValues) {
    setMessage(null);
    setLoading(true);
    try {
      const res = await fetch('/api/staff/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const data = (await res.json()) as LoginResponse;
      if (!res.ok) {
        setMessage({ kind: 'error', text: data.message || 'Đăng nhập thất bại.' });
        return;
      }
      if (data.next === 'pin' && data.stepToken) {
        setStepToken(data.stepToken);
        setStepTokenExpired(false);
        setPin('');
        setMessage(null);
        setStep('pin');
      }
    } catch {
      setMessage({ kind: 'error', text: 'Không kết nối được máy chủ. Vui lòng thử lại.' });
    } finally {
      setLoading(false);
    }
  }

  async function submitPin(pinValue: string) {
    // Guard against double submits (auto-submit on 6th digit + impatient Enter presses).
    if (loading || stepTokenExpired) return;
    const values = getValues();
    setMessage(null);
    setLoading(true);
    try {
      const res = await fetch('/api/staff/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: values.email, password: values.password, pin: pinValue, stepToken }),
      });
      const data = (await res.json()) as LoginResponse;
      if (res.ok && data.ok) {
        // Relative redirect — stays on the current origin (never a stale port).
        // Respect the ?next= destination set by the middleware so staff land on
        // the page they originally tried to open, not always the dashboard.
        const target = nextRedirect && nextRedirect.startsWith('/staff/') ? nextRedirect : '/staff/dashboard';
        router.replace(target);
        return;
      }
      triggerShake();
      clearPin();
      if (data.expired) {
        // The 5-minute step token died (server restart / slow typing).
        // Reset the whole flow instead of leaving the user stuck on a dead PIN step.
        setStepTokenExpired(true);
        setStepToken(null);
        setStep('creds');
        setMessage({ kind: 'error', text: data.message || 'Phiên xác thực hết hạn. Vui lòng đăng nhập lại từ đầu.' });
        return;
      }
      setMessage({ kind: 'error', text: data.message || 'Mã PIN không chính xác, vui lòng thử lại!' });
    } catch {
      triggerShake();
      clearPin();
      setMessage({ kind: 'error', text: 'Không kết nối được máy chủ. Vui lòng thử lại.' });
    } finally {
      setLoading(false);
    }
  }

  function goBackToCreds() {
    setStepToken(null);
    setStepTokenExpired(false);
    setPin('');
    setMessage(null);
    setStep('creds');
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-b from-[#05080f] via-[#0a1120] to-[#0c1526] px-4 py-14">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-liquid-mesh" />
      <div aria-hidden className="pointer-events-none absolute -top-32 left-1/2 h-[420px] w-[680px] -translate-x-1/2 rounded-full bg-emerald-400/10 blur-[130px]" />

      <div className="relative w-full max-w-md">
        {/* Emblem */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-3xl border border-white/20 bg-white/10 shadow-vision-glass backdrop-blur-2xl">
            <ShieldCheck className="size-8 text-emerald-300" />
          </div>
          <h1 className="text-2xl font-extrabold text-white">Cổng nhân viên Belwee</h1>
          <p className="mt-1 text-sm text-white/50">Đăng nhập nội bộ · phòng khám thú y</p>
        </div>

        <div className="relative min-h-[400px]">
          {/* ── Phase 1: credentials (recedes on PIN step) ─────────── */}
          <motion.div
            className={cn('absolute inset-0 z-10', step === 'pin' && 'pointer-events-none')}
            animate={step === 'pin' ? { scale: 0.9, opacity: 0.35, filter: 'blur(3px)' } : { scale: 1, opacity: 1, filter: 'blur(0px)' }}
            transition={APPLE_SPRING}
          >
            <form
              onSubmit={handleSubmit(values => {
                const parsed = CRED_SCHEMA.safeParse(values);
                if (!parsed.success) {
                  parsed.error.issues.forEach(issue => {
                    setError(issue.path[0] as 'email' | 'password', { message: issue.message });
                  });
                  return;
                }
                submitCredentials(parsed.data);
              })}
              className="rounded-3xl border border-white/15 bg-white/10 p-7 shadow-vision-glass backdrop-blur-3xl"
            >
              <div className="mb-6 flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-emerald-300">
                  <Lock className="size-4.5" />
                </div>
                <div>
                  <p className="font-bold text-white">Bước 1 · Email & mật khẩu</p>
                  <p className="text-xs text-white/50">Tài khoản do quản trị viên cấp</p>
                </div>
              </div>

              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/45">Email</label>
              <div className="relative mb-4">
                <Mail className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-white/35" />
                <input
                  {...register('email')}
                  type="email"
                  autoComplete="username"
                  placeholder="admin@belwee.vn"
                  className={cn(
                    'w-full rounded-2xl border bg-white/5 py-3 pl-11 pr-4 text-sm text-white outline-none backdrop-blur-xl transition-all duration-300 placeholder:text-white/30',
                    'shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)] focus:border-emerald-300/50 focus:shadow-[0_0_0_4px_rgba(52,211,153,0.12),inset_0_1px_1px_rgba(255,255,255,0.2)]',
                    errors.email ? 'border-red-400/60' : 'border-white/15'
                  )}
                />
              </div>
              {errors.email && <p className="-mt-2 mb-3 text-xs text-red-400">{errors.email.message}</p>}

              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/45">Mật khẩu</label>
              <div className="relative mb-5">
                <KeyRound className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-white/35" />
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className={cn(
                    'w-full rounded-2xl border bg-white/5 py-3 pl-11 pr-11 text-sm text-white outline-none backdrop-blur-xl transition-all duration-300 placeholder:text-white/30',
                    'shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)] focus:border-emerald-300/50 focus:shadow-[0_0_0_4px_rgba(52,211,153,0.12),inset_0_1px_1px_rgba(255,255,255,0.2)]',
                    errors.password ? 'border-red-400/60' : 'border-white/15'
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  className="absolute right-3 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-lg text-white/35 transition-colors hover:bg-white/10 hover:text-white/80"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {errors.password && <p className="-mt-3 mb-3 text-xs text-red-400">{errors.password.message}</p>}

              <button
                type="submit"
                disabled={loading}
                className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-emerald-400 py-3.5 text-sm font-extrabold text-slate-950 shadow-liquid-glow-emerald transition-all duration-300 hover:bg-emerald-300 disabled:opacity-60"
              >
                {loading ? <Loader2 className="size-4.5 animate-spin" /> : <LogIn className="size-4.5" />}
                {loading ? 'Đang kiểm tra…' : 'Tiếp tục với mã PIN'}
                <span aria-hidden className="absolute inset-y-0 -left-1/2 w-1/3 -skew-x-12 bg-white/30 opacity-0 transition-all duration-500 group-hover:left-[120%] group-hover:opacity-100" />
              </button>

              <AnimatePresence>
                {message && message.kind === 'error' && step === 'creds' && (
                  <motion.p
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-center text-xs font-semibold text-red-300"
                  >
                    {message.text}
                  </motion.p>
                )}
              </AnimatePresence>
            </form>
          </motion.div>

          {/* ── Phase 2: PIN (flies in from deep space) ───────────── */}
          <motion.div
            className={cn('absolute inset-0 z-20', step === 'creds' && 'pointer-events-none')}
            initial={false}
            animate={
              step === 'pin'
                ? { scale: 1, opacity: 1, x: 0, filter: 'blur(0px)' }
                : { scale: 1.08, opacity: 0, x: 60, filter: 'blur(6px)' }
            }
            transition={APPLE_SPRING}
          >
            <motion.div
              animate={shake ? { x: [0, -10, 10, -10, 10, 0] } : { x: 0 }}
              transition={{ duration: 0.5, ease: 'easeInOut' }}
              className="rounded-3xl border border-white/15 bg-white/10 p-7 shadow-vision-glass backdrop-blur-3xl"
              style={shake ? { boxShadow: '0 0 24px rgba(239,68,68,0.45), inset 0 1px 1px rgba(255,255,255,0.15)' } : undefined}
            >
              <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-emerald-300">
                    <KeyRound className="size-4.5" />
                  </div>
                  <div>
                    <p className="font-bold text-white">Bước 2 · Mã PIN</p>
                    <p className="text-xs text-white/50">Xác thực hai lớp bảo mật</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={goBackToCreds}
                  className="flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <ArrowLeft className="size-3.5" /> Quay lại
                </button>
              </div>

              <p className="mb-4 text-center text-sm text-white/55">
                Nhập mã PIN 6 số để hoàn tất đăng nhập
              </p>

              <div className="mb-3 flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/40">6 chữ số</span>
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

              <PinInputs value={pin} onChange={setPin} shake={shake} onComplete={submitPin} masked={!showPin} />

              <div className="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-white/35">
                <PawPrint className="size-3.5" />
                <span>Belwee Pet Clinic · bảo mật hai lớp</span>
              </div>

              <AnimatePresence>
                {message && message.kind === 'error' && step === 'pin' && (
                  <motion.p
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-center text-xs font-semibold text-red-300"
                  >
                    {message.text}
                  </motion.p>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
