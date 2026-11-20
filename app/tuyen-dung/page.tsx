"use client";

import { useTransitionNavigate } from '@/hooks/useTransitionNavigate';

export default function TuyenDungPage() {
  const navigate = useTransitionNavigate();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased relative overflow-x-hidden selection:bg-blue-500 selection:text-white">
      
      {/* VIDEO NỀN ĐỘNG HỢP NHẤT KHÔNG GIAN */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden select-none">
        <video
          autoPlay
          loop
          muted
          playsInline
          preload="none"
          className="w-full h-full object-cover opacity-40 scale-105 filter blur-[3px] brightness-90"
        >
          <source src="/7960654768910.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/20 via-slate-950/70 to-slate-950"></div>
      </div>

      {/* HỆ THỐNG STYLE CHUYÊN SÂU: LIQUID GLASS & LENS EFFECT */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes bubblePopUp {
          0% { transform: scale(0.97) translateY(-8px); opacity: 0; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        .animate-nav-bubble {
          animation: bubblePopUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        /* Siêu cấu trúc Kính lỏng cao cấp */
        .liquid-glass-premium {
          background: rgba(10, 15, 30, 0.35);
          backdrop-filter: blur(30px) saturate(180%);
          -webkit-backdrop-filter: blur(30px) saturate(180%);
          border: 1px solid rgba(255, 255, 255, 0.04);
          border-top: 1px solid rgba(255, 255, 255, 0.18);
          border-left: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 
            0 50px 100px -20px rgba(0, 0, 0, 0.7),
            inset 0 1px 2px rgba(255, 255, 255, 0.05);
          position: relative;
          overflow: hidden;
          transition: all 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .liquid-glass-navbar {
          background: rgba(255, 255, 255, 0.015);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid rgba(255, 255, 255, 0.03);
          border-top: 1px solid rgba(255, 255, 255, 0.18);
          border-left: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 30px 70px -15px rgba(0, 0, 0, 0.65);
        }

        /* Phản xạ thấu kính hội tụ theo tọa độ chuột */
        .lens-glow::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(
            550px circle at 50% 50%, 
            rgba(255, 255, 255, 0.06),
            rgba(239, 107, 87, 0.03),
            transparent 65%
          );
          opacity: 0;
          transition: opacity 0.5s ease;
          pointer-events: none;
          z-index: 1;
        }
        .lens-glow:hover::before { opacity: 1; }
        
        .content-front { position: relative; z-index: 10; }

        .imperial-shimmer { position: relative; overflow: hidden; isolation: isolate; }
        .imperial-shimmer::after {
          content: ''; position: absolute; inset: 0; border-radius: inherit; padding: 1px;
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor; mask-composite: exclude; pointer-events: none; z-index: 2;
          background: linear-gradient(120deg, transparent 35%, rgba(255, 255, 255, 0.25) 48%, transparent 55%);
          background-size: 300% 100%; background-position: 150% 0; opacity: 0;
        }
        .imperial-shimmer:hover::after {
          opacity: 1; background-position: -120% 0; transition: background-position 1.5s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .glass-bubble {
          background: radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0) 70%);
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: inset -3px -3px 8px rgba(0, 0, 0, 0.4), inset 3px 3px 6px rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(4px);
        }

        .backdrop-only-blur {
          position: fixed; inset: 0; background: rgba(6, 9, 18, 0.6); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); z-index: 40;
        }

        /* ĐÃ GỠ Ở GIAI ĐOẠN 1: .skeleton-block + @keyframes skeletonShimmer.
           Hai khai báo này là BẢN SAO của keyframes cùng tên trong
           app/globals.css và của shimmer trong app/loading.tsx, và chúng chưa
           từng được dùng ở đây (không có phần tử nào mang class
           skeleton-block) — tức là CSS chết, nhưng vẫn khiến người sau phải
           đoán xem bản nào là bản thật. Nay skeleton đi qua
           components/ui/Skeleton.tsx.
           Lưu ý: chuỗi này nằm trong một template literal, nên comment ở đây
           KHÔNG được chứa dấu backtick — nó sẽ đóng chuỗi và làm vỡ cả file. */
      `}} />

      {/* ================= KHỐI NỘI DUNG CHÍNH LIQUID GLASS THẦU KÍNH VÀNG TRẮNG ================= */}
      <main className="pt-36 pb-24 px-4 md:px-8 flex items-center justify-center min-h-screen relative z-10">
        <section 
          data-reveal="zoom"
          className="max-w-4xl w-full liquid-glass-premium lens-glow imperial-shimmer rounded-[2.5rem] p-6 md:p-12 hover:border-white/10"
        >
          <div className="content-front space-y-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#ff6b57]/10 text-[#ff6b57] border border-[#ff6b57]/20 text-[11px] font-semibold rounded-full uppercase tracking-widest">
              Tuyển dụng nhân sự
            </span>
            <h1 className="text-xl md:text-2xl lg:text-3xl font-light tracking-tight text-white leading-snug uppercase">
              Gia nhập đội ngũ bệnh viện thú y Belwee
            </h1>
          </div>

          <div className="w-full h-[1px] bg-white/10 my-6 md:my-8 content-front"></div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12 items-center relative z-10">
            
            {/* THIẾT KẾ ĐỒ HỌA PHÁ LÊ CRYSTALLINE THAY THẾ CHO KHỐI CŨ */}
            <div className="md:col-span-5 flex justify-center content-front">
              <div className="relative w-64 h-64 md:w-72 md:h-72 rounded-[2.5rem] bg-gradient-to-tr from-white/[0.02] via-white/[0.06] to-blue-500/[0.05] p-1 flex items-center justify-center overflow-hidden border border-white/10 shadow-2xl">
                <div className="absolute inset-0 bg-gradient-to-bl from-white/5 via-transparent to-black/30 mix-blend-overlay"></div>
                
                {/* Thẻ pha lê Thực Tập */}
                <div className="absolute top-12 left-6 w-32 h-44 rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/10 shadow-xl transform -rotate-6 flex flex-col justify-between p-3 transition-transform hover:scale-105 duration-500">
                  <div className="w-12 h-1 bg-indigo-400/40 rounded-full mt-1"></div>
                  <div className="text-center font-medium text-slate-200 text-xs py-1.5 border border-white/10 rounded-lg bg-white/[0.05]">Thực Tập</div>
                  <div className="w-full h-12 bg-white/[0.01] border border-dashed border-white/5 rounded-lg"></div>
                </div>

                {/* Thẻ pha lê Bác Sĩ */}
                <div className="absolute bottom-8 right-6 w-32 h-44 rounded-2xl bg-white/[0.06] backdrop-blur-xl border border-white/20 shadow-2xl transform rotate-3 flex flex-col justify-between p-3 z-10 transition-transform hover:scale-105 duration-500">
                  <div className="w-12 h-1 bg-emerald-400/40 rounded-full mt-1"></div>
                  <div className="text-center font-semibold text-white text-xs py-1.5 border border-white/20 rounded-lg bg-white/[0.1]">Bác Sĩ</div>
                  <div className="w-full h-12 bg-white/[0.02] border border-dashed border-white/10 rounded-lg"></div>
                </div>

                {/* Các bong bóng thấu kính trang trí */}
                <div className="absolute bottom-6 left-4 w-16 h-16 rounded-full glass-bubble z-20 animate-pulse" style={{ animationDuration: '6s' }}></div>
                <div className="absolute top-20 right-2 w-20 h-16 glass-bubble z-20 transform rotate-12" style={{ borderRadius: '40% 60% 70% 30% / 40% 50% 60% 50%' }}></div>
              </div>
            </div>

            {/* KHỐI CHỮ SANG TRỌNG */}
            <div className="md:col-span-7 space-y-6 content-front">
              <p className="text-slate-300 text-sm md:text-base font-normal leading-relaxed text-justify">
                Bạn yêu động vật, mong muốn làm việc trong môi trường chuyên nghiệp, hiện đại và được phát triển lâu dài trong ngành thú y? ✨ Bệnh viện thú y Belwee đang tìm kiếm những cộng sự tâm huyết để cùng đồng hành chăm sóc sức khỏe thú cưng bằng sự tận tâm và chuyên nghiệp...
              </p>

              <div className="pt-2">
                <button 
                  onClick={() => navigate('/tuyen-dung/chi-tiet')}
                  className="liquid-glass-navbar text-white border border-white/15 hover:bg-white/10 font-medium text-xs tracking-widest uppercase px-6 py-3.5 rounded-full transition-all duration-300 active:scale-95 inline-block"
                >
                  <span className="flex items-center gap-2">
                    Xem chi tiết tuyển dụng <span className="text-sm font-light">→</span>
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* PHẦN CHÂN CARD ĐỒNG BỘ */}
          <div className="mt-8 pt-4 border-t border-white/5 flex justify-between items-center content-front">
            <span className="text-[11px] font-medium text-[#ff6b57]/80 tracking-widest uppercase">#NgànhThúY</span>
            <button onClick={() => navigate('/')} className="text-xs text-slate-400 hover:text-white transition">Quay lại trang chủ</button>
          </div>

        </section>

        {/* Thẻ cuối trang — chuyên gia & kiến thức ngẫu nhiên */}
      </main>

    </div>
  );
}
