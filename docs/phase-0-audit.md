# Giai đoạn 0 — Audit chỉ-đọc & Kế hoạch

> Trạng thái: **chưa sửa bất kỳ file code nào.** Tài liệu này chỉ ghi nhận hiện trạng.
> Repo: `Downloads/Belwee Pet Clinic/belwee-pet-clinic`

---

## 1. Nền tảng & môi trường

| Hạng mục | Thực tế |
|---|---|
| Framework | **Next.js 14.2.4** (App Router), React **18.3.1**, TypeScript 5 |
| Styling | Tailwind CSS **3.4.19** (config theo cú pháp 3.3, không dùng plugin) |
| Animation | GSAP **3.15** (+ScrollTrigger, ScrollToPlugin) · framer-motion **13.2.0** |
| Auth | next-auth **4.24** (khách) · cookie HMAC + PIN (staff, tự viết) |
| Dữ liệu | JSON file store (`lib/jsonStore.ts`) **và** MongoDB (`lib/mongodb.ts`) — chạy song song |
| Khác | zod 3.25, react-hook-form 7, nodemailer 9, html2pdf.js, lucide-react, clsx + tailwind-merge, sharp, bcryptjs |
| Dev server | `scripts/next-run.js`; `distDir` = `.next-dev` (dev) / `.next` (prod) |

**Baseline đã đo được (trước mọi thay đổi):**

```
npm run typecheck   → PASS (exit 0, không lỗi)
npm run lint        → PASS ("✔ No ESLint warnings or errors")
```

⚠️ **Hạn chế đã ghi nhận:** `AGENTS.md` yêu cầu đọc `node_modules/next/dist/docs/` trước khi viết code, nhưng **thư mục đó không tồn tại** trong repo (chỉ có `license.md` và `README.md`). Vì vậy mọi thay đổi liên quan Next sẽ dựa trên API thực tế trong `node_modules/next@14.2.4` và **được kiểm chứng bằng `next build`**, không dựa vào tài liệu không có.

---

## 2. Cấu trúc dự án

- `app/` — 31 page route (public + staff + portal)
- `components/` — 33 component gốc + `ui/` (2) + `staff/` (14) + `portal/` (3)
- `lib/` — 52 module nghiệp vụ · `hooks/` (2) · `types/` · `security/` · `data/` (JSON store) · `docs/`
- `middleware.ts` — chặn `/staff/**` + `/api/staff/**`, kiểm HMAC bằng Web Crypto (edge)

**Danh sách route (để lập bảng show/hide cho hạng mục D):**

```
/                        /dich-vu                 /staff
/booking/[service]       /doi-ngu                 /staff/chat
/booking/khach-san       /doi-ngu/[slug]          /staff/dashboard
/booking/spa-grooming    /gioi-thieu              /staff/forgot-pin
/booking/tiem-ngua       /kien-thuc-thu-y         /staff/login
/cap-lai-mat-khau        /kien-thuc-thu-y/[slug]  /staff/profile
/care-schedule           /lien-he                 /staff/receipts
/ChiTietBookingForm      /tao-tai-khoan           /staff/register
/client-portal           /tien-ich                /staff/rules
/dang-nhap               /trang-ca-nhan           /staff/team
/tuyen-dung  ·  /tuyen-dung/chi-tiet
```

**i18n:** `lib/i18n.ts` (1309 dòng) — `translations.en` + `translations.vi`, type `MessageKey` suy ra từ `en`. Quy ước của repo: **mọi chuỗi hiển thị đi qua `t(key)`**, không viết text trong JSX. Mọi section mới phải thêm key cho **cả `en` và `vi`** nếu không type sẽ lỗi.

---

## 3. Design system "liquid glass" hiện có (đầu vào của mục 2)

Repo **đã có** vật liệu kính nhưng bị **phân mảnh thành 3 namespace**:

| Namespace | Vị trí | Dùng cho |
|---|---|---|
| `--pt-*` | `globals.css` L5754+ (light) và L5797+ (dark) | `.pt-glass`, `.pt-glass-strong` — **theme-aware, đây là hệ token hiện đại nhất**, đã có đủ nhánh sáng/tối |
| `--lg-*` | `.liquid-glass-base` / `.lg-material` | **chỉ** navbar (tint/glare/rim/hairline/blur/saturate/drop) |
| `--glass-*` + `.apple-glass(-dark)` | `globals.css` L498+ | legacy; Tailwind `boxShadow: glass / vision-glass / vision-glass-hover` |

Tailwind config đã có sẵn: `shimmer-liquid`, `fluid-wobble`, `ripple-expand`, `blob` (keyframes/animation); `backdropBlur 2xl/3xl`; `glass-noise`, `liquid-mesh`.

Component sẵn có: `components/ui/LiquidGlassCard.tsx`, `components/LiquidGlassDefs.tsx` (SVG filter `container-glass`).

**Đề xuất (giả định, cần duyệt):** *không* tạo namespace `--glass-*` thứ tư. Thay vào đó **thêm alias `--glass-*` trỏ về `--pt-*`** (đã có light/dark), rồi xây `GlassSurface` / `GlassPill` / `GlassButton` trên đó. Lý do: tránh 2 nguồn chân lý cho kính → tránh đúng loại lỗi "chữ trắng trên pill trắng" mà comment trong `globals.css` đã từng phải sửa.

**Dark mode tồn tại thật:** `data-theme="light|dark"` trên `<html>` (`components/ThemeProvider.tsx` + script chống flash trong `layout.tsx`). ⇒ Mọi nền "trắng sáng" ở A5 bắt buộc có nhánh tối.

---

## 4. Trang chủ — hiện trạng theo từng hạng mục A

`app/page.tsx` là **một client component 1164 dòng**. Thứ tự render thực tế:

```
Hero → #home-services (A2) → #home-vets → #vet-knowledge (A3)
     → ClinicSystem (A4) → StatsBand (A5) → BelweeNewsSection → CTA
```

| Mục | File | Hiện trạng | Việc cần làm |
|---|---|---|---|
| **A1** | `app/page.tsx` (`bgRef`) | Một layer `fixed inset-0` duy nhất chứa **gradient + `url(/anhnentcdichvu.webp)`**, GSAP `scrub` đổi `opacity 0→1` trong 0–60% trang. Video hero nằm ở `.hero-video-layer` riêng, tự mờ bằng **CSS mask gradient** (không cross-fade theo scroll). | Tách thành 2 layer fixed cross-fade bằng `useScroll`+`useTransform`; `pause()` video khi opacity≈0. Ảnh nền ✓ tồn tại. |
| **A2** | `page.tsx` `#home-services` | Coverflow 3D: `translate3d/rotateY/scale` (offset 210px, rotate 38°, scale .78). Điều khiển = **2 nút tròn + 4 nút chấm `role="tab"`**, keyboard ←/→, swipe. Thẻ = gradient trắng/xanh, `ring-1`, shadow. | Thẻ to–đều + `GlassSurface`; **thay nút+chấm bằng 1 pill kính động** (tên thẻ active + trước/sau) có morph; giữ nguyên mobile. |
| **A3** | `page.tsx` `#vet-knowledge` | 5 thẻ `knowledge[]` **thứ tự cố định**, cuộn ngang + 2 nút tròn; dùng `.apple-glass`. | `GlassSurface`/`GlassPill` + **xáo trộn hydration-safe**. Tiền lệ tốt đã có: `AboveFooterCard` xáo trộn trong `useMemo` sau mount. |
| **A4** | `components/ClinicSystem.tsx` | `flex flex-col gap-6` = **1 cột**, `max-w-5xl`, ~170 dòng CSS-in-component, 4 chi nhánh, cả thẻ là `role="button"`. Trang chủ gọi `<ClinicSystem linkTo="/lien-he" />`. | Desktop **2 cột**; `GlassSurface`; pill "Chúng tôi là ai?" → `/doi-ngu`. ⚠️ Component **dùng chung với `/doi-ngu`** ⇒ phải gate bằng prop, không sửa cứng. |
| **A5** | `components/StatsBand.tsx` | `dl` grid 2 cột → `md:grid-cols-4`, `.pt-glass`, `CountUp`, **số tính từ dữ liệu thật**: `BRANCHES.length` (4) · `teamDoctors`+`STAFF_PROFILES` (10) · `DECLARED_YEARS = 10` · `knowledgeArticles.length` (12). File ghi rõ quy tắc **"KHÔNG ĐƯỢC BỊA SỐ"**. | ⚠️ **Xung đột nội dung — xem §7.** Phần nền (trắng → blob xanh → kính) hiện **chưa có gì**. |
| **A6** | — | Section **không tồn tại**. | Tạo mới, chèn giữa `#home-services` và `#home-vets`. Cả 4 ảnh ✓ tồn tại (xem §6). |
| **A7** | — | **Đã có hệ thống dùng chung**, không cần xây mới. | Áp dụng nhất quán; xác nhận hero không bị gate (hiện hero chạy GSAP sau `pageReady`, không qua reveal ✓). |

**A7 — hệ thống reveal hiện có (2 tầng):**
- `components/AnimationProvider.tsx` — gắn ở `app/layout.tsx`, quét toàn `main` cho `[data-reveal]`, `[data-reveal-group]` (stagger), và `[data-reveal-exit]` (**hai chiều, scrub theo scroll**). Đã có logic đặc biệt giữ tiêu đề trong cây trợ năng (dùng `opacity` thay `autoAlpha` để không phá heading-order — một fix Lighthouse có thật).
- `components/Reveal.tsx` — wrapper React, GSAP ScrollTrigger `once: true`.
- `lib/motion.ts` — `prefersReducedMotion()` là **nguồn duy nhất** cho mọi quyết định JS. `FORCE_MOTION = false` (đã sửa lỗi cũ khiến reduced-motion bị vô hiệu toàn site).

---

## 5. Hạng mục B — Danh sách skeleton/loading cũ (Bước 1)

| File | Dòng | Vấn đề |
|---|---|---|
| `components/ui/LiquidSkeleton.tsx` | 13–28 | 1 mục đích duy nhất (chỉ `circle \| rect`), màu hardcode `bg-white/5` (thiết kế cho nền tối) → sai tông ở site sáng. Shimmer qua `animate-shimmer-liquid`, **không có nhánh reduced-motion**. |
| `app/lib/route-skeletons.tsx` | 10–115 | `LiquidBlock` + `PageSkeleton` + `HomeSkeleton`. `PageSkeleton` hardcode nền **navy đậm `#0a0f1c`** trong khi site mặc định sáng → nháy sai màu. Kích thước là **phỏng đoán**, không khớp layout thật → CLS. `role="status"` có, nhưng **không có `aria-busy` và không có text `sr-only`**. `aria-hidden` trên block trang trí ✓. |
| `app/loading.tsx` | 1–63 | Loader toàn màn hình nền tối: **2 blob `blur-3xl` 96×96 `animate-pulse`** + SVG filter `feGaussianBlur`+`feColorMatrix` + `animate-bounce` + shimmer inline. Không `role="status"`/`aria-busy`. **Keyframes `loadingShimmer` trùng lặp** với `skeletonShimmer`, không reduced-motion. |
| `components/staff/StaffDashboard.tsx` | 355, 404 | `animate-pulse` viết thẳng trong JSX — không component dùng chung, không a11y. |
| `app/tuyen-dung/page.tsx` | 106–110, 152 | `@keyframes skeletonShimmer` **bản sao thứ 3** + `.skeleton-block` inline + `animate-pulse` cho bong bóng trang trí. |
| `app/gioi-thieu/page.tsx` | 232 | `animate-pulse` cho quầng sáng trang trí (không reduced-motion). |

**Kết luận B:** có **≥3 bản sao keyframes shimmer** (`globals.css:144`, `app/tuyen-dung:110`, `app/loading.tsx:60`) + Tailwind `shimmer-liquid`. **Không có** một component `Skeleton` dùng chung, **không có** ràng buộc reduced-motion cho shimmer, **không có** `aria-busy`, và **không có** ràng buộc giữa kích thước skeleton ↔ nội dung thật.

---

## 6. Kiểm tra tồn tại của asset

**A6 — 4 ảnh hoạt động ✓ (đúng tên, đúng chỗ, sẽ tham chiếu bằng URL gốc `/ten-file.jpg`):**

| # | File | Tồn tại |
|---|---|---|
| 1 | `/hoatdongkhamchuabenh.jpg` | ✓ |
| 2 | `/hoatdongsieuam.jpg` | ✓ |
| 3 | `/hoatdongkhaitruong.jpg` | ✓ |
| 4 | `/hoatdongchamsoc.jpg` | ✓ |

**A1 —** `/anhnentcdichvu.webp` ✓ (bản `.png` cũng còn, **sẽ giữ nguyên cả hai, không đổi tên/di chuyển**).
**A5/A2/A3 —** ảnh dịch vụ & kiến thức (`khamchuabenh.webp`, `xquang-ctsan.webp`, `spagroming.webp`, `khachsan.webp`, `top1–5.webp`) ✓ đều tồn tại. Video hero `/belwee-hero.mp4` + `/belwee-super.mp4` ✓.

---

## 7. ⚠️ Xung đột cần bạn quyết trước khi làm A5

Yêu cầu A5 ghi 3 thẻ phải là:

1. "Hơn 12 năm kinh nghiệm"
2. "Đội ngũ nhân viên có hơn 30 bác sĩ và tiến sĩ"
3. "Chi nhánh phủ khắp Thành phố Hồ Chí Minh"

Ba nội dung này xung đột với **bốn** điều đang có trong repo:

1. `components/StatsBand.tsx` tuyên bố rõ **"⚠️ KHÔNG ĐƯỢC BỊA SỐ"** — mọi con số đều tính từ dữ liệu thật (`BRANCHES.length`, `teamDoctors + STAFF_PROFILES`, `DECLARED_YEARS`, `knowledgeArticles.length`).
2. Số liệu thật hiện tại: **4 chi nhánh, 10 nhân sự, 10 năm, 12 bài** — không phải 12 năm / 30 bác sĩ.
3. Trang `/gioi-thieu` (nội dung đã xuất bản của chính website) tuyên bố **"hơn 10 năm"** ⇒ "hơn 12 năm" **mâu thuẫn với chính site**.
4. Chính master prompt, mục 1, cấm: *"Không tự bịa số liệu, thành tích, tuyên bố y khoa."*

Ngoài ra "Chi nhánh phủ khắp Thành phố Hồ Chí Minh" là **chữ, không phải số** → phá `CountUp` và phá bố cục 4 thẻ số đồng dạng.

**Đề xuất:** làm phần *nền + animation* của A5 đúng như yêu cầu, và chờ bạn chọn 1 trong 3 hướng cho phần nội dung (xem câu hỏi ở cuối báo cáo). Tôi **không tự đổi thẻ thứ tư** cho tới khi có xác nhận.

---

## 8. Hạng mục C — Navbar

`components/SiteNavbar.tsx` (605 dòng), một component **dùng chung** cho site + staff portal (menu truyền qua prop `items`).

**5 lớp nền chồng nhau:** `.site-global-nav-glass`, `.site-global-ripple-init`, `.site-global-ripple-reverse` (gắn `key={atTopCount}` → **remount mỗi lần về đầu trang**), `.site-global-nav-glow`, `.site-global-nav-sheen`; cộng thêm `.is-morph::before`.

**Nghi phạm "dải màu xanh trễ phía sau" (xếp theo khả năng):**

1. **3 lớp gradient XANH có "đồng hồ" riêng, lệch nhịp với transform của nav:**
   `rippleInitWave 2.0s (delay .3s)` · `rippleReverseIn 1.1s` · `gooeyStretch .8s` · `.site-global-nav-glow { transition: opacity .5s, transform .5s }`
   → trong khi chính nav chỉ `transition: transform .5s cubic-bezier(.16,1,.3,1)`.
2. **`backdrop-filter` bị cố ý KHÔNG transition** (có comment PERF trong `globals.css`) ⇒ độ mờ/nền đổi **tức thời** trong lúc hình dạng nav **co giãn trong 500ms** → mắt thấy "mảng xanh" tách rời khỏi thanh.
3. **State được cập nhật qua React state** (`setIsScrolled` / `setIsScrollingDown` / `setIsAtTop`) trong `requestAnimationFrame` → đổi lớp kính ở một thời điểm khác với animation CSS đang chạy.

**Bug code đọc được ngay:** `useEffect` thêm class `site-global-nav-active` vào `<body>` bị **khai báo trùng 2 lần** trong cùng file (dead duplicate).

**C2:** hiện có **7 mục nav**, chưa có cơ chế "3 mục + Thêm". `Math.random` hiện chỉ dùng cho góc mở hamburger (client-only ⇒ **không** gây hydration mismatch).

---

## 9. Hạng mục D — thẻ "Belwee luôn quan tâm bạn"

**Chưa tồn tại.** Lưu ý phân biệt: `components/AboveFooterCard.tsx` là thứ **khác** (3 chuyên gia + 3 bài viết ngẫu nhiên) và chỉ được render **thủ công** ở 3 trang: `/gioi-thieu`, `/dich-vu`, `/tuyen-dung`.

`app/layout.tsx` là **layout duy nhất** (SiteNavbar + main + Footer), **không có route group**. ⇒ D nên làm bằng một client component đọc `usePathname()` + **một mảng loại trừ tập trung**, gắn một lần trong layout trước `<Footer />`.

---

## 10. Các hạng mục còn lại — mức độ sẵn sàng

| Mục | Sẵn có | Còn thiếu |
|---|---|---|
| **E** (Staff) | RBAC thật: `lib/staffPermissions.ts` (6 role × 10 action, deny-by-default); `middleware.ts`; ~20 route `/api/staff/**`; **SSE realtime** `lib/realtime.ts` + `app/api/realtime/stream`; hồ sơ bệnh án `lib/dbMedicalRecords.ts` | `@dnd-kit` (Kanban), `qrcode` (toa thuốc), **mô hình kho vật tư chưa có** (E3), Voice = Web Speech API (không cần dep) |
| **F** (Booking Wizard) | `app/booking/**` (4 luồng), `components/BookingConfirmDialog.tsx`, `lib/bookingService.ts`, `lib/validators.ts` (zod), `BookingStatusTimeline` | Chuyển thành wizard liên tục, lưu state vào URL, kiểm slot phía server |
| **G1** | — | Toàn bộ anatomy map (greenfield) |
| **G2** | `BookingLensButton.tsx`, `BookingEnvelopeSuccess.tsx`, `GlassToast.tsx` | Morph trạng thái idle/loading/success/error |
| **H** | — | **Không có e-commerce/cart/sản phẩm/tồn kho nào.** Cần cả mô hình dữ liệu sản phẩm. Zustand thiếu. → **greenfield lớn nhất** |
| **I1** | `public/manifest.json` tĩnh | Không service worker, không logic offline. Thiếu `serwist`/`@serwist/next` |
| **I2** | Toàn bộ form là client `fetch` → `/api/*` | **Không form nào dùng Server Action** → đây là migration lớn nhất về rủi ro |
| **I3** | `next/og` **có sẵn trong Next 14** (không cần cài `@vercel/og`) | Chưa có route `opengraph-image*` nào |
| **K1** | `PetSpeciesPicker.tsx`, `lib/petSpecies.ts`, `PetThemeToggle.tsx` | `PetThemeToggle` chỉ là toggle sáng/tối (🦴/🐟) — **không phải** pet-driven theming. Thiếu Zustand |
| **K2** | — | Thiếu `@react-three/fiber` + `drei`; không có model GLB |
| **L** | — | Chưa có gì; cần Web Push/VAPID (`web-push`) |

---

## 11. Dependency cần cài (chờ duyệt)

`zustand` · `@dnd-kit/core` (+`/sortable`, `/modifiers`) · `qrcode` · `serwist` + `@serwist/next` · `@react-three/fiber` + `@react-three/drei` · `web-push`

**Không cần cài:** `next/og` (đã tích hợp trong Next 14).

---

## 12. Rủi ro & giả định

1. **A5 xung đột nội dung** (§7) — cần quyết định của chủ dự án.
2. `app/page.tsx` là **1 client component 1164 dòng** đã chứa nhiều fix tinh tế (hydration, double-tap carousel, a11y heading-order, will-change lifecycle) ⇒ mọi thay đổi phải **nhỏ và có kiểm chứng**, không viết lại.
3. **Layout đơn** ⇒ thẻ D dễ gây regression toàn site.
4. **I2** nên làm từng form, **giữ API route song song**, không xoá đường cũ trong cùng bước.
5. **H không có dữ liệu sản phẩm** ⇒ phải chọn nguồn (JSON store sẵn có hay Mongo) trước khi code.
6. **Dark mode tồn tại thật** ⇒ mọi nền sáng phải có nhánh tối.
7. **Không có file test nào** (`repo_stats: 0`). `npm test` / `npm run verify` thực chất là **8 script `tsx` kiểm tra tĩnh**, không phải unit test. Không có Playwright/Jest.
8. **Dữ liệu y tế/cá nhân (E, I, K, L):** cần chủ dự án/pháp chế xác nhận theo **Nghị định 13/2023/NĐ-CP**. Tôi **không tự đưa ra kết luận pháp lý**; sẽ chỉ ghi chú vị trí cần xác nhận.
9. **Giả định về token kính:** mở rộng `--pt-*` và thêm alias `--glass-*` thay vì tạo namespace mới (§3).

---

## 13. Kế hoạch 8 giai đoạn (điều chỉnh theo audit)

| GĐ | Nội dung | Ghi chú từ audit |
|---|---|---|
| 0 | Audit + kế hoạch | ✅ **Hoàn tất** (tài liệu này) |
| 1 | Tokens hợp nhất + `GlassSurface`/`GlassPill`/`GlassButton`; chuẩn hoá hệ Reveal; **hệ Skeleton (B)** | A7 đã có `AnimationProvider` + `Reveal` → chỉ mở rộng, **không xây mới**. B cần xoá 3 bản sao keyframes shimmer |
| 2 | Trang chủ A1→A7 | A5 chờ quyết định nội dung; A6 tạo mới `WhyChooseBelwee` |
| 3 | Navbar (C) + thẻ D | C1: sửa gốc theo §8, phải **quay lại xác minh bằng Performance recording**; gỡ `useEffect` trùng |
| 4 | Booking Wizard (F) + G2 + G1 + Server Action (I2) cho form đặt lịch | I2 làm từng form, giữ API cũ |
| 5 | E-commerce (H) | **Cần chọn nguồn dữ liệu sản phẩm trước** |
| 6 | Staff (E) + PWA (I1) + nốt I2 + OG Images (I3) | E3 cần mô hình kho; SSE đã có sẵn để dùng |
| 7 | Cá nhân hoá (K) | K1: `--glass-tint` qua `data-pet-theme` |
| 8 | Gamification & cộng đồng (L) | Cần Web Push/VAPID |

**Nguyên tắc thực thi đã cam kết:** mỗi giai đoạn chạy `npm run typecheck` + `npm run lint` (+ `next build` trước khi kết thúc giai đoạn chạm vào render), kiểm tra viewport 1440/1280/1024/768/390/360, báo cáo trung thực những gì **chưa** kiểm thử được.
