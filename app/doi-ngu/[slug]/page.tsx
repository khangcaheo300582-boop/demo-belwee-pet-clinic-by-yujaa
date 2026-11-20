"use client";

import { useEffect, useMemo } from "react";
import Image from "next/image";
import { useParams } from "next/navigation";
import { findDoctorBySlug, doctorFullName, teamDoctors } from "@/lib/teamData";
import { STAFF_PROFILES, staffDisplayName } from "@/lib/staffProfiles";
import DoctorLanyardBadge from "@/components/DoctorLanyardBadge";
import { useLanguage } from "@/components/LanguageProvider";
import { useTransitionNavigate } from "@/hooks/useTransitionNavigate";

export default function DoctorDetailPage() {
  const params = useParams<{ slug: string }>();
  const navigate = useTransitionNavigate();
  const { lang, t } = useLanguage();

  /*
   * GĐ9 · (g) — trang này phục vụ HAI danh sách, không chỉ một.
   *
   * `/doi-ngu` hiển thị hai nhóm khác nhau:
   *   • 6 "chuyên gia tư vấn" từ `lib/teamData` — bio nhiều đoạn + danh sách
   *     chuyên môn, slug kiểu `ten-bac-si`.
   *   • 4 nhân viên từ `lib/staffProfiles` — bio MỘT đoạn, id kiểu
   *     `phan-thi-tu`.
   *
   * Trước GĐ9 trang chỉ tra `teamData`, nên bấm vào thẻ nhân viên hoặc gõ
   * `/doi-ngu/phan-thi-tu` đều ra "không tìm thấy".
   *
   * Nhân viên KHÔNG có `highlights` ⇒ khối "chuyên môn nổi bật" bị ẩN thay
   * vì render một danh sách rỗng. Thêm mục vào đây thì tự hiện.
   */
  const slug = params?.slug ?? "";
  const staff = slug ? STAFF_PROFILES.find((s) => s.id === slug) : undefined;
  const doctor = !staff && slug ? findDoctorBySlug(slug) : undefined;

  const person = useMemo<{
    name: string;
    specialty: string;
    image: string;
    emoji: string;
    bio: readonly string[];
    highlights: readonly string[];
    badgeIndex: number;
    seed: string;
  } | null>(() => {
    if (staff) {
      return {
        name: staffDisplayName(staff),
        specialty: lang === "vi" ? staff.title : staff.titleEn,
        image: staff.image,
        emoji: staff.emoji,
        bio: [lang === "vi" ? staff.bioVi : staff.bioEn],
        highlights: [],
        badgeIndex: 0,
        seed: staff.id,
      };
    }
    if (!doctor) return null;
    return {
      name: doctorFullName(doctor),
      specialty: t(doctor.specKey),
      image: doctor.image,
      emoji: "🧑‍⚕️",
      bio: lang === "vi" ? doctor.bioVi : doctor.bioEn,
      highlights: lang === "vi" ? doctor.highlightsVi : doctor.highlightsEn,
      badgeIndex: teamDoctors.findIndex((item) => item.slug === doctor.slug) + 1,
      seed: doctor.slug,
    };
  }, [staff, doctor, lang, t]);

  useEffect(() => {
    document.title = person
      ? `${person.name} | Belwee Pet Clinic`
      : `${t("team.notFound")} | Belwee Pet Clinic`;
  }, [person, t]);

  // GĐ9 · (g) — `bio` / `highlights` / `badgeIndex` đã nằm trong `person`.

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
      <div className="fixed inset-0 bg-gradient-to-b from-white/70 via-white/80 to-white/90 backdrop-blur-[2px] pointer-events-none z-0" />
      <div className="fixed inset-x-0 top-0 h-64 bg-gradient-to-b from-[#f4f8ff] via-[#f4f8ff]/40 to-transparent pointer-events-none z-[1]" />
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
            <li>
              <button onClick={() => navigate("/doi-ngu")} className="hover:text-blue-600 transition-colors">{t("nav.team")}</button>
            </li>
            <li aria-hidden="true" className="text-slate-400">/</li>
            <li className="text-blue-700 font-medium" aria-current="page">
              {person ? person.name : t("team.notFound")}
            </li>
          </ol>
        </nav>

        {!person ? (
          <section
            data-reveal="fade-up"
            className="liquid-glass-card rounded-[2.5rem] p-8 md:p-12 text-center"
          >
            <div className="relative z-10 max-w-xl mx-auto space-y-5">
              <span className="text-5xl" aria-hidden="true">🧑‍⚕️</span>
              <h1 className="text-2xl md:text-3xl font-light tracking-tight text-slate-900">{t("team.notFound")}</h1>
              <p className="text-slate-600 text-sm md:text-base leading-relaxed">{t("team.notFoundDesc")}</p>
              <div className="pt-2">
                <button
                  onClick={() => navigate("/doi-ngu")}
                  className="liquid-glass-navbar text-xs font-semibold uppercase tracking-widest px-8 py-4 rounded-full text-white border border-white/10 hover:brightness-110 hover:-translate-y-0.5 active:scale-[0.98] transition-all"
                >
                  ← {t("team.backToList")}
                </button>
              </div>
            </div>
          </section>
        ) : (
          <>
            {/* HERO — ảnh vuông bo góc lớn + thông tin */}
            <section
              data-reveal="fade-up"
              className="liquid-glass-card lens-glow rounded-[2.5rem] p-6 sm:p-10"
            >
              <div className="relative z-10 grid gap-8 md:grid-cols-[300px_1fr] md:items-start">
                <div className="relative mx-auto w-full max-w-[300px] aspect-square overflow-hidden rounded-[1.75rem] border border-white/80 bg-slate-100 shadow-[0_24px_50px_-20px_rgba(30,64,175,0.35)]">
                  <Image
                    src={person.image}
                    alt={person.name}
                    fill
                    sizes="300px"
                    priority
                    className="object-cover"
                  />
                </div>

                <div className="space-y-4">
                  <span className="inline-flex items-center gap-1.5 px-3.5 py-1 bg-blue-600/10 text-blue-700 border border-blue-600/25 text-[11px] font-semibold rounded-full uppercase tracking-widest">
                    🧑‍⚕️ {t("team.badge")}
                  </span>
                  <h1 className="text-2xl sm:text-3xl md:text-4xl font-light tracking-tight text-slate-900 leading-tight">
                    {person.name}
                  </h1>
                  <p className="text-sm sm:text-base font-medium text-blue-700">{person.specialty}</p>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <span className="inline-block rounded-full bg-emerald-600/10 border border-emerald-600/25 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-800">
                      {person.emoji}
                    </span>
                  </div>

                  <p className="max-w-2xl text-sm text-slate-600 leading-relaxed">
                    {person.bio[0]}
                  </p>

                  <div className="flex flex-wrap gap-3 pt-2">
                    <button
                      onClick={() => navigate("/booking/kham-benh")}
                      className="liquid-glass-navbar text-xs font-semibold uppercase tracking-widest px-7 py-3.5 rounded-full text-white border border-white/10 hover:brightness-110 hover:-translate-y-0.5 active:scale-[0.98] transition-all"
                    >
                      📅 {t("team.bookAppointment")}
                    </button>
                    <button
                      onClick={() => navigate("/doi-ngu")}
                      className="rounded-full border border-slate-300 bg-white/70 text-xs font-semibold uppercase tracking-widest px-7 py-3.5 text-slate-700 backdrop-blur-md hover:border-blue-300 hover:text-blue-700 hover:-translate-y-0.5 active:scale-[0.98] transition-all"
                    >
                      ← {t("team.backToList")}
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* THẺ TREO 3D */}
            <DoctorLanyardBadge
              name={person.name}
              specialty={person.specialty}
              index={person.badgeIndex}
              seed={person.seed}
            />

            {/* GIỚI THIỆU */}
            <section
              data-reveal="fade-up"
              className="liquid-glass-card lens-glow rounded-[2.5rem] p-8 md:p-12"
            >
              <div className="relative z-10 max-w-3xl">
                <h2 className="text-2xl font-normal tracking-wide text-slate-900 uppercase">
                  {t("team.about")}
                </h2>
                <div className="mt-5 space-y-4">
                  {person.bio.map((paragraph, index) => (
                    <p key={index} className="text-sm md:text-base leading-relaxed text-slate-600">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </div>
            </section>

            {/* CHUYÊN MÔN NỔI BẬT — chỉ có ở chuyên gia tư vấn. Nhân viên
                không có danh sách này; render ra sẽ là một khối rỗng. */}
            {person.highlights.length > 0 && (
            <section
              data-reveal="fade-up"
              className="liquid-glass-card rounded-[2.5rem] p-8 md:p-12"
            >
              <div className="relative z-10">
                <h2 className="text-2xl font-normal tracking-wide text-slate-900 uppercase">
                  {t("team.credentials")}
                </h2>
                <ul className="mt-6 grid gap-3 sm:grid-cols-2" data-reveal-group>
                  {person.highlights.map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-3 rounded-2xl border border-blue-200/70 bg-blue-50/80 px-4 py-3.5 text-sm font-medium text-slate-700"
                    >
                      <span aria-hidden="true" className="mt-0.5 text-blue-600">✦</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
            )}

            {/* CTA */}
            <section
              data-reveal="fade-up"
              className="liquid-glass-card rounded-[2.5rem] p-8 md:p-12 text-center"
            >
              <div className="relative z-10 max-w-2xl mx-auto space-y-5">
                <h2 className="text-xl md:text-2xl font-normal text-slate-900 tracking-wide uppercase">
                  {t("home.bookingSection")}
                </h2>
                <p className="text-slate-600 text-sm md:text-base leading-relaxed">
                  {t("home.bookingDesc")}
                </p>
                <div className="pt-2">
                  <button
                    onClick={() => navigate("/booking/kham-benh")}
                    className="liquid-glass-navbar text-xs font-semibold uppercase tracking-widest px-8 py-4 rounded-full text-white border border-white/10 hover:brightness-110 hover:-translate-y-0.5 active:scale-[0.98] transition-all"
                  >
                    📅 {t("home.ctaBtn")}
                  </button>
                </div>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}