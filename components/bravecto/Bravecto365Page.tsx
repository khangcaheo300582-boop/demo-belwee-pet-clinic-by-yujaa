"use client";

/**
 * components/bravecto/Bravecto365Page.tsx
 *
 * Toàn bộ nội dung trang phụ "Bravecto 365 — MSD Animal Health x Belwee".
 * Route: /kien-thuc-thu-y/bravecto-365 (xem app/kien-thuc-thu-y/bravecto-365/page.tsx).
 *
 * ── PHÂN CHIA SERVER/CLIENT ─────────────────────────────────────────────────
 * `page.tsx` là server component chỉ để sinh metadata/Open Graph. Toàn bộ phần
 * nhìn thấy nằm ở đây vì có state (video, accordion). Tách như vậy để
 * `generateMetadata` chạy được — client component không export được nó.
 *
 * ── VÌ SAO KHÔNG DÙNG TAILWIND CHO TRANG NÀY ────────────────────────────────
 * Bản thiết kế là một trang chiến dịch nền navy đậm, thẻ kính, cung tròn trang
 * trí và chữ co giãn theo `clamp()`. Viết bằng CSS Module (đã có tiền lệ:
 * components/home/BranchesSection.module.css) giữ toàn bộ "da" của trang trong
 * một file, không thêm ~200 utility class vào JSX và không đụng globals.css
 * (8543 dòng dùng chung cho 30+ route). Class trong module được băm tên nên
 * cũng không thể vô tình đè lên style của trang khác.
 *
 * ── TÁI SỬ DỤNG, KHÔNG VIẾT LẠI ─────────────────────────────────────────────
 *   • Navbar/Footer/widget nổi: do app/layout.tsx lo, trang này không khai lại.
 *   • Reveal khi cuộn: dùng `data-reveal` / `data-reveal-group` của
 *     AnimationProvider (IntersectionObserver + GSAP, tôn trọng reduced motion).
 *   • Điều hướng: `useTransitionNavigate` — cùng cổng chuyển trang với Navbar
 *     (navGate + skeleton), không `window.location`, không reload.
 *   • Font: Nunito của toàn site (next/font, đã có subset tiếng Việt).
 */

import { useEffect, type MouseEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Calendar,
  Check,
  Clock,
  House,
  PawPrint,
  ShieldPlus,
  Stethoscope,
} from "lucide-react";
import styles from "./Bravecto365Page.module.css";
import BravectoIntroVideo from "./BravectoIntroVideo";
import BravectoDoctorVideo from "./BravectoDoctorVideo";
import BravectoFaq from "./BravectoFaq";
import { DaysSeal365, YearBadge } from "./BravectoSeals";
import { useTransitionNavigate } from "@/hooks/useTransitionNavigate";

/**
 * Cùng đích với luồng "Đặt lịch hẹn" của site: `/booking` redirect sẵn về
 * `/booking/kham-benh` (xem app/booking/page.tsx) — đó là form đặt lịch khám &
 * tư vấn thật, không phải trang danh sách dịch vụ.
 */
const BOOKING_HREF = "/booking/kham-benh";
/** "Khám phá vaccine" → mục Dịch vụ (site chưa có trang riêng cho vaccine). */
const SERVICES_HREF = "/dich-vu";
const ABOUT_HREF = "/gioi-thieu";
const CONTACT_HREF = "/lien-he";

interface FeatureCell {
  icon: typeof Calendar;
  title: string;
  text: string;
}

/** Section 2 — 1 năm bảo vệ (chó). */
const DOG_FEATURES: readonly FeatureCell[] = [
  {
    icon: Calendar,
    title: "Hiệu quả tới 12 tháng",
    text: "Không lo quên lịch: chấm dứt nỗi lo quên cho bé uống thuốc hay nhai viên hàng tháng.",
  },
  {
    icon: ShieldPlus,
    title: "Phòng ngừa tối ưu",
    text: "Phòng ngừa tối ưu ve, ghẻ, bọ chét và ký sinh trùng gây hại.",
  },
  {
    icon: Stethoscope,
    title: "An toàn & uy tín",
    text: "An toàn & uy tín dưới sự theo dõi sát sao của bác sĩ Belwee.",
  },
];

/** Section 4 — Bravecto Plus (mèo). */
const CAT_FEATURES: readonly FeatureCell[] = [
  {
    icon: Calendar,
    title: "Thao tác nhỏ gọn, tiện lợi",
    text: "Giải pháp nhỏ gọn, đơn giản, nhanh chóng, hạn chế tối đa sự căng thẳng hay sợ hãi cho các “boss” mèo trong quá trình thăm khám.",
  },
  {
    icon: ShieldPlus,
    title: "Chuyên sâu phòng bệnh giun tim",
    text: "Hiệu quả vượt trội trong việc tiêu diệt nội ngoại ký sinh trùng, đặc biệt phòng ngừa triệt để bệnh giun tim nguy hiểm ở mèo.",
  },
  {
    icon: Stethoscope,
    title: "Thiết kế chuyên biệt cho loài mèo",
    text: "Công thức và hàm lượng được nghiên cứu riêng biệt, đảm bảo an toàn tuyệt đối cho thể trạng nhạy cảm của mèo cưng.",
  },
];

/** Section 3 — 3 thẻ chăm sóc chủ động. */
const CARE_CARDS: readonly FeatureCell[] = [
  {
    icon: ShieldPlus,
    title: "Quan tâm đến nguy cơ ký sinh trùng",
    text: "Tìm hiểu chương trình bảo vệ trước ve, ghẻ và bọ chét cùng bác sĩ thú y, dựa trên nhu cầu và tình trạng riêng của từng bé.",
  },
  {
    icon: Clock,
    title: "Lịch chăm sóc dễ theo dõi",
    text: "Được hướng dẫn về lịch hẹn, các mốc theo dõi và lưu ý chăm sóc để chủ nuôi thuận tiện đồng hành cùng thú cưng.",
  },
  {
    icon: House,
    title: "Đồng hành tại bệnh viện Belwee",
    text: "Đội ngũ Belwee hỗ trợ giải đáp thắc mắc, thăm khám và tư vấn phương án phù hợp với từng giai đoạn phát triển của bé.",
  },
];

/** Section 5 — checklist 2×2. */
const PROGRAM_CHECKS: readonly string[] = [
  "Tư vấn trước khi sử dụng",
  "Kiểm tra tình trạng sức khỏe",
  "Hướng dẫn theo dõi sau thăm khám",
  "Nhắc lịch chăm sóc phù hợp",
];

function FeatureRow({ items }: { items: readonly FeatureCell[] }) {
  return (
    <div className={styles.glassRow} data-reveal-group>
      {items.map(({ icon: Icon, title, text }) => (
        <div className={styles.cell} key={title}>
          <span className={styles.cellIcon} aria-hidden="true">
            <Icon size={22} strokeWidth={2.2} />
          </span>
          <h3 className={styles.cellTitle}>{title}</h3>
          <p className={styles.cellText}>{text}</p>
        </div>
      ))}
    </div>
  );
}

export default function Bravecto365Page() {
  const navigate = useTransitionNavigate();

  /** Mỗi lần VÀO trang (không phải back) thì về đầu trang — yêu cầu mục 2. */
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash) return;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, []);

  const go = (href: string) => (event: MouseEvent<HTMLAnchorElement>) => {
    // Giữ <a> thật cho SEO/chuột giữa/chuột phải, nhưng điều hướng phía client
    // để giữ trạng thái "đã tương tác" cho video intro (mục 2 + mục 6).
    event.preventDefault();
    navigate(href);
  };

  return (
    <div className={styles.page}>
      {/* ══ SECTION 0 — VIDEO INTRO ══════════════════════════════════════════ */}
      <BravectoIntroVideo />

      {/* ══ SECTION 1 — HERO ═════════════════════════════════════════════════ */}
      <section className={styles.hero} aria-labelledby="bravecto-hero-title">
        <span className={`${styles.arc} ${styles.arcTopRight}`} aria-hidden="true" />
        <span className={`${styles.arc} ${styles.arcBottomLeft}`} aria-hidden="true" />

        <div className={`${styles.container} ${styles.heroGrid}`}>
          <div className={styles.heroCopy}>
            <h1 id="bravecto-hero-title" className={styles.h1} data-reveal="fade-up">
              Bảo vệ chó yêu
              <br />
              trọn vẹn <span className={styles.accentCyan}>365 ngày.</span>
            </h1>

            <p className={styles.heroLead} data-reveal="fade-up" data-delay="0.08">
              Chủ động bảo vệ sức khỏe thú cưng với chương trình Bravecto 365 tại Belwee. Một
              hành trình chăm sóc được tư vấn và theo dõi bởi đội ngũ bác sĩ thú y.
            </p>

            <div className={styles.brandCard} data-reveal="fade-up" data-delay="0.14">
              <Image
                src="/bravecto365-logo.png"
                alt="Bravecto 365 — Giải pháp bảo vệ cho bé cưng của bạn"
                width={165}
                height={70}
                priority
                style={{ display: "block" }}
              />
              <span className={styles.brandDivider} aria-hidden="true" />
              <p className={styles.brandClaim}>
                Giải pháp bảo vệ
                <br />
                cho bé cưng của bạn
              </p>
            </div>

            <div className={styles.heroActions} data-reveal="fade-up" data-delay="0.2">
              <Link href={BOOKING_HREF} onClick={go(BOOKING_HREF)} className={styles.btnPrimary}>
                Đăng ký tư vấn
              </Link>
              <Link href={SERVICES_HREF} onClick={go(SERVICES_HREF)} className={styles.btnGhost}>
                Khám phá vaccine
                <ArrowRight size={16} strokeWidth={2.4} aria-hidden="true" />
              </Link>
            </div>

            <p className={styles.heroNote}>
              *Thông tin về sản phẩm và phạm vi bảo vệ cần được cá nhân hóa theo chỉ định, tình
              trạng sức khỏe của bé và tư vấn trực tiếp từ bác sĩ thú y.
            </p>
          </div>

          <div className={styles.heroArt}>
            <DaysSeal365 className={styles.seal365} />
            <Image
              src="/anh-cun-a.png"
              alt="Ba chú chó vui vẻ xếp chồng nhau và cùng giữ một khúc xương"
              width={308}
              height={540}
              priority
              sizes="(min-width: 1024px) 420px, 70vw"
              className={styles.dogA}
            />
            <YearBadge className={styles.medal} />
          </div>
        </div>
      </section>

      {/* ══ SECTION 2 — 1 NĂM BẢO VỆ ═════════════════════════════════════════ */}
      <section className={styles.section} aria-labelledby="bravecto-year-title">
        <span className={`${styles.arc} ${styles.arcRight}`} aria-hidden="true" />

        <div className={`${styles.container} ${styles.twoCol}`}>
          <div>
            <h2 id="bravecto-year-title" className={styles.h2Upper} data-reveal="fade-up">
              <span className={styles.accentCyan}>1 năm</span> bảo vệ cho bé về bọ chét, ve, giun
              với <span className={styles.accentCyan}>1 lần</span> tiêm duy nhất
            </h2>

            <FeatureRow items={DOG_FEATURES} />

            <figure className={styles.quote} data-reveal="fade-up">
              <Image
                src="/anh-cun-b.png"
                alt="Chú chó nằm ngửa thư giãn trên nền trong suốt"
                width={282}
                height={200}
                loading="lazy"
                decoding="async"
                className={styles.quoteImg}
              />
              <blockquote className={styles.quoteText}>
                “Trao gửi sự quan tâm đến bé yêu bằng giải pháp Bravecto giúp các bé luôn vui tươi
                mỗi ngày, loại bỏ hoàn toàn nguy cơ nhiễm ve, bọ chét, giun sán…”
              </blockquote>
            </figure>
          </div>

          <div className={styles.mediaCol}>
            <BravectoDoctorVideo
              poster="/chuc-nang-bravecto-poster.jpg"
              h264Src="/chuc-nang-bravecto-h264.mp4"
              hevcSrc="/chuc-nang-bravecto.mp4"
              label="Bác sĩ nam Belwee tư vấn chức năng bảo vệ của Bravecto 365"
            />
          </div>
        </div>
      </section>

      {/* ══ SECTION 3 — CHĂM SÓC CHỦ ĐỘNG ════════════════════════════════════ */}
      <section className={styles.section} aria-labelledby="bravecto-care-title">
        <span className={`${styles.arc} ${styles.arcLeft}`} aria-hidden="true" />

        <div className={styles.container}>
          <div className={styles.centerHead}>
            <PawPrint className={styles.pawDeco} size={54} aria-hidden="true" />
            <span className={styles.eyebrowPill} data-reveal="fade-up">
              Vì sức khỏe của bé
            </span>
            <h2 id="bravecto-care-title" className={styles.h2Center} data-reveal="fade-up">
              Chăm sóc chủ động.
              <br />
              <span className={styles.accentCyan}>An tâm mỗi ngày.</span>
            </h2>
          </div>

          <div className={styles.careGrid} data-reveal-group>
            {CARE_CARDS.map(({ icon: Icon, title, text }) => (
              <article className={styles.careCard} key={title}>
                <span className={styles.careIcon} aria-hidden="true">
                  <Icon size={24} strokeWidth={2.2} />
                </span>
                <h3 className={styles.careTitle}>{title}</h3>
                <p className={styles.careText}>{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ══ SECTION 4 — BRAVECTO PLUS CHO MÈO ════════════════════════════════ */}
      <section className={styles.section} aria-labelledby="bravecto-cat-title">
        <span className={`${styles.arc} ${styles.arcBottomRight}`} aria-hidden="true" />

        <div className={`${styles.container} ${styles.howGrid}`}>
          {/* Thứ tự DOM: chữ TRƯỚC, video SAU ⇒ mobile đúng yêu cầu
              ("heading trước, video sau") mà không cần đổi DOM bằng JS. */}
          <div className={`${styles.howText} ${styles.alignEnd}`}>
            <h2 id="bravecto-cat-title" className={styles.h2Upper} data-reveal="fade-up">
              Bảo vệ mèo yêu toàn diện với <span className={styles.accentCyan}>Bravecto Plus</span>
            </h2>

            <FeatureRow items={CAT_FEATURES} />

            <figure className={`${styles.quote} ${styles.quoteImageEnd}`} data-reveal="fade-up">
              <blockquote className={styles.quoteText}>
                “Đồng hành cùng bé yêu trên mỗi chặng đường bằng giải pháp Bravecto giúp các bé
                luôn thoải mái vận động, đẩy lùi hoàn toàn ve, bọ chét và ký sinh trùng…”
              </blockquote>
              <Image
                src="/anh-cun-c.png"
                alt="Chú chó shiba đang ngáp, vươn vai thoải mái"
                width={271}
                height={154}
                loading="lazy"
                decoding="async"
                className={styles.quoteImg}
              />
            </figure>
          </div>

          <div className={styles.howMedia}>
            <BravectoDoctorVideo
              poster="/hieu-qua-bravecto-poster.jpg"
              h264Src="/hieu-qua-bravecto-h264.mp4"
              hevcSrc="/hieu-qua-bravecto.mp4"
              label="Bác sĩ nữ Belwee tư vấn hiệu quả của Bravecto dành cho mèo"
            />
          </div>
        </div>
      </section>

      {/* ══ SECTION 5 — MỘT CHƯƠNG TRÌNH ═════════════════════════════════════ */}
      <section className={styles.section} aria-labelledby="bravecto-program-title">
        <div className={`${styles.container} ${styles.programGrid}`}>
          <div className={styles.programCard} data-reveal="fade-up">
            <YearBadge className={styles.programBadge} />
          </div>

          <div>
            <h2 id="bravecto-program-title" className={styles.h2Center} data-reveal="fade-up">
              Một chương trình.
              <br />
              Một năm <span className={styles.accentCyan}>quan tâm đúng cách</span>
            </h2>

            <p className={styles.lead} data-reveal="fade-up">
              Bravecto 365 được giới thiệu trong chương trình chăm sóc tại Belwee với thông điệp bảo
              vệ chó khỏi ve, ghẻ, bọ chét với một mũi tiêm duy nhất. Bác sĩ sẽ thăm khám và tư vấn
              để xác định sản phẩm có phù hợp với bé hay không.
            </p>

            <ul className={styles.checklist} data-reveal-group>
              {PROGRAM_CHECKS.map((label) => (
                <li className={styles.checkItem} key={label}>
                  <span className={styles.checkIcon} aria-hidden="true">
                    <Check size={14} strokeWidth={3} />
                  </span>
                  <span>{label}</span>
                </li>
              ))}
            </ul>

            <Link
              href={ABOUT_HREF}
              onClick={go(ABOUT_HREF)}
              className={`${styles.btnPrimary} ${styles.programCta}`}
              data-reveal="fade-up"
            >
              Tìm hiểu tại Belwee
            </Link>
          </div>
        </div>
      </section>

      {/* ══ SECTION 6 — FAQ ══════════════════════════════════════════════════ */}
      <section className={`${styles.section} ${styles.faqSection}`} aria-labelledby="bravecto-faq-title">
        <div className={`${styles.container} ${styles.faqGrid}`}>
          <div className={styles.faqIntro}>
            <p className={styles.faqLabel} data-reveal="fade-up">
              Bạn muốn biết thêm?
            </p>
            <h2 id="bravecto-faq-title" className={styles.faqTitle} data-reveal="fade-up">
              Câu hỏi thường gặp.
            </h2>
            <p className={styles.faqDesc} data-reveal="fade-up">
              Một số thông tin giúp bạn chuẩn bị trước khi trao đổi cùng đội ngũ bác sĩ Belwee.
            </p>
            <Link href={CONTACT_HREF} onClick={go(CONTACT_HREF)} className={styles.contactPill}>
              Liên hệ Belwee
              <span aria-hidden="true">/</span>
            </Link>
          </div>

          <BravectoFaq />
        </div>
      </section>
    </div>
  );
}
