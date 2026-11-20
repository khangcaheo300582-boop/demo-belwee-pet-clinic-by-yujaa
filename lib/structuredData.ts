/**
 * lib/structuredData.ts
 * Dữ liệu có cấu trúc (JSON-LD schema.org) cho SEO local.
 *
 * VÌ SAO TÁCH RIÊNG, KHÔNG VIẾT THẲNG TRONG layout.tsx
 *   Trước đây `VeterinaryCareJsonLd()` nằm trong `app/layout.tsx` và chỉ mô tả
 *   MỘT cơ sở (địa chỉ trụ sở ở Gò Vấp). Vấn đề: Belwee có 4 chi nhánh, mỗi
 *   chi nhánh là một điểm đến khác nhau mà khách tìm kiếm cụ thể ("phòng khám
 *   thú y quận 2", "belwee quận 9"). Một node duy nhất khiến Google chỉ gắn
 *   tất cả đánh giá/giờ mở cửa về trụ sở, các chi nhánh không có schema riêng
 *   thì không hiện trong Google Maps.
 *
 *   Nay dựng một `@graph`:
 *     • Organization            — chủ thể cha, nhận diện thương hiệu
 *     • VeterinaryCare          — phòng khám chính (giữ nguyên `#clinic` cũ)
 *     • VeterinaryCare × 4      — mỗi chi nhánh CN1…CN4, `branchOf` trỏ về cha
 *
 * NGUYÊN TẮC: KHÔNG BỊA DỮ LIỆU.
 *   `Branch.coords` và `Branch.phone` đang là `null` trong lib/clinics.ts vì
 *   dự án chưa công bố. Ở đây cũng vậy — thiếu thì BỎ HẲN field, không điền
 *   số 0 hay toạ độ tưởng tượng. Schema sai còn tệ hơn không có schema: sai
 *   thì Google hiển thị thông tin sai ra Google Maps cho khách đang tìm bệnh
 *   viện gần nhà.
 *
 * TÊN CHI NHÁNH: `Branch.*NameKey` là khoá i18n, không phải chuỗi. Server
 *   render không đọc được localStorage nên chốt tiếng Việt (ngôn ngữ đích của
 *   site, khớp `<html lang="vi">` trong layout).
 */

import {
  BRANCHES,
  CONTACT_EMAIL,
  HOTLINE,
  MAIN_ADDRESS,
  OPENING_HOURS,
  SITE_DESCRIPTION,
  SITE_NAME,
  branchPhone,
  mapsDirectionsUrl,
  type Branch,
} from "@/lib/clinics";
import { translate } from "@/lib/i18n";

/** Ngôn ngữ dùng cho nhãn trong schema — khớp `lang="vi"` của layout. */
const SCHEMA_LANG = "vi" as const;

/** Ranh giới phục vụ chung cho cả chuỗi: TP. Hồ Chí Minh. */
const AREA_SERVED = {
  "@type": "City",
  name: "TP. Hồ Chí Minh",
} as const;

/** Dịch vụ khai báo ở `availableService` — dùng chung cho mọi node. */
const SERVICES = [
  "Khám & chữa bệnh thú cưng",
  "Tiêm chủng định kỳ",
  "Spa & grooming thú cưng",
  "Khách sạn thú cưng",
  "Nội soi nội bộ",
  "Nha khoa thú y",
] as const;

function hoursSpecification() {
  return OPENING_HOURS.map((h) => ({
    "@type": "OpeningHoursSpecification",
    dayOfWeek: [...h.days],
    opens: h.opens,
    closes: h.closes,
  }));
}

function postalAddress(street: string) {
  return {
    "@type": "PostalAddress",
    streetAddress: street,
    addressLocality: MAIN_ADDRESS.city,
    addressRegion: "TP. Hồ Chí Minh",
    addressCountry: MAIN_ADDRESS.country,
  };
}

/**
 * Một chi nhánh.
 *
 * `type` trong lib/clinics.ts phân biệt "bệnh viện" (CN1/CN2) và "phòng khám"
 * (CN3/CN4) — đây không phải mỹ thuật: schema.org có hai kiểu khác nhau và
 * `MedicalClinic` là kiểu con hợp lý hơn cho cơ sở không có nội trú. Cả hai đều
 * là `LocalBusiness` nên vẫn dùng được mọi nơi cần kiểu LocalBusiness.
 */
function branchNode(branch: Branch, baseUrl: string, parentId: string) {
  const name = translate(SCHEMA_LANG, branch.fullNameKey);
  const node: Record<string, unknown> = {
    "@type": branch.type === "hospital" ? "VeterinaryCare" : "MedicalClinic",
    "@id": `${baseUrl}/#${branch.id}`,
    name,
    alternateName: `${branch.code} — ${translate(SCHEMA_LANG, branch.shortNameKey)}`,
    url: `${baseUrl}/#${branch.id}`,
    branchOf: { "@id": parentId },
    telephone: `+84${branchPhone(branch).slice(1)}`,
    email: CONTACT_EMAIL,
    address: postalAddress(branch.address),
    hasMap: mapsDirectionsUrl(branch.address),
    openingHoursSpecification: hoursSpecification(),
    areaServed: AREA_SERVED,
    availableService: SERVICES.map((s) => ({ "@type": "MedicalProcedure", name: s })),
    // Giá rõ để không ai mất thời gian gọi hỏi; "$$" = mức trung bình khá.
    priceRange: "$$",
  };

  // Chỉ thêm geo khi có toạ độ thật — xem ghi chú đầu file.
  if (branch.coords) {
    node.geo = {
      "@type": "GeoCoordinates",
      latitude: branch.coords.lat,
      longitude: branch.coords.lng,
    };
  }

  return node;
}

/**
 * Graph JSON-LD đầy đủ cho toàn site.
 *
 * Dùng `@graph` thay vì nhiều thẻ `<script>` rời: một document JSON-LD, các
 * node liên kết bằng `@id`/`branchOf` nên Google hiểu quan hệ "chi nhánh của
 * Belwee" thay vì 5 phòng khám rời rạc trùng tên.
 */
export function buildStructuredDataGraph(baseUrl: string) {
  const orgId = `${baseUrl}/#organization`;
  const clinicId = `${baseUrl}/#clinic`;

  const organization = {
    "@type": "Organization",
    "@id": orgId,
    name: SITE_NAME,
    legalName: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: baseUrl,
    logo: `${baseUrl}/logo-belwee.png`,
    image: `${baseUrl}/logo-belwee.png`,
    email: CONTACT_EMAIL,
    telephone: `+84${HOTLINE.slice(1)}`,
    areaServed: AREA_SERVED,
    // Không khai `sameAs` khi chưa có URL chính thức — mạng xã hội nào được
    // xác nhận sẽ thêm vào đây (xem SOCIAL_LINKS trong lib/clinics.ts).
  };

  const mainClinic = {
    "@type": "VeterinaryCare",
    "@id": clinicId,
    name: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: baseUrl,
    telephone: `+84${HOTLINE.slice(1)}`,
    email: CONTACT_EMAIL,
    image: `${baseUrl}/logo-belwee.png`,
    priceRange: "$$",
    address: {
      "@type": "PostalAddress",
      streetAddress: MAIN_ADDRESS.street,
      addressLocality: MAIN_ADDRESS.city,
      addressCountry: MAIN_ADDRESS.country,
    },
    openingHoursSpecification: hoursSpecification(),
    areaServed: AREA_SERVED,
    medicalSpecialty: ["Veterinary"],
    availableService: SERVICES.map((s) => ({ "@type": "MedicalProcedure", name: s })),
  };

  return {
    "@context": "https://schema.org",
    "@graph": [
      organization,
      mainClinic,
      ...BRANCHES.map((branch) => branchNode(branch, baseUrl, orgId)),
    ],
  };
}

/**
 * Chuỗi JSON đã escape an toàn để nhúng vào `<script type="application/ld+json">`.
 *
 * `JSON.stringify` xử lý đúng `"` và `\`, nhưng không xử lý `</script>` — chuỗi
 * `</script>` trong nội dung (ví dụ tên chi nhánh nếu ai đó sửa data) sẽ kết
 * thúc thẻ script ngay tại đó và phần còn lại bị coi là HTML. Thay `/` trong
 * `<` thành `<` là cách escape chuẩn mà Google cũng chấp nhận trong JSON-LD.
 */
export function structuredDataJsonLd(baseUrl: string): string {
  return JSON.stringify(buildStructuredDataGraph(baseUrl)).replace(/</g, "\\u003c");
}
