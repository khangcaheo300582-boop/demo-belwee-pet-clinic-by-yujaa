"use client";

import { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useTransitionNavigate } from "@/hooks/useTransitionNavigate";
import { useLanguage } from "@/components/LanguageProvider";
import { teamDoctors, doctorHref, doctorFullName } from "@/lib/teamData";
import { STAFF_PROFILES, staffDisplayName } from "@/lib/staffProfiles";

/**
 * The highlight strip is the 4 people the clinic actually employs, sourced from
 * lib/staffProfiles.ts — ONE array shared with the homepage. Before this, the
 * homepage showed 4 cards and this page showed 6 completely different doctors
 * from lib/teamData (the "chuyên gia tư vấn" roster with full bio pages). Two
 * different rosters, both labelled "đội ngũ", is the bug.
 */
export default function DoiNgu() {
  const navigate = useTransitionNavigate();
  const { t } = useLanguage();

  useEffect(() => {
    document.title = "Đội Ngũ Chuyên Gia | Belwee Pet Clinic";
  }, []);

  return (
    <div className="relative min-h-screen text-slate-800 font-sans antialiased bg-cover bg-center bg-no-repeat bg-fixed overflow-x-hidden selection:bg-blue-500 selection:text-white">
      {/* Background Image */}
      <div
        className="fixed inset-0 w-full h-full scale-105 pointer-events-none z-0"
        style={{
          backgroundImage: "url('/anhnentcdichvu.webp')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: "brightness(0.95) contrast(1.05) saturate(1.05)",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-white/70 via-white/80 to-white/90 backdrop-blur-[2px] pointer-events-none z-0" />
      <div className="absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-[#f4f8ff] via-[#f4f8ff]/40 to-transparent pointer-events-none z-[1]" />

      {/*
        Raw HTML child, not a JSX text child. React escapes text children on
        the server but not on the client, so the `content: ''` below shipped as
        `content: &#x27;&#x27;` and the mismatch forced React to discard the
        server-rendered tree and re-render the page on the client. Passed via
        dangerouslySetInnerHTML instead, matching the other <style> blocks in
        the app.
      */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .liquid-glass-card {
          background: rgba(255, 255, 255, 0.64);
          backdrop-filter: blur(24px) saturate(170%);
          -webkit-backdrop-filter: blur(24px) saturate(170%);
          border: 1px solid rgba(255, 255, 255, 0.6);
          border-top: 1px solid rgba(255, 255, 255, 0.9);
          border-left: 1px solid rgba(255, 255, 255, 0.7);
          box-shadow: 0 30px 60px -20px rgba(2, 6, 23, 0.18), inset 0 1px 1px rgba(255, 255, 255, 0.7);
          position: relative;
          overflow: hidden;
          transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .liquid-glass-navbar {
          background: linear-gradient(135deg, rgba(37, 99, 235, 0.95), rgba(79, 70, 229, 0.95));
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.4);
          border-top: 1px solid rgba(255, 255, 255, 0.6);
          box-shadow: 0 16px 34px -10px rgba(37, 99, 235, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.5);
        }
        .lens-glow::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(
            350px circle at 50% 50%,
            rgba(59, 130, 246, 0.12),
            rgba(147, 197, 253, 0.06),
            transparent 65%
          );
          opacity: 0;
          transition: opacity 0.5s ease;
          pointer-events: none;
          z-index: 1;
        }
        .lens-glow:hover::before { opacity: 1; }
      `,
        }}
      />

      <main className="relative z-10 max-w-6xl mx-auto pt-32 pb-24 px-4 sm:px-6 space-y-8">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="text-xs text-slate-700 tracking-wide">
          <ol className="flex flex-wrap items-center gap-2">
            <li>
              <button onClick={() => navigate("/")} className="hover:text-blue-600 transition-colors">Trang chủ</button>
            </li>
            <li aria-hidden="true" className="text-slate-400">/</li>
            <li className="text-blue-700 font-medium" aria-current="page">Đội Ngũ Chuyên Gia</li>
          </ol>
        </nav>

        {/* HERO */}
        <section
          data-reveal="fade-up"
          className="liquid-glass-card lens-glow rounded-[2.5rem] p-8 md:p-12 text-center"
        >
          <div className="relative z-10 space-y-5 max-w-3xl mx-auto">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1 bg-blue-600/10 text-blue-700 border border-blue-600/25 text-[11px] font-semibold rounded-full uppercase tracking-widest">
              🧑‍⚕️ {t("team.badge")}
            </span>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-light tracking-tight text-slate-900 leading-tight uppercase">
              {t("team.title")}
            </h1>
            <p className="text-slate-600 text-sm md:text-base leading-relaxed">
              {t("team.desc")}
            </p>
          </div>
        </section>

        {/* NHÂN SỰ BELWEE — 2 thẻ mỗi hàng trên mobile.
            grid-cols-2 from 360px up: the old grid-cols-1 gave a single card the
            full 360px width, which made one portrait ~340px tall — the visitor
            swiped through four full-screen cards to reach the CTA. */}
        <section data-reveal="fade-up" aria-label="Nhân sự Belwee" className="space-y-6">
          <div
            data-reveal-group
            className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4 lg:gap-6"
          >
            {STAFF_PROFILES.map((member) => (
              /*
                GĐ9 · (g) — thẻ nhân viên dẫn tới trang chi tiết của họ.
                Dùng `<Link>` thật, không phải `<article>` + onClick: giữ được
                prefetch, mở tab mới, chuột phải → sao chép địa chỉ, và bàn phím
                đã có sẵn mà không phải viết thêm handler. Nhóm chuyên gia tư vấn
                bên dưới vốn đã là link như vậy — giờ hai nhóm giống nhau.
              */
              <Link
                key={member.id}
                href={`/doi-ngu/${member.id}`}
                aria-label={staffDisplayName(member)}
                className="doctor-card group rounded-[20px] p-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 sm:rounded-[24px] sm:p-4"
              >
                <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[14px] bg-slate-100 shadow-inner sm:rounded-[16px]">
                  {member.image ? (
                    <Image
                      src={member.image}
                      alt={member.name}
                      fill
                      sizes="(min-width: 1024px) 260px, (min-width: 640px) 45vw, 45vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                      loading="lazy"
                    />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="flex h-full w-full items-center justify-center bg-gradient-to-br from-emerald-100 to-sky-100 text-4xl"
                    >
                      {member.emoji}
                    </span>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                </div>
                <div className="mt-2.5 px-0.5 pb-1 sm:mt-3">
                  <h3 className="text-[13px] font-semibold leading-tight text-slate-900 transition-colors duration-300 group-hover:text-emerald-700 sm:text-[15px]">
                    {staffDisplayName(member)}
                  </h3>
                  <p className="mt-1 text-[10px] font-semibold leading-snug text-emerald-600 sm:text-[11px]">
                    {member.title}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* CHUYÊN GIA TƯ VẤN — the advisory roster with full bio pages. */}
        <section data-reveal="fade-up" aria-label={t("team.title")} className="space-y-6">
          <h2 className="text-center text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">
            {t("team.title")}
          </h2>
          <div
            data-reveal-group
            className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-3 sm:gap-5 lg:gap-6"
          >
            {teamDoctors.map((vet) => (
              <Link
                key={vet.slug}
                href={doctorHref(vet.slug)}
                aria-label={`${t("team.viewProfile")} ${doctorFullName(vet)}`}
                className="doctor-card group rounded-[20px] p-2.5 sm:rounded-[24px] sm:p-4"
              >
                <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[14px] bg-slate-100 shadow-inner sm:rounded-[16px]">
                  <Image
                    src={vet.image}
                    alt={doctorFullName(vet)}
                    fill
                    sizes="(min-width: 1024px) 320px, (min-width: 640px) 45vw, 45vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                </div>
                <div className="mt-2.5 px-0.5 pb-1 sm:mt-3 sm:px-0.5 sm:pb-1">
                  <h3 className="text-[13px] font-semibold leading-tight text-slate-900 transition-colors duration-300 group-hover:text-emerald-700 sm:text-[15px]">
                    {doctorFullName(vet)}
                  </h3>
                  <p className="mt-0.5 text-[10px] font-semibold leading-snug text-emerald-600 sm:text-[11px]">
                    {t(vet.specKey)}
                  </p>
                  <div className="mt-2 hidden items-center justify-between gap-2 sm:flex">
                    <span className="rounded-full bg-emerald-50/80 border border-emerald-100/80 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
                      {t(vet.tagKey)}
                    </span>
                    <span className="text-emerald-600 transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true">→</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section
          data-reveal="fade-up"
          className="liquid-glass-card rounded-[2.5rem] p-8 md:p-12 text-center"
        >
          <div className="relative z-10 max-w-2xl mx-auto space-y-5">
            <h2 className="text-xl md:text-2xl font-normal text-slate-900 tracking-wide uppercase">
              Đặt lịch khám với đội ngũ bác sĩ Belwee
            </h2>
            <p className="text-slate-600 text-sm md:text-base leading-relaxed">
              Trải nghiệm dịch vụ chăm sóc thú y chuyên nghiệp từ đội ngũ bác sĩ giàu
              kinh nghiệm của Belwee.
            </p>
            <div className="pt-2">
              <button
                onClick={() => navigate("/booking/kham-benh")}
                className="liquid-glass-navbar text-xs font-semibold uppercase tracking-widest px-8 py-4 rounded-full text-white border border-white/10 hover:brightness-110 hover:-translate-y-0.5 active:scale-[0.98] transition-all"
              >
                📅 Đặt Lịch Khám Ngay
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}