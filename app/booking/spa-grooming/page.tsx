"use client";
import React, { useState } from 'react';
import { useTransitionNavigate } from '@/hooks/useTransitionNavigate';
import BookingSuccessModal from '@/components/BookingSuccessModal';

export default function SpaBooking() {
  const navigate = useTransitionNavigate();
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const [formData, setFormData] = useState({ fullName: '', phone: '', petName: '', petType: 'Chó', date: '', time: '', notes: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setIsSuccess(false);
    try {
      const response = await fetch('/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.fullName,
          phone: formData.phone,
          petName: formData.petName,
          petType: formData.petType,
          date: formData.date,
          bookingTime: formData.time,
          notes: formData.notes,
          service: 'Spa - Grooming',
        }),
      });
      if (response.ok) {
        setIsSuccess(true);
        setFormData({ fullName: '', phone: '', petName: '', petType: 'Chó', date: '', time: '', notes: '' });
      } else {
        let errorMsg = 'Có lỗi xảy ra khi gửi thông tin!';
        try {
          const errData = await response.json();
          errorMsg = errData.message || errData.error || errorMsg;
        } catch {}
        alert(errorMsg);
      }
    } catch {
      alert('Lỗi kết nối mạng!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen text-slate-100 font-sans antialiased pb-20 bg-cover bg-center bg-no-repeat bg-fixed" style={{ backgroundImage: "url('/anhchuyengia.webp')" }}>
      <style dangerouslySetInnerHTML={{__html: `
        .liquid-glass-nav { background: rgba(15, 23, 42, 0.5); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px); border: 1px solid rgba(255, 255, 255, 0.08); box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.5), inset 0 1px 0px rgba(255, 255, 255, 0.1); }
        .liquid-glass-card { background: rgba(15, 23, 42, 0.45); backdrop-filter: blur(30px); -webkit-backdrop-filter: blur(30px); border: 1px solid rgba(255, 255, 255, 0.08); border-top: 1px solid rgba(255, 255, 255, 0.15); border-left: 1px solid rgba(255, 255, 255, 0.1); box-shadow: 0 30px 60px -15px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.05); }
        @keyframes shineSweep { 0% { transform: translateX(-150%) skewX(-45deg); opacity: 0; } 50% { opacity: 1; } 100% { transform: translateX(200%) skewX(-45deg); opacity: 0; } }
        .group:hover .glass-shine { animation: shineSweep 1.2s cubic-bezier(0.4, 0, 0.2, 1) forwards; }
        .backdrop-menu { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.6); backdrop-filter: blur(15px); z-index: 40; }
      `}} />

      <div className="absolute inset-0 bg-slate-950/40 pointer-events-none z-0"></div>

      <main className="relative z-10 max-w-3xl mx-auto px-4 pt-32 md:pt-40">
        <div className="mb-6">
          <button type="button" onClick={() => navigate('/dich-vu')} className="text-sm font-semibold text-slate-300 hover:text-white flex items-center gap-2 bg-white/5 backdrop-blur-md px-5 py-2.5 rounded-full border border-white/10 transition-all hover:bg-white/10 active:scale-95 shadow-lg">
            ⬅ Quay lại
          </button>
        </div>
        
        <div data-reveal="fade-up" className="text-center mb-10">
          <h1 className="text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-100 via-rose-200 to-pink-400 tracking-tight uppercase drop-shadow-lg">
            Dịch Vụ Spa - Grooming
          </h1>
          <div className="w-24 h-1.5 bg-gradient-to-r from-pink-500 to-rose-400 mx-auto mt-4 rounded-full shadow-[0_0_15px_rgba(244,114,182,0.6)]"></div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6" data-reveal-group>
          <div className="relative group overflow-hidden liquid-glass-card rounded-[2.5rem] p-6 md:p-8 transition-transform duration-500 hover:scale-[1.01]">
            <div className="absolute top-0 bottom-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/10 to-transparent glass-shine pointer-events-none -translate-x-full" />
            <h2 className="text-lg font-black text-white border-l-4 border-rose-400 pl-3 mb-6 flex items-center gap-2">👤 1. Thông Tin Khách Hàng</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase">Tên chủ nuôi *</label>
                <input type="text" required placeholder="Nhập tên..." className="w-full bg-slate-950/40 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white focus:border-rose-400 outline-none transition" value={formData.fullName} onChange={(e) => setFormData({...formData, fullName: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase">Số điện thoại *</label>
                <input type="tel" required placeholder="Nhập SĐT..." className="w-full bg-slate-950/40 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white focus:border-rose-400 outline-none transition" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} />
              </div>
            </div>
          </div>

          <div className="relative group overflow-hidden liquid-glass-card rounded-[2.5rem] p-6 md:p-8 transition-transform duration-500 hover:scale-[1.01]">
            <div className="absolute top-0 bottom-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/10 to-transparent glass-shine pointer-events-none -translate-x-full" />
            <h2 className="text-lg font-black text-white border-l-4 border-rose-400 pl-3 mb-6 flex items-center gap-2">✂️ 2. Thông Tin Thú Cưng</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase">Loài thú cưng *</label>
                <select className="w-full bg-slate-950/40 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white focus:border-rose-400 outline-none" value={formData.petType} onChange={(e) => setFormData({...formData, petType: e.target.value})}>
                  <option value="Chó" className="bg-slate-900">🐶 Chó</option>
                  <option value="Mèo" className="bg-slate-900">🐱 Mèo</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase">Tên thú cưng *</label>
                <input type="text" required placeholder="Tên bé..." className="w-full bg-slate-950/40 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white focus:border-rose-400 outline-none" value={formData.petName} onChange={(e) => setFormData({...formData, petName: e.target.value})} />
              </div>
            </div>
          </div>

          <div className="relative group overflow-hidden liquid-glass-card rounded-[2.5rem] p-6 md:p-8 transition-transform duration-500 hover:scale-[1.01]">
            <div className="absolute top-0 bottom-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/10 to-transparent glass-shine pointer-events-none -translate-x-full" />
            <h2 className="text-lg font-black text-white border-l-4 border-rose-400 pl-3 mb-6 flex items-center gap-2">🛀 3. Lịch Hẹn & Yêu Cầu Spa</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase">Ngày làm Spa *</label>
                <input type="date" required className="w-full bg-slate-950/40 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white focus:border-rose-400 [color-scheme:dark] outline-none" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase">Giờ tới *</label>
                <input type="time" required className="w-full bg-slate-950/40 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white focus:border-rose-400 outline-none" value={formData.time} onChange={(e) => setFormData({...formData, time: e.target.value})} />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase">Ghi chú cắt tỉa, kiểu lông mong muốn</label>
              <textarea rows={3} placeholder="Ví dụ: Cắt tròn mặt, cạo bàn, tắm thơm..." className="w-full bg-slate-950/40 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white focus:border-rose-400 resize-none outline-none" value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} />
            </div>
          </div>

          <div className="pt-4 pb-10">
            <button type="submit" disabled={loading} className="w-full relative overflow-hidden bg-gradient-to-r from-rose-500 via-pink-600 to-rose-600 hover:from-rose-400 hover:to-pink-500 text-white font-black text-lg py-4.5 rounded-2xl shadow-[0_12px_40px_rgba(225,29,72,0.4)] transition-all duration-300 active:scale-[0.98] disabled:opacity-70 group/btn">
              <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full group-hover/btn:animate-[shineSweep_1s_ease-in-out_forwards]" />
              {loading ? "⌛ ĐANG XỬ LÝ..." : "🌸 ĐẶT LỊCH SPA NGAY"}
            </button>
          </div>
        </form>
      </main>
      <BookingSuccessModal open={isSuccess} message="Đặt lịch Spa thành công!" />
    </div>
  );
}
