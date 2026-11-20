﻿"use client";

import { useTransitionNavigate } from '@/hooks/useTransitionNavigate';

export default function GioiThieu() {
  const navigate = useTransitionNavigate();

  return (
    <div 
      className="relative min-h-screen text-slate-100 font-sans antialiased bg-cover bg-center bg-no-repeat bg-fixed selection:bg-blue-500 selection:text-white"
      style={{ backgroundImage: "url('/anhnentcdichvu.webp')" }}
    >
      {/* CSS Injection cho hiệu ứng Thấu kính chuyên sâu */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes bubblePopUp {
          0% { transform: scale(0.97) translateY(-8px); opacity: 0; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        .animate-nav-bubble {
          animation: bubblePopUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        /* Lớp nền kính lỏng thấu kính cao cấp */
        .liquid-glass-card {
          background: rgba(10, 15, 30, 0.35);
          backdrop-filter: blur(25px) saturate(160%);
          -webkit-backdrop-filter: blur(25px) saturate(160%);
          border: 1px solid rgba(255, 255, 255, 0.04);
          border-top: 1px solid rgba(255, 255, 255, 0.15);
          border-left: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 
            0 40px 80px -15px rgba(0, 0, 0, 0.7),
            inset 0 1px 2px rgba(255, 255, 255, 0.05);
          position: relative;
          overflow: hidden;
          transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .liquid-glass-navbar {
          background: rgba(255, 255, 255, 0.012);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid rgba(255, 255, 255, 0.03);
          border-top: 1px solid rgba(255, 255, 255, 0.18);
          border-left: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 30px 70px -15px rgba(0, 0, 0, 0.65);
        }

        /* Di chuột tạo vệt sáng thấu kính hội tụ */
        .lens-glow::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(
            350px circle at 50% 50%, 
            rgba(255, 255, 255, 0.06),
            rgba(59, 130, 246, 0.03),
            transparent 65%
          );
          opacity: 0;
          transition: opacity 0.5s ease;
          pointer-events: none;
          z-index: 1;
        }
        .lens-glow:hover::before { opacity: 1; }

        .imperial-shimmer {
          position: relative;
          overflow: hidden;
          isolation: isolate;
        }
        .imperial-shimmer::after {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          padding: 1px;
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
          z-index: 2;
          background: linear-gradient(120deg, transparent 35%, rgba(255, 255, 255, 0.3) 48%, transparent 55%);
          background-size: 300% 100%;
          background-position: 150% 0;
          opacity: 0;
        }
        .imperial-shimmer:hover::after {
          opacity: 1;
          background-position: -120% 0;
          transition: background-position 1.5s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .backdrop-only-blur {
          position: fixed;
          inset: 0;
          background: rgba(6, 9, 18, 0.5);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          z-index: 40;
        }
      `}} />

      {/* Lớp phủ mờ diện rộng mượt mà */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/50 via-slate-950/60 to-slate-950/70 backdrop-blur-[2px] pointer-events-none z-0"></div>
      <div className="absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-[#f4f8ff] via-[#f4f8ff]/40 to-transparent pointer-events-none z-[1]" />

      {/* ================= NỘI DUNG CHÍNH (THEO ẢNH IMAGE_06692F.PNG) ================= */}
      <main className="relative z-10 max-w-5xl mx-auto pt-32 pb-24 px-4 sm:px-6 space-y-10">
        
        {/* THẺ 1: TIÊU ĐỀ CHÍNH & GIỚI THIỆU CHUNG */}
        <section 
          data-reveal="fade-up"
          className="liquid-glass-card lens-glow imperial-shimmer rounded-[2.5rem] p-8 md:p-12 hover:border-white/10"
        >
          <div className="relative z-10 space-y-6">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[11px] font-semibold rounded-full uppercase tracking-widest">
              Giới thiệu hệ thống
            </span>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-light tracking-tight text-white leading-tight uppercase">
              Bệnh viện Thú y Belwee TP.HCM - Nơi chăm sóc sức khỏe và hạnh phúc cho thú cưng của bạn
            </h1>
            <div className="w-12 h-[1px] bg-slate-500"></div>
            <p className="text-slate-300 text-sm md:text-base leading-relaxed font-normal text-justify">
              Ngày nay, thú cưng không chỉ là vật nuôi mà còn là thành viên không thể thiếu trong gia đình. Việc chăm sóc sức khỏe và đời sống tinh thần cho thú cưng ngày càng được quan tâm. Trong bối cảnh đó, <strong className="text-white font-medium">Bệnh viện Thú y Belwee TP.HCM</strong> tự hào là địa chỉ đáng tin cậy, nơi cung cấp các dịch vụ thú y chuyên nghiệp, tận tâm, và chất lượng cao dành cho các loại thú cưng như chó, mèo, thỏ, rùa và nhiều loài khác.
            </p>
          </div>
        </section>

        {/* THẺ 2: ĐỘI NGŨ BÁC SĨ THÚ Y */}
        <section 
          data-reveal="fade-up" data-delay="0.05"
          className="liquid-glass-card lens-glow imperial-shimmer rounded-[2.5rem] p-8 md:p-12 hover:border-white/10"
        >
          <div className="relative z-10 space-y-5">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🧑‍⚕️</span>
              <h2 className="text-xl md:text-2xl font-normal text-white tracking-wide">
                Đội ngũ bác sĩ thú y với hơn 12 năm kinh nghiệm
              </h2>
            </div>
            <div className="space-y-4 text-slate-300 text-sm md:text-base leading-relaxed text-justify">
              <p>
                Tại Bệnh viện Thú y Belwee, chất lượng dịch vụ được đặt lên hàng đầu, bắt nguồn từ đội ngũ bác sĩ thú y với <strong className="text-white font-medium">trên 12 năm kinh nghiệm</strong> trong lĩnh vực chăm sóc và điều trị thú cưng. Các bác sĩ tại đây không chỉ sở hữu kiến thức chuyên môn sâu rộng mà còn được đào tạo bài bản tại các trường đại học hàng đầu trong và ngoài nước.
              </p>
              <p>
                Với khả năng chẩn đoán chính xác, đưa ra phác đồ điều trị phù hợp và hiệu quả, đội ngũ bác sĩ của Belwee đã thành công trong việc chăm sóc sức khỏe cho hàng nghìn thú cưng tại TP.HCM. Bên cạnh đó, các bác sĩ còn không ngừng học hỏi và cập nhật kiến thức mới để áp dụng các công nghệ tiên tiến trong điều trị.
              </p>
            </div>
          </div>
        </section>

        {/* THẺ 3: ĐỘI NGŨ KỸ THUẬT VIÊN */}
        <section 
          data-reveal="fade-up"
          className="liquid-glass-card lens-glow imperial-shimmer rounded-[2.5rem] p-8 md:p-12 hover:border-white/10"
        >
          <div className="relative z-10 space-y-5">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🤝</span>
              <h2 className="text-xl md:text-2xl font-normal text-white tracking-wide">
                Đội ngũ kỹ thuật viên tận tâm, yêu thương động vật
              </h2>
            </div>
            <div className="space-y-4 text-slate-300 text-sm md:text-base leading-relaxed text-justify">
              <p>
                Một yếu tố làm nên sự khác biệt của Bệnh viện Thú y Belwee chính là đội ngũ kỹ thuật viên chăm sóc, xét nghiệm với tay nghề vững vàng và tình yêu thương động vật vô hạn. Những kỹ thuật viên này được tuyển chọn và đào tạo kỹ lưỡng, không chỉ về mặt chuyên môn mà còn về cách ứng xử, giao tiếp và chăm sóc thú cưng.
              </p>
              <p>
                Tại Belwee, mỗi thú cưng khi đến đều được chăm sóc chu đáo như chính người bạn thân thiết. Từ việc an ủi những chú chó mèo nhút nhát đến việc hỗ trợ điều trị những trường hợp bệnh nặng, đội ngũ kỹ thuật viên luôn làm việc với tâm huyết, cam kết mang lại sự thoải mái và an tâm nhất cho cả thú cưng và chủ nuôi.
              </p>
            </div>
          </div>
        </section>

        {/* THẺ 4: KHỐI DỊCH VỤ CHUYÊN NGHIỆP (BAO GỒM LƯỚI 8 DỊCH VỤ CHI TIẾT) */}
        <section data-reveal="fade-up" data-delay="0.1" className="space-y-6">
          <div 
            className="liquid-glass-card lens-glow p-8 rounded-[2rem]"
          >
            <div className="relative z-10 text-center md:text-left">
              <h2 className="text-xl md:text-2xl font-normal text-white tracking-wide uppercase">
                Các dịch vụ thú y chuyên nghiệp tại Bệnh viện Thú y Belwee
              </h2>
              <p className="text-slate-400 text-sm mt-2">
                Bệnh viện Thú y Belwee TP.HCM cung cấp đầy đủ các dịch vụ chăm sóc và điều trị cho thú cưng, đáp ứng mọi nhu cầu của khách hàng:
              </p>
            </div>
          </div>

          {/* Lưới 8 dịch vụ thấu kính nhỏ sang trọng */}
          <div data-reveal-group className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { num: "1", title: "Khám và chữa bệnh cho thú cưng", content: "Belwee chuyên khám, chẩn đoán và điều trị cho các loại thú cưng như chó, mèo, thỏ, rùa và các loại vật khác. Với các thiết bị hiện đại và đội ngũ chuyên gia giàu kinh nghiệm, bệnh viện đảm bảo quá trình khám chữa bệnh diễn ra nhanh chóng, chính xác và an toàn." },
              { num: "2", title: "Dịch vụ xét nghiệm thú cưng", content: "Bệnh viện trang bị hệ thống xét nghiệm tiên tiến, giúp phát hiện sớm các vấn đề sức khỏe của thú cưng như bệnh truyền nhiễm, ký sinh trùng, hay các rối loạn chức năng cơ thể. Kết quả xét nghiệm tại đây luôn được xử lý nhanh chóng và chính xác, giúp bác sĩ đưa ra phác đồ điều trị phù hợp nhất." },
              { num: "3", title: "Dịch vụ siêu âm thú cưng", content: "Với công nghệ siêu âm hiện đại, Belwee hỗ trợ chẩn đoán các bệnh lý liên quan đến nội tạng, thai kỳ hay các tổn thương bên trong mà không gây đau đớn cho thú cưng. Đây là công nghệ quan trọng để đảm bảo sức khỏe toàn diện cho các bé yêu." },
              { num: "4", title: "Dịch vụ phẫu thuật điều trị bệnh", content: "Từ các ca phẫu thuật thông thường như triệt sản đến những ca phức tạp như xử lý gãy xương, phẫu thuật nội tạng, đội ngũ bác sĩ tại Belwee luôn sẵn sàng. Với môi trường vô trùng và trang thiết bị hiện đại, mọi ca phẫu thuật đều được thực hiện an toàn và hiệu quả." },
              { num: "5", title: "Dịch vụ chăm sóc, cắt tỉa lông và spa thú cưng", content: "Ngoài sức khỏe, vẻ ngoài của thú cưng cũng rất quan trọng. Tại Belwee, các dịch vụ tắm, cắt tỉa lông, tẩm dưỡng chuyên nghiệp giúp thú cưng luôn xinh đẹp, sạch sẽ và thoải mái. Kỹ thuật viên tận tâm đảm bảo mang lại trải nghiệm thư giãn tuyệt vời cho thú cưng của bạn." },
              { num: "6", title: "Huấn luyện thú cưng", content: "Belwee còn cung cấp dịch vụ huấn luyện thú cưng chuyên nghiệp, giúp chúng phát triển các kỹ năng cơ bản như nghe lời, hòa đồng và thực hiện các mệnh lệnh đơn giản. Điều này không chỉ cải thiện mối quan hệ giữa thú cưng và chủ mà còn giúp chúng sống hạnh phúc hơn." },
              { num: "7", title: "Dịch vụ đỡ đẻ thú cưng", content: "Việc sinh nở của thú cưng đòi hỏi sự chăm sóc đặc biệt. Tại Belwee, các bác sĩ thú y giàu kinh nghiệm sẽ theo dõi sát sao quá trình mang thai và hỗ trợ đỡ đẻ an toàn, đảm bảo sức khỏe tốt nhất cho cả mẹ và con." },
              { num: "8", title: "Dịch vụ xuất cảnh thú cưng", content: "Nếu bạn cần đưa thú cưng ra nước ngoài, Belwee cung cấp dịch vụ hỗ trợ toàn diện, từ tiêm phòng, xét nghiệm sức khỏe đến chuẩn bị hồ sơ xuất cảnh theo yêu cầu của từng quốc gia." }
            ].map((srv, index) => (
              <div 
                key={index}
                className="liquid-glass-card lens-glow imperial-shimmer rounded-2xl p-6 md:p-8 flex flex-col justify-between hover:scale-[1.01]"
              >
                <div className="relative z-10 space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-xs font-semibold text-blue-400">
                      {srv.num}
                    </span>
                    <h3 className="text-base font-medium text-slate-200 tracking-wide">{srv.title}</h3>
                  </div>
                  <p className="text-xs md:text-sm text-slate-400 leading-relaxed text-justify">{srv.content}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* THẺ 5: CAM KẾT CHẤT LƯỢNG & HÌNH ẢNH MINH HỌA */}
        <section 
          className="liquid-glass-card lens-glow imperial-shimmer rounded-[2.5rem] p-8 md:p-12 hover:border-white/10"
        >
          <div className="relative z-10 grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
            <div className="md:col-span-4 flex justify-center">
              {/* Box chứa ảnh thú cưng nghệ thuật theo ảnh gốc tinh tế */}
              <div className="relative w-full aspect-[4/5] max-w-[240px] rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-slate-950 flex items-center justify-center group">
                <div className="absolute inset-0 bg-gradient-to-t from-blue-950/80 via-transparent to-transparent z-10"></div>
                {/* Bạn có thể đổi src sang ảnh thật nếu cần, hiện tại giả lập artwork ánh sáng xanh giống ảnh gốc */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.3),transparent_70%)] animate-pulse"></div>
                <div className="z-20 text-center p-4">
                  <span className="text-4xl block mb-2 filter drop-shadow-md">🐕‍🦺🐈</span>
                  <span className="text-[10px] uppercase tracking-widest text-slate-400 block">Belwee Art Gallery</span>
                </div>
              </div>
            </div>
            
            <div className="md:col-span-8 space-y-4">
              <h2 className="text-xl md:text-2xl font-normal text-white tracking-wide">
                Cam kết chất lượng tại Bệnh viện Thú y Belwee TP.HCM
              </h2>
              <p className="text-slate-300 text-sm md:text-base leading-relaxed text-justify">
                Với phương châm <span className="text-blue-400 font-medium">&quot;Hạnh phúc của thú cưng là trách nhiệm của chúng tôi&quot;</span>, Belwee luôn cam kết mang lại dịch vụ tốt nhất với sự tận tâm và chuyên nghiệp. Bệnh viện không chỉ là nơi chăm sóc sức khỏe mà còn là ngôi nhà thứ hai, nơi thú cưng của bạn được yêu thương và bảo vệ.
              </p>
            </div>
          </div>
        </section>

        {/* THẺ 6: KẾT LUẬN & KÊU GỌI HÀNH ĐỘNG */}
        <section 
          data-reveal="fade-up"
          className="liquid-glass-card lens-glow imperial-shimmer rounded-[2.5rem] p-8 md:p-12 text-center border-dashed border-blue-500/20"
        >
          <div className="relative z-10 max-w-3xl mx-auto space-y-6">
            <h2 className="text-xl md:text-2xl font-normal text-white tracking-wide uppercase">
              Kết luận
            </h2>
            <div className="space-y-4 text-slate-300 text-sm md:text-base leading-relaxed">
              <p className="text-justify md:text-center">
                Dù bạn đang tìm kiếm một nơi để khám bệnh, điều trị hay chăm sóc sắc đẹp cho thú cưng, <strong className="text-white font-medium">Bệnh viện Thú y Belwee TP.HCM</strong> luôn sẵn sàng đồng hành cùng bạn. Với đội ngũ bác sĩ giỏi, kỹ thuật viên tận tâm, và dịch vụ đa dạng, đây chắc chắn là địa chỉ lý tưởng để bạn gửi gắm niềm tin và tình yêu dành cho thú cưng.
              </p>
              <p className="text-blue-300 font-medium tracking-wide pt-2 text-base">
                Hãy đến và trải nghiệm sự khác biệt tại Belwee - nơi sức khỏe và hạnh phúc của thú cưng luôn được đặt lên hàng đầu.
              </p>
            </div>

            <div className="pt-4">
              <button 
                onClick={() => navigate('/dich-vu')}
                className="liquid-glass-navbar text-xs font-semibold uppercase tracking-widest px-8 py-4 rounded-full text-white border border-white/10 hover:bg-white/5 active:scale-98 transition-all"
              >
                📅 Đặt Lịch Hẹn Ngay Hôm Nay
              </button>
            </div>
          </div>
        </section>

        {/* Thẻ cuối trang — chuyên gia & kiến thức ngẫu nhiên */}
      </main>
    </div>
  );
}
