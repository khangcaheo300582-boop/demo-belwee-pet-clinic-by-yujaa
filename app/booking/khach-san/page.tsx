"use client";
import React, { useState } from 'react';
import { useTransitionNavigate } from '@/hooks/useTransitionNavigate';
import BookingSuccessModal from '@/components/BookingSuccessModal';

export default function HotelBooking() {
  const navigate = useTransitionNavigate();
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  
  const [formData, setFormData] = useState({
    customerName: "", phoneNumber: "", petType: "Chó", petName: "",
    petAgeYears: "", petAgeMonths: "", petWeight: "", hotelDays: "",
    foodNote: "", bookingDate: "", bookingTime: "8:00", additionalNote: ""
  });

  const timeSlots = [];
  for (let hour = 8; hour <= 20; hour++) {
    timeSlots.push(`${hour}:00`);
    if (hour !== 20) timeSlots.push(`${hour}:30`);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setIsSuccess(false);
    try {
      const response = await fetch('/api/booking', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, petAge: `${formData.petAgeYears} năm ${formData.petAgeMonths} tháng`, service: "Đặt Phòng Khách Sạn Thú Cưng" }),
      });
      if (response.ok) {
        setIsSuccess(true);
        setFormData({ customerName: "", phoneNumber: "", petType: "Chó", petName: "", petAgeYears: "", petAgeMonths: "", petWeight: "", hotelDays: "", foodNote: "", bookingDate: "", bookingTime: "8:00", additionalNote: "" });
      } else {
        let errorMsg = "Có lỗi xảy ra khi gửi thông tin!";
        try {
          const errData = await response.json();
          errorMsg = errData.message || errData.error || errorMsg;
        } catch (e) { console.debug('Failed to parse error response', e); }
        alert(errorMsg);
      }
    } catch { 
      alert("Lỗi kết nối mạng!");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen text-slate-100 font-sans antialiased pb-20 bg-cover bg-center bg-no-repeat bg-fixed" style={{ backgroundImage: "url('/anhnentcdichvu.webp')" }}>
      <style dangerouslySetInnerHTML={{__html: `
        .liquid-glass-nav { background: rgba(15, 23, 42, 0.5); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px); border: 1px solid rgba(255, 255, 255, 0.08); box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.5), inset 0 1px 0px rgba(255, 255, 255, 0.1); }
        .liquid-glass-card { background: rgba(15, 23, 42, 0.45); backdrop-filter: blur(30px); -webkit-backdrop-filter: blur(30px); border: 1px solid rgba(255, 255, 255, 0.08); border-top: 1px solid rgba(255, 255, 255, 0.15); border-left: 1px solid rgba(255, 255, 255, 0.1); box-shadow: 0 30px 60px -15px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.05); }
        @keyframes shineSweep { 0% { transform: translateX(-150%) skewX(-45deg); opacity: 0; } 50% { opacity: 1; } 100% { transform: translateX(200%) skewX(-45deg); opacity: 0; } }
        .group:hover .glass-shine { animation: shineSweep 1.2s cubic-bezier(0.4, 0, 0.2, 1) forwards; }
        .backdrop-menu { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.6); backdrop-filter: blur(15px); z-index: 40; }
      `}} />

      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-[4px] pointer-events-none z-0"></div>

      <main className="relative z-10 max-w-3xl mx-auto px-4 pt-32 md:pt-40">
        <div className="mb-6">
          <button type="button" onClick={() => navigate('/dich-vu')} className="text-sm font-semibold text-slate-300 hover:text-white flex items-center gap-2 bg-white/5 backdrop-blur-md px-5 py-2.5 rounded-full border border-white/10 transition-all hover:bg-white/10 active:scale-95 shadow-lg">
            ⬅ Quay lại
          </button>
        </div>
        
        <div data-reveal="fade-up" className="text-center mb-10">
          <h1 className="text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-100 via-amber-200 to-yellow-400 tracking-tight uppercase drop-shadow-lg">
            Khách Sạn Thú Cưng
          </h1>
          <div className="w-24 h-1.5 bg-gradient-to-r from-amber-500 to-yellow-300 mx-auto mt-4 rounded-full shadow-[0_0_15px_rgba(252,211,77,0.6)]"></div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6" data-reveal-group>
          <div className="relative group overflow-hidden liquid-glass-card rounded-[2.5rem] p-6 md:p-8 transition-transform duration-500 hover:scale-[1.01]">
            <div className="absolute top-0 bottom-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/10 to-transparent glass-shine pointer-events-none -translate-x-full" />
            <h2 className="text-lg font-black text-white border-l-4 border-yellow-400 pl-3 mb-6 flex items-center gap-2">👤 1. Thông Tin Khách Hàng</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase">Tên khách hàng *</label>
                <input type="text" required placeholder="Nhập tên..." className="w-full bg-slate-950/40 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white focus:border-yellow-400 outline-none" value={formData.customerName} onChange={(e) => setFormData({...formData, customerName: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase">Số điện thoại *</label>
                <input type="tel" required placeholder="Nhập SĐT..." className="w-full bg-slate-950/40 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white focus:border-yellow-400 outline-none" value={formData.phoneNumber} onChange={(e) => setFormData({...formData, phoneNumber: e.target.value})} />
              </div>
            </div>
          </div>

          <div className="relative group overflow-hidden liquid-glass-card rounded-[2.5rem] p-6 md:p-8 transition-transform duration-500 hover:scale-[1.01]">
            <div className="absolute top-0 bottom-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/10 to-transparent glass-shine pointer-events-none -translate-x-full" />
            <h2 className="text-lg font-black text-white border-l-4 border-yellow-400 pl-3 mb-6 flex items-center gap-2">🐾 2. Thông Tin Thú Cưng</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase">Loài thú cưng</label>
                <select className="w-full bg-slate-950/40 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white focus:border-yellow-400 outline-none" value={formData.petType} onChange={(e) => setFormData({...formData, petType: e.target.value})}>
                  <option value="Chó" className="bg-slate-900">Chó</option>
                  <option value="Mèo" className="bg-slate-900">Mèo</option>
                  <option value="Khác" className="bg-slate-900">Khác</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase">Tên thú cưng</label>
                <input type="text" required placeholder="Nhập tên..." className="w-full bg-slate-950/40 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white focus:border-yellow-400 outline-none" value={formData.petName} onChange={(e) => setFormData({...formData, petName: e.target.value})} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase">Độ tuổi</label>
                <div className="flex gap-1 items-center">
                  <input type="number" placeholder="Năm" min="0" required className="w-full bg-slate-950/40 border border-white/10 rounded-xl p-2.5 text-sm text-center text-white focus:border-yellow-400 outline-none" value={formData.petAgeYears} onChange={(e) => setFormData({...formData, petAgeYears: e.target.value})} />
                  <span className="text-[10px] text-slate-400">Năm</span>
                  <input type="number" placeholder="Thg" min="0" max="11" required className="w-full bg-slate-950/40 border border-white/10 rounded-xl p-2.5 text-sm text-center text-white focus:border-yellow-400 outline-none" value={formData.petAgeMonths} onChange={(e) => setFormData({...formData, petAgeMonths: e.target.value})} />
                  <span className="text-[10px] text-slate-400">Thg</span>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase">Cân nặng (kg)</label>
                <input type="text" required placeholder="Ví dụ: 5.5" className="w-full bg-slate-950/40 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white focus:border-yellow-400 outline-none" value={formData.petWeight} onChange={(e) => setFormData({...formData, petWeight: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase">Số ngày gửi</label>
                <input type="number" required placeholder="Ví dụ: 3" min="1" className="w-full bg-slate-950/40 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white focus:border-yellow-400 outline-none" value={formData.hotelDays} onChange={(e) => setFormData({...formData, hotelDays: e.target.value})} />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase">Ghi chú thức ăn riêng (nếu có)</label>
              <input type="text" placeholder="Chế độ ăn riêng của bé..." className="w-full bg-slate-950/40 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white focus:border-yellow-400 outline-none" value={formData.foodNote} onChange={(e) => setFormData({...formData, foodNote: e.target.value})} />
            </div>
          </div>

          <div className="relative group overflow-hidden liquid-glass-card rounded-[2.5rem] p-6 md:p-8 transition-transform duration-500 hover:scale-[1.01]">
            <div className="absolute top-0 bottom-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/10 to-transparent glass-shine pointer-events-none -translate-x-full" />
            <h2 className="text-lg font-black text-white border-l-4 border-yellow-400 pl-3 mb-6 flex items-center gap-2">📅 3. Chọn Thời Gian Đến</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase">Ngày nhận bé *</label>
                <input type="date" required className="w-full bg-slate-950/40 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white focus:border-yellow-400 [color-scheme:dark] outline-none" value={formData.bookingDate} onChange={(e) => setFormData({...formData, bookingDate: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase">Giờ đến gửi *</label>
                <select className="w-full bg-slate-950/40 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white focus:border-yellow-400 outline-none" value={formData.bookingTime} onChange={(e) => setFormData({...formData, bookingTime: e.target.value})}>
                  {timeSlots.map((time) => (<option key={time} value={time} className="bg-slate-900">{time}</option>))}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase">Yêu cầu thêm khác</label>
              <input type="text" placeholder="Yêu cầu đặc biệt khác..." className="w-full bg-slate-950/40 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white focus:border-yellow-400 outline-none" value={formData.additionalNote} onChange={(e) => setFormData({...formData, additionalNote: e.target.value})} />
            </div>
          </div>

          <div className="pt-4 pb-10">
            <button type="submit" disabled={loading} className="w-full relative overflow-hidden bg-gradient-to-r from-yellow-600 via-amber-500 to-yellow-600 hover:from-yellow-500 hover:to-amber-400 text-white font-black text-lg py-4.5 rounded-2xl shadow-[0_12px_40px_rgba(245,158,11,0.4)] transition-all duration-300 active:scale-[0.98] disabled:opacity-70 group/btn">
              <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full group-hover/btn:animate-[shineSweep_1s_ease-in-out_forwards]" />
              {loading ? "⌛ ĐANG XỬ LÝ..." : "🏰 ĐẶT PHÒNG KHÁCH SẠN NGAY"}
            </button>
          </div>
        </form>
      </main>
      <BookingSuccessModal open={isSuccess} message="Đặt phòng thành công!" />
    </div>
  );
}
