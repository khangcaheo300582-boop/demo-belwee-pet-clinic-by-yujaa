'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, Eye, EyeOff, KeyRound, Loader2, Mail, ShieldCheck } from 'lucide-react';

export default function StaffForgotPinPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPin, setShowPin] = useState(true);
  const [countdown, setCountdown] = useState(0);
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = window.setInterval(() => {
      setCountdown((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [countdown]);

  async function sendOtp() {
    setMessage(null);
    setSending(true);
    try {
      const response = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, type: 'staff-reset' }),
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage({ text: data.message || 'Không thể gửi mã OTP.', error: true });
        // Keep the button disabled for the full server-side cooldown instead of
        // letting the user hammer a 429.
        if (response.status === 429 && typeof data.cooldownSeconds === 'number' && data.cooldownSeconds > 0) {
          setCountdown(data.cooldownSeconds);
        }
        return;
      }
      setMessage({ text: data.message || 'Mã OTP đã được gửi vào email nhân viên.', error: false });
      setCountdown(data.cooldownSeconds || 300);
    } catch {
      setMessage({ text: 'Không kết nối được máy chủ gửi OTP. Vui lòng thử lại.', error: true });
    } finally {
      setSending(false);
    }
  }

  async function submitReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    if (otpCode.length !== 6) {
      setMessage({ text: 'Vui lòng nhập đủ 6 chữ số OTP rồi xác nhận.', error: true });
      return;
    }
    if (!/^\d{6}$/.test(recoveryCode)) {
      setMessage({ text: 'Mã khôi phục phải gồm đúng 6 chữ số.', error: true });
      return;
    }
    if (!/^\d{6}$/.test(pin) || pin !== confirmPin) {
      setMessage({ text: 'Mã PIN mới phải gồm 6 số và khớp với phần xác nhận.', error: true });
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/staff/reset-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otpCode, recoveryCode, pin }),
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage({ text: data.message || 'Không thể cấp lại mã PIN.', error: true });
        return;
      }
      setMessage({ text: data.message || 'Cấp lại mã PIN thành công.', error: false });
      window.setTimeout(() => router.replace('/staff/login'), 1200);
    } catch {
      setMessage({ text: 'Không kết nối được máy chủ. Vui lòng thử lại.', error: true });
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    'w-full rounded-2xl border border-white/15 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition-[border-color,box-shadow,background-color] duration-200 placeholder:text-white/25 focus:border-emerald-300/60 focus:bg-white/[0.12] focus:shadow-[0_0_0_4px_rgba(52,211,153,0.16)]';
  const remainingTime = `${String(Math.floor(countdown / 60)).padStart(2, '0')}:${String(countdown % 60).padStart(2, '0')}`;

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-gradient-to-b from-[#05080f] via-[#0a1120] to-[#0c1526] px-4 py-14">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-liquid-mesh" />
      <section className="relative w-full max-w-lg rounded-3xl border border-white/15 bg-white/10 p-6 shadow-vision-glass backdrop-blur-3xl sm:p-8">
        <header className="mb-7 text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-emerald-300">
            <ShieldCheck className="size-7" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-extrabold text-white">Cấp lại mã PIN nhân viên</h1>
          <p className="mt-2 text-sm text-white/55">Nhận mã OTP qua email đã đăng ký để xác nhận tài khoản.</p>
        </header>

        <form onSubmit={submitReset} className="space-y-5">
          <div>
            <label htmlFor="staff-recovery-email" className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-white/55">
              Email nhân viên
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-white/30" aria-hidden="true" />
              <input
                id="staff-recovery-email"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="ban@belwee.vn"
                className={`${inputClass} pl-11 pr-32`}
              />
              <button
                type="button"
                onClick={sendOtp}
                disabled={sending || countdown > 0 || !email.trim()}
                className="absolute right-2 top-2 bottom-2 rounded-xl bg-emerald-400/15 px-3 text-xs font-bold text-emerald-200 transition-colors hover:bg-emerald-400/25 disabled:opacity-45"
              >
                {sending ? 'ĐANG GỬI…' : countdown > 0 ? remainingTime : 'GỬI OTP'}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="staff-recovery-otp" className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-white/55">
              Mã OTP 6 số
            </label>
            <input
              id="staff-recovery-otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              required
              value={otpCode}
              onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="Nhập mã trong email"
              className={`${inputClass} tracking-[0.25em]`}
            />
            {otpCode.length === 6 && <p className="mt-1.5 text-xs text-emerald-200">Đã nhập đủ 6 số — xác nhận bên dưới để tiếp tục.</p>}
          </div>

          <div>
            <label htmlFor="staff-recovery-code" className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-white/55">
              Mã khôi phục
            </label>
            <input
              id="staff-recovery-code"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              pattern="\d{6}"
              maxLength={6}
              required
              value={recoveryCode}
              onChange={(event) => setRecoveryCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="Nhập mã khôi phục của phòng khám"
              aria-describedby="staff-recovery-code-hint"
              className={inputClass}
            />
            <p id="staff-recovery-code-hint" className="mt-1.5 text-xs text-white/45">
              Mã 6 số do quản lý phòng khám cấp — không phải mã số nhân viên của bạn.
            </p>
          </div>

          <div>
            <label htmlFor="staff-new-pin" className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-white/55">
              Mã PIN mới
            </label>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-white/30" aria-hidden="true" />
              <input
                id="staff-new-pin"
                type={showPin ? 'text' : 'password'}
                inputMode="numeric"
                autoComplete="new-password"
                pattern="\d{6}"
                maxLength={6}
                required
                value={pin}
                onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Chọn PIN mới gồm 6 số"
                className={`${inputClass} pl-11 pr-12 tracking-[0.25em]`}
              />
              <button
                type="button"
                onClick={() => setShowPin((visible) => !visible)}
                aria-label={showPin ? 'Ẩn mã PIN' : 'Hiện mã PIN'}
                aria-pressed={showPin}
                className="absolute right-3 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-white/45 transition-colors hover:bg-white/10 hover:text-white"
              >
                {showPin ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="staff-confirm-pin" className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-white/55">
              Xác nhận mã PIN mới
            </label>
            <input
              id="staff-confirm-pin"
              type={showPin ? 'text' : 'password'}
              inputMode="numeric"
              autoComplete="new-password"
              pattern="\d{6}"
              maxLength={6}
              required
              value={confirmPin}
              onChange={(event) => setConfirmPin(event.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="Nhập lại PIN mới"
              className={`${inputClass} tracking-[0.25em]`}
            />
          </div>

          {message && (
            <p role={message.error ? 'alert' : 'status'} className={`rounded-xl border px-3 py-2.5 text-center text-xs font-semibold ${message.error ? 'border-red-400/30 bg-red-500/10 text-red-200' : 'border-emerald-300/30 bg-emerald-400/10 text-emerald-200'}`}>
              {message.text}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-300 py-3.5 text-sm font-extrabold text-slate-950 transition-all duration-200 hover:brightness-110 disabled:opacity-55"
          >
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
            {submitting ? 'ĐANG XÁC NHẬN…' : 'XÁC NHẬN OTP VÀ CẤP LẠI PIN'}
          </button>
        </form>

        <Link href="/staff/login" className="mt-6 flex items-center justify-center gap-2 text-xs font-semibold text-white/55 transition-colors hover:text-white">
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          Quay lại đăng nhập
        </Link>
      </section>
    </main>
  );
}
