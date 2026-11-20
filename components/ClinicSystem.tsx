"use client";

import React from "react";
import Link from "next/link";
import { useTransitionNavigate } from "@/hooks/useTransitionNavigate";
import { useLanguage } from "@/components/LanguageProvider";
import GlassPill from "@/components/ui/GlassPill";
import NearestBranchFinder from "@/components/clinics/NearestBranchFinder";
import type { MessageKey } from "@/lib/i18n";
// GĐ9: nguồn số đánh giá duy nhất. Bảng `BRANCHES` cục bộ bên dưới chỉ chứa
// khoá i18n + trang trí; số đánh giá phải đến từ `lib/clinics.ts` để không ai
// gõ tay một con số vào mã nguồn. Đặt alias vì tên `BRANCHES` đã bị bảng cục
// bộ chiếm.
import { BRANCHES as BRANCH_DATA } from "@/lib/clinics";

const BRANCHES: {
  num: string;
  nameKey: MessageKey;
  badgeKey: MessageKey;
  addressKey: MessageKey;
  hoursKey: MessageKey;
  /**
   * Id chi nhánh trong `BRANCHES` — dùng để tra `rating`.
   *
   * GĐ9: trước đây trường này là `ratingKey` trỏ tới khoá i18n
   * `branches.bNRating`, chứa các CHUỖI BỰA ("4.9 Google rating"). Nay số
   * đánh giá lấy từ `lib/clinics.ts` — nguồn dữ liệu duy nhất — và mặc định
   * là `null`, tức KHÔNG hiện badge. Xem giải thích ở `Branch.rating`.
   */
  branchId: string;
  highKeys: [MessageKey, MessageKey];
  mapHintKey?: MessageKey;
  isResort?: boolean;
}[] = [
  {
    num: "01",
    nameKey: "branches.b1Name",
    badgeKey: "branches.b1Badge",
    addressKey: "branches.b1Address",
    hoursKey: "branches.b1Hours",
    branchId: "b1",
    highKeys: ["branches.b1High1", "branches.b1High2"],
  },
  {
    num: "02",
    nameKey: "branches.b2Name",
    badgeKey: "branches.b2Badge",
    addressKey: "branches.b2Address",
    hoursKey: "branches.b2Hours",
    branchId: "b2",
    highKeys: ["branches.b2High1", "branches.b2High2"],
  },
  {
    num: "03",
    nameKey: "branches.b3Name",
    badgeKey: "branches.b3Badge",
    addressKey: "branches.b3Address",
    hoursKey: "branches.b3Hours",
    branchId: "b3",
    highKeys: ["branches.b3High1", "branches.b3High2"],
    mapHintKey: "branches.b3MapHint",
  },
  {
    num: "04",
    nameKey: "branches.b4Name",
    badgeKey: "branches.b4Badge",
    addressKey: "branches.b4Address",
    hoursKey: "branches.b4Hours",
    branchId: "b4",
    highKeys: ["branches.b4High1", "branches.b4High2"],
    isResort: true,
  },
];

const HOTLINE = "0772003915";

const CLINIC_BRANCH_CSS = `
        .clinic-branch-card {
          position: relative;
          isolation: isolate;
          overflow: hidden;
          border-radius: 30px;
          /* Vật liệu lấy kênh màu từ token dùng chung (--pt-glass-strong-tint)
             thay vì gõ trắng cứng, và THÊM backdrop-filter để thẻ này thực sự
             là kính (trước đây chỉ là nền trắng alpha cao, không hề có lớp
             nhoè). Độ đục hạ nhẹ — 0.90/0.84/0.88 so với 0.95/0.88/0.92 —
             vừa đủ để nhìn thấy lớp nhoè phía sau, vẫn đủ trong để giữ tương
             phản cho chữ slate-900 bên trong. */
          background: linear-gradient(135deg,
            rgb(var(--pt-glass-strong-tint) / 0.90) 0%,
            rgb(240 249 255 / 0.84) 55%,
            rgb(var(--pt-glass-strong-tint) / 0.88) 100%);
          /* PERF: bỏ backdrop-filter. Nền đã đục 0.84–0.90 nên lớp nhoè không
             nhìn thấy; đây là 4 thẻ lớn nhất vùng "hệ thống chi nhánh" và mỗi
             thẻ phải blur lại mỗi frame khi cuộn trên nền cố định. */
          border: 1px solid rgb(var(--pt-glass-strong-tint) / 0.95);
          border-top-color: rgba(255,255,255,1);
          box-shadow: 0 24px 60px -24px rgba(30,64,175,0.3), 0 8px 24px -16px rgba(2,6,23,0.2), inset 0 1px 0 rgba(255,255,255,1), inset 0 -36px 70px -55px rgba(56,189,248,0.55);
          transition: transform 0.55s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.55s ease, border-color 0.4s ease;
        }
        .clinic-branch-card::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          z-index: 0;
          pointer-events: none;
          background: radial-gradient(420px circle at 50% 50%, rgba(59,130,246,0.14), rgba(147,197,253,0.05) 45%, transparent 65%);
          opacity: 0;
          transition: opacity 0.5s ease;
        }
        .clinic-branch-card::after {
          content: '';
          position: absolute;
          top: 0;
          left: -40%;
          width: 55%;
          height: 100%;
          z-index: 0;
          pointer-events: none;
          background: linear-gradient(105deg, transparent 0%, rgba(255,255,255,0.75) 50%, transparent 100%);
          transform: skewX(-14deg);
          opacity: 0;
          transition: opacity 0.2s ease;
        }
        .clinic-branch-card:hover {
          transform: translateY(-8px);
          border-color: rgba(59,130,246,0.45);
          box-shadow: 0 40px 80px -28px rgba(30,64,175,0.42), 0 12px 30px -18px rgba(2,6,23,0.28), 0 0 0 1px rgba(59,130,246,0.08), inset 0 1px 0 rgba(255,255,255,1), inset 0 -40px 80px -60px rgba(56,189,248,0.6);
        }
        .clinic-branch-card:hover::before { opacity: 1; }
        .clinic-branch-card:hover::after {
          opacity: 1;
          animation: clinicCardSweep 1.1s cubic-bezier(0.22, 1, 0.36, 1);
        }
        @keyframes clinicCardSweep {
          0% { left: -40%; opacity: 0; }
          18% { opacity: 1; }
          100% { left: 140%; opacity: 0; }
        }
        .clinic-branch-card > * { position: relative; z-index: 1; }
        .clinic-branch-num {
          position: absolute;
          top: -24px;
          right: 8px;
          z-index: 0;
          font-size: clamp(88px, 12vw, 150px);
          font-weight: 800;
          line-height: 1;
          letter-spacing: -0.04em;
          color: transparent;
          background: linear-gradient(180deg, rgba(37,99,235,0.14), rgba(37,99,235,0.02));
          -webkit-background-clip: text;
          background-clip: text;
          pointer-events: none;
          transition: transform 0.6s cubic-bezier(0.16,1,0.3,1);
        }
        .clinic-branch-card:hover .clinic-branch-num { transform: translateY(6px) scale(1.04); }
        .clinic-branch-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border-radius: 9999px;
          white-space: nowrap;
          font-size: 12px;
          font-weight: 700;
          padding: 12px 22px;
          transition: transform 0.3s cubic-bezier(0.22,1,0.36,1), box-shadow 0.3s ease, background 0.3s ease, opacity 0.3s ease;
          cursor: pointer;
        }
        .clinic-branch-btn-primary {
          color: #ffffff;
          background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%);
          border: 1px solid rgba(255,255,255,0.45);
          box-shadow: 0 10px 26px -10px rgba(37,99,235,0.55), inset 0 1px 0 rgba(255,255,255,0.45);
        }
        .clinic-branch-btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 16px 34px -12px rgba(37,99,235,0.65), inset 0 1px 0 rgba(255,255,255,0.6);
        }
        .clinic-branch-btn-primary:active { transform: translateY(0) scale(0.97); }
        .clinic-branch-btn-ghost {
          color: #1d4ed8;
          background: rgba(255,255,255,0.75);
          border: 1px solid rgba(59,130,246,0.35);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.95), 0 6px 18px -12px rgba(37,99,235,0.35);
        }
        .clinic-branch-btn-ghost:hover {
          color: #ffffff;
          background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%);
          border-color: rgba(37,99,235,0.6);
          transform: translateY(-2px);
          box-shadow: 0 14px 30px -12px rgba(37,99,235,0.55), inset 0 1px 0 rgba(255,255,255,0.45);
        }
        .clinic-branch-btn-ghost:active { transform: translateY(0) scale(0.97); }
        .clinic-branch-card[role="link"]:focus-visible {
          outline: 2px solid rgba(37,99,235,0.85);
          outline-offset: 3px;
        }
        @media (prefers-reduced-motion: reduce) {
          .clinic-branch-card, .clinic-branch-card::before, .clinic-branch-card::after { transition: none !important; }
          .clinic-branch-card:hover { transform: none; }
          .clinic-branch-card::after { display: none; }
        }
      `;

/**
 * Hệ Thống Phòng Khám — 4 chi nhánh Belwee dạng card kính lỏng SÁNG.
 *
 * Đang dùng ở: trang chủ (`linkTo="/lien-he"` → cả thẻ thành link) và
 * /lien-he (không truyền prop). Comment cũ ghi "trang Đội Ngũ (cuối trang)" —
 * đã sai từ khi khối này được chuyển về /lien-he; sửa lại cho khỏi bị tin nhầm
 * khi ai đó đi tìm chỗ dùng.
 *
 * Hiệu ứng hover: lens-glow theo chuột, quét sáng, nhấc nổi, nước số phủ mờ.
 * Nếu truyền `linkTo`, toàn bộ thẻ chi nhánh trở thành link mở trang đó
 * (nút bên trong vẫn hoạt động riêng, không bị kích hoạt link).
 *
 * HẠNG MỤC A4: lưới 2 thẻ/hàng từ `lg` (≥1024px = desktop/laptop). Dưới `lg`
 * — điện thoại và tablet — vẫn là 1 thẻ/hàng như trước, không đổi hành vi.
 */
export default function ClinicSystem({
  linkTo,
  showNearest,
}: {
  linkTo?: string;
  /**
   * GĐ5 — bật tiện ích "Tìm chi nhánh gần tôi" (hạng mục 25.4).
   *
   * Mặc định TẮT, và chỉ bật ở trang Liên hệ. Lý do: ở trang chủ, cả bốn thẻ
   * chi nhánh là liên kết điều hướng (`linkTo`) — người dùng bấm là sang trang
   * khác ngay, nên tiện ích định vị ở đó chỉ gây rối. Ở trang Liên hệ thì người
   * dùng đang chọn phòng khám, nên nó đúng chỗ.
   */
  showNearest?: boolean;
}) {
  const navigate = useTransitionNavigate();
  const { t } = useLanguage();
  const isLink = typeof linkTo === "string" && linkTo.length > 0;

  /**
   * Id chi nhánh vừa tìm ra, để tô đậm thẻ tương ứng. `null` = chưa tìm, hoặc
   * người dùng đã bấm lại và kết quả cũ không còn tin nữa.
   */
  const [nearestId, setNearestId] = React.useState<string | null>(null);

  const handleCardClick = (e: React.MouseEvent<HTMLElement>) => {
    if (!isLink) return;
    e.preventDefault();
    navigate(linkTo);
  };

  const handleCardKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (!isLink) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      navigate(linkTo);
    }
  };

  return (
    <section className="relative px-4 py-20 text-slate-800 sm:px-6 lg:px-8">
      <style dangerouslySetInnerHTML={{ __html: CLINIC_BRANCH_CSS }} />

      <div className="mx-auto max-w-5xl">
        <div className="mb-12 text-center">
          {/* A7 — khối tiêu đề chưa có `data-reveal` trong khi lưới thẻ bên
              dưới thì có (`data-reveal-group`), nên tiêu đề hiện tức thì còn
              thẻ thì mới chạy hiệu ứng. `data-reveal-exit` cho phép mờ nhẹ khi
              cuộn ra, không ẩn hẳn — xem components/AnimationProvider.tsx. */}
          <span
            data-reveal="fade"
            data-reveal-exit
            className="inline-block rounded-full bg-blue-100/80 border border-blue-200/80 backdrop-blur-md px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.28em] text-blue-700"
          >
            {t("system.label")}
          </span>
          <h2
            data-reveal="fade-up"
            data-reveal-exit
            className="mt-4 text-3xl font-light tracking-tight text-slate-900 sm:text-4xl"
          >
            {t("system.title")}
          </h2>
          <p
            data-reveal="fade-up"
            data-reveal-exit
            className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base"
          >
            {t("system.desc")}
          </p>
        </div>

        {showNearest && (
          <NearestBranchFinder onFound={setNearestId} />
        )}

        {/* 1 cột dưới 1024px (mobile/tablet giữ nguyên), 2 cột từ `lg` theo A4. */}
        <div data-reveal-group className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {BRANCHES.map((branch) => {
            /*
             * `BRANCHES` ở đây đánh số "01".."04" còn `lib/clinics.ts` dùng id
             * "b1".."b4". Ghép lại để so khớp với kết quả `nearestBranch()`.
             * Dùng `slice(1)` thay vì `parseInt` vì "01" -> 1 làm mất số 0 đứng
             * đầu, và ở đây cần giữ nguyên dạng chuỗi cho so khớp.
             */
            const isNearest = nearestId !== null && `b${branch.num.slice(1)}` === nearestId;
            // GĐ9: số đánh giá lấy từ nguồn dữ liệu chung, không phải từ chuỗi
            // i18n. `null` ⇒ không hiện badge (xem `Branch.rating`).
            const branchRating =
              BRANCH_DATA.find((b) => b.id === branch.branchId)?.rating ?? null;
            return (
            <article
              key={branch.num}
              /* `aria-current` để trình đọc màn hình nói được "chi nhánh gần bạn
                 nhất" — chỉ viền màu thì người dùng khiếm khả năng nhìn không biết
                 thẻ nào vừa được chọn. */
              aria-current={isNearest ? "true" : undefined}
              data-nearest={isNearest ? "" : undefined}
              onClick={handleCardClick}
              onKeyDown={handleCardKeyDown}
              role={isLink ? "button" : undefined}
              tabIndex={isLink ? 0 : undefined}
              aria-label={isLink ? t(branch.nameKey) : undefined}
              aria-pressed={isLink}
              className={
                (isLink
                  ? "clinic-branch-card cursor-pointer p-7 sm:p-9"
                  : "clinic-branch-card p-7 sm:p-9") +
                /* Viền xanh đậm cho thẻ gần nhất. Đặt ở đây (utility) chứ không
                   nhét vào `.clinic-branch-card` trong CSS: nhánh đó không biết
                   trạng thái, mà biết thì phải truyền biến qua một class tĩnh. */
                (isNearest ? " !border-blue-500 !ring-2 !ring-blue-500/40" : "")
              }
            >
              <span className="clinic-branch-num" aria-hidden="true">
                {branch.num}
              </span>

              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-white shadow-[0_6px_16px_-6px_rgba(37,99,235,0.6)]">
                  {t(branch.badgeKey)}
                </span>
                {/* GĐ9: chỉ hiện badge đánh giá khi lib/clinics.ts có số THẬT.
                    Trước đây đây là chuỗi bịa "4.9 Google rating" lấy từ i18n —
                    số không có nguồn nhưng lại gắn chữ "Google" vào. Thiếu dữ
                    liệu thì bỏ trường đó, không dựng số để lấp chỗ trống. */}
                {branchRating && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200/80 px-3 py-1.5 text-[11px] font-semibold text-amber-700">
                    ⭐ {branchRating.value.toFixed(1)} · {branchRating.reviewCount} đánh giá
                  </span>
                )}

                {/* Nhãn "gần bạn nhất" đặt TRONG hàng pill này, không đặt ở góc thẻ.
                    Lý do đo được: `.clinic-branch-card > *` (CLINIC_BRANCH_CSS) đặt
                    `position: relative` cho mọi con trực tiếp, và độ ưu tiên
                    0-1-1 của nó CAO HƠN `absolute` (0-1-0) của Tailwind. Bản đầu
                    đặt badge ở góc đã bị đẩy thành phần tử trong dòng, rồi lệch
                    20px so với vị trí mong muốn — có trong DOM nhưng không thấy. */}
                {isNearest && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-600 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white shadow-[0_6px_16px_-6px_rgba(37,99,235,0.6)]">
                    {t("nearest.badge")}
                  </span>
                )}
              </div>

              <h3 className="mt-4 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
                {t(branch.nameKey)}
              </h3>

              <div className="mt-2 flex flex-col gap-1.5 text-sm text-slate-600">
                <p className="flex items-start gap-2">
                  <span aria-hidden="true" className="mt-0.5">📍</span>
                  <span>{t(branch.addressKey)}</span>
                </p>
                <p className="flex items-start gap-2">
                  <span aria-hidden="true" className="mt-0.5">🕗</span>
                  <span>{t(branch.hoursKey)}</span>
                </p>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {branch.highKeys.map((hk) => (
                  <span
                    key={hk}
                    className="inline-flex items-center gap-1.5 rounded-full bg-blue-50/90 border border-blue-200/70 px-3.5 py-1.5 text-[11px] font-semibold text-blue-700"
                  >
                    <span aria-hidden="true">✦</span>
                    {t(hk)}
                  </span>
                ))}
              </div>

              {branch.mapHintKey && (
                <p className="mt-4 flex items-start gap-2 rounded-2xl border border-sky-200/70 bg-sky-50/80 px-4 py-3 text-xs font-medium text-sky-700">
                  <span aria-hidden="true" className="mt-0.5">🧭</span>
                  <span>{t(branch.mapHintKey)}</span>
                </p>
              )}

              <div className="mt-7 flex flex-wrap items-center gap-3">
                {branch.isResort ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate("/booking/khach-san");
                    }}
                    className="clinic-branch-btn clinic-branch-btn-primary"
                  >
                    🏨 {t("system.hotelRooms")}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate("/dich-vu");
                    }}
                    className="clinic-branch-btn clinic-branch-btn-primary"
                  >
                    📅 {t("system.book")}
                  </button>
                )}
                <a
                  href={`tel:${HOTLINE}`}
                  onClick={(e) => e.stopPropagation()}
                  className="clinic-branch-btn clinic-branch-btn-ghost"
                >
                  📞 {t("system.call")}
                </a>
              </div>
            </article>
            );
          })}
        </div>

        {/* Hạng mục A4 — nút viên thuốc kính "Chúng tôi là ai?", dẫn thẳng tới
            trang Đội ngũ.

            Dùng `next/link` (liên kết thật: prefetch, mở tab mới, chuột phải
            sao chép được) chứ KHÔNG dùng useTransitionNavigate — đây là liên
            kết nội dung, không phải hành động trong trang.

            Vòng focus đặt trên chính <Link> vì đó mới là phần tử nhận tiêu
            điểm; đặt trên pill bên trong thì bàn phím vẫn tab vào <Link> mà
            không thấy vòng focus.

            KHÔNG đặt `aria-label` trên <Link>: nó sẽ thay thế tên truy cập và
            tên mới không chứa chữ nhìn thấy ⇒ vi phạm WCAG 2.5.3 (Label in
            Name) — đúng lỗi Lighthouse đã từng bắt ở thẻ "Đọc thêm" của mục
            kiến thức. Thay vào đó nối thêm ngữ cảnh bằng `sr-only`, cách này
            giữ nguyên tên cũ rồi bổ sung thêm. */}
        <div className="mt-10 flex justify-center">
          <Link href="/doi-ngu" className="pt-focus inline-block rounded-full">
            <GlassPill as="span" className="px-6 py-3 text-sm font-bold">
              {t("system.teamCta")}
              <span aria-hidden="true">→</span>
              <span className="sr-only"> — {t("system.teamCtaAria")}</span>
            </GlassPill>
          </Link>
        </div>
      </div>
    </section>
  );
}