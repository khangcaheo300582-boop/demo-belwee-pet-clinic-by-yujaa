"use client";

import Image from "next/image";
import { useRef } from "react";
import Reveal from "@/components/Reveal";
import ContactCard from "@/components/home/ContactCard";
import BranchTag from "@/components/home/BranchTag";
import type { Branch } from "@/data/branches";
import clsx from "clsx";

const C = "bt";

export default function BranchItem({
  branch,
  priority = false,
}: {
  branch: Branch;
  priority?: boolean;
}) {
  const contentRef = useRef<HTMLDivElement>(null);

  return (
    <Reveal
      as="article"
      variant="fade-up"
      className={clsx(C + "-branch", "relative w-full")}
    >
      {/* ── B1. Banner ảnh toàn chiều (full-bleed) ─────────────────────── */}
      <div className="relative w-full overflow-hidden">
        <div className="relative w-full aspect-[4/3] md:aspect-[16/8] bg-[#0F1B3D] overflow-hidden">
          <Image
            src={branch.bannerImage}
            alt={branch.bannerAlt}
            fill
            sizes="100vw"
            className="object-cover object-center"
            loading={priority ? undefined : "lazy"}
            priority={priority}
          />
          {/* lớp gradient rất nhẹ ở đáy để tab nổi bật */}
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-[40%] bg-gradient-to-t from-[rgba(15,23,42,0.18)] to-transparent"
            aria-hidden="true"
          />
        </div>

        {/* Nhãn tab góc dưới-trái của banner */}
        <div
          className="absolute bottom-0 left-0 z-10 flex items-center gap-2.5 bg-white px-5 py-3 rounded-tr-[24px] bt-tab-inverted max-w-[96%]"
          aria-label={branch.shortName}
        >
          <Image
            src="/logo-belwee.png"
            alt=""
            width={351}
            height={117}
            className="h-5 w-auto flex-shrink-0 sm:h-6"
            priority
            sizes="120px"
          />
          <h3 className="text-[#0F1B3D] text-[14px] sm:text-[16px] md:text-[18px] font-bold leading-tight whitespace-nowrap">
            {branch.shortName}
          </h3>
        </div>
      </div>

      {/* ── B2. Khối nội dung 2 cột ─────────────────────────────── */}
      <div
        ref={contentRef}
        className="mx-auto max-w-[1200px] px-4 py-10 sm:px-6 md:px-8 md:py-12 lg:px-12 lg:py-14"
      >
        <div className="grid grid-cols-1 gap-8 md:grid-cols-[60fr_40fr] md:gap-8 lg:grid-cols-[68fr_32fr] lg:gap-12 items-center">
          {/* ─ cột trái ─ Văn bản ──────────────── */}
          <div className="min-w-0">
            {/* tiêu đề cơ sở gồm icon logo + tên */}
            <div className="mb-5 flex items-center gap-3">
              <Image
                src="/belwee-phong-kham.png"
                alt=""
                width={263}
                height={262}
                className="h-7 w-7 flex-shrink-0 object-contain"
                priority
                sizes="28px"
                aria-hidden="true"
              />
              <h3 className="text-[20px] sm:text-[24px] md:text-[26px] lg:text-[30px] font-semibold text-[#0F1B3D] leading-tight">
                {branch.facilityName}
              </h3>
            </div>

            {/* ảnh thẻ — chỉ hiển thị trên mobile, nằm sau tiêu đề */}
            <div className="mb-6 flex justify-center md:hidden">
              <Image
                src={branch.cardImage}
                alt={branch.cardAlt}
                width={branch.cardWidth}
                height={branch.cardHeight}
                className="h-auto w-auto max-w-[260px] object-contain drop-shadow-[0_12px_24px_rgba(0,0,0,.15)]"
                sizes="260px"
                loading="lazy"
              />
            </div>

            {/* 2 đoạn mô tả, có chấm tròn đứng đầu dòng */}
            <div className="space-y-3">
              <p className="relative pl-[22px] text-[15px] sm:text-[16px] md:text-[15.5px] lg:text-[17px] font-bold text-[#0F1B3D] leading-[1.6]">
                <span
                  className="absolute left-0 top-[calc(1em-5px)] h-2.5 w-2.5 rounded-full bg-[#1F5BD9]"
                  aria-hidden="true"
                />
                {branch.description}
              </p>
              <p className="relative pl-[22px] text-[13.5px] sm:text-[14px] md:text-[14px] lg:text-[15px] font-semibold text-[#0F1B3D]/80 leading-[1.6]">
                <span
                  className="absolute left-0 top-[calc(1em-5px)] h-2.5 w-2.5 rounded-full bg-[#1F5BD9]"
                  aria-hidden="true"
                />
                {branch.detail}
              </p>
            </div>

            {/* Thẻ liên hệ */}
            <div className="mt-6 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:gap-4">
              <ContactCard
                kind="zalo"
                number={branch.zalo}
                ariaLabel={`Chat Zalo cho ${branch.shortName} qua ${branch.zalo}`}
              />
              <ContactCard
                kind="phone"
                number={branch.phone}
                ariaLabel={`Gọi cho ${branch.shortName} qua ${branch.phone}`}
              />
            </div>

            {/* Tag pills */}
            <div className="mt-5 flex flex-wrap items-center gap-3">
              {branch.tags.map((tag) => (
                <BranchTag key={tag} kind="service">
                  {tag}
                </BranchTag>
              ))}
              <BranchTag kind="service">{branch.hours}</BranchTag>
              {branch.emergency && (
                <BranchTag kind="emergency">Cấp cứu 24/24h</BranchTag>
              )}
            </div>
          </div>

          {/* ─ cột phải ─ Ảnh thẻ chi nhánh (desktop) ─────────────── */}
          <div className="hidden md:flex items-center justify-center">
            <Image
              src={branch.cardImage}
              alt={branch.cardAlt}
              width={branch.cardWidth}
              height={branch.cardHeight}
              className="h-auto w-full max-w-[340px] lg:max-w-[380px] object-contain drop-shadow-[0_12px_24px_rgba(0,0,0,.15)]"
              sizes="(max-width: 1023px) 340px, 380px"
              loading="lazy"
            />
          </div>
        </div>
      </div>
    </Reveal>
  );
}