/**
 * lib/clinics.ts
 * Dữ liệu dùng chung cho chi nhánh & hotline Belwee.
 *
 * - `HOTLINE`: số hotline chính thức duy nhất của phòng khám. Mọi nút
 *   "Gọi ngay" / link `tel:` / Zalo trên site PHẢI lấy từ đây (NAP nhất quán
 *   cho SEO local + khách không gọi nhầm số).
 * - `HOTLINE_DISPLAY`: dạng hiển thị có khoảng cách cho dễ đọc.
 * - `BELWEE_HOTLINES`: danh sách số hotline chính thức (kể cả số cũ). Dùng để
 *   chặn khách hàng nhập nhầm số hotline vào ô "Số điện thoại" khi đặt lịch.
 * - `BOOKING_BRANCHES`: 4 chi nhánh cho bước "Chọn chi nhánh đặt lịch khám".
 *   Nhãn lấy từ i18n (khóa `branches.*`) nên tự dịch theo ngôn ngữ đang chọn.
 */

import type { MessageKey } from "@/lib/i18n";

/** Hotline chính thức — nguồn duy nhất cho mọi nút gọi trên site. */
export const HOTLINE = "0772003915";

/** Số hiển thị có khoảng cách (dùng cho văn bản, không dùng cho tel:/zalo.me). */
export const HOTLINE_DISPLAY = "0772 003 915";

/** Link Zalo của hotline chính. */
export const HOTLINE_ZALO = `https://zalo.me/${HOTLINE}`;

/** Hotline chính thức — so khớp sau khi chuẩn hoá (bỏ khoảng trắng, dấu chấm, +84). */
export const BELWEE_HOTLINES = [HOTLINE, "0772033915", "02873008286"] as const;

/**
 * Chuẩn hoá số điện thoại để so khớp:
 *  - bỏ mọi ký tự không phải số (khoảng trắng, dấu chấm, gạch ngang, ngoặc)
 *  - đổi tiền tố quốc tế +84 / 84 về dạng nội địa 0
 */
export function normalizePhone(raw: string): string {
  const digits = (raw || "").replace(/\D+/g, "");
  if (digits.startsWith("84") && digits.length >= 11) return `0${digits.slice(2)}`;
  return digits;
}

/** true nếu số người dùng nhập trùng với một hotline của Belwee. */
export function isBelweeHotline(raw: string): boolean {
  const normalized = normalizePhone(raw);
  if (!normalized) return false;
  return BELWEE_HOTLINES.some((hotline) => normalizePhone(hotline) === normalized);
}

/* ────────────────────────────────────────────────────────────────────────────
   Sổ đăng ký chi nhánh — MỘT nguồn duy nhất cho toàn site.

   Trước đây dữ liệu chi nhánh nằm rải ở 3 nơi (tên ở i18n, link Google Maps
   hardcode trong Footer.tsx, giờ mở cửa ở BOOKING_BRANCHES) nên dễ lệch nhau.
   Nay gộp về đây; `BRANCHES` là nguồn, `BOOKING_BRANCHES` chỉ là view hẹp của nó
   cho bước chọn chi nhánh khi đặt lịch.
   ──────────────────────────────────────────────────────────────────────────── */

/** "Bệnh viện" (CN1, CN2) vs "Phòng khám" (CN3, CN4). */
export type BranchType = "hospital" | "clinic";

export interface Branch {
  /** id dùng cho form đặt lịch (giữ nguyên để không phá payload đã lưu). */
  id: string;
  /** Mã hiển thị: CN1…CN4. */
  code: "CN1" | "CN2" | "CN3" | "CN4";
  type: BranchType;
  /** Tên ngắn trên thẻ chi nhánh (footer) — 1–2 dòng, lấy từ i18n. */
  shortNameKey: MessageKey;
  /** Tên đầy đủ kèm mã, dùng cho aria-label / title / JSON-LD. */
  fullNameKey: MessageKey;
  /** Tên hiển thị trong luồng đặt lịch + ClinicSystem (tên thương hiệu đầy đủ). */
  bookingNameKey: MessageKey;
  /** Khoá i18n cho badge (CN1) và giờ mở cửa của luồng đặt lịch. */
  badgeKey: MessageKey;
  bookingAddressKey: MessageKey;
  bookingHoursKey: MessageKey;
  /**
   * Địa chỉ dạng text thuần, dùng cho link Google Maps (encodeURIComponent) và
   * structured data. Giữ đúng dạng ghi trong ảnh tham chiếu — KHÔNG tự rút gọn.
   */
  address: string;
  /** Địa chỉ 1 dòng cho nút "Chỉ đường" (maps/dir) khi cần hiển thị ngắn. */
  addressShort: string;
  /**
   * Link Google Maps rút gọn đã có sẵn trong dự án (ghim đúng vị trí thật).
   * Dùng cho link trên TÊN chi nhánh. Nút "Chỉ đường" dùng `mapsDirectionsUrl`
   * (dựng từ `address`) vì deep-link chỉ đường cần điểm đến, không cần pin.
   */
  mapUrl: string;
  /**
   * Số điện thoại riêng của chi nhánh. `null` = chưa công bố trong dự án →
   * mọi nút gọi fallback về `HOTLINE` (xem `branchPhone`). TUYỆT ĐỐI không bịa
   * số: nhầm số là khách gọi nhầm cơ sở.
   */
  phone: string | null;
  /**
   * Điểm đánh giá trên Google Maps, kèm số lượt đánh giá.
   *
   * `null` = CHƯA CÓ SỐ LIỆU THẬT trong dự án ⇒ thẻ chi nhánh KHÔNG hiện
   * badge đánh giá. Đây là mặc định của cả 4 chi nhánh.
   *
   * ── VÌ SAO KHÔNG ĐỂ CHIẾC SỐ ĐẾM BỰA ────────────────────────────────────
   * Trước đây thẻ chi nhánh hiện badge "4.9 Google rating" / "4.8 Google
   * rating" lấy từ khoá i18n (`branches.b1Rating`…). Đó là những con số bịa
   * được ghi cứng trong mã nguồn, KHÔNG phải số liệu Google thật, nhưng lại
   * gắn chữ "Google" vào — tức chủ động trình bày một tuyên bố về số liệu mà
   * mình không có nguồn.
   *
   * Với một cơ sở kinh doanh có thật, hiển thị điểm đánh giá không có nguồn là
   * tuyên bố quảng cáo sai lệch, và chủ doanh nghiệp là người chịu hậu quả —
   * không phải dự án.
   *
   * Muốn bật lại: điền số thật lấy từ hồ sơ Google Business của từng chi
   * nhánh vào đây. Component tự hiện badge khi trường này khác `null`, không
   * cần sửa gì thêm ở component.
   */
  rating: { value: number; reviewCount: number } | null;
  /**
   * Ảnh thú cưng (chó/mèo) làm nền trang trí cho thẻ chi nhánh.
   * `null` = chưa có asset trong dự án → component bỏ qua ảnh, chỉ hiện nền
   * kính. Không render <Image> với path không tồn tại để tránh 404/console.
   * Xem BRANCH_IMAGE_EXPECTED để biết cần bổ sung file nào.
   */
  image: string | null;
  /**
   * Toạ độ để xếp hạng "chi nhánh gần nhất".
   *
   * GĐ3 — chủ dự án cung cấp từ Google Maps (bấm chuột phải vào đúng điểm,
   * copy cặp số ở đầu tooltip). Kiểm lại theo địa chỉ văn bản: cả 4 đều nằm
   * trong TP. Hồ Chí Minh (lat 10.79–10.85, lng 106.67–106.74).
   *
   * Vẫn giữ kiểu `| null` thay vì bắt buộc: nếu sau này thêm chi nhánh mà
   * chưa kịp lấy toạ độ, thiếu dữ liệu phải làm tính năng hạ cấp chứ không
   * phải làm hỏng cả trang (xem `nearestBranch`).
   */
  coords: { lat: number; lng: number } | null;
}

/** 4 chi nhánh — thứ tự cố định CN1…CN4, khớp ảnh tham chiếu và ClinicSystem. */
export const BRANCHES: readonly Branch[] = [
  {
    id: "b1",
    code: "CN1",
    type: "hospital",
    shortNameKey: "footer.branch1Short",
    fullNameKey: "footer.branch1",
    bookingNameKey: "branches.b1Name",
    badgeKey: "branches.b1Badge",
    bookingAddressKey: "branches.b1Address",
    bookingHoursKey: "branches.b1Hours",
    address: "1E Trần Não, P. Bình An, TP. Thủ Đức",
    addressShort: "1E Trần Não, P. Bình An",
    mapUrl: "https://maps.app.goo.gl/KpcvbzAyQmbTcN3j7",
    phone: null,
    image: null,
    rating: null,
    // 1E Trần Nas, An Khánh, Thủ Đức — chủ dự án lấy từ Google Maps (GĐ3)
    coords: { lat: 10.798595660653689, lng: 106.7333726119422 },
  },
  {
    id: "b2",
    code: "CN2",
    type: "hospital",
    shortNameKey: "footer.branch2Short",
    fullNameKey: "footer.branch2",
    bookingNameKey: "branches.b2Name",
    badgeKey: "branches.b2Badge",
    bookingAddressKey: "branches.b2Address",
    bookingHoursKey: "branches.b2Hours",
    address: "695 Nguyễn Kiệm, P. 3, Q. Gò Vấp, TP. Hồ Chí Minh",
    addressShort: "695 Nguyễn Kiệm, Q. Gò Vấp",
    mapUrl: "https://maps.app.goo.gl/EnYtxfJ9AWhx61568",
    phone: null,
    image: null,
    rating: null,
    // 695 Nguyễn Kiệm, Hạnh Thông, TP.HCM — chủ dự án lấy từ Google Maps (GĐ3)
    coords: { lat: 10.815112633459872, lng: 106.67869698972261 },
  },
  {
    id: "b3",
    code: "CN3",
    type: "clinic",
    shortNameKey: "footer.branch3Short",
    fullNameKey: "footer.branch3",
    bookingNameKey: "branches.b3Name",
    badgeKey: "branches.b3Badge",
    bookingAddressKey: "branches.b3Address",
    bookingHoursKey: "branches.b3Hours",
    address: "160 Xô Viết Nghệ Tĩnh, P. 21, Q. Bình Thạnh, TP. Hồ Chí Minh",
    addressShort: "160 Xô Viết Nghệ Tĩnh, Q. Bình Thạnh",
    mapUrl: "https://maps.app.goo.gl/bJx4y3dMZqR7gFP19",
    phone: null,
    image: null,
    rating: null,
    // 160 Xô Viết Nghệ Tĩnh, Thạnh Mỹ Tây, TP.HCM — chủ dự án lấy từ Google Maps (GĐ3)
    coords: { lat: 10.797116313811332, lng: 106.71097715265792 },
  },
  {
    id: "b4",
    code: "CN4",
    type: "clinic",
    shortNameKey: "footer.branch4Short",
    fullNameKey: "footer.branch4",
    bookingNameKey: "branches.b4Name",
    badgeKey: "branches.b4Badge",
    bookingAddressKey: "branches.b4Address",
    bookingHoursKey: "branches.b4Hours",
    address: "552 Lê Đức Thọ, P. 16, Q. Gò Vấp, TP. Hồ Chí Minh",
    addressShort: "552 Lê Đức Thọ, P. 16, Q. Gò Vấp",
    mapUrl: "https://maps.app.goo.gl/sXJDUS9XqkD9HsvD7",
    phone: null,
    image: null,
    rating: null,
    // 552 Lê Đức Thọ, Gò Vấp, TP.HCM — chủ dự án lấy từ Google Maps (GĐ3)
    coords: { lat: 10.843669991995931, lng: 106.67426680132334 },
  },
];

/**
 * Tên file ảnh thú cưng cần bổ sung cho thẻ chi nhánh (đặt trong `public/`).
 * Chỉ là HƯỚNG DẪN cho người dùng — không phải dữ liệu: giá trị ở đây KHÔNG
 * được dùng để render, vì file chưa tồn tại sẽ sinh 404. Khi bạn bỏ file vào
 * `public/`, chỉ cần đặt `image` của chi nhánh tương ứng thành đường dẫn này.
 */
export const BRANCH_IMAGE_EXPECTED: Readonly<Record<string, string>> = {
  CN1: "/chi-nhanh-cn1.webp",
  CN2: "/chi-nhanh-cn2.webp",
  CN3: "/chi-nhanh-cn3.webp",
  CN4: "/chi-nhanh-cn4.webp",
};

/** Số gọi của một chi nhánh: số riêng nếu đã công bố, không thì hotline chung. */
export function branchPhone(branch: Branch): string {
  return branch.phone ?? HOTLINE;
}

/** Link Google Maps tìm theo địa chỉ (dùng cho thẻ liên hệ, card chi nhánh). */
export function mapsSearchUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

/** Link Google Maps chỉ đường tới địa chỉ (nút "Chỉ đường"). */
export function mapsDirectionsUrl(address: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
}

/**
 * Khoảng cách Haversine (km) — chỉ dùng khi cả hai điểm đều có toạ độ.
 * Trả về `null` nếu thiếu toạ độ để chủ động hạ cấp, KHÔNG trả số 0 giả.
 */
export function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number | null {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Chi nhánh gần nhất so với vị trí người dùng.
 * Trả `null` khi: thiếu quyền định vị, hoặc CHƯA chi nhánh nào có toạ độ
 * (`coords === null`). Khi đó UI mở danh sách chi nhánh thay vì bịa kết quả.
 */
export function nearestBranch(
  position: { latitude: number; longitude: number }
): { branch: Branch; km: number } | null {
  const here = { lat: position.latitude, lng: position.longitude };
  let best: { branch: Branch; km: number } | null = null;
  for (const branch of BRANCHES) {
    if (!branch.coords) continue;
    const km = distanceKm(here, branch.coords);
    if (km === null) continue;
    if (!best || km < best.km) best = { branch, km };
  }
  return best;
}

/** View hẹp cho bước "Chọn chi nhánh đặt lịch" — suy ra từ BRANCHES. */
export interface BookingBranch {
  id: string;
  badgeKey: MessageKey;
  nameKey: MessageKey;
  addressKey: MessageKey;
  hoursKey: MessageKey;
}

export const BOOKING_BRANCHES: readonly BookingBranch[] = BRANCHES.map((b) => ({
  id: b.id,
  badgeKey: b.badgeKey,
  nameKey: b.bookingNameKey,
  addressKey: b.bookingAddressKey,
  hoursKey: b.bookingHoursKey,
}));

export const DEFAULT_BRANCH_ID = BOOKING_BRANCHES[0].id;

/**
 * Giờ mở cửa văn bản (đã nằm trong i18n qua keys `contact.hoursValue`), và
 * cấu trúc máy đọc được cho JSON-LD/điều kiện "đang mở cửa".
 * multiple: mở CẢ TUẦN (Thứ Hai → Chủ Nhật) theo i18n hiện tại.
 */
export const OPENING_HOURS = [
  { days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"], opens: "08:00", closes: "20:00" },
] as const;

/** Địa chỉ chi nhánh chính (dùng cho JSON-LD + thẻ liên hệ). */
export const MAIN_ADDRESS = {
  street: "552 Đ. Lê Đức Thọ, P. 16, Q. Gò Vấp",
  city: "TP. Hồ Chí Minh",
  country: "VN",
} as const;

/** Email liên hệ công khai (NAP). */
export const CONTACT_EMAIL = "contact@belwee.vn";

/**
 * Tên/mô tả thương hiệu — nguồn duy nhất cho metadata, JSON-LD và <title>.
 *
 * Trước đây hai hằng này nằm cục bộ trong `app/layout.tsx`, nên
 * `lib/structuredData.ts` buộc phải khai báo lại — dễ lệch nhau sau này (mô tả
 * một chỗ, schema một chỗ). Sửa ở đây là cả site đổi.
 */
export const SITE_NAME = "Belwee Pet Clinic";
export const SITE_DESCRIPTION =
  "Phòng khám & Chăm sóc thú cưng Belwee — hotline cấp cứu 24h, 4 chi nhánh tại TP. Hồ Chí Minh. Đặt lịch khám, tiêm phòng, spa grooming, khách sạn thú cưng.";

/* ────────────────────────────────────────────────────────────────────────────
   Dịch vụ chuyên khoa (cột 3 footer + mega-menu navbar)
   ──────────────────────────────────────────────────────────────────────────── */

export interface SpecialtyService {
  /** Khoá i18n cho tên dịch vụ. */
  labelKey: MessageKey;
  /**
   * Nơi link dẫn tới. Ưu tiên trang đặt lịch riêng của đúng dịch vụ nếu dự án
   * đã có (đã khảo sát: /booking/spa-grooming, /booking/kham-benh,
   * /booking/khach-san, /booking/tiem-ngua). Không dùng route không tồn tại.
   */
  href: string;
}

/**
 * 4 dịch vụ chuyên khoa — nguồn duy nhất, dùng lại cho cả footer và
 * mega-menu navbar nên hai nơi không thể lệch danh sách.
 */
export const SPECIALTY_SERVICES: readonly SpecialtyService[] = [
  {
    labelKey: "footer.service1",
    // Cấp cứu & nội trú: dự án chưa có form đặt lịch riêng cho nhánh này
    // nên dẫn tới trang Dịch vụ (đã khảo sát tồn tại) thay vì link chết.
    href: "/dich-vu",
  },
  {
    labelKey: "footer.service2",
    // Khám tổng quát & tiêm chủng: dùng form đặt lịch khám có sẵn.
    href: "/booking/kham-benh",
  },
  {
    labelKey: "footer.service3",
    // Phẫu thuật & điều trị kỹ thuật cao: chưa có form riêng → trang Dịch vụ.
    href: "/dich-vu",
  },
  {
    labelKey: "footer.service4",
    href: "/booking/spa-grooming",
  },
] as const;

/* ────────────────────────────────────────────────────────────────────────────
   Mạng xã hội
   ──────────────────────────────────────────────────────────────────────────── */

export interface SocialLink {
  /** Tên hiện tại cho aria-label + tooltip. */
  label: string;
  /**
   * URL thật. `null` = chưa có trong dự án / chưa được cung cấp.
   * Component BỎ QUA hoàn toàn mục chưa có URL, thay vì render `href="#"`
   * (link chết — vi phạm yêu cầu "không để href=#"). Chỉ cần điền URL vào đây
   * là icon tự hiện, không phải sửa component.
   */
  href: string | null;
  /** Khoá icon trong `components/SocialIcons.tsx`. */
  icon: "facebook" | "zalo" | "tiktok" | "youtube";
}

export const SOCIAL_LINKS: readonly SocialLink[] = [
  {
    label: "Facebook",
    href: "https://www.facebook.com/BelweePetShop552LeDucTho/",
    icon: "facebook",
  },
  {
    label: "Zalo",
    href: HOTLINE_ZALO,
    icon: "zalo",
  },
  // TODO(người dùng): điền URL TikTok chính thức của Belwee.
  { label: "TikTok", href: null, icon: "tiktok" },
  // TODO(người dùng): điền URL YouTube chính thức của Belwee.
  { label: "YouTube", href: null, icon: "youtube" },
] as const;
