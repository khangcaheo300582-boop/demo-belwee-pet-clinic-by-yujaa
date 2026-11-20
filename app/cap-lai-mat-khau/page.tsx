"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { signIn } from 'next-auth/react';

export default function CapLaiMatKhauPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [loadingSend, setLoadingSend] = useState(false);
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [message, setMessage] = useState<{ text: string; isError: boolean; isInfo?: boolean } | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  // Track countdown interval so it can be cleaned up on unmount
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Hẹn giờ tự chuyển sang trang đăng ký khi email chưa có tài khoản.
  const redirectRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      // Clean up interval on unmount to prevent memory leak
      if (countdownRef.current != null) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
      if (redirectRef.current != null) {
        clearTimeout(redirectRef.current);
        redirectRef.current = null;
      }
    };
  }, []);

  // Khởi động bộ đếm ngược, dọn interval cũ trước. Dùng chung cho cả lần gửi
  // thành công lẫn lần bị chặn 429 để con số hiển thị khớp giới hạn máy chủ.
  const startCountdown = (seconds: number) => {
    const safeSeconds = seconds > 0 ? seconds : 300;
    setCountdown(safeSeconds);
    if (countdownRef.current != null) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setCountdown((current) => {
        if (current <= 1) {
          if (countdownRef.current != null) {
            clearInterval(countdownRef.current);
            countdownRef.current = null;
          }
          return 0;
        }
        return current - 1;
      });
    }, 1000);
  };

  const sendOtp = async () => {
    if (!email) {
      setMessage({ text: 'Vui lòng nhập email trước.', isError: true });
      return;
    }
    setLoadingSend(true);
    setMessage(null);
    try {
      const response = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, type: 'reset' }),
      });
      const data = await response.json();
      const serverCooldown = typeof data.cooldownSeconds === 'number' ? data.cooldownSeconds : 0;

      // Đọc Retry-After nếu máy chủ gửi, về cơ sở giây.
      const retryAfterHeader = response.headers.get('Retry-After');
      let retryAfterSeconds = 0;
      if (retryAfterHeader != null) {
        const parsed = Number(retryAfterHeader);
        if (Number.isFinite(parsed) && parsed > 0) retryAfterSeconds = Math.floor(parsed);
      }

      if (!response.ok) {
        // Email chưa có tài khoản: báo rõ và tự chuyển sang trang đăng ký với
        // email điền sẵn, thay vì để khách chờ một lá thư không bao giờ tới.
        if (data.code === 'ACCOUNT_NOT_FOUND') {
          setMessage({
            text: `${data.message} Đang chuyển đến trang đăng ký…`,
            isError: false,
            isInfo: true,
          });
          const registerUrl = `/dang-nhap?mode=register&email=${encodeURIComponent(email.trim())}`;
          if (redirectRef.current != null) clearTimeout(redirectRef.current);
          redirectRef.current = setTimeout(() => {
            router.push(registerUrl);
          }, 3000);
          return;
        }

        // Bao giờ cũng hiện lỗi, không bao giờ báo thành công khi server từ chối.
        const errorText =
          response.status === 429
            ? data.message ||
              (retryAfterSeconds > 0
                ? `Vui lòng đợi ${retryAfterSeconds} giây rồi thử lại.`
                : 'Vui lòng đợi một lúc rồi thử lại.')
            : data.message || 'Không thể gửi mã OTP.';
        setMessage({ text: errorText, isError: true });
        if (response.status === 429) {
          // Chỉ chạy đồng hồ đếm để nút bị khóa, không báo thành công.
          startCountdown(retryAfterSeconds || serverCooldown);
        }
        return;
      }
      setMessage({ text: data.message, isError: false });
      startCountdown(serverCooldown);
    } catch {
      setMessage({ text: 'Không thể kết nối đến máy chủ gửi OTP.', isError: true });
    } finally {
      setLoadingSend(false);
    }
  };

  const submitReset = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoadingSubmit(true);
    setMessage(null);
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otpCode, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage({ text: data.message || 'Không thể đặt lại mật khẩu.', isError: true });
        return;
      }

      const loginResult = await signIn('credentials', { email, password, redirect: false });
      if (loginResult?.error) {
        setMessage({ text: 'Đã đổi mật khẩu nhưng đăng nhập tự động thất bại.', isError: true });
        return;
      }
      setShowSuccess(true);
      setTimeout(() => {
        router.push('/');
        router.refresh();
      }, 1800);
    } catch {
      setMessage({ text: 'Lỗi kết nối máy chủ đặt lại mật khẩu.', isError: true });
    } finally {
      setLoadingSubmit(false);
    }
  };

  const formatTime = (seconds: number) =>
    `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;

  return (
    <main className="min-h-screen w-full bg-[#0a0f1c] flex items-center justify-center p-4 sm:p-6 font-sans overflow-x-hidden">
      {/* MODAL THÀNH CÔNG */}
      {showSuccess && (
        <div className="terms-modal-backdrop" role="dialog" aria-modal="true" aria-label="Thành công">
          <div className="terms-modal-card is-entering" style={{ textAlign: 'center' }}>
            <div className="success-modal-icon">
              <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                <circle cx="32" cy="32" r="30" stroke="url(#successGradReset)" strokeWidth="3" fill="rgba(34,197,94,0.08)" />
                <path className="success-check" d="M20 33 L28 41 L44 23" stroke="#22c55e" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                <defs>
                  <linearGradient id="successGradReset" x1="0" y1="0" x2="64" y2="64">
                    <stop offset="0%" stopColor="#22c55e" />
                    <stop offset="100%" stopColor="#16a34a" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <h2 className="terms-title" style={{ marginTop: '16px' }}>Đặt lại mật khẩu thành công!</h2>
            <p className="terms-sub" style={{ marginTop: '8px' }}>Đang chuyển hướng đến trang chủ...</p>
            <div className="success-modal-bar">
              <div className="success-modal-bar-fill" />
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-[520px]">
        <div data-reveal="fade-up" className="w-full bg-white/[0.02] backdrop-blur-xl rounded-2xl p-8 sm:p-10 shadow-2xl border border-white/[0.05]">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-white tracking-wider mb-2 uppercase">CẤP LẠI MẬT KHẨU</h1>
            <div className="h-0.5 w-16 bg-blue-500 mx-auto rounded-full mb-3" />
            <p className="text-xs text-slate-400">Hệ thống bảo mật y tế Belwee Clinic</p>
          </div>

          <form onSubmit={submitReset} className="space-y-5">
            <div>
              <label htmlFor="reset-email" className="block text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-2">Email nhận mã OTP</label>
              <div className="relative">
                <input id="reset-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="email@belwee.com" className="w-full bg-black/30 border border-slate-700/50 rounded-xl px-5 py-4 pr-32 text-sm focus:outline-none focus:border-blue-500 transition text-white placeholder:text-slate-600" required />
                <button type="button" onClick={sendOtp} disabled={loadingSend || countdown > 0} className="absolute right-2 top-2 bottom-2 px-3 bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white rounded-lg text-xs font-semibold transition disabled:opacity-50">
                  {loadingSend ? 'ĐANG GỬI...' : countdown ? formatTime(countdown) : 'GỬI MÃ'}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="reset-otp" className="block text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-2">Mã xác nhận (OTP)</label>
              <input id="reset-otp" type="text" inputMode="numeric" maxLength={6} pattern="\d{6}" value={otpCode} onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="Nhập 6 chữ số" className="w-full bg-black/30 border border-slate-700/50 rounded-xl px-5 py-4 text-sm tracking-[0.4em] focus:outline-none focus:border-blue-500 transition text-white placeholder:text-slate-600 placeholder:tracking-normal" required />
            </div>

            <div>
              <label htmlFor="reset-password" className="block text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-2">Mật khẩu mới</label>
              <div className="relative">
                <input id="reset-password" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Ít nhất 8 ký tự, gồm chữ hoa, thường, số, ký tự đặc biệt" className="w-full bg-black/30 border border-slate-700/50 rounded-xl px-5 py-4 pr-12 text-sm focus:outline-none focus:border-blue-500 transition text-white placeholder:text-slate-600" required />
                <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition">
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"></path><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"></path><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"></path><line x1="2" y1="2" x2="22" y2="22"></line></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                  )}
                </button>
              </div>
            </div>

            {message && <div className={`p-4 rounded-xl text-sm font-medium border text-center ${message.isError ? 'bg-red-500/10 border-red-500/20 text-red-400' : message.isInfo ? 'bg-amber-500/10 border-amber-500/20 text-amber-300' : 'bg-green-500/10 border-green-500/20 text-green-400'}`}>{message.text}</div>}

            <button type="submit" disabled={loadingSubmit} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold tracking-widest rounded-xl py-4 text-sm transition shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)] disabled:opacity-50 mt-2 uppercase">
              {loadingSubmit ? 'ĐANG XỬ LÝ...' : 'ĐẶT LẠI MẬT KHẨU'}
            </button>
          </form>

          <div className="text-center mt-6 pt-4 border-t border-white/[0.03] space-y-3">
            <Link href="/dang-nhap" className="block text-[11px] text-blue-400 hover:text-blue-300 font-bold tracking-widest uppercase hover:underline transition-all">
              Quay lại đăng nhập
            </Link>
            <Link
              href={email.trim() ? `/dang-nhap?mode=register&email=${encodeURIComponent(email.trim())}` : '/tao-tai-khoan'}
              className="block text-[11px] text-slate-300 hover:text-white font-bold tracking-widest uppercase hover:underline transition-all"
            >
              Tạo tài khoản mới
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
