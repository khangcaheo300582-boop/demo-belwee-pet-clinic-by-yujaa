"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { getAuthCallbackUrl } from '@/lib/site-url';
import { useLanguage } from '@/components/LanguageProvider';
import LanguageSwitcher from '@/components/LanguageSwitcher';

export default function DangNhapPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLanguage();

  // Quản lý luồng giao diện: true = Đăng nhập, false = Đăng ký
  const [isLogin, setIsLogin] = useState(true);
  // Quản lý trạng thái bật/tắt đèn (Mặc định bật để chiếu sáng Form)
  const [isLightOn, setIsLightOn] = useState(true);

  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // State quản lý 6 ô OTP cho luồng đăng ký tài khoản
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [loadingSend, setLoadingSend] = useState(false);
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [countdown, setCountdown] = useState(0);

  // Modal thành công sau đăng nhập/đăng ký
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Modal xác nhận "Đăng nhập cho nhân viên" — chặn trước khi rời sang /staff/login
  const [staffDialogOpen, setStaffDialogOpen] = useState(false);

  // ĐIỀU KHOẢN DỊCH VỤ — hiển thị từng thẻ một trước khi đăng nhập
  const termsList = [
    { title: t("login.terms1Title"), body: t("login.terms1Body") },
    { title: t("login.terms2Title"), body: t("login.terms2Body") },
    { title: t("login.terms3Title"), body: t("login.terms3Body") },
    { title: t("login.terms4Title"), body: t("login.terms4Body") },
  ];
  // currentTerm: 0..3 = các thẻ nội dung, 4 = thẻ cuối xác nhận, null = đóng modal (đã xác nhận)
  const [currentTerm, setCurrentTerm] = useState<number | null>(0);
  const [termLeaving, setTermLeaving] = useState(false);

  useEffect(() => {
    if (searchParams.get('mode') === 'register') setIsLogin(false);
  }, [searchParams]);

  // Trang quên mật khẩu chuyển sang đây kèm ?email=… để khách không phải gõ lại.
  useEffect(() => {
    const prefilled = searchParams.get('email')?.trim();
    if (prefilled) setEmail((current) => current || prefilled);
  }, [searchParams]);

  /**
   * GĐ9 · (i) — nơi đến sau khi đăng nhập, lấy từ `?next=`.
   *
   * Trước GĐ9 cả ba luồng (credentials · Google · đăng ký rồi đăng nhập) đều
   * `push('/')`. Nghĩa là khách bấm "Spa & Grooming" → bị cổng chặn → đăng nhập
   * → về trang chủ, phải tự tìm lại. `BookingAuthGate` đã gửi kèm `?next=`
   * nên chỗ cần là đọc nó.
   *
   * ── CHỐNG OPEN REDIRECT ─────────────────────────────────────────────────────
   * `?next=` là dữ liệu do kẻ khác đưa vào, nên không được tin. Ba chốt:
   *   1. phải bắt đầu bằng `/` — loại `https://evil.com` và `javascript:…`
   *   2. KHÔNG được bắt đầu bằng `//` — `//evil.com` là protocol-relative, trình
   *      duyệt coi như URL tuyệt đối và sẽ đưa người dùng ra ngoài
   *   3. mọi trường hợp lệ dùng `router.push` (đường dẫn nội bộ), không dùng
   *      `window.location`, nên kể cả khi lọt sót cũng không rời khỏi origin
   *
   * `?mode=register` được giữ nguyên: cổng gửi `?next=` nhưng không gửi `mode`.
   */
  const nextPath = useMemo(() => {
    const raw = searchParams.get('next');
    if (!raw) return '/trang-ca-nhan';
    if (!raw.startsWith('/')) return '/trang-ca-nhan';
    if (raw.startsWith('//')) return '/trang-ca-nhan';
    if (raw.startsWith('/\\')) return '/trang-ca-nhan';
    return raw;
  }, [searchParams]);

  const advanceTerm = () => {
    if (currentTerm === null) return;
    setTermLeaving(true);
    window.setTimeout(() => {
      setTermLeaving(false);
      if (currentTerm >= termsList.length) {
        setCurrentTerm(null); // Hoàn tất -> đóng modal
      } else {
        setCurrentTerm(currentTerm + 1);
      }
    }, 380);
  };

  const retreatTerm = () => {
    if (currentTerm === null || currentTerm <= 0) return;
    setTermLeaving(true);
    window.setTimeout(() => {
      setTermLeaving(false);
      setCurrentTerm(currentTerm - 1);
    }, 380);
  };

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Tự động nhảy ô OTP khi nhập mã đăng ký
  const handleOtpChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);

    if (digit && index < 5 && inputRefs.current[index + 1]) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  // Dán mã 6 số: rải các chữ số vào 6 ô. Trước đây mỗi ô chỉ nhận 1 ký tự nên
  // dán cả mã vào ô đầu chỉ giữ lại đúng một số, buộc khách phải gõ lại.
  const handleOtpPaste = (index: number, e: React.ClipboardEvent<HTMLInputElement>) => {
    const digits = e.clipboardData.getData('text').replace(/\D/g, '');
    if (!digits) return;
    e.preventDefault();
    const newOtp = [...otp];
    for (let offset = 0; offset < digits.length && index + offset < 6; offset += 1) {
      newOtp[index + offset] = digits[offset];
    }
    setOtp(newOtp);
    inputRefs.current[Math.min(index + digits.length, 5)]?.focus();
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // Gửi mã OTP qua hệ thống SMTP cho bất kỳ email nào khách hàng nhập vào
  const handleSendOtp = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!email) {
      setMessage({ text: t('login.errEmailFirst'), isError: true });
      return;
    }
    setLoadingSend(true);
    setMessage(null);
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, type: 'register' }),
      });
      const data = await res.json();
      const serverCooldown = typeof data.cooldownSeconds === 'number' ? data.cooldownSeconds : 0;
      if (!res.ok) {
        setMessage({ text: data.message || t('login.errOtpSend'), isError: true });
        if (res.status === 429) setCountdown(serverCooldown || 300);
      } else {
        setMessage({ text: data.message, isError: false });
        setCountdown(serverCooldown || 300);
      }
    } catch {
      setMessage({ text: t('login.errSmtp'), isError: true });
    } finally {
      setLoadingSend(false);
    }
  };

  // Xử lý gửi Form chính xác theo nghiệp vụ tách biệt
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    // 1. LUỒNG ĐĂNG NHẬP (Chuyển sang dùng NextAuth để đồng bộ Token với màn hình khóa)
    if (isLogin) {
      setLoadingSubmit(true);
      try {
        const res = await signIn("credentials", {
          email,
          password,
          redirect: false, // Ngăn chặn tự động chuyển hướng lỗi của NextAuth
        });

        if (res?.error) {
          setMessage({ text: t('login.errCredentials'), isError: true });
        } else {
          setSuccessMessage(t('login.successLogin'));
          setShowSuccess(true);
          setTimeout(() => {
            // GĐ9 · (i) — về đúng trang khách định vào, không phải luôn trang chủ.
            router.push(nextPath);
            router.refresh();
          }, 1800);
        }
      } catch {
        setMessage({ text: t('login.errServer'), isError: true });
      } finally {
        setLoadingSubmit(false);
      }
      return;
    }

    // 2. LUỒNG ĐĂNG KÝ (Tự động đăng nhập ngay sau khi kích hoạt thành công ✨)
    if (!fullName.trim()) {
      setMessage({ text: 'Vui lòng nhập họ và tên.', isError: true });
      return;
    }
    if (fullName.trim().length < 2) {
      setMessage({ text: 'Họ tên phải có ít nhất 2 ký tự.', isError: true });
      return;
    }
    const otpCode = otp.join('');
    if (otpCode.length < 6) {
      setMessage({ text: t('login.errOtpDigits'), isError: true });
      return;
    }
    setLoadingSubmit(true);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otpCode, password, name: fullName.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setMessage({ text: data.message || t('login.errCreate'), isError: true });
      } else {
        setSuccessMessage(t('login.successRegister'));
        setShowSuccess(true);

        // Kích hoạt đăng nhập ngầm ngay lập tức bằng tài khoản vừa tạo
        const loginResult = await signIn("credentials", {
          email: email,
          password: password,
          redirect: false,
        });

        if (loginResult?.error) {
          // Phòng hờ hy hữu lỗi, chuyển hướng về đăng nhập thủ công
          setMessage({ text: t('login.errAutoLogin'), isError: true });
          setIsLogin(true);
          return;
        }

        // Đăng nhập ngầm thành công -> Đưa thẳng vào trang cá nhân (Màn hình khóa sẽ biến mất)
        setTimeout(() => {
          // GĐ9 · (i) — xem chú thích ở luồng đăng nhập credentials ở trên.
          router.push(nextPath);
          router.refresh(); // Làm mới dữ liệu client-side để nhận Session
        }, 1200);
      }
    } catch {
      setMessage({ text: t('login.errNetworkRegister'), isError: true });
    } finally {
      setLoadingSubmit(false);
    }
  };

  // Sửa lỗi sập trang đen của Google Auth (NextAuth yêu cầu gọi hàm signIn chứ không dùng window.location)
  const handleGoogleAuth = () => {
    signIn('google', { callbackUrl: getAuthCallbackUrl(nextPath) });
  };

  return (
    <div className="login-page min-h-screen w-full bg-[#080d17] flex items-center justify-center p-4 sm:p-6 relative overflow-x-hidden select-none font-sans">

      {/* NỀN ẢNH ĐĂNG NHẬP — asset ảnh nền đăng nhập.png + lớp phủ tối nhẹ
          để thẻ kính và đèn bàn luôn đủ tương phản. */}
      <div className="login-bg-image" aria-hidden="true" />
      <div className="login-bg-scrim" aria-hidden="true" />

      {/* MODAL ĐIỀU KHOẢN DỊCH VỤ — nền mờ dần hiển thị từng thẻ */}
      {currentTerm !== null && (
        <div className="terms-modal-backdrop" role="dialog" aria-modal="true" aria-label={t("login.termsBackdropAria")}>
          <div
            className={`terms-modal-card ${termLeaving ? "is-leaving" : "is-entering"}`}
          >
            <span className="terms-badge">📋 {t("login.termsBadge")}</span>
            <h2 className="terms-title">{t("login.termsHello")}</h2>
            <p className="terms-sub">{t("login.termsIntro")}</p>

            <div className="terms-progress">
              <div
                className="terms-progress-fill"
                style={{ width: `${((Math.min(currentTerm, 4) + 1) / 5) * 100}%` }}
              />
            </div>

            {currentTerm <= termsList.length - 1 ? (
              <div className="terms-body">
                <div className="terms-step-num">{currentTerm + 1}</div>
                <div className="terms-text">
                  <div className="font-bold text-blue-200 mb-1.5">{termsList[currentTerm].title}</div>
                  <div>{termsList[currentTerm].body}</div>
                </div>
              </div>
            ) : (
              <div className="text-center px-2">
                <div className="text-5xl mb-4 anim-float inline-block">✅</div>
                <div className="text-sm text-slate-300 leading-relaxed">
                  {t("login.termsDonePre")} <b className="text-blue-300">{t("login.termsDoneBold")}</b>
                  {t("login.termsDonePost")}
                  <br />
                  {t("login.termsDoneHint")}
                </div>
              </div>
            )}

            {/* Step indicator dots */}
            <div className="flex items-center justify-center gap-2 mt-5">
              {termsList.map((_, idx) => (
                <div
                  key={idx}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${
                    idx < currentTerm
                      ? 'bg-blue-400'
                      : idx === currentTerm
                        ? 'bg-blue-500 w-5'
                        : 'bg-slate-600'
                  }`}
                />
              ))}
              <div
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  currentTerm >= termsList.length
                    ? 'bg-blue-500 w-5'
                    : 'bg-slate-600'
                }`}
              />
            </div>

            <div className="flex gap-3 mt-4">
              {currentTerm > 0 && (
                <button type="button" onClick={retreatTerm} className="terms-btn-back">
                  ← {t("login.termsBack")}
                </button>
              )}
              <button type="button" onClick={advanceTerm} className={`terms-btn ${currentTerm > 0 ? 'flex-1' : ''} anim-pulse-soft`}>
                {currentTerm <= termsList.length - 1
                  ? t("login.termsNext")
                  : t("login.termsAccept")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL XÁC NHẬN NHÂN VIÊN — đặt ở root (ngoài .login-glass-card có
          animation fill both giữ transform => fixed bên trong sẽ bị lỗi) */}
      {staffDialogOpen && (
        <div
          className="staff-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="staff-dialog-title"
          onClick={() => setStaffDialogOpen(false)}
        >
          <div
            className="staff-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="staff-modal-badge">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 9v4" />
                <path d="M12 17h.01" />
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              </svg>
              {t("login.staffBadge")}
            </div>
            <h3 id="staff-dialog-title" className="staff-modal-title">
              {t("login.staffTitle")}
            </h3>
            <p className="staff-modal-text">
              {t("login.staffText")}
            </p>
            <div className="staff-modal-actions">
              <button
                type="button"
                onClick={() => {
                  setStaffDialogOpen(false);
                  router.push('/staff/login');
                }}
                className="staff-modal-btn-primary"
              >
                {t("login.staffConfirm")}
              </button>
              <button
                type="button"
                onClick={() => setStaffDialogOpen(false)}
                className="staff-modal-btn-secondary"
              >
                {t("login.staffCancel")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL THÀNH CÔNG — Liquid Glass */}
      {showSuccess && (
        <div className="terms-modal-backdrop" role="dialog" aria-modal="true" aria-label={t("login.successAria")}>
          <div className="terms-modal-card is-entering" style={{ textAlign: 'center' }}>
            <div className="success-modal-icon">
              <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                <circle cx="32" cy="32" r="30" stroke="url(#successGrad)" strokeWidth="3" fill="rgba(34,197,94,0.08)" />
                <path className="success-check" d="M20 33 L28 41 L44 23" stroke="#22c55e" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                <defs>
                  <linearGradient id="successGrad" x1="0" y1="0" x2="64" y2="64">
                    <stop offset="0%" stopColor="#22c55e" />
                    <stop offset="100%" stopColor="#16a34a" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <h2 className="terms-title" style={{ marginTop: '16px' }}>{successMessage}</h2>
            <p className="terms-sub" style={{ marginTop: '8px' }}>{t("login.redirecting")}</p>
            <div className="success-modal-bar">
              <div className="success-modal-bar-fill" />
            </div>
          </div>
        </div>
      )}

      {/* ===== NỀN VŨ TRỤ DECORATIVE (chỉ hiển thị, không tương tác) ===== */}
      <div className="login-space-bg" aria-hidden="true">
        {/* Radial glow phía sau card */}
        <div className="space-glow space-glow-center" />
        <div className="space-glow space-glow-left" />
        <div className="space-glow space-glow-right" />

        {/* ĐÈN BÀN “LIQUID GLASS” — chao hình nón, toả ánh sáng xanh.
            Toàn bộ đèn dùng đúng kiến trúc kính lỏng 3 lớp (.glassContainer
            + filter url(#container-glass)); nút trên chao bật/tắt đèn. */}
        <div
          className={`lamp-rig login-lamp-slot glassContainer ${isLightOn ? 'is-glass' : 'is-off'}`}
          role="group"
          aria-label={t('login.lampAria')}
          style={{ '--lamp-lit': isLightOn ? 1 : 0.35 } as React.CSSProperties}
        >
          <span className="lamp-beam" aria-hidden="true" />
          <span className="lamp-head" aria-hidden="true" />
          <span className="lamp-bulb" aria-hidden="true" />
          <span className="lamp-neck" aria-hidden="true" />
          <span className="lamp-base" aria-hidden="true" />
          <button
            type="button"
            className="lamp-toggle"
            onClick={() => setIsLightOn(!isLightOn)}
            aria-label={isLightOn ? t('login.lampOff') : t('login.lampOn')}
            aria-pressed={isLightOn}
          />
        </div>

        {/* Hành tinh + sao + ngôi sao lấp lánh bên phải */}
        <div className="planet planet-main" />
        <div className="planet planet-small" />
        <div className="star star-1" />
        <div className="star star-2" />
        <div className="star star-3" />
        <div className="star star-4" />
      </div>

      {/* ===== THẺ ĐĂNG NHẬP GLASSMORPHISM (lệch phải như tham chiếu) ===== */}
      <div className="login-card-shell relative z-10 w-full flex justify-center lg:justify-end lg:pr-[8vw] xl:pr-[10vw]">

        <div
          data-reveal="fade-up"
          className="login-glass-card w-full max-w-[420px] rounded-[24px] p-8 sm:p-10"
        >
          {/* Vùng logo thương hiệu — dùng logo hiện có của dự án */}
          <div className="flex justify-center mb-5">
            <div className="login-logo-wrap">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-belwee.png" alt="Belwee Pet Clinic" className="login-logo-img" />
            </div
            >
          </div>

          <div className="text-center mb-8">
            <h1 className="login-title">
              {isLogin ? t('login.titleLogin') : t('login.titleRegister')}
            </h1>
            <div className="login-title-line" />
            <p className="login-subtitle">
              {isLogin ? t('login.subLogin') : t('login.subRegister')}
            </p>
          </div>

          <form onSubmit={handleFormSubmit} className="login-form" noValidate>
            {/* TRƯỜNG HỌ TÊN - chỉ hiện khi đăng ký */}
            {!isLogin && (
              <div className="login-field" data-reveal="fade-up">
                <label htmlFor="login-fullname" className="login-label">Họ và tên</label>
                <input
                  id="login-fullname"
                  name="fullName"
                  type="text"
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Nhập họ và tên của bạn"
                  className="login-input"
                  required={!isLogin}
                />
              </div>
            )}

            {/* TRƯỜNG EMAIL */}
            <div className="login-field">
              <label htmlFor="login-email" className="login-label">{t('login.emailLabel')}</label>
              <div className="relative">
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value.trim())}
                  onBlur={(e) => setEmail(e.target.value.trim())}
                  placeholder={t('login.emailPh')}
                  className="login-input"
                  required
                />
                {/* NÚT GỬI MÃ OTP — chỉ hiện khi đăng ký */}
                {!isLogin && (
                  <button
                    type="button"
                    disabled={loadingSend || countdown > 0}
                    onClick={handleSendOtp}
                    className="login-otp-btn"
                  >
                    {loadingSend
                      ? t('login.sending').toUpperCase()
                      : countdown > 0
                        ? `${t('login.retryIn').toUpperCase()} (${formatTime(countdown)})`
                        : t('login.sendOtp').toUpperCase()}
                  </button>
                )}
              </div>
            </div>

            {/* Ô OTP — chỉ hiện khi đăng ký */}
            {!isLogin && (
              <div className="login-field" data-reveal="fade-up">
                <label className="login-label">{t('login.otpLabel')}</label>
                <div className="flex justify-between gap-2">
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => { inputRefs.current[index] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      aria-label={`${t('login.otpDigitAria')} ${index + 1}`}
                      value={digit}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onPaste={(e) => handleOtpPaste(index, e)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      className="login-input login-otp-cell"
                      required={!isLogin}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* TRƯỜNG MẬT KHẨU */}
            <div className="login-field">
              <label htmlFor="login-password" className="login-label">
                {isLogin ? t('login.passwordLabel') : t('login.newPasswordLabel')}
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={isLogin ? "current-password" : "new-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('login.passwordPh')}
                  className="login-input pr-12"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? t('login.hidePassword') : t('login.showPassword')}
                  aria-pressed={showPassword}
                  className="login-eye-btn"
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"></path><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"></path><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"></path><line x1="2" y1="2" x2="22" y2="22"></line></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                  )}
                </button>
              </div>
              {isLogin && (
                <div className="mt-2.5 text-right">
                  <Link href="/cap-lai-mat-khau" className="login-link-muted">
                    {t('login.forgot')}
                  </Link>
                </div>
              )}
            </div>

            {/* Thông báo lỗi / thông báo hệ thống */}
            {message && (
              <div
                role={message.isError ? 'alert' : 'status'}
                aria-live="assertive"
                className={`login-message ${message.isError ? 'is-error' : 'is-ok'}`}
              >
                {message.text}
              </div>
            )}

            {/* NÚT ĐĂNG NHẬP chính */}
            <button
              type="submit"
              disabled={loadingSubmit}
              className="login-submit-btn"
              aria-busy={loadingSubmit}
            >
              {loadingSubmit && (
                <span className="login-spinner" aria-hidden="true" />
              )}
              <span className="login-submit-text">
                {loadingSubmit
                  ? t('login.submitting')
                  : isLogin
                    ? t('login.submitLogin')
                    : t('login.submitRegister')}
              </span>
            </button>
          </form>

          {/* KHU VỰC OAUTH GOOGLE — giữ nguyên logic, chỉ redesign nút */}
          <div className="mt-6 space-y-4">
            <div className="login-divider">
              <span className="login-divider-text">{t('login.or')}</span>
            </div>

            <button
              type="button"
              onClick={handleGoogleAuth}
              disabled={loadingSubmit}
              className="login-google-btn"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#EA4335" d="M12 5.04c1.65 0 3.13.57 4.3 1.69l3.22-3.22C17.56 1.61 14.99 1 12 1 7.24 1 3.21 3.74 1.29 7.71l3.77 2.92C5.97 7.04 8.74 5.04 12 5.04z" />
                <path fill="#4285F4" d="M23.45 12.27c0-.82-.07-1.61-.21-2.38H12v4.51h6.42c-.28 1.48-1.12 2.73-2.38 3.58l3.7 2.87c2.16-1.99 3.41-4.92 3.41-8.58z" />
                <path fill="#FBBC05" d="M5.06 14.21c-.24-.71-.37-1.47-.37-2.26s.13-1.55.37-2.26L1.29 6.77C.47 8.41 0 10.21 0 12s.47 3.59 1.29 5.23l3.77-3.02z" />
                <path fill="#34A853" d="M12 23c3.24 0 5.97-1.07 7.96-2.92l-3.7-2.87c-1.03.69-2.35 1.1-4.26 1.1-3.26 0-6.03-2-7.02-4.92l-3.77 2.92C3.21 20.26 7.24 23 12 23z" />
              </svg>
              {t('login.google')}
            </button>
          </div>

          {/* CHUYỂN ĐỔI TAB / ĐĂNG KÝ */}
          <div className="login-footer-links">
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
                setMessage(null);
              }}
              className="login-link-accent"
            >
              {isLogin ? t('login.toRegister') : t('login.toLogin')}
            </button>
            <button
              type="button"
              onClick={() => setStaffDialogOpen(true)}
              className="login-link-muted"
            >
              {t('login.staffLogin')}
            </button>
          </div>

          {/* Đổi ngôn ngữ ngay trên trang đăng nhập — dùng chung state toàn cục,
              nội dung form dịch lại tức thì, không cần tải lại trang. */}
          <div className="mt-5 flex justify-center">
            <LanguageSwitcher />
          </div>

          <p className="login-copyright">© Belwee Pet Clinic</p>
        </div>
      </div>

      {/* CSS nhúng: nền vũ trụ + đèn bàn + thẻ kính — tất cả dùng var(--light-on) */}
      <style dangerouslySetInnerHTML={{ __html: `
        .login-page { --login-accent: #2563eb; }

        /* ============ NỀN VŨ TRỤ ============ */
        .login-space-bg {
          position: absolute; inset: 0; pointer-events: none; z-index: 0;
        }
        .space-glow {
          position: absolute; border-radius: 50%; pointer-events: none;
        }
        .space-glow-center {
          width: 700px; height: 700px; top: 50%; left: 65%;
          transform: translate(-50%, -50%);
          background: radial-gradient(circle, rgba(37,99,235,0.14) 0%, transparent 65%);
          filter: blur(40px);
        }
        .space-glow-left {
          width: 500px; height: 500px; top: 20%; left: -10%;
          background: radial-gradient(circle, rgba(47,107,255,0.08) 0%, transparent 70%);
          filter: blur(50px);
        }
        .space-glow-right {
          width: 400px; height: 400px; bottom: -5%; right: -5%;
          background: radial-gradient(circle, rgba(96,165,250,0.07) 0%, transparent 70%);
          filter: blur(50px);
        }

        /* ============ ĐÈN BÀN KÍNH LỎNG ============
           Đèn được dựng lại bằng kiến trúc "Liquid Glass" (mục 27 trong
           globals.css): chao hình nón + filter url(#container-glass) +
           quầng neon xanh. Không còn dùng khối CSS tối giản cũ. */

        /* ============ SAO + HÀNH TINH ============ */
        .planet { position: absolute; border-radius: 50%; }
        .planet-main {
          top: 14%; right: 6%; width: 56px; height: 56px;
          background: radial-gradient(circle at 32% 30%, #93c5fd, #3b82f6 45%, #1e3a8a 100%);
          box-shadow: 0 0 34px rgba(59,130,246,0.45), inset -8px -8px 18px rgba(0,0,0,0.35);
          animation: planetFloat 9s ease-in-out infinite;
        }
        .planet-small {
          top: 60%; right: 14%; width: 26px; height: 26px;
          background: radial-gradient(circle at 35% 32%, #cbd5e1, #64748b 70%, #334155 100%);
          box-shadow: 0 0 16px rgba(148,163,184,0.35);
          animation: planetFloat 12s ease-in-out infinite reverse;
        }
        .star {
          position: absolute; width: 4px; height: 4px; border-radius: 50%;
          background: #cbd5e1; opacity: 0.55;
          animation: starTwinkle 4s ease-in-out infinite;
        }
        .star-1 { top: 24%; right: 22%; }
        .star-2 { top: 44%; right: 9%;  width: 3px; height: 3px; animation-delay: 1.2s; }
        .star-3 { top: 70%; right: 28%; animation-delay: 2.1s; }
        .star-4 { top: 34%; left: 22%;  width: 3px; height: 3px; animation-delay: 3s; }
        @keyframes planetFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-14px); }
        }
        @keyframes starTwinkle {
          0%, 100% { opacity: 0.25; transform: scale(1); }
          50% { opacity: 0.9; transform: scale(1.35); }
        }

        /* ============ THẺ GLASS LOGIN ============ */
        .login-glass-card {
          position: relative;
          background: linear-gradient(155deg, rgba(92,114,133,0.18) 0%, rgba(20,32,58,0.55) 100%);
          -webkit-backdrop-filter: blur(22px);
          backdrop-filter: blur(22px);
          border: 1px solid rgba(255,255,255,0.12);
          border-top: 1px solid rgba(255,255,255,0.22);
          box-shadow:
            0 24px 60px -12px rgba(0,0,0,0.65),
            0 0 0 1px rgba(47,107,255,0.06),
            inset 0 1px 0 rgba(255,255,255,0.08);
          animation: loginCardIn 0.7s cubic-bezier(0.16,1,0.3,1) both;
        }
        @keyframes loginCardIn {
          from { opacity: 0; transform: translateY(24px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        .login-logo-wrap {
          width: 64px; height: 64px; border-radius: 18px;
          display: flex; align-items: center; justify-content: center;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          box-shadow: 0 0 24px rgba(37,99,235,0.18), inset 0 1px 0 rgba(255,255,255,0.1);
        }
        .login-logo-img { width: 44px; height: 44px; object-fit: contain; }

        .login-title {
          color: #f1f5f9; font-size: 21px; font-weight: 800;
          letter-spacing: 0.08em; text-transform: uppercase;
          text-shadow: 0 2px 12px rgba(0,0,0,0.4);
        }
        .login-title-line {
          width: 56px; height: 3px; margin: 12px auto 10px; border-radius: 9999px;
          background: linear-gradient(90deg, #2563eb, #60a5fa);
          box-shadow: 0 0 12px rgba(37,99,235,0.6);
        }
        .login-subtitle {
          font-size: 11.5px; color: rgba(255,255,255,0.68); letter-spacing: 0.02em;
        }

        /* ============ FORM ============ */
        .login-form { display: flex; flex-direction: column; gap: 18px; margin-top: 8px; }
        .login-field { display: flex; flex-direction: column; gap: 8px; }
        .login-label {
          font-size: 10.5px; font-weight: 700; color: #8fa3bf;
          letter-spacing: 0.14em; text-transform: uppercase;
        }
        .login-input {
          width: 100%; min-height: 52px;
          background: rgba(2,8,20,0.5);
          border: 1px solid rgba(148,163,184,0.18);
          border-radius: 14px;
          padding: 0 20px;
          color: #f1f5f9; font-size: 14px;
          transition: border-color 0.25s ease, box-shadow 0.25s ease, background 0.25s ease;
        }
        .login-input::placeholder { color: rgba(203,213,225,0.45); }
        .login-input:focus {
          outline: none;
          border-color: #3b82f6;
          background: rgba(2,8,20,0.65);
          box-shadow: 0 0 0 3px rgba(37,99,235,0.18), 0 0 18px rgba(37,99,235,0.25);
        }
        .login-otp-btn {
          position: absolute; right: 8px; top: 8px; bottom: 8px;
          padding: 0 14px; border-radius: 10px; border: none;
          background: rgba(37,99,235,0.22); color: #93c5fd;
          font-size: 11px; font-weight: 700; letter-spacing: 0.06em;
          transition: background 0.25s ease, color 0.25s ease;
        }
        .login-otp-btn:hover:not(:disabled) { background: #2563eb; color: #fff; }
        .login-otp-btn:disabled { opacity: 0.55; cursor: not-allowed; }
        .login-otp-cell { text-align: center; font-size: 20px; font-weight: 800; padding: 0; }

        .login-eye-btn {
          position: absolute; right: 16px; top: 50%; transform: translateY(-50%);
          color: #8fa3bf; transition: color 0.2s ease; line-height: 0;
        }
        .login-eye-btn:hover { color: #f1f5f9; }

        .login-link-muted {
          font-size: 11px; color: #93c5fd; transition: color 0.2s ease;
        }
        .login-link-muted:hover { color: #bfdbfe; text-decoration: underline; }

        .login-message {
          padding: 13px 16px; border-radius: 12px; font-size: 13px; font-weight: 600;
          text-align: center; border: 1px solid;
        }
        .login-message.is-error {
          background: rgba(239,68,68,0.10); border-color: rgba(239,68,68,0.25); color: #fca5a5;
        }
        .login-message.is-ok {
          background: rgba(34,197,94,0.10); border-color: rgba(34,197,94,0.25); color: #86efac;
        }

        /* ============ NÚT ĐĂNG NHẬP ============ */
        .login-submit-btn {
          width: 100%; min-height: 50px; margin-top: 4px;
          display: flex; align-items: center; justify-content: center; gap: 10px;
          border: none; border-radius: 12px; cursor: pointer;
          background: linear-gradient(135deg, #2563eb 0%, #2f6bff 55%, #4f46e5 100%);
          color: #ffffff; font-size: 13.5px; font-weight: 800;
          letter-spacing: 0.16em; text-transform: uppercase;
          box-shadow: 0 10px 28px -8px rgba(37,99,235,0.55), inset 0 1px 0 rgba(255,255,255,0.2);
          transition: transform 0.2s ease, box-shadow 0.25s ease, filter 0.2s ease;
        }
        .login-submit-btn:hover:not(:disabled) {
          transform: translateY(-2px); filter: brightness(1.1);
          box-shadow: 0 16px 36px -8px rgba(37,99,235,0.7), inset 0 1px 0 rgba(255,255,255,0.2);
        }
        .login-submit-btn:active:not(:disabled) { transform: scale(0.98); }
        .login-submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .login-submit-btn:focus-visible { outline: 2px solid #93c5fd; outline-offset: 3px; }

        .login-spinner {
          width: 16px; height: 16px; border-radius: 50%;
          border: 2px solid rgba(255,255,255,0.3); border-top-color: #ffffff;
          animation: loginSpin 0.7s linear infinite;
        }
        @keyframes loginSpin { to { transform: rotate(360deg); } }

        /* ============ DIVIDER + GOOGLE + FOOTER ============ */
        .login-divider { display: flex; align-items: center; gap: 14px; }
        .login-divider::before, .login-divider::after {
          content: ''; flex: 1; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent);
        }
        .login-divider-text {
          font-size: 10px; color: #64748b; letter-spacing: 0.2em; text-transform: uppercase; font-weight: 600;
        }
        .login-google-btn {
          width: 100%; min-height: 48px;
          display: flex; align-items: center; justify-content: center; gap: 12px;
          border-radius: 12px; cursor: pointer;
          background: rgba(255,255,255,0.04);
          border: 1px dashed rgba(148,163,184,0.3);
          color: #cbd5e1; font-size: 12px; font-weight: 700; letter-spacing: 0.1em;
          transition: background 0.25s ease, border-color 0.25s ease, color 0.25s ease;
        }
        .login-google-btn:hover:not(:disabled) {
          background: rgba(255,255,255,0.08); border-color: rgba(148,163,184,0.5); color: #f1f5f9;
        }
        .login-google-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .login-footer-links {
          margin-top: 22px; padding-top: 18px;
          border-top: 1px solid rgba(255,255,255,0.06);
          display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center;
        }
        .login-link-accent {
          font-size: 11px; font-weight: 800; color: #60a5fa;
          letter-spacing: 0.1em; text-transform: uppercase;
          transition: color 0.2s ease;
        }
        .login-link-accent:hover { color: #93c5fd; text-decoration: underline; }
        .login-copyright {
          margin-top: 18px; text-align: center;
          font-size: 10px; color: rgba(148,163,184,0.4); letter-spacing: 0.1em;
        }

        /* ============ MODAL XÁC NHẬN NHÂN VIÊN ============ */
        .staff-modal-backdrop {
          position: fixed; inset: 0; z-index: 9999;
          display: flex; align-items: center; justify-content: center;
          padding: 20px;
          background: rgba(2,6,23,0.72);
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
          animation: staffBackdropIn 0.25s ease both;
        }
        .staff-modal-card {
          width: 100%; max-width: 400px;
          background: linear-gradient(160deg, rgba(23,34,58,0.97), rgba(11,18,32,0.97));
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 22px;
          padding: 26px 24px;
          box-shadow: 0 30px 80px -20px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.08);
          animation: staffCardIn 0.32s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .staff-modal-badge {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 5px 12px; border-radius: 999px;
          background: rgba(251,191,36,0.12); border: 1px solid rgba(251,191,36,0.35);
          color: #fbbf24; font-size: 10px; font-weight: 800;
          letter-spacing: 0.14em; text-transform: uppercase;
        }
        .staff-modal-title {
          margin-top: 14px; font-size: 15px; font-weight: 700; color: #f1f5f9; line-height: 1.45;
        }
        .staff-modal-text {
          margin-top: 8px; font-size: 13px; color: rgba(203,213,225,0.85); line-height: 1.6;
        }
        .staff-modal-actions {
          margin-top: 20px; display: flex; flex-direction: column; gap: 10px;
        }
        .staff-modal-btn-primary {
          min-height: 46px; border-radius: 14px;
          border: 1px solid rgba(255,255,255,0.14); background: rgba(255,255,255,0.05);
          color: #e2e8f0; font-size: 13px; font-weight: 700;
          transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease;
        }
        .staff-modal-btn-primary:hover {
          background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.25); color: #ffffff;
        }
        .staff-modal-btn-secondary {
          min-height: 46px; border-radius: 14px;
          border: 1px solid transparent;
          background: linear-gradient(135deg, #2563eb, #3b82f6);
          color: #ffffff; font-size: 13px; font-weight: 700;
          box-shadow: 0 10px 26px -8px rgba(37,99,235,0.55);
          transition: filter 0.2s ease, transform 0.2s ease;
        }
        .staff-modal-btn-secondary:hover { filter: brightness(1.1); }
        .staff-modal-btn-secondary:active { transform: scale(0.98); }
        @keyframes staffBackdropIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes staffCardIn {
          from { opacity: 0; transform: translateY(14px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .staff-modal-backdrop, .staff-modal-card { animation: none; }
        }

        /* ============ RESPONSIVE ============ */
        @media (max-width: 1023px) {
          .lamp-rig, .planet-main, .planet-small { display: none; }
          .star-1, .star-2, .star-3, .star-4 { opacity: 0.3; }
          .login-card-shell { justify-content: center; padding-right: 0 !important; }
        }
        @media (max-width: 767px) {
          .login-space-bg .space-glow { filter: blur(60px); opacity: 0.6; }
          .login-glass-card { padding: 26px 22px; }
          .login-input { min-height: 48px; padding: 0 16px; }
          .login-title { font-size: 18px; }
          .login-submit-btn { min-height: 48px; }
        }
        @media (max-height: 700px) {
          .login-glass-card { padding-top: 24px; padding-bottom: 24px; }
        }

        /* ============ REDUCED MOTION (inert — see lib/motion.ts) ============
           Query renamed to a non-existent media feature so it can never match;
           these fallbacks are intentionally dead. Restore by renaming back to
           prefers-reduced-motion: reduce and flipping FORCE_MOTION.
           NOTE: no backticks in this comment — it lives inside a template
           literal, and one would terminate the string. */
        @media (prefers-reduced-motion: reduce) {
          .login-glass-card { animation: none; }
          .planet-main, .planet-small, .star { animation: none; }
          .login-submit-btn, .login-otp-btn { transition: none; }
        }
      `}} />
    </div>
  );
}
