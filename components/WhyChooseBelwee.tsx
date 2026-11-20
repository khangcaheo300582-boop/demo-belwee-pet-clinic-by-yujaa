"use client";

/**
 * components/WhyChooseBelwee.tsx
 *
 * Hạng mục A6 — section "Nơi chăm sóc thú cưng của bạn tốt nhất".
 *
 * VỊ TRÍ: trên trang chủ, NGAY DƯỚI "Hệ thống chăm sóc toàn diện" (#home-services)
 * và NGAY TRÊN "Các chuyên gia thú y của chúng tôi" (#home-vets).
 *
 * ── ẢNH ─────────────────────────────────────────────────────────────────────
 * Bốn ảnh này là ảnh hoạt động CÓ THẬT trong /public, đã kiểm tra tồn tại.
 * KHÔNG tìm ảnh trên mạng, KHÔNG tạo ảnh AI, KHÔNG đổi tên / di chuyển / chuyển
 * đổi định dạng file gốc, KHÔNG bịa đường dẫn. Tham chiếu bằng URL gốc phục vụ
 * trực tiếp từ public (`/ten-file.jpg`) — KHÔNG dùng `/public/...`, KHÔNG dùng
 * đường dẫn tuyệt đối kiểu Windows, KHÔNG import như asset.
 *
 * Thứ tự 1→4 là cố định và không ảnh nào bị dùng lại.
 *
 * ── VÌ SAO KHÔNG CÓ STATE/JS CHO PHẦN TĨNH ─────────────────────────────────
 * "use client" chỉ cần vì `useLanguage()`. Không có `useState`, không có
 * carousel, không có JS điều khiển: đây là lưới tĩnh. Không carousel tự chạy,
 * không giấu nội dung sau nút bấm.
 *
 * ── CHỐNG NHẢY BỐ CỤC ──────────────────────────────────────────────────────
 * Mỗi ô ảnh dùng `fill` + `aspect-[11/10]` trên khung `relative`, nên TỈ LỆ
 * được chốt bằng CSS trước khi ảnh tải xong ⇒ khung ảnh không nhảy khi ảnh về.
 * Ảnh lazy-load vì section này nằm dưới màn hình đầu.
 *
 * `data-reveal` / `data-reveal-group` là cách của dự án để gắn hiệu ứng cuộn
 * (components/AnimationProvider.tsx quét chúng) — nhờ vậy phần A7 áp dụng được
 * cho section này mà không thêm một dòng JS nào.
 */

import Image from "next/image";
import { useLanguage } from "@/components/LanguageProvider";
import type { MessageKey } from "@/lib/i18n";

interface WhyCard {
  image: string;
  titleKey: MessageKey;
  descKey: MessageKey;
  altKey: MessageKey;
}

/** Dữ liệu 4 card — một mảng rồi map, không viết lặp markup. */
const CARDS: readonly WhyCard[] = [
  {
    image: "/hoatdongkhamchuabenh.jpg",
    titleKey: "why.c1Title",
    descKey: "why.c1Desc",
    altKey: "why.c1Alt",
  },
  {
    image: "/hoatdongsieuam.jpg",
    titleKey: "why.c2Title",
    descKey: "why.c2Desc",
    altKey: "why.c2Alt",
  },
  {
    image: "/hoatdongkhaitruong.jpg",
    titleKey: "why.c3Title",
    descKey: "why.c3Desc",
    altKey: "why.c3Alt",
  },
  {
    image: "/hoatdongchamsoc.jpg",
    titleKey: "why.c4Title",
    descKey: "why.c4Desc",
    altKey: "why.c4Alt",
  },
];

export default function WhyChooseBelwee() {
  const { t } = useLanguage();

  return (
    <section
      id="why-belwee"
      aria-labelledby="why-belwee-title"
      /* Container: rộng tối đa 1240px, padding ngang 20px (24px từ sm) — theo
         đúng thông số yêu cầu vì dự án chưa có component container dùng chung. */
      className="relative px-5 py-16 sm:px-6 lg:py-20"
    >
      <div className="mx-auto max-w-[1240px]">
        <div data-reveal="fade-up" className="text-center">
          <h2
            id="why-belwee-title"
            className="text-[28px] font-medium leading-[1.3] tracking-tight text-slate-900 sm:text-[30px]"
          >
            {t("why.title")}
          </h2>
          {/* Đường kẻ ngang 1px, dài 130px (trong khoảng 120–140px), căn giữa. */}
          <span
            aria-hidden="true"
            className="mx-auto mt-5 block h-px w-[130px] bg-slate-300/80"
          />
        </div>

        {/* Lưới: 1 cột dưới 370px → 2 cột → 4 cột từ 1024px.
            gap ngang 28px, gap dọc lớn hơn để hai hàng không dính nhau.

            MỐC 370px, không phải 420px: yêu cầu A6 ghi rõ "<768px: ưu tiên 2
            cột nếu chữ vẫn rõ, màn hẹp như 360px thì 1 cột" — tức 390px PHẢI
            là 2 cột, chỉ 360px mới xuống 1 cột. Đã đo thật: mốc 420px cho ra
            1 cột ở 390px (sai), mốc 370px cho 2 cột ở 390px và 1 cột ở 360px. */}
        <div
          data-reveal-group
          className="mt-12 grid grid-cols-1 gap-x-7 gap-y-10 min-[370px]:grid-cols-2 lg:grid-cols-4"
        >
          {CARDS.map((card) => (
            <article key={card.image} className="text-center">
              {/* Khung ảnh chốt tỉ lệ 1.1:1 bằng CSS ⇒ không nhảy khi ảnh tải. */}
              <div className="relative aspect-[11/10] w-full overflow-hidden rounded-[12px] bg-slate-100">
                <Image
                  src={card.image}
                  alt={t(card.altKey)}
                  fill
                  /* 4 cột ở ≥1024px: (1240 − 3×28) / 4 ≈ 289px. */
                  sizes="(min-width: 1024px) 290px, (min-width: 420px) 50vw, 100vw"
                  className="object-cover"
                  loading="lazy"
                />
              </div>

              <h3 className="mx-auto mt-5 max-w-[34ch] text-[15px] font-semibold leading-snug text-slate-900 sm:text-[16px]">
                {t(card.titleKey)}
              </h3>
              <p className="mx-auto mt-2.5 max-w-[42ch] text-[13px] leading-[1.7] text-slate-600 sm:text-[14px]">
                {t(card.descKey)}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
