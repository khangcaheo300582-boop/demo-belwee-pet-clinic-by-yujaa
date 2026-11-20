"use client";

/**
 * components/StatsBand.tsx
 * Dải số liệu đếm chạy trên trang chủ (I1 — "số liệu đếm chạy").
 *
 * ── NGUỒN CỦA TỪNG CON SỐ ────────────────────────────────────────────────────
 * Có hai loại, và phân biệt rõ để không bao giờ trộn:
 *
 * 1. SỐ ĐẾM TỪ DỮ LIỆU TRONG REPO (tự đổi theo, không cần sửa):
 *      • chi nhánh  ← BRANCHES.length
 *      • bài kiến thức ← knowledgeArticles.length
 *
 * 2. SỐ TUYÊN BỐ DO CHỦ DỰ ÁN CUNG CẤP (ghi tay, không suy ra được):
 *      • năm kinh nghiệm ← DECLARED_YEARS
 *      • nhân sự        ← DECLARED_EXPERTS
 *    Con số "số thú cưng đã chăm sóc" trong đề bài KHÔNG có nguồn nào (không có
 *    bảng lượt khách, không có CRM) nên vẫn bị bỏ hẳn — không có số liệu thì
 *    không có con số.
 *
 * ── LỊCH SỬ QUYẾT ĐỊNH (GĐ0 → GĐ3) ──────────────────────────────────────────
 * GĐ0 phát hiện mâu thuẫn: đề bài yêu cầu "12 năm / hơn 30 bác sĩ / phủ khắc
 * TP.HCM", còn dữ liệu trong repo là 4 chi nhánh · 10 nhân sự · 10 năm, và
 * /gioi-thieu đang xuất bản "hơn 12 năm". Ba con số đó không thể tự suy ra từ
 * code, nên GĐ2A giữ nguyên số thật và hỏi chủ dự án.
 *
 * GĐ3 — chủ dự án đã XÁC NHẬN 12 năm / hơn 30 bác sĩ và tiến sĩ / chi nhánh phủ
 * khắc TP.HCM là số liệu đúng, và yêu cầu đồng bộ /gioi-thieu cho khớp. Vì vậy
 * `DECLARED_YEARS` và `DECLARED_EXPERTS` bên dưới là SỐ DO CHỦ DỰ ÁN NÓI, không
 * phải số AI tự bịa. Nếu sau này cần đổi, đổi hai hằng này — đừng rải số 12/30
 * rải rác trong JSX.
 *
 * ── HẠNG MỤC A5 ─────────────────────────────────────────────────────────────
 * Phần NỀN + HIỆU ỨNG (giọt nước nở ra, thẻ hoá kính, hai quầng màu) làm đúng
 * yêu cầu A5.
 *
 * Đoạn trình tự (điều khiển bằng scrollYProgress, KHÔNG re-render React):
 *   1. Hết mục "Hệ thống phòng khám" → nền chuyển sang mặt phẳng sáng
 *      (.stats-surface, token --pt-bg-bright).
 *   2. Cuộn tiếp → một giọt nước xanh nhạt NỞ RA từ mép dưới (scaleX/scaleY,
 *      gốc 50% 100%) bao trọn cả bốn thẻ.
 *   3. Khối xanh mờ dần, đồng thời lớp trắng đặc trên mỗi thẻ (opacity 1 → 0)
 *      tan đi ⇒ thẻ chuyển thành kính lỏng.
 *   4. Hai quầng màu hai bên trang hiện ra, trôi rất nhẹ (translate + scale).
 *
 * CHỈ dùng transform + opacity cho các lớp này. Giọt nước và quầng màu là
 * GRADIENT mờ sẵn — KHÔNG animate `filter: blur()`, vì blur lớn chạy liên tục
 * là đúng thứ làm mất khung hình.
 *
 * prefers-reduced-motion: xử lý bằng CSS trong app/globals.css (khối A5), KHÔNG
 * branch trong render — branch bằng JS sẽ cho kết quả khác nhau giữa server và
 * client và gây hydration mismatch.
 */

/**
 * Hai con số TUYÊN BỐ, không phải số đếm từ dữ liệu.
 *
 * Nguồn: chủ dự án xác nhận ở GĐ3 (xem khối chú thích đầu file). Không rải số
 * 12/30 ra chỗ khác trong file — đổi ở đây là đủ.
 */
const DECLARED_YEARS = 12;
const DECLARED_EXPERTS = 30;

import { useRef } from "react";
import { motion, useTransform } from "framer-motion";
import useScrollProgress from "@/hooks/useScrollProgress";
import { BRANCHES } from "@/lib/clinics";
import { knowledgeArticles } from "@/lib/knowledgeData";
// GĐ3: `STAFF_PROFILES` và `teamDoctors` KHÔNG còn dùng ở đây. Trước đó thẻ
// "nhân sự" lấy `teamDoctors.length + STAFF_PROFILES.length` (= 10); giờ thẻ đó
// hiện con số chủ dự án tuyên bố (`DECLARED_EXPERTS`) nên không còn cần cộng.
// Trang Đội ngũ vẫn render hai danh sách này — xóa import ở đây không ảnh hưởng.
import CountUp from "@/components/CountUp";
import Reveal from "@/components/Reveal";
import { useLanguage } from "@/components/LanguageProvider";

interface StatItem {
  value: number;
  suffix?: string;
  labelKey:
    | "stats.branchesLabel"
    | "stats.expertsLabel"
    | "stats.experienceLabel"
    | "stats.articlesLabel";
}

export default function StatsBand() {
  const { t } = useLanguage();

  const items: StatItem[] = [
    // GĐ3 — chủ dự án xác nhận. Ba thẻ đầu theo đúng câu chữ đã duyệt:
    // "Hơn 12 năm" · "hơn 30 bác sĩ và tiến sĩ" · "Chi nhánh phủ khắc TP.HCM".
    // Thẻ chi nhánh vẫn hiện số đếm thật (BRANCHES.length) kèm nhãn mới.
    { value: DECLARED_YEARS, suffix: "+", labelKey: "stats.experienceLabel" },
    { value: DECLARED_EXPERTS, suffix: "+", labelKey: "stats.expertsLabel" },
    { value: BRANCHES.length, labelKey: "stats.branchesLabel" },
    { value: knowledgeArticles.length, labelKey: "stats.articlesLabel" },
  ];

  const sectionRef = useRef<HTMLElement>(null);

  /**
   * Tiến độ cuộn của riêng section này: từ lúc mép trên chạm 90% màn hình tới
   * lúc tâm section tới 45% màn hình. Chọn mốc này để hiệu ứng kết thúc TRƯỚC
   * khi section đi qua giữa màn hình — nếu để muộn hơn, người dùng đọc xong số
   * liệu trước khi thẻ kịp thành kính.
   *
   * GĐ2A — CHUYỂN TỪ `useScroll({ target })` SANG `useScrollProgress`.
   * Bản `useScroll` chạy được ở đúng cấu hình offset này (đã đo), nhưng nó phụ
   * thuộc đường tăng tốc ViewTimeline của framer-motion 13 và đã bị chứng minh
   * là không phát giá trị với offset dạng `start/end` ở chính trang chủ
   * (xem hooks/useScrollProgress.ts). Dùng chung một cơ chế đã được đo là chạy
   * thay vì để hai hiệu ứng cùng họ nằm trên hai đường khác nhau.
   */
  const scrollYProgress = useScrollProgress(sectionRef, {
    fromAnchor: "start",
    fromVh: 90,
    toAnchor: "center",
    toVh: 45,
  });

  // 2. Giọt nước nở ra — gốc ở mép dưới nên cảm giác "nổi lên từ dưới".
  const blobScaleX = useTransform(scrollYProgress, [0, 0.5], [0.12, 1]);
  const blobScaleY = useTransform(scrollYProgress, [0, 0.5], [0.3, 1]);
  // Giữ độ đục rồi mờ dần ở cuối (bước 3) chứ không biến mất hẳn — còn lại một
  // vệt xanh nhạt làm nền cho kính.
  const blobOpacity = useTransform(scrollYProgress, [0, 0.08, 0.55, 1], [0, 1, 1, 0.3]);
  // 3. Lớp trắng đặc trên thẻ tan đi ⇒ thẻ "thành kính".
  const cardSolidOpacity = useTransform(scrollYProgress, [0.45, 0.9], [1, 0]);
  // 4. Hai quầng màu chỉ hiện khi thẻ đã là kính.
  const auraOpacity = useTransform(scrollYProgress, [0.6, 1], [0, 1]);

  return (
    <section
      ref={sectionRef}
      /* `overflow-hidden` để hai quầng màu đặt lệch ra ngoài mép không tạo
         thanh cuộn ngang. Không có phần tử `sticky` nào bên trong nên việc này
         không vô hiệu hoá sticky. */
      className="stats-surface relative overflow-hidden px-4 py-14 sm:px-6 lg:py-20"
      aria-labelledby="stats-band-title"
    >
      {/* Hai quầng màu hai bên — gradient TĨNH mờ sẵn, chỉ trôi bằng transform. */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
        style={{ opacity: auraOpacity }}
      >
        <span className="stats-aura animate-blob" style={{ top: "4%", left: "-90px" }} />
        <span
          className="stats-aura animate-blob"
          style={{ bottom: "2%", right: "-90px", animationDelay: "-3.4s" }}
        />
      </motion.div>

      <div className="relative mx-auto max-w-5xl">
        <Reveal>
          <h2
            id="stats-band-title"
            className="text-center text-xs font-bold uppercase tracking-[0.22em] text-sky-700 dark:text-sky-300"
          >
            {t("stats.label")}
          </h2>
        </Reveal>

        {/* 2 cột từ 360px, 4 cột từ md — cùng nguyên tắc 2 thẻ/hàng như Part C. */}
        <div className="relative mt-8">
          {/* Giọt nước nằm SAU lưới thẻ (z-0) và được lưới (relative) phủ lên. */}
          <motion.div
            aria-hidden="true"
            className="stats-blob"
            style={{ scaleX: blobScaleX, scaleY: blobScaleY, opacity: blobOpacity }}
          />

          <dl className="relative grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
            {items.map((item) => (
              /* Vật liệu kính nằm TRỰC TIẾP trên phần tử con của <dl> (không
                 bọc thêm một <div> nữa): HTML chỉ cho <dl> chứa các nhóm
                 <div> bao ngoài cặp dt/dd, nên thêm một tầng nữa là sai cấu
                 trúc. Nhờ vậy lưới grid cũng chỉ có đúng 4 ô, không có tầng
                 trung gian nào phải kéo `h-full`. */
              <Reveal
                key={item.labelKey}
                className="pt-glass relative rounded-[22px] px-4 py-6 text-center sm:rounded-[26px] sm:px-5"
              >
                {/* Lớp trắng đặc tan dần để thẻ chuyển từ khối trắng trên nền
                    xanh sang kính lỏng. z-index -1 ⇒ trên nền kính, dưới chữ. */}
                <motion.span
                  aria-hidden="true"
                  className="stats-card-solid"
                  style={{ opacity: cardSolidOpacity }}
                />
                <dd className="text-3xl font-extrabold leading-none text-[var(--pt-heading)] sm:text-4xl">
                  <CountUp value={item.value} suffix={item.suffix ?? ""} />
                </dd>
                <dt className="mt-2 text-[11px] font-semibold leading-snug text-[var(--pt-fg-muted)] sm:text-xs">
                  {t(item.labelKey)}
                </dt>
              </Reveal>
            ))}
          </dl>
        </div>

        <p className="relative mx-auto mt-6 max-w-2xl text-center text-[11px] leading-relaxed text-[var(--pt-fg-muted)]">
          {t("stats.footnote")}
        </p>
      </div>
    </section>
  );
}
