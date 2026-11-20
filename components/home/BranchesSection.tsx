"use client";

import React from "react";
import BranchItem from "@/components/home/BranchItem";
import { BRANCHES } from "@/data/branches";
import { pulseCSS } from "@/components/home/BranchTag";

export default function BranchesSection() {
  return (
    <section
      id="he-thong-phong-kham"
      className="bt-section"
      aria-labelledby="bt-title"
      style={
        {
          "--bt-blue": "#1F5BD9",
          "--bt-blue-50": "#E8EEFF",
          "--bt-navy": "#0F1B3D",
          "--bt-danger": "#FF5A4F",
          /* Nền trắng chỉ ở trang chủ — component này chỉ được nhúng tại
             app/page.tsx (Knowledge → BranchesSection → StatsBand).
             Gradient 3 vùng, gắn vào chính section nên nội dung luôn nằm trên nền:
               0–14%    nền trang → trắng  (mờ dần sau thẻ Kiến thức thú y)
               14–86%   trắng tuyệt đối    (phần thân mục)
               86–100%  trắng → nền trang  (mờ dần trước mục Belwee qua con số)
             Hai đầu mút là transparent (cùng pattern với .stats-surface ở
             globals.css) thay vì màu cố định: ở 0%/100% nền section = đúng
             những gì đang thấy (body + lớp mesh z:-10 + DNA field z:5) nên
             seamless với section lân cận, và tự theo theme sáng/tối mà không
             cần khai lại màu. Trung gian gradient alpha nội suy premultiplied
             → chuyển trắng mượt, không xám. */
          background:
            "linear-gradient(to bottom, transparent 0%, #fff 14%, #fff 86%, transparent 100%)",
        } as React.CSSProperties
      }
    >
      <style dangerouslySetInnerHTML={{ __html: pulseCSS }} />
      <style dangerouslySetInnerHTML={{ __html: `
        .bt-tab-inverted::after {
          content: "";
          position: absolute;
          left: 100%;
          bottom: 0;
          width: 24px;
          height: 24px;
          background: radial-gradient(circle at 0 100%, transparent 24px, #fff 24px);
          pointer-events: none;
        }
        @media (prefers-reduced-motion: reduce) {
          .bt-section * { scroll-behavior: auto; }
        }
      ` }} />

      {/* ── A. Phần tiêu đề section (căn giữa) ─────────────────────────── */}
      <div className="flex flex-col items-center text-center px-4 pt-12 pb-8 sm:px-6 md:px-8 lg:px-12">
        <span
          className="inline-block rounded-full bg-[#E8EEFF] text-[#1F5BD9] text-[11px] font-bold tracking-[0.18em] uppercase px-4 py-1.5 border border-[#E8EEFF]"
          aria-hidden="true"
        >
          HỆ THỐNG PHÒNG KHÁM
        </span>
        <h2
          id="bt-title"
          className="mt-4 max-w-[720px] text-[26px] sm:text-[32px] md:text-[36px] lg:text-[40px] font-semibold text-[#0F1B3D] leading-[1.22] tracking-[-0.01em] text-balance"
        >
          Hệ thống phòng khám hiện đại ở Hồ Chí Minh, luôn gần bên bạn
        </h2>
        <p className="mt-3 text-[14px] sm:text-[15px] md:text-[16px] text-[#64748B] leading-[1.7] max-w-[640px] mx-auto">
          Bốn chi nhánh tiện lợi trên khắp TP. Hồ Chí Minh — bệnh viện chuẩn
          quốc tế, flagship store, trung tâm hội tụ và resort thú cưng — để
          người bạn luôn nhỏ của bạn luôn được chăm sóc chu đáo.
        </p>
      </div>

      {/* ── 4 khối chi nhánh ─────────────────────────────────────────────── */}
      <div className="flex flex-col gap-12 lg:gap-16 xl:gap-20">
        {BRANCHES.map((branch, idx) => (
          <BranchItem key={branch.id} branch={branch} priority={idx === 0} />
        ))}
      </div>
    </section>
  );
}