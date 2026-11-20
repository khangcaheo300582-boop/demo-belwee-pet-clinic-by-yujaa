# Giai đoạn 1 — Báo cáo: Nền tảng (tokens + Glass components + Reveal + Skeleton)

Trạng thái: **hoàn tất và đã kiểm chứng.** Không cài dependency mới (GĐ1 không cần gói nào).

---

## 1. File đã tạo

| Đường dẫn | Nội dung |
|---|---|
| `components/ui/GlassSurface.tsx` | Thẻ kính mờ dùng chung. Chỉ ghép class lên `.pt-glass`; mở bán kính qua token `--glass-radius`; có prop `tint` cho hạng mục K1 |
| `components/ui/GlassPill.tsx` | Viên thuốc kính mờ — **khung chứa** điều khiển (khác `GlassButton` là hành động) |
| `components/ui/GlassButton.tsx` | CTA kính mờ có trạng thái `idle / loading / success / error` truyền từ ngoài |
| `components/ui/Skeleton.tsx` | Hệ skeleton dùng chung: `Skeleton`, `SkeletonStatus`, `SkeletonPetAvatar`, `SkeletonAppointmentCard`, `SkeletonMedicalRecordList`, `SkeletonText` |
| `lib/revealVariants.ts` | Bảng variant reveal dùng chung cho 2 lối vào |
| `scripts/phase1-check.js` | Script kiểm chứng GĐ1 (CDP thuần, không thêm dependency) |
| `docs/phase-0-audit.md` | Báo cáo GĐ0 |

## 2. File đã sửa

| Đường dẫn | Thay đổi |
|---|---|
| `app/globals.css` | Thêm alias `--glass-*` (khai ở **cả** `:root` và `[data-theme="dark"]`); thêm `--sk-base`/`--sk-sheen` cho cả 2 theme; fallback `@supports not (backdrop-filter)`; `@media (prefers-reduced-transparency)`; tầng CSS cho `.glass-surface`, `.glass-pill`, `.glass-btn`, `.glass-sheen`, spinner + nhánh reduced-motion. **Gỡ** `@keyframes skeletonShimmer` (không còn nơi dùng) |
| `tailwind.config.ts` | Thêm keyframes/animation `skeletonSheen` → `animate-skeleton-sheen` (dùng `transform`, không `background-position`) |
| `app/lib/route-skeletons.tsx` | Viết lại trên hệ Skeleton mới; nền theo theme; danh sách `DARK_ROUTE_PREFIXES` cho các route tự vẽ nền tối |
| `app/loading.tsx` | Viết lại: bỏ loader "gooey" nền tối (SVG filter + 2× `blur-3xl animate-pulse` + `animate-bounce` + keyframes shimmer tự viết) → dùng `PageSkeleton` |
| `app/tuyen-dung/page.tsx` | Gỡ CSS chết `.skeleton-block` + **bản sao thứ 3** của `@keyframes skeletonShimmer` |
| `components/staff/StaffDashboard.tsx` | 2 chỗ `animate-pulse` viết tay → `Skeleton` + `SkeletonAppointmentCard` + `SkeletonStatus` |
| `components/Reveal.tsx` | Dùng bảng variant từ `lib/revealVariants.ts` |
| `components/AnimationProvider.tsx` | Dùng bảng variant từ `lib/revealVariants.ts` |

## 3. File đã xoá

- `components/ui/LiquidSkeleton.tsx` — **không có nơi nào import** (đã kiểm tra toàn repo). Là skeleton một-mục-đích với màu hardcode cho nền tối.

---

## 4. Quyết định thiết kế quan trọng

**Không tạo namespace token thứ tư.** Repo đã có 3 namespace (`--pt-*` theme-aware, `--lg-*` chỉ navbar, `.apple-glass` legacy). Thay vì thêm `--glass-*` như một nguồn chân lý mới, các biến `--glass-*` **chỉ trỏ về `--pt-*`**. Đổi `--pt-*` ở một chỗ là kính/pill/nút đổi theo toàn bộ.

**Phải khai alias ở CẢ khối tối.** Giá trị custom property được tính (`var()` thay thế) ngay tại phần tử khai báo rồi mới kế thừa xuống. Khai một lần ở `:root` sẽ "đóng băng" giá trị sáng cho cả chế độ tối. Điều này **đã được kiểm chứng bằng trình duyệt thật**: `--glass-bg` `rgb(255 255 255/0.62)` → `rgb(255 255 255/0.09)` khi bật `data-theme="dark"`.

**`z-index: -1` cho lớp phủ nội bộ.** `.glass-surface__tint` và `.glass-sheen` phải nằm ở `-1`, không phải `0`: trong một stacking context, phần tử `position` + `z-index: 0` vẽ **trên** nội dung in-flow nên sẽ phủ mờ chữ. Nhờ `-1`, nội dung của người gọi vẫn là flex item trực tiếp của pill — **bố cục của người gọi không đổi**.

**Reveal: gộp thay vì viết mới.** GĐ1 yêu cầu "chuẩn hoá hệ Reveal". Hệ thống đã tồn tại (GĐ0 xác nhận); việc thật sự cần là hai bảng variant đã **trôi khỏi nhau** (`zoom` 0.9 vs 0.92, `flip-y` 40° vs 45°) nên cùng tên variant cho hai chuyển động khác nhau tuỳ đường vào. Nay chỉ còn một bảng. Lệch do gộp: 2% tỉ lệ và 5° xoay — dưới ngưỡng nhận biết.

---

## 5. Kết quả kiểm chứng (đã chạy thật)

### 5.1 Tĩnh

```
npm run typecheck   → PASS (exit 0)
npx next lint       → PASS ("✔ No ESLint warnings or errors")
npm run build       → PASS, toàn bộ 60+ route biên dịch thành công
                      First Load JS shared by all: 87.5 kB
```

### 5.2 Trong trình duyệt thật — `node scripts/phase1-check.js http://localhost:3001`

Production build (`node scripts/next-run.js start`), Chrome headless qua CDP.

**Tràn ngang — 5 route × 6 bề rộng (1440/1280/1024/768/390/360):**

```
/                 ok ok ok ok ok ok
/gioi-thieu       ok ok ok ok ok ok
/doi-ngu          ok ok ok ok ok ok
/tuyen-dung       ok ok ok ok ok ok
/kien-thuc-thu-y  ok ok ok ok ok ok
```

**Token & vật liệu (computed style, không phải đọc file CSS):**

| Hạng mục | Kết quả đo |
|---|---|
| `--glass-bg` | `rgb(255 255 255 / 0.62)` — phân giải ✓ |
| `--glass-border` | `rgb(120 88 62 / 0.16)` ✓ |
| `--glass-highlight` | `rgb(255 255 255 / 0.75)` ✓ |
| `--glass-blur` / `--glass-radius` | `22px` / `24px` ✓ |
| `--glass-tint` | `#0f766e` (hook K1) ✓ |
| `--sk-base` / `--sk-sheen` | phân giải ✓ |
| `GlassSurface` backdrop-filter | `blur(22px) saturate(1.7)` ✓ · bo góc `24px` ✓ · viền `1px` ✓ · **5 lớp box-shadow** ✓ |
| `GlassButton` backdrop-filter | `blur(11px) saturate(1.7)` ✓ · bo góc `9999px` ✓ |
| `z-index` lớp `tint` / `sheen` | `-1` / `-1` ✓ |
| skeleton shimmer | `animation-name: skeletonSheen` ✓ |
| Class/at-rule có trong CSS | `.glass-surface`, `.glass-pill`, `.glass-btn`, `animate-skeleton-sheen`, `prefers-reduced-transparency` — tất cả **true** ✓ |

**Nhánh reduced-motion:** bật `prefers-reduced-motion: reduce` → vệt shimmer `display: none` ✓ (không còn chạy vô điều kiện như 3 bản skeleton cũ).

**Theme tối:** `--glass-bg` đổi giá trị ✓, `--sk-base` chuyển sang `hsla(0,0%,100%,.09)` ✓.

### 5.3 Những gì CHƯA kiểm thử

Phải nói rõ, không được suy ra "đạt" từ việc script xanh:

- **CLS chưa đo.** Cần chạy Lighthouse/`web-vitals` riêng. Vì vậy **không** khẳng định đạt CLS = 0.
- **Ảnh render chưa kiểm** (ảnh có tải đúng không) — thuộc GĐ2.
- **Tương tác bàn phím / screen reader chưa kiểm.**
- **`GlassSurface`/`GlassPill`/`GlassButton` chưa được nối vào trang nào.** Chúng mới chỉ được kiểm ở tầng CSS + computed style (script tự dựng phần tử để đo). Lần dùng thật đầu tiên là GĐ2 — lúc đó phải kiểm lại bằng mắt.
- **`SkeletonMedicalRecordList` chưa có đối tượng thật để đối chiếu** — xem §6.

---

## 6. Giới hạn CLS đã phát hiện (ghi lại trung thực)

Yêu cầu "CLS = 0" chỉ đạt được khi kích thước skeleton **trùng** kích thước nội dung thật. Hai chỗ có vấn đề thật:

1. **`SkeletonAppointmentCard` (dashboard staff).** Chiều cao hàng thật **dao động theo dữ liệu**: hai dòng `appt.confirmedBy` và `appt.ownerPhone` là điều kiện, mỗi dòng thêm 16px (+ margin 6px/2px). Hàng thật có thể là 92px, 114px hoặc 132px… **Không skeleton tĩnh nào khớp được mọi trường hợp.** Preset hiện khớp trường hợp cơ bản (92px = `py-4` 16 + `max(44, 24+20+16)` 60 + `py-4` 16). Muốn triệt CLS tuyệt đối thì phải render skeleton với đúng số dòng điều kiện — cần biết trước dữ liệu, tức là phải đổi luồng tải. Số đo từng dòng đã ghi ngay trong mã nguồn để người sửa sau có mốc đối chiếu (cùng cách làm mà bản cũ thiếu).
2. **`SkeletonMedicalRecordList` chưa có UI thật.** Hiện chưa có màn hình nào render danh sách hồ sơ kèm trạng thái tải (các trang hồ sơ đang là Server Component vẽ thẳng). Preset dùng chung số đo của `SkeletonAppointmentCard`; **sẽ phải đo lại khi nối vào UI ở GĐ6.**

---

## 7. Phát hiện ngoài phạm vi (bug có trước, KHÔNG do GĐ1 gây ra)

**Hydration mismatch trên `/gioi-thieu`, `/dich-vu`, `/tuyen-dung`** — React lỗi `#422` và `#425`.

Nguyên nhân: `components/AboveFooterCard.tsx` gọi
```tsx
const pickedExperts  = useMemo(() => shuffle(EXPERTS).slice(0, 3), []);
const pickedArticles = useMemo(() => shuffle(knowledgeArticles).slice(0, 3), []);
```
`useMemo` **có chạy trong lần render đầu** (cả trên server và trên client), nên server và client xáo ra hai thứ tự khác nhau → React báo mismatch và phải dựng lại phần cây đó.

**Bằng chứng đây không phải hồi quy của GĐ1:** `/gioi-thieu` — file **không hề bị sửa** ở giai đoạn này — cũng mắc y hệt; còn `/doi-ngu` và `/kien-thuc-thu-y` không dùng `AboveFooterCard` thì sạch.

⚠️ Điều này **trực tiếp liên quan hạng mục A3** ("hiển thị ngẫu nhiên các thẻ kiến thức, áp dụng quy tắc chống hydration mismatch"). `AboveFooterCard` hiện là ví dụ của cách **sai**; GĐ2 nên sửa nó thành mẫu đúng (render thứ tự cố định ở server → xáo sau khi mount) rồi dùng lại chính cách đó cho A3.

**Hai cảnh báo console khác cũng có trước** (không phải lỗi, nhưng nên biết):
- `<link rel=preload> uses an unsupported as value` — do `app/layout.tsx` preload `intro-logo.mp4` với `as="video"`.
- `<meta name="apple-mobile-web-app-capable"> is deprecated` — metadata Next sinh.

**Phụ chú môi trường:** để chạy kiểm chứng, tôi khởi động server production trên cổng 3001. `scripts/next-run.js` tự phát hiện "stale Next.js server" ở cổng đó và **đã tắt tiến trình cũ (PID 12268)** trước khi khởi động — tức là một dev server bạn đang chạy có thể đã bị dừng. Sau khi kiểm xong tôi đã tắt luôn server của mình, cổng 3001 hiện trống. Chạy lại `npm run dev` khi cần.

---

## 8. Việc còn dang dở / chuyển sang GĐ2

- 3 component kính **chưa được dùng ở đâu** — GĐ2 nối vào A2/A3/A4/A6.
- GĐ2 nên bắt đầu bằng: sửa hydration của `AboveFooterCard` (mẫu chống mismatch) → A6 `WhyChooseBelwee` (8 phút, thuần tĩnh, 4 ảnh đã xác nhận tồn tại) → A5 nền/anim (giữ số liệu thật theo quyết định của bạn) → A1 cross-fade nền → A2/A4 → A3 → A7.
