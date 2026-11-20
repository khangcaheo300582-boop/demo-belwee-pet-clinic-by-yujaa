"use client";

import { useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { Megaphone } from "lucide-react";
import { motion, useTransform } from "framer-motion";
import { useLanguage } from "@/components/LanguageProvider";
import useScrollProgress from "@/hooks/useScrollProgress";

/**
 * Route xem toàn bộ tin tức — chung cho CTA cuối "Xem thêm các hoạt động của belwee".
 * Trỏ về trang danh sách tin tức của dự án (/kien-thuc-thu-y).
 */
const NEWS_ROUTE = "/kien-thuc-thu-y";

/**
 * Trang chi tiết của tin "Belwee cùng MSD — Bảo vệ pet của bạn".
 *
 * Chỉ thẻ ĐẦU TIÊN đổi đích: nút "Xem toàn bộ tin tức →" trên thẻ đó giờ mở
 * trang phụ Bravecto 365 (nội dung chính là chương trình mà tấm poster nhắc
 * tới). Các thẻ khác và CTA cuối GIỮ NGUYÊN `/kien-thuc-thu-y`.
 *
 * Là `<Link>` của next/link sẵn có ⇒ điều hướng phía client, không reload —
 * nhờ vậy trạng thái "người dùng đã tương tác" còn nguyên khi video intro của
 * trang đích tự phát có tiếng.
 */
const BRAVECTO_ROUTE = "/kien-thuc-thu-y/bravecto-365";

interface NewsItem {
  id: number;
  /** Nhãn dạng IN HOA, ví dụ "THÔNG BÁO". */
  label: string;
  /** Mỗi dòng một dòng tiêu đề (xuống dòng đúng theo mẫu). */
  title: [string, string];
  description: string;
  image: string;
  imageFit: "contain" | "cover";
  bg: string;
  corner: string;
  alt: string;
  href: string;
}

const newsItems: NewsItem[] = [
  {
    id: 1,
    label: "THÔNG BÁO",
    title: ["Belwee cùng MSD", "Bảo Vệ Pet Của Bạn"],
    description: "Cùng vaccine bravecto 365 - DMS thú cưng của bạn được bảo vệ trọn vẹn",
    image: "/belwee-hop-tac-cung-msd.png",
    imageFit: "contain",
    bg: "#FFF9EE",
    corner: "#F3E6CF",
    alt: "Belwee cùng MSD – Bảo Vệ Pet Của Bạn",
    href: BRAVECTO_ROUTE,
  },
  {
    id: 2,
    label: "THÔNG BÁO",
    title: ["Belwee hoạt động", "xuyên lễ Quốc Khánh"],
    description: "Sẵn sàng đón tiếp các bé yêu của bạn đến với belwee trong dịp lễ 2 tháng 9",
    image: "/belwee-hoat-dong-xuyen-le.jpg",
    imageFit: "cover",
    bg: "#E3F1FD",
    corner: "#8DB6DD",
    alt: "Belwee hoạt động xuyên lễ Quốc Khánh – poster chào mừng lễ 2/9",
    href: NEWS_ROUTE,
  },
];

interface BelweeNewsSectionProps {
  /** "light" khi đặt trên nền trắng (trang chủ), "dark" khi nền tối (trang kiến thức). */
  variant?: "light" | "dark";
}

/**
 * Tin tức Belwee — mục "Hoạt động nổi bật tại Belwee" trên trang chủ.
 *
 * Mỗi thẻ là một khối nội dung chữ (trái) + khung ảnh (phải), có họa tiết
 * góc bo tròn đè lên khung ảnh. Dữ liệu tin tức nằm trong `newsItems` để thêm
 * tin sau này chỉ cần bổ sung vào mảng.
 */
export default function BelweeNewsSection({ variant = "light" }: BelweeNewsSectionProps) {
  const { t } = useLanguage();
  const isDark = variant === "dark";

  const sectionRef = useRef<HTMLElement>(null);

  /* ── Nền mờ tối dần theo cuộn (thay cho dải trắng cắt ngang trang) ──────
   * Progress 0→1 chạy từ lúc đỉnh section chạm đáy viewport tới lúc đáy
   * section rời khỏi đỉnh viewport. `overlayOpacity` / màu chữ dùng chung
   * một đường cong: nền tối hiện vào khi cuộn xuống và tan ra khi mục này
   * đi qua, nên KHÔNG có mép cứng ở hai đầu. Mid-flat (0,32–0,68) là vùng
   * đọc: nền tối nhất, chữ sáng nhất.
   *
   * Lớp phủ là rgba navy ở đỉnh ~0.78 (KHÔNG bao giờ đặc 1.0): ảnh nền
   * dịch vụ + gradient kem của trang phía sau vẫn lộ rõ mờ qua lớp này —
   * đúng yêu cầu "nền ở mục phải mờ dần, không bị cắt ngang".
   *
   * Giảm chuyển động: `useScrollProgress` gán thẳng `reducedValue = 0.5` ⇒
   * nền tối nhất + chữ sáng (trạng thái cuối), không gắn listener cuộn. */
  const progress = useScrollProgress(sectionRef, {
    fromAnchor: "start",
    fromVh: 100,
    toAnchor: "bottom",
    toVh: 0,
    reducedValue: 0.5,
  });
  const overlayOpacity = useTransform(
    progress,
    [0.04, 0.32, 0.68, 0.96],
    [0, 0.78, 0.78, 0]
  );
  const headingColor = useTransform(
    progress,
    [0.08, 0.3, 0.7, 0.92],
    ["#4B5563", "#F3F4F6", "#F3F4F6", "#4B5563"]
  );
  const badgeColor = useTransform(
    progress,
    [0.08, 0.3, 0.7, 0.92],
    ["#B7791F", "#FCD34D", "#FCD34D", "#B7791F"]
  );
  const badgeBg = useTransform(
    progress,
    [0.08, 0.3, 0.7, 0.92],
    ["#F7EFD8", "#3F2D13", "#3F2D13", "#F7EFD8"]
  );
  const badgeBorder = useTransform(
    progress,
    [0.08, 0.3, 0.7, 0.92],
    ["#EBDDB8", "#92400E", "#92400E", "#EBDDB8"]
  );

  const sectionClassName = isDark ? "py-16" : "relative overflow-hidden py-16";
  const badgeClassName = isDark
    ? "inline-flex items-center justify-center rounded-full border border-amber-800/60 bg-amber-950/40 px-4 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-amber-300"
    : "inline-flex items-center justify-center rounded-full border border-transparent px-4 py-1 text-[10px] font-semibold uppercase tracking-[0.15em]";
  const headingClassName = isDark
    ? "mt-4 mb-8 text-2xl font-normal text-white"
    : "mt-4 mb-8 text-2xl font-normal";
  // Nền card luôn là màu sáng (lấy từ `newsItems`), kể cả khi section nằm trên
  // nền tối. Vì vậy chữ trong card phải luôn dùng màu tối để đủ tương phản —
  // nếu đổi theo `isDark` sẽ thành chữ trắng trên nền sáng, gần như biến mất.
  const cardLabelClassName = "text-[#5B7FF0]";
  const cardTitleClassName = "text-[#2B2D42]";
  const cardDescClassName = "text-[#6B7280]";
  const cardButtonClassName = "bg-[#0B4DA8] hover:bg-[#083a80]";

  return (
    <section ref={sectionRef} className={sectionClassName}>
      {/* Lớp nền tối mờ dần theo cuộn (chỉ ở bản light). Nằm dưới nội dung
          (content bọc `relative`), không chặn click. */}
      {!isDark && (
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[#0F1B3D]"
          style={{ opacity: overlayOpacity }}
        />
      )}
      <div className="relative mx-auto max-w-[970px] px-4">
        {/* ── Header: badge + tiêu đề ─────────────────────────────── */}
        <div data-reveal="fade-up" className="text-center">
          {isDark ? (
            <span className={badgeClassName}>{t("home.news")}</span>
          ) : (
            <motion.span
              className={badgeClassName}
              style={{
                color: badgeColor,
                backgroundColor: badgeBg,
                borderColor: badgeBorder,
              }}
            >
              {t("home.news")}
            </motion.span>
          )}
          {isDark ? (
            <h2 className={headingClassName}>{t("home.newsTitle")}</h2>
          ) : (
            <motion.h2
              className={headingClassName}
              style={{ color: headingColor }}
            >
              {t("home.newsTitle")}
            </motion.h2>
          )}
        </div>

        {/* ── Lưới 2 card tin tức ─────────────────────────────────── */}
        <div data-reveal-group className="grid grid-cols-1 gap-[21px] md:grid-cols-2">
          {newsItems.map((item) => (
            <article
              key={item.id}
              className="group relative flex h-auto flex-col overflow-hidden rounded-[28px] transition-transform duration-300 hover:-translate-y-1 md:block md:h-[226px]"
              style={{ backgroundColor: item.bg }}
            >
              {/* Nội dung chữ — bên trái */}
              <div className="relative z-10 flex w-full flex-col px-4 pt-5 md:absolute md:left-4 md:top-0 md:bottom-0 md:w-[195px] md:p-0 md:pt-[30px]">
                <span
                  className={`flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.2em] ${cardLabelClassName}`}
                >
                  <Megaphone size={16} color="#E5568A" />
                  {item.label}
                </span>

                <h3 className={`mt-3 text-[19px] font-medium leading-[1.3] ${cardTitleClassName}`}>
                  <span className="block whitespace-normal md:whitespace-nowrap">{item.title[0]}</span>
                  <span className="block whitespace-normal md:whitespace-nowrap">{item.title[1]}</span>
                </h3>

                <p className={`mt-5 w-[175px] text-[12px] leading-[1.6] ${cardDescClassName}`}>{item.description}</p>

                <Link
                  href={item.href}
                  className={`group mt-auto mb-[14px] inline-flex h-[27px] w-fit shrink-0 items-center gap-1 self-start rounded-full px-4 text-[11px] font-bold !text-white transition-colors duration-300 ${cardButtonClassName}`}
                >
                  {t("home.newsReadMore")}
                  <span className="transition-transform duration-300 group-hover:translate-x-[2px]">→</span>
                </Link>
              </div>

              {/* Khung ảnh — bên phải, inset ~12px so với mép card */}
              <div
                className={`relative m-3 h-[180px] overflow-hidden rounded-2xl md:absolute md:top-3 md:right-3 md:bottom-3 md:m-0 md:h-auto md:w-[54%] ${
                  item.imageFit === "contain" ? "bg-white" : "bg-transparent"
                }`}
              >
                <Image
                  src={item.image}
                  alt={item.alt}
                  fill
                  sizes="(min-width: 768px) 480px, 100vw"
                  className={
                    item.imageFit === "contain"
                      ? "object-contain scale-[3]"
                      : "object-cover object-top"
                  }
                />
              </div>

              {/* Họa tiết góc trên phải: 1/4 hình tròn bo tròn, đè lên khung ảnh */}
              <span
                aria-hidden="true"
                className="absolute top-0 right-0 z-10 h-[58px] w-[58px] rounded-bl-full"
                style={{ background: item.corner }}
              />
            </article>
          ))}
        </div>

        {/* ── CTA cuối: xem thêm hoạt động ─────────────────────────── */}
        <div className="mt-6 flex justify-center">
          <Link
            href={NEWS_ROUTE}
            className="inline-flex w-full max-w-xs items-center justify-center rounded-full bg-gradient-to-r from-[#5B86FF] to-[#4A74F0] px-7 py-2.5 text-sm font-medium !text-white shadow-md shadow-blue-300/40 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg md:w-auto"
          >
            Xem thêm các hoạt động của belwee
          </Link>
        </div>
      </div>
    </section>
  );
}
