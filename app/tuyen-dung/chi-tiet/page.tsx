"use client";

import Image from "next/image";
import { useTransitionNavigate } from "@/hooks/useTransitionNavigate";

export default function TuyenDungChiTietPage() {
  const navigate = useTransitionNavigate();

  return (
    <div className="min-h-screen relative overflow-hidden bg-slate-950">
      {/* Background: consistent with /tuyen-dung */}
      <div className="fixed inset-0 z-0">
        <Image src="/anhnentcdichvu.webp" alt="" fill sizes="100vw" className="object-cover opacity-30" priority />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-950/90 to-slate-950/95" />
        <div className="absolute inset-0 bg-gradient-to-r from-blue-900/20 to-transparent" />
      </div>

      <main className="relative z-10 px-4 sm:px-8 py-32 text-slate-100">
        <div className="mx-auto max-w-3xl rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 shadow-2xl backdrop-blur-xl sm:p-12">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-300">Cơ hội nghề nghiệp</p>
          <h1 className="mt-4 text-3xl font-bold sm:text-4xl">Gia nhập đội ngũ Belwee</h1>
          <p className="mt-6 leading-8 text-slate-300">
            Belwee chào đón những cộng sự yêu động vật, tận tâm và muốn phát triển lâu dài trong môi trường thú y chuyên nghiệp.
          </p>
          <div className="mt-8 space-y-4 text-sm leading-7 text-slate-300">
            <p>Vị trí thường tuyển: bác sĩ thú y, kỹ thuật viên, nhân viên chăm sóc thú cưng và tư vấn khách hàng.</p>
            <p>Vui lòng gửi CV và thông tin liên hệ tới đội ngũ Belwee để được trao đổi về cơ hội phù hợp.</p>
          </div>
          <button onClick={() => navigate('/tuyen-dung')} className="mt-10 inline-flex rounded-full border border-white/20 px-5 py-3 text-sm font-semibold transition hover:bg-white/10">
            ← Quay lại tuyển dụng
          </button>
        </div>
      </main>
    </div>
  );
}
