"use client";

/**
 * components/home/CareAreaMap.tsx
 *
 * Hạng mục 25.3 — teaser "vùng cơ thể" trên trang chủ.
 *
 * Phiên bản này hiển thị layout chính xác theo ảnh tham chiếu:
 * Hai cột cân đối, ảnh với blob nền nhẹ và họa tiết trang trí tinh tế, cột nội dung với pill label, tiêu đề lớn, mô tả ngắn, thẻ có icon + ghi chú + nút CTA.
 *
 * ── Ý nghĩa ─────────────────────────────────────────────────────────────────────────────
 * Hiển thị 4 dịch vụ thật của Belwee (Spa, Khám, Khách Sạn, Tiêm) bằng hình ảnh chú chó có các vùng tương ứng.
 * Không vẽ bất kỳ vùng chọn (hotspot) nào trên ảnh.
 * Cột trái: ảnh với blob nền nhẹ, họa tiết trang trí (tim, khiên, dấu chân) bên trên.
 * Cột phải: nội dung được căn giữa, có pill label, tiêu đề lớn, mô tả, thẻ có icon, ghi chú với vạch xanh bên trái, và nút CTA.
 *
 * ── DESIGN SYSTEM ────────────────────────────────────────────────────────────────────
 * Giữ giữ hệ màu xanh dương, font chữ, pill, thẻ, nút pill từ design system.
 * Có khoảng trắng rộng rãi, đổ bóng nhẹ, bo góc vừa phải.
 * Tương tác: hover/focus states rõ ràng, ring focus visible.
 *
 * ── HIỆN THỊ: NÊN BỐ CỤC ─────────────────────────────────────────────────────────────────────────
 * Desktop: 2 cột cân đối, ảnh trái, nội dung phải, giữa theo chiều dọc.
 * Mobile/Tablet: 1 cột, ảnh trên, nội dung dưới, căn trái.
 *
 * ── TƯƠNG THỰ̉C ─────────────────────────────────────────────────────────────────────────────
 * Hover/focus: hiệu ứng nhẹ, thay đổi nền/thẻ.
 * Nút CTA: trạng thái hover/focus visible.
 * Không có animation scroll phức tạp; chỉ hiệu ứng tương tác trực tiếp.
 */

import Link from "next/link";
import { Dog } from "lucide-react";
export default function CareAreaMap({ className }: { className?: string }) {
  return (
    <section
      aria-labelledby="area-map-title"
      className={`relative px-4 py-16 sm:px-6 lg:py-20 ${className ?? ""}`}
    >
      <div className="mx-auto max-w-[1240px]">
        {/* Header */}
        <div data-reveal="fade-up" className="text-center">
          <span className="inline-block rounded-full bg-white/80 border border-blue-200/60 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.28em] text-blue-700 shadow-sm">
            VÙNG CHĂM SÓC
          </span>
          <h2
            id="area-map-title"
            className="mx-auto mt-4 max-w-[24ch] text-[32px] font-semibold leading-tight text-slate-900 sm:text-[36px]"
          >
            Bắt đầu từ chỗ bạn đang lo
          </h2>
          <p className="mx-auto mt-4 max-w-[52ch] text-[15px] leading-[1.75] text-slate-600 sm:text-base">
            Hiện Belwee đang hỗ trợ chăm sóc da và lông cho thú cưng của bạn — nơi bé dễ gặp vấn đề nhất.
          </p>
        </div>

        {/* Layout hai cột, căn giữa theo chiều dọc */}
        <div className="mt-16 grid items-center gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          {/* Cột trái: ảnh */}
          <figure data-reveal="fade-up" className="m-0 flex justify-center">
            <div className="relative w-full max-w-[380px]">
              {/* Ảnh nền với blob gradient nhẹ phía dưới, bo mềm */}
              <div
                className="absolute inset-0 rounded-3xl bg-gradient-to-br from-blue-50 via-blue-100/50 to-blue-200/60"
                aria-hidden="true"
              />

              {/* Họa tiết trang trí nhẹ: trái tim, khiên, dấu chân */}
              <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
                {/* Trái tim bên trái, mờ */}
                <div
                  className="absolute -left-4 top-1/2 h-32 w-32 rounded-full bg-red-500/20 blur-2xl"
                  style={{ transform: 'translateY(-50%)' }}
                />
                {/* Khiên chữ thập bên phải phía trên đầu chó */}
                <div className="absolute -right-2 top-8 h-20 w-20 rotate-12">
                  <svg viewBox="0 0 100 100" className="h-full w-full text-blue-500/30">
                    <path d="M50 10 L90 50 L50 90 L10 50 Z" fill="currentColor" />
                  </svg>
                </div>
                {/* Dấu chân nhỏ */}
                <div className="absolute left-1/4 top-3/4 h-16 w-16">
                  <svg viewBox="0 0 100 100" className="h-full w-full text-blue-400/40">
                    <path d="M30 70 L50 30 L70 70 Z" fill="currentColor" />
                  </svg>
                </div>
              </div>

              {/* Ảnh chú chó, KHÔNG có viền, KHÔNG có caption */}
              <img
                src="/anh-vung-cham-soc.png"
                alt="Hình vẽ chú chó với các vùng chăm sóc được tô sáng"
                className="relative h-full w-full object-cover rounded-3xl"
                width={380}
                height={380}
              />
            </div>
          </figure>

          {/* Cột phải: nội dung, căn giữa */}
          <div data-reveal="fade-up" className="flex flex-col items-center justify-center">
            {/* Thẻ nội dung */}
            <div className="w-full max-w-[420px]">
              {/* Icon + tên vùng */}
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100/80">
                  <Dog className="h-6 w-6 text-blue-700" />
                </div>
                <span className="text-xl font-semibold text-slate-900">Da & lông</span>
              </div>

              {/* Mô tả */}
              <p className="text-sm text-slate-600 leading-relaxed">
                Khám da, hỗ trợ dị ứng, tắm, cắt tỉa và chăm sóc bộ lông.
              </p>

              {/* Thẻ có ghi chú với vạch xanh */}
              <div className="mt-6 rounded-2xl bg-white/80 border border-blue-200/60 p-5 shadow-lg backdrop-blur-sm">
                {/* Ghi chú với vạch xanh */}
                <div className="flex gap-3">
                  <div className="w-1 bg-blue-500 rounded-full mt-0.5" />
                  <p className="text-xs text-slate-600 flex-1">
                    Belwee sẽ bổ sung thêm các vùng chăm sóc khác trong thời gian tới, và đội ngũ của chúng tôi luôn sẵn sàng tư vấn cho mọi nhu cầu của bé.
                  </p>
                </div>

                {/* Nút CTA */}
                <Link
                  href="/booking/spa-grooming"
                  className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                >
                  Xem Spa & Grooming
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4"
                    aria-hidden="true"
                  >
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}