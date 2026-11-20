"use client";

/**
 * components/Footer.tsx
 *
 * Footer dùng chung cho toàn site — MỘT nơi duy nhất (app/layout.tsx).
 *
 * Bố cục (desktop ≥1280px):
 *   Hàng 1 — 4 cột: Thương hiệu | Liên kết nhanh | Dịch vụ chuyên khoa |
 *             Card Thông tin liên hệ (kẻ dọc mảnh giữa cột 1–2 và 2–3)
 *   Hàng 2 — "CÁC CHI NHÁNH BELWEE": 4 thẻ kính nằm ngang, bề rộng không đều
 *   Hàng 3 — Thanh dưới: © bản quyền · đổi ngôn ngữ · slogan chữ viết tay
 *
 * Nguồn dữ liệu: `lib/clinics.ts` (BRANCHES, SPECIALTY_SERVICES, SOCIAL_LINKS).
 * Mọi liên kết đều là URL thật; mục chưa có URL sẽ bị BỎ QUA chứ không render
 * `href="#"`.
 *
 * Nền navy full-width nối liền mạch với trang: wave SVG chôn -1px vào mép trên
 * để không hở khe; trang ngắn vẫn chạm đáy viewport nhờ sticky footer
 * (app/layout.tsx: min-h-dvh + main flex-1).
 */

import React, { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useLanguage } from "@/components/LanguageProvider";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { SocialIcon, resolvableSocials } from "@/components/SocialIcons";
import { prefersReducedMotion } from "@/lib/motion";
import { usePageReady } from "@/hooks/usePageReady";
import {
  BRANCHES,
  SPECIALTY_SERVICES,
  SOCIAL_LINKS,
  HOTLINE,
  HOTLINE_DISPLAY,
  HOTLINE_ZALO,
  CONTACT_EMAIL,
  branchPhone,
  mapsSearchUrl,
  mapsDirectionsUrl,
} from "@/lib/clinics";

/* ─── Icon nội tuyến (giữ nguyên quy ước file này: không thêm thư viện icon) ── */

function PinIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 21s-7-5.5-7-11a7 7 0 1 1 14 0c0 5.5-7 11-7 11z" />
      <circle cx="12" cy="10" r="2.6" />
    </svg>
  );
}

function PhoneIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 3.07 9.8a19.79 19.79 0 0 1-3.07-8.7A2 2 0 0 1 2 .96h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L6.09 8.74a16 16 0 0 0 6.17 6.17l1.14-1.14a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function MailIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="m4 7 8 6 8-6" />
    </svg>
  );
}

function ClockIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.2 1.8" />
    </svg>
  );
}

function SirenIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M7 18v-6a5 5 0 0 1 10 0v6" />
      <rect x="4" y="18" width="16" height="3" rx="1.5" />
      <path d="M12 2v2M4.5 5.5 6 7M19.5 5.5 18 7" />
    </svg>
  );
}

function CompassIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2 5-5 2 2-5 5-2z" />
    </svg>
  );
}

function HeartIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 21s-7.5-4.9-9.6-9.2C.9 8.4 2.7 4.8 6 4.2c2.2-.4 4.3.7 5.4 2.6l.6 1 .6-1c1.1-1.9 3.2-3 5.4-2.6 3.3.6 5.1 4.2 3.6 7.6C19.5 16.1 12 21 12 21z" />
    </svg>
  );
}

/** Dấu chân mèo — dùng cho tiêu đề cột 2, khối kính bên trái và thanh cuối. */
function PawIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <ellipse cx="7.4" cy="7.2" rx="2.1" ry="2.7" transform="rotate(-16 7.4 7.2)" />
      <ellipse cx="12" cy="5.7" rx="2.1" ry="2.8" />
      <ellipse cx="16.6" cy="7.2" rx="2.1" ry="2.7" transform="rotate(16 16.6 7.2)" />
      <ellipse cx="4.4" cy="12.4" rx="1.9" ry="2.4" transform="rotate(-26 4.4 12.4)" />
      <ellipse cx="19.6" cy="12.4" rx="1.9" ry="2.4" transform="rotate(26 19.6 12.4)" />
      <path d="M12 11.4c3.5 0 6.3 2.9 6.3 6.1 0 2.4-2 3.9-4.2 3.9-1.2 0-1.5-.5-2.1-.5s-.9.5-2.1.5c-2.2 0-4.2-1.5-4.2-3.9 0-3.2 2.8-6.1 6.3-6.1z" />
    </svg>
  );
}

function ArrowIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M2.5 8h11M9.5 4l4 4-4 4" />
    </svg>
  );
}

/* ─── Component ───────────────────────────────────────────────────────────── */

export default function Footer() {
  const pathname = usePathname();
  const hidePaths = ['/dang-nhap', '/trang-ca-nhan', '/booking/cham-soc-khach-hang'];

  const footerRef = useRef<HTMLElement>(null);
  const pageReady = usePageReady();
  const { lang, t } = useLanguage();

  const socials = resolvableSocials(SOCIAL_LINKS);

  /**
   * Reveal khi footer vào viewport — IntersectionObserver, KHÔNG dùng scroll
   * event. Stagger 70ms theo `--i` bằng transition-delay, chỉ chạy một lần
   * (`unobserve` ngay khi hiện). Chỉ `transform` + `opacity`.
   *
   * Khi reduced-motion: KHÔNG gắn `will-reveal` → nội dung hiện sẵn ngay, không
   * phụ thuộc JS để nhìn thấy chữ (an toàn nội dung, không chỉ là hiệu ứng).
   */
  useEffect(() => {
    const root = footerRef.current;
    if (!root || !pageReady) return;
    if (prefersReducedMotion()) return;

    const targets = Array.from(
      root.querySelectorAll<HTMLElement>("[data-footer-reveal]")
    );
    if (!targets.length) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          (entry.target as HTMLElement).classList.add("is-revealed");
          io.unobserve(entry.target);
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );

    targets.forEach((el) => {
      el.classList.add("will-reveal");
      io.observe(el);
    });

    return () => io.disconnect();
  }, [pageReady, lang]);

  if (hidePaths.includes(pathname || '')) return null;

  return (
    <footer ref={footerRef} className="site-footer">
      {/* Nền nay là ảnh `anhnenchantrang.png` đặt bằng CSS (xem `.site-footer`).
          Vì vậy gỡ hai lớp trang trí cũ:
            • FooterWave — mép sóng vẽ bằng màu navy để nối liền nền gradient;
              trên nền ảnh thì nó là một dải navy lơ lửng, lệch màu rõ rệt.
            • FooterGlassPaw — khối kính "trái tim chân mèo" được hoà vào nền
              navy; trên ảnh nó thành vệt sáng không có chủ đích.
          Cả hai chỉ tồn tại để giấu mối nối màu của nền cũ. */}
      <div className="footer-shell">
        {/* ══ HÀNG 1 — 4 cột ══════════════════════════════════════════════ */}
        <div className="footer-row1">
          {/* ── Cột 1: Thương hiệu ── */}
          <div className="footer-col footer-col-brand" data-footer-reveal style={{ ["--i" as string]: 0 }}>
            <Link href="/" className="footer-brand" aria-label="Belwee Pet Clinic">
              <Image
                src="/logo-belwee.png"
                alt="Logo Belwee Pet Clinic"
                width={160}
                height={53}
                className="footer-brand-img"
              />
            </Link>

            <p className="footer-desc">{t("footer.desc")}</p>

            <a href={`tel:${HOTLINE}`} className="footer-emergency">
              <span className="footer-emergency-ring" aria-hidden="true" />
              <SirenIcon className="footer-emergency-icon" />
              <span className="footer-emergency-label">{t("footer.emergency247")}</span>
            </a>

            {socials.length > 0 && (
              <ul className="footer-socials" role="list">
                {socials.map((s) => (
                  <li key={s.icon}>
                    <a
                      href={s.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={s.label}
                      title={s.label}
                      className="footer-social-btn"
                    >
                      <SocialIcon name={s.icon} />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <span className="footer-col-rule" aria-hidden="true" />

          {/* ── Cột 2: Liên kết nhanh ── */}
          <nav className="footer-col footer-col-links" aria-labelledby="footer-h-links" data-footer-reveal style={{ ["--i" as string]: 1 }}>
            <h2 id="footer-h-links" className="footer-heading">
              <PawIcon className="footer-heading-icon" />
              {t("footer.quickLinks")}
            </h2>
            <ul className="footer-links" role="list">
              {(
                [
                  { href: "/", labelKey: "nav.home" },
                  { href: "/gioi-thieu", labelKey: "nav.about" },
                  { href: "/dich-vu", labelKey: "nav.services" },
                  { href: "/doi-ngu", labelKey: "nav.team" },
                  { href: "/tien-ich", labelKey: "tools.label" },
                  { href: "/kien-thuc-thu-y", labelKey: "nav.petKnowledge" },
                  { href: "/tuyen-dung", labelKey: "nav.careers" },
                  { href: "/lien-he", labelKey: "nav.contact" },
                ] as const
              ).map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="footer-link">
                    <span className="footer-link-text">{t(l.labelKey)}</span>
                    <ArrowIcon className="footer-link-arrow" />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <span className="footer-col-rule" aria-hidden="true" />

          {/* ── Cột 3: Dịch vụ chuyên khoa ── */}
          <nav className="footer-col footer-col-services" aria-labelledby="footer-h-services" data-footer-reveal style={{ ["--i" as string]: 2 }}>
            <h2 id="footer-h-services" className="footer-heading">
              <HeartIcon className="footer-heading-icon" />
              {t("footer.services")}
            </h2>
            <ul className="footer-links" role="list">
              {SPECIALTY_SERVICES.map((s) => (
                <li key={s.labelKey}>
                  <Link href={s.href} className="footer-link">
                    <span className="footer-link-text">{t(s.labelKey)}</span>
                    <ArrowIcon className="footer-link-arrow" />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* ── Cột 4: Card Thông tin liên hệ ── */}
          <div className="footer-col footer-col-contact" data-footer-reveal style={{ ["--i" as string]: 3 }}>
            <div className="footer-contact-card">
              <PawIcon className="footer-contact-watermark" />

              <h2 className="footer-heading footer-heading-incard">
                <PhoneIcon className="footer-heading-icon" />
                {t("footer.contact")}
              </h2>

              <ul className="footer-contact-list" role="list">
                <li className="footer-contact-row">
                  <span className="footer-contact-chip">
                    <PhoneIcon className="footer-contact-chip-icon" />
                  </span>
                  <span className="footer-contact-text">
                    <span className="footer-contact-label">{t("footer.hotline")}</span>
                    <a href={`tel:${HOTLINE}`} className="footer-contact-strong">
                      {HOTLINE_DISPLAY}
                    </a>
                    <span className="footer-contact-sep" aria-hidden="true">-</span>
                    <a
                      href={HOTLINE_ZALO}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="footer-contact-strong"
                    >
                      Zalo
                    </a>
                  </span>
                </li>

                <li className="footer-contact-row">
                  <span className="footer-contact-chip">
                    <MailIcon className="footer-contact-chip-icon" />
                  </span>
                  <a href={`mailto:${CONTACT_EMAIL}`} className="footer-contact-line">
                    {CONTACT_EMAIL}
                  </a>
                </li>

                <li className="footer-contact-row">
                  <span className="footer-contact-chip">
                    <PinIcon className="footer-contact-chip-icon" />
                  </span>
                  <a
                    href={mapsSearchUrl(BRANCHES[3].address)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="footer-contact-line"
                  >
                    {t("footer.address")}
                  </a>
                </li>

                <li className="footer-contact-row">
                  <span className="footer-contact-chip">
                    <ClockIcon className="footer-contact-chip-icon" />
                  </span>
                  <span className="footer-contact-line">24/7</span>
                </li>
              </ul>

              <a href={`tel:${HOTLINE}`} className="footer-cta">
                <span className="footer-cta-shine" aria-hidden="true" />
                <PhoneIcon className="footer-cta-icon" />
                <span className="footer-cta-number">{HOTLINE_DISPLAY}</span>
                <ArrowIcon className="footer-cta-arrow" />
              </a>
            </div>
          </div>
        </div>

        {/* ══ HÀNG 2 — Các chi nhánh ═════════════════════════════════════ */}
        <section className="footer-branches" aria-labelledby="footer-h-branches" data-footer-reveal style={{ ["--i" as string]: 4 }}>
          <h2 id="footer-h-branches" className="footer-branches-title">
            <PinIcon className="footer-branches-title-icon" />
            <span>{t("footer.branches")}</span>
            <span className="footer-branches-title-rule" aria-hidden="true" />
          </h2>

          <ul className="footer-branches-list" role="list">
            {BRANCHES.map((b, i) => {
              const phone = branchPhone(b);
              return (
                <li
                  key={b.id}
                  className="footer-branch-card"
                  style={{ ["--i" as string]: i }}
                >
                  {b.image && (
                    <span className="footer-branch-media" aria-hidden="true">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={b.image} alt="" loading="lazy" decoding="async" />
                    </span>
                  )}

                  <div className="footer-branch-top">
                    <span className="footer-branch-code">{b.code}</span>
                    <span
                      className={`footer-branch-type ${
                        b.type === "hospital" ? "is-hospital" : "is-clinic"
                      }`}
                    >
                      {b.type === "hospital"
                        ? t("footer.typeHospital")
                        : t("footer.typeClinic")}
                    </span>
                  </div>

                  <h3 className="footer-branch-name">
                    <a
                      href={b.mapUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={t(b.fullNameKey)}
                    >
                      {t(b.shortNameKey)}
                    </a>
                  </h3>

                  <address className="footer-branch-addr">
                    <PinIcon className="footer-branch-addr-icon" />
                    <span>{b.address}</span>
                  </address>

                  <div className="footer-branch-actions">
                    <a
                      href={mapsDirectionsUrl(b.address)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="footer-branch-btn is-primary"
                      aria-label={`${t("footer.directions")} — ${t(b.fullNameKey)}`}
                    >
                      <CompassIcon className="footer-branch-btn-icon" />
                      <span>{t("footer.directions")}</span>
                    </a>
                    <a
                      href={`tel:${phone}`}
                      className="footer-branch-btn is-call"
                      aria-label={`${t("footer.callNow")} ${phone === HOTLINE ? HOTLINE_DISPLAY : phone}`}
                    >
                      <PhoneIcon className="footer-branch-btn-icon" />
                      <span>{t("footer.callNow")}</span>
                    </a>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        {/* ══ HÀNG 3 — Thanh dưới cùng ═══════════════════════════════════ */}
        <div className="footer-bottom" data-footer-reveal style={{ ["--i" as string]: 5 }}>
          <p className="footer-copy">
            <PawIcon className="footer-copy-paw" />
            <span>© 2026 Belwee Pet Clinic. {t("footer.rights")}</span>
          </p>

          <div className="footer-bottom-right">
            <LanguageSwitcher className="footer-lang" />

            <p className="footer-slogan">
              {/* Nét cong (swoosh) vẽ bằng stroke-dashoffset khi footer vào viewport */}
              <svg className="footer-slogan-swoosh" viewBox="0 0 120 40" preserveAspectRatio="none" aria-hidden="true">
                <path d="M2 32 C26 10 44 6 66 14 C88 22 102 28 118 20" />
              </svg>
              <HeartIcon className="footer-slogan-heart" />
              <span className="footer-slogan-text">{t("footer.slogan")}</span>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
