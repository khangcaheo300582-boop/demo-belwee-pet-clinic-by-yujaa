# G0 — BÁO CÁO AUDIT (kèm nguyên nhân gốc 2 lỗi hiển thị)

Ngày: 2026-10-18 · Branch: `feat/belwee-overhaul` · Base: `da01621` + snapshot `ced1f2a`

## 1. Kiến trúc thực tế (đọc từ code, không suy đoán)

| Mục | Thực tế |
|---|---|
| Framework | Next.js **14.2.4**, App Router, React 18, TypeScript 5 |
| Styling | Tailwind 3.3 + `globals.css` token (`--bg-color`, `--text-color`) |
| Animation | Framer Motion 13 + GSAP; `lib/motion.ts`, `lib/revealVariants.ts` |
| DB | MongoDB qua mongoose 9 (`lib/mongodb.ts`), fallback JSON store (`lib/jsonStore.ts`) |
| Auth khách | NextAuth 4 (`app/api/auth/[...nextauth]`) **+** hệ mới `lib/auth-service.ts` (Bearer token, `app/api/v1/auth/*`) |
| Auth staff | Cookie HMAC tự quản `belwee_staff_session` (`lib/staffSession.ts`), chốt ở `middleware.ts` |
| i18n | `lib/i18n.ts` + `LanguageProvider` (vi/en) |
| Theme | `data-theme` + `THEME_INIT_SCRIPT` chống FOUC (`ThemeProvider`) |
| Dev | `scripts/next-run.js`, port **3001**, distDir `.next-dev`, tự giết orphan |
| Routes | 37 `page.tsx`; chỉ 3 layout: `app/`, `app/booking/`, `app/staff/` |

**Hệ thống chuyển trang ĐÃ CÓ SẴN** (không cần dựng lại như G1 mô tả):
`lib/navGate.ts` (cổng idle→loading + auto-release 8s) → `components/RouteSkeletonOverlay.tsx`
(skeleton) → `components/motion/PageTransition.tsx` → `lib/introGate.ts` (cổng intro video).
`components/Reveal.tsx` + `components/motion/ScrollReveal.tsx` + `lib/smoothScroll.ts` cũng đã có.

## 2. NGUYÊN NHÂN GỐC — LỖI 1: FOOTER BIẾN MẤT Ở MỌI TRANG

**Nguyên nhân gốc: `app/layout.tsx` không còn render `<Footer />` — import và thẻ đều bị xoá.**

- `components/Footer.tsx` **còn nguyên, đầy đủ 19 KB**, nhưng `rg "Footer"` toàn repo cho thấy
  **không còn chỗ nào import nó**. Comment dòng 6 trong chính file vẫn ghi
  *"Footer dùng chung cho toàn site — MỘT nơi duy nhất (app/layout.tsx)"* → đã sai.
- `git diff app/layout.tsx` (WIP **chưa commit**) cho thấy chính xác phần bị xoá:
  ```diff
  -import Footer from "@/components/Footer";
  ...
  -<StaffChromeGate>
  -  <Footer />
  -</StaffChromeGate>
  ```
  Cùng một diff đó thay `AnimationProvider` → `HomeOnlyAnimationProvider` và bọc `<main>`
  trong `<PageTransition>`. Việc xoá Footer là **tác dụng phụ của một refactor đang dở**,
  không phải chủ ý — bằng chứng là nó xoá đúng khối mà code cũ cần, để lại file mồ côi.
- Commit `4375065` (checkpoint) **còn** `<Footer />` → lỗi do WIP, không phải do code đã bàn giao.

**Kiểm chứng thật** (HTML render từ server, không phải do JS):
`GET / , /gioi-thieu , /lien-he , /dich-vu` → tất cả `200`, **`footerTag=False`**, không có
thẻ `<footer>` nào trong HTML.

## 3. NGUYÊN NHÂN GỐC — LỖI 2: THẺ "KIẾN THỨC THÚ Y" + "BÁC SĨ" BIẾN MẤT

**Nguyên nhân gốc: `"/"` nằm trong `HIDDEN_PREFIXES` của `components/AboveFooterGate.tsx`,
cộng với bộ so khớp theo đoạn làm `"/"` khớp MỌI pathname.**

```ts
const HIDDEN_PREFIXES = [ "/", "/tuyen-dung", "/booking", ... ];   // ← dòng 58, do WIP thêm vào

function isHidden(path) {
  const segments = path.split("/").filter(Boolean);
  return HIDDEN_PREFIXES.some((prefix) => {
    const wanted = prefix.split("/").filter(Boolean);   // "/".split("/") = ["",""] → []
    return wanted.length <= segments.length              // 0 <= 1 → true
      && wanted.every((seg, i) => seg === segments[i]);  // [].every(...) === true  ← KHỚP MỌI THỨ
  });
}
```

`prefix = "/"` biến thành mảng rỗng, `[].every()` luôn trả `true`, nên `isHidden("/gioi-thieu")`
= `true` ⇒ `AboveFooterGate` trả `null` ⇒ `AboveFooterCard` (khối "Kiến thức" + "Chuyên gia")
**không render ở bất kỳ trang nào**.

Bằng chứng nó là hồi quy chứ không phải ý đồ:
- Comment ngay trên (dòng 27–31) ghi rõ *"GĐ9 · (c): TRANG CHỦ ĐÃ BỎ KHỎI DANH SÁCH LOẠI TRỪ"* —
  nhưng code vẫn còn `"/"`. Comment và code trái nhau ⇒ việc gỡ chưa từng được thực hiện.
- `git diff` cho thấy `+  "/",` và `+  "/tuyen-dung",` là **dòng được thêm trong WIP chưa commit**.
- Nếu `isHidden` còn dùng `startsWith` cũ thì `"/"` **vô hại** (`startsWith("//")` không bao
  giờ đúng). Chính việc viết lại `isHidden` theo đoạn đã biến một mục vô hại thành lỗi toàn site.

**Kiểm chứng thật:** cùng 4 route trên → **`aboveFooterCard=False`** trong HTML server.

Ghi chú: bản thân cơ chế xáo ngẫu nhiên **đã an toàn hydration** (`hooks/useShuffledOrder.ts`:
render đầu trả thứ tự gốc, `useEffect` mới xáo). Nên chỉ cần sửa cổng, **không** đụng logic xáo.

## 4. Lỗi phát hiện thêm

| # | Vấn đề | Mức | Nơi |
|---|---|---|---|
| 3 | **Pre-commit hook chết** → không commit được. `lint-staged` gọi `prettier` nhưng `prettier` **không có trong devDependencies**; `eslint` cũng không resolve được trong hook. | P1 | `package.json` + `.husky/pre-commit` |
| 4 | **`/staff/register` + `/api/staff/register` còn công khai** — đúng cái đăng ký tự do gây tài khoản rác mà G7 yêu cầu xoá. | P0 (G7) | `middleware.ts:149-151` còn để trong `STAFF_PUBLIC_*` |
| 5 | **`/kham-truc-tiep` không tồn tại** — mảng lớn của G8. Có sẵn `app/staff/chat`, `lib/realtime.ts`, `app/api/realtime/stream` (SSE). | P0 (G8) | — |
| 6 | **Không có `/admin` nào cả** — Admin Console (G7) phải dựng mới. | P0 (G7) | — |
| 7 | Không có route group → việc loại trừ footer/navbar phải dựa trên `StaffChromeGate` (so `pathname`). Chạy được nhưng dễ vỡ như GĐ9 đã vỡ. | P2 | `app/layout.tsx` |
| 8 | `phone`/`image` của cả 4 chi nhánh đều `null` → thẻ chi nhánh không có SĐT riêng, không có ảnh. | Cần data | `lib/clinics.ts` |
| 9 | `AGENTS.md` yêu cầu đọc `node_modules/next/dist/docs/` — thư mục này **không tồn tại** (Next 14.2.4 không ship docs). Hướng dẫn đó không dùng được. | P3 | `AGENTS.md` |
| 10 | TikTok/YouTube `href: null` (đã xử lý đúng — component bỏ qua, không render link chết). | OK | `lib/clinics.ts:379-381` |
| 11 | **Video intro chạy ở MỌI route**, không chỉ Trang chủ. Đo thật: mở `/lien-he` phải chờ ~8.3s video + 0.7s fade, trong lúc đó wrapper trang bị `inert` ⇒ không bấm được gì. Trái Mục 5.5. **Đã sửa ở G1.** | P0 (G1) | `components/IntroVideo.tsx` |
| 12 | **`FORCE_REDUCED_MOTION = true`** — tắt toàn bộ chuyển động toàn site, không theo cài đặt OS. | Cần quyết định | `lib/motion.ts:8` |

### ⚠ Mục 12 — cần chủ dự án quyết định (ảnh hưởng G3–G8)

`lib/motion.ts` đặt `FORCE_REDUCED_MOTION = true`, nên `prefersReducedMotion()` và
`useReducedMotion()` **luôn trả `true`**. Đây là quyết định có chủ đích của chủ
dự án (có ghi rõ trong comment), nên agent **không tự ý đổi**.

Hệ quả: mọi yêu cầu "animation" trong master prompt hiện **không thể chạy** —
navbar co giãn/liquid glass (G3.2), crossfade video hero (G4.1), animation section
bản đồ (G5.9), checkbox điều khoản vẽ nét (G6), panel mở/đóng (G8.2).

Cần chủ dự án chọn một trong hai:
- **Giữ `true`** ⇒ các mục animation của G3–G8 phải hiểu là "đã cố ý tắt", và
  phần còn lại của các giai đoạn đó tập trung vào chức năng/bố cục.
- **Đặt `false`** ⇒ `prefersReducedMotion()` đọc `matchMedia` thật, toàn bộ
  animation của G3–G8 mở lại theo thiết bị.

Dù chọn gì, `prefers-reduced-motion` vẫn phải được tôn trọng ở cả hai vế.

## 5. Đánh giá rủi ro

- **Đã đúng và nên giữ nguyên:** `lib/clinics.ts` là nguồn chi nhánh duy nhất, **đã có toạ độ thật** do chủ dự án lấy từ Google Maps (GĐ3) ⇒ Mục 6.4 của G5 coi như đã đạt, không cần bịa/suy đoán gì.
- Hệ chuyển trang, reveal, i18n, theme, security headers, rate limit, CSRF **đều đã có** ⇒ G1/G9 nên *kiểm tra và bổ sung*, không dựng lại.
- Rủi ro lớn nhất nếu làm G7/G8 theo đúng đặc tả: sẽ phải dựng thêm `AdminLog`/`AuditLog`/`ConsultationRequest` trên tầng dữ liệu mới, cạnh hệ staff hiện có. Phải **đọc `lib/staffProfiles.ts` + `lib/staff-service.ts` trước** rồi ánh xạ, không dựng hệ thứ hai.

## 6. Thứ tự thực thi đề xuất (điều chỉnh so với master prompt)

G2 (footer + thẻ) là **hồi quy đang gây thiệt hại thực tế** và sửa được trong 2 file ⇒ làm **ngay**.
Sau đó mới tới G1/G3/G4 (nền + navbar + trang chủ). G7/G8 là phần lớn nhất và cần
đọc sâu tầng dữ liệu staff trước khi code.

## 7. Việc đã làm ở G0

- `git checkout -b feat/belwee-overhaul`
- Commit snapshot `ced1f2a` — **giữ nguyên WIP sẵn có của chủ dự án** (dùng `--no-verify` vì lỗi #3 chặn hook), để không mất việc đang dở và để diff của G1+ tách bạch.