"use client";

import React, { useEffect, useState } from 'react';
import { useTransitionNavigate } from '@/hooks/useTransitionNavigate';
import { BOOKING_BRANCHES, DEFAULT_BRANCH_ID } from '@/lib/clinics';
import GlassToast from '@/components/GlassToast';
import { validateEmail, validatePhone, validateRequired } from '@/lib/validators';

interface PageProps {
  params?: { service?: string };
}

const SERVICE_MAP: Record<string, string> = {
  'kham-benh': 'Khám & Chữa Bệnh',
  'spa-grooming': 'Spa - Grooming',
  'khach-san': 'Khách Sạn Thú Cưng',
  'tiem-ngua': 'Tiêm Chủng Định Kỳ',
};

const DRAFT_KEY = 'belwee-booking-draft-chitiet';

interface FormState {
  petName: string;
  petType: string;
  ownerName: string;
  email: string;
  phone: string;
  bookingDate: string;
  note: string;
  branchId: string;
}

const EMPTY_FORM: FormState = {
  petName: '',
  petType: 'dog',
  ownerName: '',
  email: '',
  phone: '',
  bookingDate: '',
  note: '',
  branchId: DEFAULT_BRANCH_ID,
};

/** Đọc nháp từ localStorage — an toàn cả SSR lẫn JSON lỗi. */
function loadDraft(): FormState {
  if (typeof window === 'undefined') return EMPTY_FORM;
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return EMPTY_FORM;
    const parsed = JSON.parse(raw) as Partial<FormState>;
    return { ...EMPTY_FORM, ...parsed } as FormState;
  } catch {
    return EMPTY_FORM;
  }
}

// This page is a static route (not [service]), so params.service will be undefined.
// Default to generic service name; service-specific pages exist under /booking/.
export default function ChiTietBookingForm({ params }: PageProps) {
  const navigate = useTransitionNavigate();
  const currentServiceSlug = params?.service || '';
  const serviceName = SERVICE_MAP[currentServiceSlug] || "Dịch Vụ Thú Cưng";

  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle');
  const [formData, setFormData] = useState<FormState>(EMPTY_FORM);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: 'error' | 'success' } | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);

  // Nạp nháp 1 lần sau mount (SSR-safe).
  useEffect(() => {
    const draft = loadDraft();
    if (draft.petName || draft.ownerName || draft.phone) {
      setFormData(draft);
      setDraftRestored(true);
    }
  }, []);

  // Lưu nháp mỗi lần form đổi — người dùng mất mạng / F5 không mất chữ đã gõ.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(formData));
    } catch { /* localStorage đầy / chặn — bỏ qua, form vẫn chạy bình thường */ }
  }, [formData]);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setFormData((prev) => ({ ...prev, [key]: value }));

  const clearDraft = () => {
    if (typeof window !== 'undefined') {
      try { window.localStorage.removeItem(DRAFT_KEY); } catch { /* bỏ qua */ }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === 'loading') return; // chống gửi trùng
    setErrorMsg(null);

    // Validate client-side bằng tiếng Việt — đúng field, không bắt người dùng
    // chờ server trả lỗi.
    const nameErr = validateRequired(formData.ownerName, 'Họ tên chủ nuôi');
    if (nameErr) { setErrorMsg(nameErr.message); return; }
    const phoneErr = validatePhone(formData.phone);
    if (phoneErr) { setErrorMsg(phoneErr.message); return; }
    const emailErr = validateEmail(formData.email);
    if (emailErr) { setErrorMsg(emailErr.message); return; }
    const petErr = validateRequired(formData.petName, 'Tên thú cưng');
    if (petErr) { setErrorMsg(petErr.message); return; }
    const dateErr = validateRequired(formData.bookingDate, 'Ngày giờ đến');
    if (dateErr) { setErrorMsg(dateErr.message); return; }

    const branch = BOOKING_BRANCHES.find((b) => b.id === formData.branchId) ?? BOOKING_BRANCHES[0];
    const addressName = `Belwee ${branch.id.toUpperCase()} — ${branch.addressKey}`;

    setStatus('loading');
    try {
      const response = await fetch('/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          serviceName: serviceName,
          addressName: addressName,
          // Idempotency: nếu mạng lag khiến request treo và người dùng bấm lại,
          // server nhận biết request lặp qua cờ này.
          clientRequestId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        }),
      });

      const data = await response.json().catch(() => null);
      if (response.ok && data?.success) {
        clearDraft();
        setStatus('success');
      } else if (response.status === 409 || data?.slotTaken) {
        // Khung giờ vừa bị người khác giữ trước — giữ form cho khách chọn lại.
        setErrorMsg(
          data?.message ||
            'Khung giờ này đã có người đặt. Vui lòng chọn thời gian khác hoặc gọi hotline để được hỗ trợ.'
        );
        setStatus('idle');
      } else {
        setErrorMsg(data?.message || 'Không thể gửi yêu cầu. Vui lòng thử lại.');
        setStatus('idle');
      }
    } catch {
      setErrorMsg('Mạng chập chờn — bản nháp của bạn vẫn được giữ lại. Vui lòng thử lại.');
      setStatus('idle');
    }
  };

  const glassCardClass = "rounded-[2rem] p-6 border border-white/[0.08] bg-white/[0.03] backdrop-blur-2xl shadow-xl mb-6 anim-fade-up";

  return (
    <div className="relative min-h-screen text-slate-100 font-sans antialiased pb-20 bg-cover bg-center bg-no-repeat bg-fixed" 
         style={{ backgroundImage: "url('/anhnentcdichvu.webp')" }}>
      
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-slate-950/80 to-slate-950/80 backdrop-blur-sm pointer-events-none z-0"></div>
      <div className="absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-[#f4f8ff] via-[#f4f8ff]/40 to-transparent pointer-events-none z-[1]" />

      <div className="relative z-10 max-w-2xl mx-auto px-4 pt-24">
        
        <button 
          type="button"
          onClick={() => navigate('/dich-vu')}
          className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-blue-400 transition-colors group anim-fade-in"
        >
          <span className="group-hover:-translate-x-1 transition-transform">←</span> Quay lại chọn dịch vụ
        </button>

        <form onSubmit={handleSubmit}>
          
          <div className={`${glassCardClass} anim-delay-1`}>
            <h2 className="text-blue-400 text-xs font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full shadow-[0_0_10px_#3b82f6]"></span>
              01. Thông tin thú cưng
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold text-slate-500 ml-2">Tên bé *</label>
                <input type="text" required value={formData.petName}
                  onChange={(e) => setField('petName', e.target.value)}
                  className="w-full bg-slate-900/40 border border-white/5 rounded-2xl px-4 py-3 text-sm focus:border-blue-500/50 outline-none transition"
                  placeholder="Ví dụ: Đậu Đậu" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold text-slate-500 ml-2">Loại thú cưng</label>
                <select value={formData.petType}
                  onChange={(e) => setField('petType', e.target.value)}
                  className="w-full bg-slate-900/40 border border-white/5 rounded-2xl px-4 py-3 text-sm outline-none transition text-white">
                  <option value="dog" className="bg-slate-950">Chó</option>
                  <option value="cat" className="bg-slate-950">Mèo</option>
                  <option value="other" className="bg-slate-950">Khác</option>
                </select>
              </div>
            </div>
          </div>

          <div className={`${glassCardClass} anim-delay-2`}>
            <h2 className="text-indigo-400 text-xs font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="w-2 h-2 bg-indigo-500 rounded-full shadow-[0_0_10px_#6366f1]"></span>
              02. Thông tin chủ nuôi
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold text-slate-500 ml-2">Họ tên chủ *</label>
                <input type="text" required autoComplete="name" value={formData.ownerName}
                  onChange={(e) => setField('ownerName', e.target.value)}
                  className="w-full bg-slate-900/40 border border-white/5 rounded-2xl px-4 py-3 text-base focus:border-indigo-500/50 outline-none transition"
                  placeholder="Nguyễn Văn A" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold text-slate-500 ml-2">Email liên hệ *</label>
                <input type="email" required inputMode="email" autoComplete="email" value={formData.email}
                  onChange={(e) => setField('email', e.target.value)}
                  className="w-full bg-slate-900/40 border border-white/5 rounded-2xl px-4 py-3 text-base focus:border-indigo-500/50 outline-none transition"
                  placeholder="email@example.com" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-[10px] uppercase font-bold text-slate-500 ml-2">Số điện thoại *</label>
                <input type="tel" required inputMode="tel" autoComplete="tel" value={formData.phone}
                  onChange={(e) => setField('phone', e.target.value)}
                  className="w-full bg-slate-900/40 border border-white/5 rounded-2xl px-4 py-3 text-base focus:border-indigo-500/50 outline-none transition"
                  placeholder="090xxxxxxx" />
              </div>
            </div>
          </div>

          <div className={`${glassCardClass} anim-delay-3`}>
            <h2 className="text-teal-400 text-xs font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="w-2 h-2 bg-teal-500 rounded-full shadow-[0_0_10px_#14b8a6]"></span>
              03. Chọn chi nhánh đặt lịch
            </h2>
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-slate-500 ml-2">Cơ sở gần bạn nhất *</label>
              <select value={formData.branchId}
                onChange={(e) => setField('branchId', e.target.value)}
                className="w-full bg-slate-900/40 border border-white/5 rounded-2xl px-4 py-3 text-sm outline-none transition text-white">
                {BOOKING_BRANCHES.map((b) => (
                  <option key={b.id} value={b.id} className="bg-slate-950">
                    Belwee {b.id.toUpperCase()} — {b.addressKey as string}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-slate-500 ml-2">🕗 {BOOKING_BRANCHES.find((b) => b.id === formData.branchId)?.hoursKey as string}</p>
            </div>
          </div>

          <div className={`${glassCardClass} anim-delay-4`}>
            <h2 className="text-purple-400 text-xs font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="w-2 h-2 bg-purple-500 rounded-full shadow-[0_0_10px_#a855f7]"></span>
              04. Thời gian & Ghi chú
            </h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold text-slate-500 ml-2">Ngày & Giờ đến *</label>
                <input type="datetime-local" required value={formData.bookingDate}
                  onChange={(e) => setField('bookingDate', e.target.value)}
                  className="w-full bg-slate-900/40 border border-white/5 rounded-2xl px-4 py-3 text-base focus:border-purple-500/50 outline-none transition" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold text-slate-500 ml-2">Ghi chú thêm</label>
                <textarea rows={3} value={formData.note}
                  onChange={(e) => setField('note', e.target.value)}
                  className="w-full bg-slate-900/40 border border-white/5 rounded-2xl px-4 py-3 text-base focus:border-purple-500/50 outline-none transition resize-none"
                  placeholder="Tình trạng sức khỏe bé hoặc các yêu cầu đặc biệt khác..." />
              </div>
            </div>
          </div>

          <div className="relative mt-12 flex flex-col items-center">
            {errorMsg && (
              <div
                role="alert"
                aria-live="assertive"
                className="w-full max-w-md mb-5 rounded-2xl border border-red-400/30 bg-red-500/10 px-5 py-4 text-sm font-semibold text-red-200 text-center"
              >
                {errorMsg}
              </div>
            )}

            {draftRestored && (
              <div className="w-full max-w-md mb-5 rounded-2xl border border-blue-400/25 bg-blue-500/10 px-5 py-3 text-xs font-medium text-blue-200 text-center">
                Đã khôi phục bản nháp bạn lưu trước đó.
              </div>
            )}

            {status === 'idle' && (
              <button
                type="submit"
                className="w-full max-w-md bg-gradient-to-r from-blue-600 to-indigo-600 py-4 rounded-2xl font-black uppercase tracking-tighter shadow-lg shadow-blue-900/20 hover:from-blue-500 hover:to-indigo-500 transition anim-fade-in"
              >
                Xác Nhận Đặt Lịch →
              </button>
            )}

            {status === 'loading' && (
              <button
                type="button"
                disabled
                aria-busy="true"
                className="w-full max-w-md bg-blue-600/40 py-4 rounded-2xl font-black uppercase tracking-tighter cursor-not-allowed flex items-center justify-center gap-3"
              >
                <span className="inline-block h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" aria-hidden="true" />
                Đang gửi...
              </button>
            )}

            {status === 'success' && (
              <div className="flex flex-col items-center w-full space-y-6">
                <div className="bg-white/10 border border-white/20 backdrop-blur-3xl px-10 py-4 flex items-center gap-3 shadow-2xl rounded-full anim-zoom-in">
                  <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-[0_0_15px_#22c55e]">✓</div>
                  <span className="text-white font-bold tracking-tight">Đặt Lịch Thành Công!</span>
                </div>

                <div className="flex flex-col md:flex-row gap-4 w-full max-w-md anim-fade-up anim-delay-2">
                  <button type="button" onClick={() => navigate('/dich-vu')} className="flex-1 bg-blue-600/80 hover:bg-blue-500 py-3 rounded-xl text-xs font-bold uppercase shadow-lg shadow-blue-900/40 transition">
                    Quay lại dịch vụ
                  </button>
                </div>
              </div>
            )}
          </div>

        </form>
      </div>

      <GlassToast
        open={toast !== null}
        message={toast?.message ?? ""}
        tone={toast?.tone ?? "error"}
        onClose={() => setToast(null)}
      />
    </div>
  );
}
