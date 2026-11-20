# GĐ2A — Báo cáo: Trang chủ (A1 · A2 · A3 · A7 · §24 · z-index)

> Ngày: 2026-10-11 · Nhánh: `feat/gd-2a-homepage` · Base: `main` (repo **chưa có commit nào**)
> Kế hoạch: `docs/phase-0-audit-v2.md` §12.

---

## 1. File đã tạo

| Đường dẫn | Vai trò |
|---|---|
| `components/ui/GlassHeading.tsx` | Tiêu đề kính lỏng (§24). Không hook, không "use client" |
| `hooks/useScrollProgress.ts` | Tiến độ cuộn của một phần tử → `MotionValue` (thay `useScroll` của framer-motion) |
| `scripts/phase2a-check.js` | Cổng kiểm chứng GĐ2A (Chrome headless qua CDP, 0 dependency) |
| `scripts/phase2a-shots.js` | Chụp màn hình trang chủ để kiểm bằng mắt |
| `docs/gd2a-shots/*.png` | 7 ảnh chụp tại 1440px |

## 2. File đã sửa

| Đường dẫn | Thay đổi |
|---|---|
| `app/page.tsx` | A1 (cross-fade nền) · A2 (pill + kính thẻ) · A3 (ẩn scrollbar + pill tiến độ + phím ←/→) · §24 (GlassHeading) · bỏ 3 phase GSAP theo từng chữ |
| `app/globals.css` | Thang z-index (§0.9) · class `.no-scrollbar` dùng chung (§0.9b) · vật liệu `.glass-heading` + sheen + fallback (§24) |
| `components/StatsBand.tsx` | Chuyển sang `useScrollProgress` (xem §5.1) |
| `components/ClinicSystem.tsx` | A7 — thêm `data-reveal` cho khối tiêu đề (lưới thẻ đã có, tiêu đề thì chưa) |

**Không thêm dependency.** Bundle dùng chung **không đổi: 87.5 kB** (trước và sau đều 87.5 kB).

---

## 3. Kết quả build / lint / type-check

```
npm run typecheck   → PASS (exit 0)
npx next lint       → PASS — "✔ No ESLint warnings or errors"
npm run build       → PASS (exit 0), 63 route
```

## 4. Kết quả kiểm chứng trình duyệt — **GREEN**

Chạy trên **production build** (`next start` cổng 3010, không đụng dev server 3001 của bạn):

```
node scripts/phase2a-check.js http://localhost:3010
=== KẾT QUẢ ===  ✅ GĐ2A đạt các tiêu chí đã kiểm
```

Đo được (không phải suy ra):

| Hạng mục | Số đo |
|---|---|
| **§24** | `h1` = `<h1 class="glass-heading relative">`, `background-clip: text` có hiệu lực, `color: rgba(0,0,0,0)`, `-webkit-text-stroke: 1px rgba(255,255,255,0.55)`, `filter: drop-shadow(rgba(20,50,120,0.28) 0 6px 18px)`; chỉ **2 span** (accent + sheen) thay vì ~46; sheen `aria-hidden="true"` + `data-text`; tiếng Việt: `h1` = "BELWEE XIN CHÀO!!!", accent `!!!` → `color(srgb 0.6235 0.785 0.7725)`, `white-space: nowrap` |
| **A1** | cuộn 600px: **ảnh 0 → 0.556**, **video 1 → 0.444** (chiều ngược, đúng cross-fade) |
| **A2** | 1440px & 1024px: pill hiện / bộ cũ ẩn · 960px & 390px: pill ẩn / bộ cũ hiện · cao **48px** · `backdrop-filter: blur(11px) saturate(1.7)` · bấm chuột thật: "General Examination 1/4" → "X-ray & Ultrasound **2/4**" · có `aria-live="polite"` · thẻ active có `.pt-glass` + `blur(22px) saturate(1.7)` |
| **A3** | `scrollbar-width: none` · `overflow-x: auto` (vuốt còn) · `scroll-snap-type: x mandatory` (còn) · 1 pill có thanh tiến độ · 0 nút rời rạc |
| **Tràn ngang** | 1920 / 1440 / 1280 / 1024 / 960 / 768 / 390 / 360 → `overflowX = 0` ở **cả 8** |
| **Reduced motion** | `matchMedia` = true → sheen `display:none`, video `opacity:0`, ảnh nền `opacity:1` |
| **Console** | **0 lỗi, 0 cảnh báo hydration** |

Ảnh chụp (`docs/gd2a-shots/`): hero, pill A2, pill A4, dải kiến thức, dải số liệu, ranh giới A1, A6.

---

## 5. Bốn lỗi thật tìm được khi đo — đều đã sửa

### 5.1 `useScroll({ target })` của framer-motion đứng yên với offset dạng `start/end`
Đo trên **Chrome thật**: cùng thư viện, cùng `target` —
`offset: ["start 90%","center 45%"]` chạy, `offset: ["start start","end start"]` **đứng ở 0**.
Nguyên nhân: framer-motion 13 bật đường tăng tốc bằng **native ViewTimeline**
(`node_modules/framer-motion/dist/es/render/dom/scroll/utils/can-use-native-timeline.mjs`),
đường đó không phát giá trị cho khoảng offset đó khi phần tử cao đúng một viewport (hero là `min-h-screen`).

⇒ **Hệ quả nếu để nguyên: hiệu ứng A1 không bao giờ chạy, và không có lỗi console nào báo.**
Đã tạo `hooks/useScrollProgress.ts` (rAF + `getBoundingClientRect` + listener `passive`) — đúng kỹ thuật mà `ScrollProgressBar`, `SiteNavbar` và effect "mờ tiêu đề dịch vụ" đã dùng và **đã đo là chạy**.
`StatsBand` (A5) cũng chuyển sang hook này để hai hiệu ứng cùng họ không nằm trên hai cơ chế khác nhau.

### 5.2 Lỗi trong chính hook lúc mới viết
Mặc định `toAnchor: "start"` + `toVh: 0` ⇒ hai mốc trùng nhau ⇒ `span === 0` ⇒ nhánh `return` ⇒ MotionValue đứng 0 **vĩnh viễn, không lỗi**. Đã đổi mặc định thành `"bottom"` và ghi cảnh báo trong JSDoc.

### 5.3 Dấu "!!!" biến mất im lặng
`--glass-tint` của dự án là **một MÀU** (`var(--pt-accent)` = `#0f766e`), không phải bộ kênh HSL như phụ lục §20 giả định. Viết `hsl(var(--glass-tint))` ⇒ giá trị không hợp lệ ⇒ trình duyệt **bỏ cả khai báo** ⇒ `-webkit-text-fill-color` kế thừa `transparent` từ cha ⇒ chữ vô hình, **không lỗi console**. Đã sửa + thêm phát hiện vào script kiểm.

### 5.4 Tiêu đề section gần như vô hình (lỗi có trước, nay đã sửa)
Lớp nền `fixed` có gradient `to bottom` tính theo **chiều cao viewport** ⇒ vùng 0–25% luôn dính `rgba(15,23,42,.5)` — một màn navy 50% phủ lên mọi section dưới hero, còn tiêu đề màu `slate-900`. Chụp màn hình xác nhận: "Our comprehensive care system" và "The best place to care for your pet" đều chìm.

**Không phải do GĐ2A gây ra**: bản cũ dùng GSAP `scrollTrigger { start:"top top", end:"60% top" }` — `end` nhỏ hơn `start` ⇒ progress kẹp ở 1 ⇒ **ảnh nền đã ở `opacity:1` ngay từ đầu trang** suốt thời gian qua.

⇒ Thay bằng vớt kem/trắng đục đậm dần xuống dưới. Ảnh vẫn thấy (nền mờ), chữ tối đọc rõ. Ảnh trước/sau: `06-a1-crossfade.png` của lần chụp đầu (nền tối) và lần sau (nền sáng).

---

## 6. Đánh đổi có chủ ý

| Việc | Đánh đổi | Vì sao |
|---|---|---|
| Bỏ ~46 `<span>` từng chữ + 3 phase GSAP (`elastic.out` từng ký tự) ở hero | Mất hiệu ứng "nảy từng chữ"; thay bằng fade + nâng nhẹ 0.6s | `background-clip: text` gradient khởi động lại ở **mỗi** `inline-block` ⇒ tiêu đề thành sọc. Ngoài ra ~46 node + elastic là chi phí paint lớn nhất của trang, ngay trên LCP |
| Bỏ `<span class="sr-only">` ở h1 | Không mất gì | Văn bản hiển thị khớp **nguyên văn** `home.heroTitleAria` ("BELWEE XIN CHÀO!!!"), và nay là chữ thật chứ không phải sau hydrate |
| Accent "!!!" dùng **pha sáng** của `--glass-tint` (40% teal + 60% trắng ≈ rgb(159,200,197)) thay vì `#0f766e` nguyên văn | Không đúng "dùng token nguyên văn" | Token thật là teal **đậm** dùng làm màu nhấn trên nền sáng; đặt lên video nền tối gần như không đọc được. Vẫn là màu thương hiệu, vẫn nhận ra là tông riêng. Nếu bạn muốn `#0f766e` nguyên văn, sửa 1 dòng trong `globals.css` |
| Chuyển `StatsBand` (A5) sang `useScrollProgress` | Đổi cơ chế, không đổi hình thức | Đồng cơ chế với A1; xem §5.1 |

## 7. Prettier / vệ sinh

- Gỡ `bgRef` (không còn dùng), gỡ state `motionReduced` (quyết định nằm trong hook).
- `scrollKnowledge` không còn hardcode bề rộng thẻ 340px (sai ở 390px), đọc bề rộng thật + `columnGap`, và **kẹp `maxScroll`** (bản cũ có thể cuộn vượt cuối dải).
- Thêm chặn trên điểm bấm (`elementFromPoint`) trong script — đã bắt được 2 lần cú click rơi vào `<body>` do đo sai tọa độ.

---

## 8. ⚠️ Chưa kiểm / ngoài phạm vi

| Mục | Trạng thái |
|---|---|
| **Lighthouse (LCP/CLS/TBT)** | ⬜ **Chưa chạy.** Không tuyên bố đạt Core Web Vitals |
| **Performance trace / CPU throttle 4× / FPS / số layer** | ⬜ **Chưa đo.** |
| **Tương phản WCAG đo bằng công cụ** | Chỉ **quan sát bằng mắt trên ảnh chụp** ở 1440px. Chưa đo số tỉ lệ. Không tuyên bố "đạt AA" |
| **Safari iOS / Firefox / cảm ứng thật** | ⬜ Chưa kiểm |
| **Thiết bị cảm ứng thật** | ⬜ Chưa kiểm (chỉ mô phỏng `mobile: true`) |
| **Zoom 200% / cỡ chữ lớn** | ⬜ Chưa kiểm |
| **Tầng 2/3 của §24** (SVG specular, refraction) | **Cố ý KHÔNG bật** — phải đo chi phí paint trước. Đã ghi trong `globals.css` |
| **Bàn phím đầy đủ + screen reader thật** | ⬜ Chưa kiểm bằng công cụ. Đã kiểm: `aria-live="polite"` có mặt và đọc tên mới sau khi bấm |
| **Section mới §25 (2B)** | ⬜ Chưa làm — GĐ2B |
| **A5 nội dung 3 thẻ** | ⬜ **Chờ bạn xác nhận** (câu hỏi Q1). Giữ số liệu thật: 4 / 10 / 10+ / 11 |

---

## 9. Bug có sẵn, phát hiện khi kiểm — **KHÔNG sửa** (ngoài phạm vi)

1. **Navbar chồng chữ.** Trong `06-a1-crossfade.png`, nút "Book now" của navbar **chồng lên** mục "Pet Knowledge" ở 1440px. Đây đúng là khu vực của hạng mục **C1 (GĐ3)** — cần quay Performance trace từng frame rồi mới sửa, không vá bề mặt.
2. **Nút phát lại video hiện giữa hero.** `heroPlayFailed` bật nên nút tròn 64×px nằm đè lên tiêu đề phụ, dù video vẫn đang phát (`readyState 4`, không có `video.error`). Logic này có trước, tôi không đụng vào.
3. **3 form booking legacy không gửi `addressName`** ⇒ `lib/dbBooking.ts:149` cho `activeSlotKey === undefined` ⇒ bước chống trùng slot bị bỏ qua, 409 không bao giờ bắn. Liên quan GĐ4.

---

## 10. Bảng nghiệm thu

| Hạng mục | Trạng thái |
|---|---|
| typecheck · lint · build | ✅ PASS |
| Console · hydration | ✅ 0 lỗi |
| Tràn ngang 8 bề rộng | ✅ 0 |
| **A1** cross-fade nền | ✅ Hoàn tất + kiểm đo |
| **A2** pill + kính thẻ | ✅ Hoàn tất + kiểm đo |
| **A3** ẩn scrollbar + pill + phím ←/→ | ✅ Hoàn tất + kiểm đo |
| **A4** (2 cột + pill) | ✅ có sẵn từ GĐ2 trước; chỉ bổ sung reveal |
| **A5** nền + giọt nước | ✅ có sẵn; **sửa lỗi cơ chế cuộn** |
| **A6** | ✅ có sẵn; **kiểm tương phản bằng mắt + sửa lớp nền** |
| **A7** reveal | ✅ áp cho tiêu đề phòng khám |
| **§24** GlassHeading | ✅ Tầng 1 + fallback; **tầng 2/3 cố ý chưa bật** |
| z-index token | ✅ Khai thang; **chưa refactor hàng loạt class z cũ** (ngoài trang chủ) |
| CLS / Core Web Vitals | ⬜ **Chưa đo** |
| Safari / Firefox / cảm ứng | ⬜ **Chưa kiểm** |
| §25 (2B) | ⬜ Chưa làm |

---

## 11. Git

Nhánh `feat/gd-2a-homepage` đã tạo nhưng **chưa commit**: repo hiện **chưa có commit nào** (`git log` → *"does not have any commits yet"*), nên mọi thứ đang nằm ở trạng thái staged. Commit lần đầu ở đây sẽ chứa **toàn bộ** repo (kể cả các thay đổi của GĐ1 trước đó), và không có base để diff ⇒ mất đúng giá trị rollback mà nhánh riêng mang lại.

**Đề xuất: bạn tạo một commit nền trên `main` trước**, rồi tôi commit GĐ2A trên nhánh này. Tôi không tự `git add -A` toàn repo.