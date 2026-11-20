# GĐ0 (v2) — Audit chỉ-đọc & Kế hoạch lại

> Ngày: 2026-10-10 · Repo: `Downloads/Belwee Pet Clinic/belwee-pet-clinic`
> **Không sửa một dòng mã nguồn nào.** Tài liệu này chỉ ghi nhận hiện trạng + kế hoạch.
> Bản GĐ0 cũ: `docs/phase-0-audit.md` (lập **trước** GĐ1 — đã lệch, xem §2).

---

## 0. Baseline đo thật (đã chạy)

| Lệnh | Kết quả |
|---|---|
| `npm run typecheck` | **PASS** (exit 0, không lỗi) |
| `npx next lint` | **PASS** — "✔ No ESLint warnings or errors" |
| `npm run build` | **PASS** (exit 0), 63 route biên dịch, `First Load JS shared by all: 87.5 kB` |
| `node scripts/phase2-check.js http://localhost:3001` | xem §6 — **A3/A4/A5/A6 đạt**, script báo 2 lỗi **giả** do chính script (§6.7) |

**Môi trường đang chạy:** dev server của bạn ở cổng **3001** (PID 3860). Tôi chỉ **đọc** nó, không khởi động/tắt tiến trình nào.

### ⚠️ Chưa đo (không được suy ra là đạt)
- **Lighthouse**: chưa chạy. ⇒ **không** tuyên bố đạt Core Web Vitals, không có số LCP/CLS/TBT.
- **Performance trace / CPU throttle 4×**: chưa quay. ⇒ chưa có FPS, số layer compositor, long task.
- **Ảnh chụp màn hình** ở 1920/960: chưa chụp. Các đo bố cục hiện chỉ là **computed style** (`gridTemplateColumns`, `scrollWidth`), không phải ảnh.
- **Safari iOS / Firefox / thiết bị cảm ứng thật**: chưa kiểm.

---

## 1. Nền tảng

| Hạng mục | Thực tế (đã đọc `node_modules`) |
|---|---|
| Framework | **Next.js 14.2.4** App Router · React **18.3.1** · TS **5.9.3** |
| Styling | Tailwind **3.4.19** (`tailwind.config.ts`, không plugin) · `globals.css` **6205 dòng** |
| Animation | **GSAP 3.15** (+ScrollTrigger) · **framer-motion 13.2.0** · CSS keyframes |
| Auth | next-auth 4.24 (khách) · cookie HMAC + PIN (staff, tự viết) |
| Data | JSON store (`lib/jsonStore.ts`) **+** MongoDB (`lib/mongodb.ts`) — chạy song song |
| i18n | `lib/i18n.ts` 1330 dòng, `en` (mặc định) + `vi`. Quy ước repo: **mọi chuỗi qua `t(key)`** ⇒ section mới phải thêm key cho **cả 2 ngôn ngữ** |
| Test | **Không có** Jest/Vitest/Playwright. `npm run verify` = typecheck + lint + 8 script `tsx` tự viết. Ba script CDP tay: `scripts/phase1-check.js`, `scripts/phase2-check.js`, `scripts/mobile-check.js` |
| Dependency chết | `lighthouse@13.5.0` + `playwright-core@1.62.1` **không được import ở đâu** |

**Cảnh báo `AGENTS.md`:** yêu cầu đọc `node_modules/next/dist/docs/` — **thư mục đó không tồn tại**. Mọi kết luận về Next dựa trên API thực tế của `next@14.2.4` + kiểm chứng bằng `next build`.

---

## 2. ⚠️ Điểm quan trọng nhất: GĐ1 đã xong, GĐ2 đã làm một nửa

Bản GĐ0 cũ nói A6 "không tồn tại", B "chưa có Skeleton", A3 "thứ tự cố định". **Tất cả đã sai** — vì GĐ1 đã chạy sau đó.

| Tài liệu | Nội dung | Trạng thái |
|---|---|---|
| `docs/phase-0-audit.md` | GĐ0 (trước GĐ1) | **Lệch** ở A6, B, A3, A5, D, F |
| `docs/phase-1-report.md` | GĐ1 — tokens + Glass + Reveal + Skeleton | Đúng, đã kiểm chứng |

**⇒ Kế hoạch phải lập lại từ trạng thái thật, không dùng lại bảng của GĐ0 cũ.**

Dấu vết GĐ2 đang dở nằm trong `scripts/phase2-check.js` (script kiểm A3/A4/A5/A6) — tức A3, A4, A5 (nền+anim), A6 **đã làm**; **A1, A2, A7 chưa**.

---

## 3. Design system kính (§2) — ĐÃ CÓ, dùng lại được

Không cần xây namespace mới. Đã có:

| Tầng | File | Ghi chú |
|---|---|---|
| Token gốc theme-aware | `--pt-*` trong `globals.css` (sáng + tối) | nguồn sự thật |
| Token kính dùng chung | `--glass-*` trong `globals.css:5814+` | **alias trỏ về `--pt-*`**, không phải namespace thứ tư |
| Vật liệu | `.pt-glass` / `.pt-glass-strong` (`:5933`, `:5963`) | 5 lớp, `backdrop-filter` thật |
| Fallback | `@supports not (backdrop-filter…)` (`:5986`) · `@media (prefers-reduced-transparency)` (`:6013`) | ✅ đã có |
| Component | `components/ui/GlassSurface.tsx` · `GlassPill.tsx` · `GlassButton.tsx` · `Skeleton.tsx` | không có hook → dùng được cả Server Component |
| Reveal | `components/Reveal.tsx` + `components/AnimationProvider.tsx` + `lib/revealVariants.ts` | 1 bảng variant dùng chung |

**Nhưng:** `GlassButton` có **đủ** 4 trạng thái `idle/loading/success/error` (`GlassButton.tsx:27`, `data-gstatus` ở `:62`, CSS ở `globals.css:6154/6161`) — **nhưng cả 2 chỗ đang dùng đều không truyền `status`** (`app/page.tsx:1029`, `:1039`) ⇒ nhánh loading/success/error **chưa từng chạy thật**.

---

## 4. Trang chủ — bản đồ thật

`app/page.tsx` — **1 client component, 1204 dòng**. Thứ tự render thật:

```
Hero (video 2 nguồn luân phiên)
  → #home-services      A2  coverflow 3D · 2 nút tròn + 4 chấm
  → WhyChooseBelwee     A6  ✅ XONG
  → #home-vets          chuyên gia (STAFF_PROFILES 4 thẻ)
  → #vet-knowledge      A3  ✅ XONG (kính + xáo hydration-safe)
  → ClinicSystem        A4  ✅ XONG (2 cột từ lg + pill /doi-ngu)
  → StatsBand           A5  ✅ XONG (nền + giọt nước + blob; số liệu THẬT)
  → BelweeNewsSection        (chỉ Reveal)
  → CTA panel cuối
```

| Hạng mục | Hiện trạng thật | Còn thiếu |
|---|---|---|
| **A1** nền cuộn | `page.tsx:611-623` — **một** layer `fixed` chứa gradient + `url(/anhnentcdichvu.webp)`, GSAP `scrub` đổi `opacity 0→1` (`:392-409`). Video tự mờ bằng **CSS mask** (`:641`), không cross-fade theo scroll. | Tách 2 layer fixed, cross-fade bằng `useScroll/useTransform`; `pause()` video khi opacity≈0; `poster`; `-webkit-backdrop-filter`; bảng z-index |
| **A2** coverflow | 3 thẻ, `offset 210px`, `rotateY 38°`, `scale .78` (`:51-55`, `:823`). Điều khiển = **2 nút tròn + 4 chấm `role=tab`** (`:866-912`). | **Pill kính động** thay nút+chấm; `GlassSurface` cho thẻ; size clamp; spring; `aria-live` |
| **A3** kiến thức | ✅ `useShuffledOrder` (đúng chống mismatch) + `pt-glass glass-surface` + 2 `GlassButton`. | **Ẩn thanh cuộn mặc định** (chưa có `scrollbar-width:none` ở khối này); gộp 2 bộ điều khiển (mũi tên trùng thanh cuộn); `SkeletonKnowledgeCard` placeholder |
| **A4** phòng khám | ✅ `lg:grid-cols-2`, `backdrop-filter` thật (đo: `blur(22px) saturate(1.7)`), pill `/doi-ngu`. | `mt-auto` cho khối nút (dùng `flex flex-col`); `role="button"` + `aria-pressed` trên thẻ → nên là link/button đúng nghĩa; chuẩn hoá `GlassSurface` thay CSS trong `<style>` |
| **A5** con số | ✅ Nền trắng → giọt nước (`useScroll`) → kính → 2 quầng màu. Đo thật: blob đổi transform theo cuộn ✓ | **Xung đột nội dung** — xem §9 Q1 |
| **A6** | ✅ 4 ảnh đúng thứ tự, đủ alt, 1px/130px, không tràn ở 6 bề rộng | Ảnh nền phía sau là **ảnh mờ** ⇒ mô tả `text-slate-600` cần đo tương phản thật |
| **A7** reveal | ✅ Đã dùng rộng: `data-reveal` / `data-reveal-group` / `data-reveal-exit` ở ~15 file | Áp cho phần chưa có; hero **không** gate (đúng); kiểm `data-reveal-exit` không làm mất nội dung |
| **§24** tiêu đề kính | ❌ Chưa có. `h1` hiện là `text-white` + `drop-shadow` (`:725`) | `GlassHeading` component |

### 4.1 Section mới mục §25 — **chưa có cái nào**

| Mục §25 | Tồn tại? |
|---|---|
| 25.1 Quick Action Dock | ❌ (chỉ có `BookingLensButton` trong hero) |
| 25.2 Quy trình 4 bước | ❌ |
| 25.3 Teaser giải phẫu | ❌ (greenfield, xem §5) |
| 25.4 Tìm phòng khám gần bạn | ⚠️ **Logic có, dữ liệu không** — xem §9 Q2 |
| 25.5 Đánh giá chủ nuôi | ❌ (đúng — cần dữ liệu thật) |
| 25.6 FAQ | ❌ |
| 25.7 Nhắc lịch opt-in | ⚠️ Có hạ tầng: `/api/bookings/notifications/*`, `/api/cron/reminders`, `NotificationToggle` |
| 25.8 Closing CTA | ⚠️ Có `cta-panel` cuối trang nhưng là gradient xanh đặc, không phải kính |
| §27 mobile action bar / specular / magnetic / scroll pill / Ctrl+K | ✅ `CommandPalette` + `ScrollProgressBar` đã có; ❌ 3 cái còn lại |

---

## 5. Ma trận hạng mục (có thật / thiếu)

| Mục | Đã có | Thiếu — mức công |
|---|---|---|
| **B** Skeleton | ✅ Xong GĐ1: `Skeleton.tsx` + preset + `SkeletonStatus`, shimmer bằng `transform`, `aria-busy`, tắt khi reduced-motion. `app/loading.tsx` + `app/lib/route-skeletons.tsx` đã viết lại | Chỉ còn: `SkeletonKnowledgeCard` cho A3 |
| **C1** Navbar xanh trễ | ❌ (nguyên nhân §7) | Trung bình |
| **C2** 3 mục + Thêm | ❌ — nav luôn render đủ **7 mục** (`SiteNavbar.tsx:28-36`). Hamburger đã là menu phụ đầy đủ ⇒ tái dùng làm "Thêm", **không tạo menu thứ hai** | Nhỏ |
| **D** thẻ trên footer | ⚠️ `AboveFooterCard` **đã có** + **đã sửa lỗi hydration** (`useShuffledOrder`) — nhưng **gắn thủ công** ở đúng 3 trang: `/gioi-thieu:281`, `/dich-vu:518`, `/tuyen-dung:189`. Chưa vào layout | Nhỏ (nhưng dễ gây regression toàn site) |
| **E** Staff | ✅ RBAC **rất tốt**: deny-by-default, 6 role × 10 action, `requireStaffAction()` check server-side ở 9 route, audit log khi từ chối, middleware edge. SSE realtime có sẵn | E1 Kanban+DnD **rất lớn** (cần thêm 3 trạng thái vào `BookingStatus`) · E2 đơn thuốc **lớn** (+`qrcode`) · E3 kho **zero** · E4 radar **zero, thiếu cả trường quận** · E5 voice **zero, không cần dep** |
| **F** Booking | 5 route, **đều là 1 form dài**, state ở `localStorage`, **không có state trong URL**. POST `/api/booking` có chống trùng slot → 409 | Wizard + URL state + **GET availability** + Server Action |
| **G1** Anatomy map | ❌ zero | Greenfield |
| **G2** Micro-interaction | ⚠️ `GlassButton` đủ 4 trạng thái nhưng **chưa ai truyền `status`**; `BookingLensButton` không có state machine | Trung bình |
| **H** E-commerce | ❌ **zero**: không product/SKU/giá/tồn kho/đơn hàng. **Zustand chưa cài** | Lớn nhất |
| **I1** PWA | ⚠️ `public/manifest.json` có, nhưng **không service worker, không offline queue**. Side-bug: manifest trỏ `/icon.png` — **file không tồn tại** ⇒ 2 shortcut 404 | Trung bình |
| **I2** Server Actions | ❌ **zero** — grep `use server`/`useFormStatus`/`useOptimistic`/`revalidatePath` = **0 match**. 26 route handler | Lớn, rủi ro cao |
| **I3** OG động | ❌ zero route. **`next/og` có sẵn trong Next 14** ⇒ không cài gì | Thấp |
| **K1** Pet theming | ⚠️ Token `--glass-tint` có, CSS `.glass-surface__tint` có, prop `tint` có — nhưng **không ai set `data-pet-theme`**. `PetThemeToggle` là **nút sáng/tối**, tên gây hiểu nhầm | Trung bình |
| **K2** 3D | ❌ zero. Không three/R3F/drei, không GLB | Lớn + cần asset có giấy phép |
| **L** Gamification | ❌ zero (badge hiện tại đều là **nhãn trang trí**). Có thể tái dùng: SSE + preference + cron email | Lớn + cần VAPID |

---

## 6. Đo thật trên trình duyệt (`scripts/phase2-check.js`, dev server :3001)

**A6 — "Nơi chăm sóc thú cưng của bạn tốtất nhất":**
```
card 1 /hoatdongkhamchuabenh.jpg  natW=290  alt ✓  desc 172 ký tự
card 2 /hoatdongsieuam.jpg        natW=290  alt ✓  desc 126
card 3 /hoatdongkhaitruong.jpg    natW=290  alt ✓  desc 155
card 4 /hoatdongchamsoc.jpg       natW=290  alt ✓  desc 126
1440→4 cột  1280→4  1024→4  768→2  390→2  360→1     overflowX=0 ở cả 6
đường kẻ: h=1px w=130px ✓
```

**A4:** `@1280 → 2 cột`, `@768 → 1 cột`; `.clinic-branch-card` backdrop `blur(22px) saturate(1.7)`; pill `/doi-ngu` bo `9999px`, blur `11px` ✓

**A3:** lượt 1 `top3, top2, top1, top5, top4` → lượt 2 `top4, top5, top3, top2, top1` ⇒ **đã xáo, không lặp thẻ**; `blur(22px) saturate(1.7)`, bo góc 28px

**A5:** trước cuộn `matrix(0.12,0,0,0.3,0,0)` opacity 0 → sau cuộn `none` opacity 0.419, lớp trắng 1 → 0 ⇒ **blob điều khiển bằng scroll ✓**

### 6.7 Hai lỗi script báo — là **lỗi của script**, không phải của app
Script set `localStorage['belwee-language']='vi'` rồi `Page.navigate` tới **cùng URL** `/` ⇒ trình duyệt coi là same-document, **không reload** ⇒ `LanguageProvider` không đọc lại ⇒ vẫn tiếng Anh. Key `belwee-language` là **đúng** (`lib/i18n.ts:12`). Sửa: thêm query chống cache khi chuyển ngôn ngữ.

---

## 7. C1 — Nguyên nhân gốc "dải xanh trễ phía sau navbar" (giả thuyết, **cần GĐ3 xác minh bằng Performance trace**)

Navbar có **5 lớp nền chồng nhau** + 1 `::before`. Ba nghi phạm, xếp theo độ khả nghi:

1. **`--scroll-progress` nhảy theo nấc ~50px còn transform chạy 500ms.**
   `SiteNavbar.tsx:219-222` cập nhật `--scroll-progress` mỗi ~50px trong khi `handleScroll`; nó đẩy `--lg-blur 16→24px`, `--lg-tint-a .34→.54`, `--lg-saturate` (`globals.css:702-709`). `backdrop-filter` **không** transition (cố ý, vì perf) ⇒ **vật liệu kính đổi tức thời theo nấc, còn hình dạng nav đang co trong 500ms** ⇒ thấy "mảng xanh" tách rời thanh.
2. **`::before` lệch nhịp với nav.** `globals.css:888-898`: `inset:-2px` (**lớn hơn nav 2px**), `z-index:-1` (vẽ **dưới**), chạy `gooeyStretch` **0.8s** với ease khác, còn nav chỉ `transform .5s` (`:884`). Ở bề rộng ~1100px, `scaleX(1.03)` = mỗi bên ~3% ≈ 15–17px vệt xanh lọt ra ngoài viền nav trong lúc thanh chưa kịp co.
3. **`ripple-reverse` remount mỗi lần về đầu trang.** `SiteNavbar.tsx:435` `key={`rr-${atTopCount}`}` + `atTopCount` tăng ở `:212` ⇒ **mỗi lần cuộn lên đỉnh lại phát lại** `rippleReverseIn 1.1s` (`:810-829`, có cả `filter: blur()`).

**Còn một bug đọc được ngay:** `useEffect` thêm class `site-global-nav-active` vào `<body>` bị **khai báo trùng 2 lần** — `SiteNavbar.tsx:154-158` và `:232-236`. Một là dead code.

⚠️ Chưa kết luận nguyên nhân nào là chính — bắt buộc quay Performance từng frame ở GĐ3 rồi mới sửa.

---

## 8. Bảng route → hiển thị thẻ D (mục 6)

32 page route, **không có route group**, chỉ 1 `app/layout.tsx` ⇒ D phải là 1 client component đọc `usePathname()` + **mảng loại trừ tập trung**, gắp 1 lần trước `<Footer />`.

| Route | Thẻ D | Ghi chú |
|---|---|---|
| `/` | ❌ ẩn | theo yêu cầu |
| `/dang-nhap`, `/tao-tai-khoan`, `/cap-lai-mat-khau` | ❌ ẩn | auth |
| `/trang-ca-nhan`, `/client-portal` | ❌ ẩn | tài khoản |
| `/booking/[service]` (chỉ phục vụ `/booking/kham-benh`), `/booking/khach-san`, `/booking/spa-grooming`, `/booking/tiem-ngua`, `/ChiTietBookingForm` | ❌ ẩn | form đặt lịch |
| `/staff/**` (10 trang) | ❌ ẩn | `StaffChromeGate` + navbar riêng |
| `/gioi-thieu`, `/dich-vu`, `/tuyen-dung`, `/tuyen-dung/chi-tiet` | ✅ **đã có** | 3 trang đầu đang gắn tay |
| `/doi-ngu`, `/doi-ngu/[slug]`, `/kien-thuc-thu-y`, `/kien-thuc-thu-y/[slug]`, `/lien-he`, `/tien-ich`, `/care-schedule` | ✅ sẽ thêm | |

**⚠️ Route shadowing (phát hiện mới):** `app/booking/[service]/page.tsx:15-20` khai cả 4 slug nhưng 3 thư mục tĩnh `tiem-ngua`/`khach-san`/`spa-grooming` thắng ⇒ **form "hiện đại" chỉ phục vụ `/booking/kham-benh`**.
**⚠️ Bug slot (phát hiện mới):** 3 form legacy **không gửi `addressName`** ⇒ `dbBooking.ts:149` cho `activeSlotKey === undefined` ⇒ **bước kiểm tra trùng slot ở `:153` bị bỏ qua hoàn toàn** ⇒ 409 không bao giờ bắn cho 3 form này.

---

## 9. ❓ Câu hỏi chặn — cần chủ dự án trả lời

**Q1 — A5 (chặn).** Yêu cầu đổi 3 thẻ sang "Hơn 12 năm" / "hơn 30 bác sĩ và tiến sĩ" / "Chi nhánh phủ khắp TP.HCM". Số liệu đang có trong repo là **4 chi nhánh · 10 nhân sự · 10 năm** (`StatsBand.tsx:75-82` tính từ dữ liệu thật), và `/gioi-thieu` đã xuất bản "hơn 10 năm". Ba con số trên **mâu thuẫn với dữ liệu đang có và với chính website**, đồng thời vi phạm quy tắc "không bịa số liệu". `StatsBand.tsx` có comment *"⚠️ KHÔNG ĐƯỢC BỊA SỐ"* và ghi rõ lần trước đã chọn **giữ số thật**.
→ **Cần xác nhận: giữ số thật, hay bạn là chủ dữ liệu và xác nhận 12 / 30 / phủ khắp là đúng?** Tôi **không tự đổi**.

**Q2 — 25.4 (chặn).** Toạ độ 4 chi nhánh đều là `coords: null` (`lib/clinics.ts:126,142,158,175`) ⇒ `nearestBranch()` (`:234-246`) **luôn trả `null`**. Logic sẵn có (haversine + sắp xếp + fallback) nhưng **vô dụng khi thiếu toạ độ**. Yêu cầu §25.4 ghi rõ: *dừng và hỏi, không tự đoán*.
→ **Cần 4 cặp lat/lng thật.**

**Q3 — H (chặn).** Chưa có bất kỳ dữ liệu sản phẩm/giá/tồn kho nào, **Zustand chưa cài**. Cần chọn nguồn dữ liệu trước khi code.

**Q4 — §25.5.** Đánh giá chủ nuôi: chỉ dùng dữ liệu thật có đồng ý hiển thị. Hiện **chưa có** ⇒ section sẽ không render (đúng quy tắc "thiếu dữ liệu thì không render").

**Q5 — §25.6/25.2/25.7.** Nội dung FAQ và mô tả quy trình là **nội dung y tế/quy trình** ⇒ cần bạn duyệt, AI không tự viết.

---

## 10. §19.1 — Bảng z-index hiện **KHÔNG tồn tại**

Giá trị đang rải rác, không có token: `40 · 50 · 95 · 100 · 110 · 120 · 200 · 2003 · 3500 · 9998 · 9999 · 12000` (grep toàn repo). Trang chủ mới dùng `z-0 / z-10 / z-[5]`. Ngoài ra **không có** `env(safe-area-inset-bottom)` ở đâu; `FloatingContact` dùng class `.floating-contact-*` (CSS riêng).
→ GĐ2 sẽ tạo bảng z-index trong `globals.css` và refactor các giá trị lệch.

---

## 11. Rủi ro & giả định

1. `app/page.tsx` là 1 client component **1204 dòng** đã chứa nhiều fix tinh tế (hydration, double-tap carousel, heading-order a11y, will-change lifecycle) ⇒ mọi thay đổi phải **nhỏ và có kiểm chứng**, không viết lại.
2. `ClinicSystem` **dùng chung** với `/lien-he` ⇒ mọi đổi phải gate bằng prop.
3. Layout đơn ⇒ thẻ D dễ gây regression toàn site.
4. **Dark mode có thật** (`data-theme` trên `<html>`) ⇒ mọi nền sáng mới (A5) bắt buộc có nhánh tối.
5. I2 nên làm từng form, **giữ API route cũ song song**.
6. Dữ liệu y tế/cá nhân (E, I, K, L) — cần bạn/pháp chế xác nhận theo Nghị định 13/2023/NĐ-CP. **Tôi không đưa ra kết luận pháp lý.**
7. `lib/validators.ts` **không phải zod** (báo cáo GĐ0 cũ ghi sai) — là regex tự viết. zod chỉ dùng ở route staff/auth.
8. Số đo bố cục hiện là **computed style**, không phải ảnh — phải xác minh lại bằng mắt ở GĐ2.

---

## 12. Kế hoạch (điều chỉnh theo trạng thái thật)

| GĐ | Nội dung | Ghi chú |
|---|---|---|
| 0 | ✅ **Xong** (tài liệu này) | baseline đo thật đã chụp |
| 1 | ✅ **Xong** (`phase-1-report.md`) | tokens + Glass + Reveal + Skeleton |
| **2A** | Trang chủ: **A1** (2 lớp nền cross-fade + z-index token) → **A2** (pill + `GlassSurface`) → **§24** `GlassHeading` → **A3** (ẩn scrollbar, gộp điều khiển) → bảng z-index → A7 cho phần còn lại | Chia nhỏ, build+đo sau mỗi bước |
| **2B** | §25: Dock · Quy trình 4 bước · Teaser giải phẫu · Tìm phòng khám (**chờ Q2**) · FAQ (**chờ Q5**) · Nhắc lịch · Closing CTA · thanh hành động mobile · Đánh giá (**chờ Q4**) | Mọi section có feature flag / điều kiện dữ liệu |
| **3** | Navbar C1 (quay Performance trước khi sửa) + C2 (3 mục + "Thêm") + **D** (vào layout + bảng route §8) | Gỡ `useEffect` trùng |
| **4** | F Booking Wizard + G2 + G1 (mở rộng component 2B) + I2 cho form đặt lịch | **Thêm `GET /api/availability`**; sửa bug slot 3 form legacy |
| **5** | H E-commerce | **Chờ Q3** |
| **6** | E Staff + I1 PWA + I2 còn lại + I3 OG | E3/E4 cần mô hình dữ liệu mới |
| **7** | K1 (dùng lại `--glass-tint` + prop `tint`) · K2 | K2 cần GLB có giấy phép |
| **8** | L | Cần VAPID + duyệt pháp chế |

---

## 13. Bảng nghiệm thu

| Hạng mục | Trạng thái |
|---|---|
| GĐ0 audit | ✅ Hoàn tất |
| typecheck / lint / build | ✅ PASS (exit 0) |
| Baseline Lighthouse / CLS / Performance trace | ⬜ **Chưa chạy** |
| Ảnh chụp 1920 / 960 | ⬜ **Chưa chụp** |
| A1 A2 A3 A4 A5 A6 A7 | A3 A4 A5 A6 ✅ · A1 A2 A7 ⬜ |
| §24 Glass heading | ⬜ Chưa làm |
| §25 (2B) | ⬜ Chưa làm |
| B Skeleton | ✅ GĐ1 (thiếu preset cho A3) |
| C Navbar | ⬜ Chưa làm |
| D Thẻ trên footer | 🟡 Thành phần có, chưa vào layout |
| E F G H I K L | ⬜ Chưa làm |