# GĐ2B — Section và tính năng mới trên trang chủ (§25, §27)

> Trạng thái: **đã kiểm chứng, GREEN** trên production build. Báo cáo đầy đủ ở
> `docs/phase-2b-report.md`; ảnh thật ở `docs/gd2b-shots/`.

---

## 1. Đã làm

| Mục | Yêu cầu | Kết quả |
|---|---|---|
| 25.1 | Dock hành động nhanh dưới hero | Xong — 4 viên kính: Đặt lịch · Cấp cứu 24h · Phòng khám gần bạn · Gọi tư vấn |
| 25.2 | Quy trình thăm khám 4 bước | Xong — **nội dung là bản nháp, chờ duyệt** (§4) |
| 25.3 | Teaser giải phẫu tương tác | **KHÔNG làm** — không có dịch vụ thật cho 3/4 vùng (§3.1) |
| 25.4 | Tìm phòng khám gần bạn | **KHÔNG làm** — toạ độ 4 chi nhánh đều `null` (vẫn chặn, Q2) |
| 25.5 | Chủ nuôi nói gì về Belwee | **KHÔNG làm** — không có dữ liệu đánh giá; đề bài đã loại trừ sẵn |
| 25.6 | Câu hỏi thường gặp | Component + sẵn sàng bật, **hiện đang ẩn** vì chưa có câu trả lời thật (§3.2) |
| 25.7 | Nhắc lịch chăm sóc opt-in | Xong về mặt UI + validate; **chưa nối kênh gửi thật** (§4) |
| 25.8 | Closing CTA trước footer | Xong |
| 27 | Thanh hành động cố định mobile | Xong — chỉ `< lg`, chỉ sau khi cuộn qua hero |

### Thêm ngoài danh sách (vì §20 yêu cầu)

- `GlassSurface` có thêm biến thể `variant="lite"` — tắt `backdrop-filter` nhưng
  tăng độ đục để bù. GĐ1 mới chỉ có một biến thể, trong khi §20 yêu cầu ba
  (`full` / `lite` / `pill`) và quy tắc ngân sách "tối đa 3 lớp `full` trong
  một viewport".
- `GlassButton` có thêm `as="a" href` — vì §1 cấm dùng `button` cho phần tử
  chỉ điều hướng, mà Closing CTA thì điều hướng.

---

## 2. Lỗi thật đã phát hiện và sửa

Cả bốn lỗi dưới đây đều **không lộ ra khi đọc code**, chỉ lộ khi chạy thật.

### 2.1 `position: fixed` bị bẻ bởi tổ tiên có `filter` — thanh mobile nằm ngoài màn hình

**Đo được:** `bottom = 9700px` trong khi viewport chỉ `844px`.

**Nguyên nhân:** `app/template.tsx` bọc trang trong `.template-enter` có
`filter: blur(0px)`. Theo đặc tả CSS, `filter` — kể cả blur(0) — trên một tổ
tiên tạo **containing block** cho mọi `position: fixed` bên trong. Nên
`bottom: 0` của thanh hành động được tính so với chiều cao **cả tài liệu**.

**Sửa:** `createPortal(..., document.body)`. Không sửa `template.tsx` vì đó là
hiệu ứng chuyển trang dùng chung, và portal không phụ thuộc tổ tiên.

### 2.2 `bottom` của nút liên hệ nổi bị khai lại ở ba chỗ, che mất offset

Sau khi thanh mobile ghi `--mobile-action-bar-h` vào `<html>`, nút nổi vẫn bị
che. Lý do: `.floating-contact-root` được khai báo `bottom` **ba lần** trong
`globals.css` (dòng ~37, ~2457, và trong `@media (max-width: 480px)` ~2632).
Luật tôi sửa ở dòng 37 bị hai luật kia đè vì cùng specificity và đứng sau.

Tệ hơn: `.pet-theme-toggle-dock` (nút gạt sáng/tối) **cố ý** nằm ngay trên nút
liên hệ — nó cũng phải đi theo, nếu không hai nút lại chồng nhau, đúng cái lỗi
mà luật đó sinh ra để tránh.

**Sửa:** thêm `var(--mobile-action-bar-h, 0px)` vào **cả bốn** khai báo `bottom`.

### 2.3 Đường nối 4 bước cắt ngang mặt thẻ

**Nhìn thấy trong `docs/gd2b-shots/02-journey.png`:** vệt xanh chạy qua giữa mặt
thẻ, cắt ngang tiêu đề từng bước.

**Nguyên nhân:** `<span>` đường nối là `absolute` không z-index, còn `<li>` thì
`static`. Phần tử `absolute` luôn vẽ **trên** phần tử `static`. Thêm nữa mặt
kính trong suốt nên vệt xanh lọt qua.

**Sửa:** `<li>` mang `relative` (cùng z-index auto ⇒ vẽ theo thứ tự cây, đường
nối là con đầu nên nằm dưới); nền vòng tròn icon đổi từ `bg-white/90` sang
trắng đục; và ở `≥1024px` thẻ bỏ hẳn mặt kính (`.journey-step`).

### 2.4 Icon sai nghĩa và trùng nhau trong dock

**Nhìn thấy trong `docs/gd2b-shots/01-dock.png`:** "Phòng khám gần bạn" mang icon
**lịch** (📅); "Cấp cứu 24h" và "Gọi tư vấn" **cùng ra một icon** (📞).

Đây là lỗi thông tin chứ không phải lỗi thẩm mỹ: người dùng đọc icon để đoán
trước khi đọc chữ. Đã thay toàn bộ emoji ở các section mới bằng SVG nét trong
`components/ui/icons.tsx`.

### 2.5 Hai khoảng cuộn của đường nối bão hoà sớm

Lần đầu đặt khoảng `fromVh: 85 → toVh: 55`. Lưới cao 266px nên hai mốc cách
nhau chưa tới 300px: cuộn hơn 300px là đường nối đã đầy và không còn phản ứng.
Đã nới thành `90 → 30`.

### 2.6 `aria-disabled` không chặn được `<a>` — chú thích của chính tôi sai

Khi thêm `as="a"` cho `GlassButton`, tôi viết chú thích rằng khi khoá thì
`aria-disabled` + `pointer-events: none` trong CSS sẽ chặn thao tác. Đọc lại
CSS thì **không có** `pointer-events` ở đó — chỉ có `cursor` và `opacity`.

Nên chú thích mô tả một hành vi không tồn tại. Đã sửa cả hai đầu:
CSS thêm `pointer-events: none`, và component **bỏ hẳn `href`** khi khoá — vì
`pointer-events` chỉ chặn chuột, bàn phím vẫn Enter được vào một `<a href>`.

### 2.7 `text-rose-700` trên thẻ kính là class chết

Dock có ý định làm nút "Cấp cứu 24h" nổi lên bằng đỏ. Đo thì cả 4 viên đều ra
`rgb(74, 59, 48)`.

Lý do: `.pt-glass` khai báo `color: var(--pt-fg)` và nằm **ngoài `@layer`**,
nên nó thắng mọi utility trong `@layer utilities` của Tailwind. Đây không
riêng lỗi của dock — bất kỳ chỗ nào đặt `text-*` lên `.pt-glass` đều chết.

Đã thêm class `.glass-pill--danger` khai **sau** `.pt-glass` (cùng specificity,
thắng theo thứ tự) và dùng token `--pt-danger` nên tự đổi theo theme. Đồng thời
xoá `text-[var(--pt-heading)]` vì nó cũng là class chết.

### 2.8 Chính phép đo tương phản của tôi báo sai

Sau khi đổi sang màu đỏ, script báo `3.19:1` — dưới AA. Nhưng ảnh thật cho thấy
viên kính gần như trắng, nên con số phải sai.

Gỡ lỗi ra nguyên nhân: hàm trộn alpha của script ghim `a = 1` trong kết quả, nên
khi trộn với mảnh `rgba(0,0,0,0)` của gradient nó **nhân tối đi chính lớp trắng**
đang nằm trên (255 → 182). Nền dựng ra thành xám trung tính.

Con số khớp chính xác: 182 → L = 0.4678 → `(0.4678+0.05)/(0.0479+0.05)` = 5.29,
đúng bằng `5.29:1` mà script in ra cho ba viên còn lại. Đã sửa phép trộn, nền dựng
lại gần trắng, nút đỏ ra **6.45:1 — đạt AA**.

Ghi lại vì đây là bài học chung: **đừng tin số đo của script mình tự viết khi số đó
trái ngược với ảnh.**

---

## 3. Những gì **không** làm, và vì sao

### 3.1 Teaser giải phẫu (25.3) — không có dịch vụ thật

Tên dịch vụ trong dự án (đã dò cả `lib/clinics.ts` lẫn `app/dich-vu/page.tsx`):

| Dịch vụ | Route đặt lịch |
|---|---|
| Spa - Grooming | `/booking/spa-grooming` |
| Khám & Chữa Bệnh | `/booking/kham-benh` |
| Hotel - Khách Sạn Thú Cưng | `/booking/khach-san` |
| Tiêm Vaccine | `/booking/tiem-ngua` |

Ánh xạ vùng cơ thể → dịch vụ:

| Vùng | Dịch vụ thật |
|---|---|
| Da & lông | Spa - Grooming ✅ |
| Tai | ❌ không có |
| Răng miệng | ❌ không có |
| Khớp xương | ❌ không có |

Chỉ 1/4 vùng có dịch vụ thật. §25.3 ghi rõ "Vùng nào chưa có dịch vụ tương ứng
thì không hiện, không tự bịa dịch vụ". Một teaser chỉ có 1 vùng thì không đáng
dựng. **Cần chủ dự án cho biết Belwee có dịch vụ nào cho Tai / Răng / Khớp**, hoặc
xác nhận chỉ làm vùng Da & lông.

### 3.2 FAQ (25.6) — component có, nhưng đang ẩn

`components/home/HomeFaq.tsx` đã hoàn chỉnh (accordion `<details>/<summary>`,
chuyển vùng trả lời bằng `grid-template-rows`, không animate `height`).
`FAQ_ITEMS` **cố ý để rỗng**.

Câu hỏi kiểu "Giờ mở cửa thế nào?", "Thanh toán ra sao?", "Nhận khám chó mèo hay
thú bố chân?" là **thông tin thực tế của phòng khám**, và §26 của đề bài cũng
ghi "câu trả lời do chủ dự án cung cấp". Tôi không được bịa.

Khi chủ dự án điền câu trả lời thật vào `FAQ_ITEMS`, section tự hiện — **không
cần sửa component**. Đây là điều kiện dữ liệu mà §28 yêu cầu, đã kiểm bằng
script: `#faq-title` không tồn tại trong DOM.

### 3.3 Tìm phòng khám gần bạn (25.4)

Vẫn chặn bởi **Q2**: `lib/clinics.ts` có `coords: null` cho cả 4 chi nhánh
(dòng 126, 142, 158, 175) ⇒ `nearestBranch()` luôn trả `null`.

Mục "Phòng khám gần bạn" trong dock **vẫn được làm**, nhưng dẫn tới `/lien-he`
(trang có đủ 4 chi nhánh kèm giờ mở cửa) thay vì dùng vị trí. Tên mục giữ nguyên
vì đó là ý định sản phẩm; đường dẫn tạm là đường dẫn thật.

---

## 4. Nội dung chờ duyệt

### 4.1 Quy trình 4 bước (25.2)

Bốn bước trong `lib/i18n.ts` khoá `journey.*` là **bản nháp AI soạn theo §26**,
chưa được phòng khám xác nhận:

1. Đặt lịch hẹn — *Chọn dịch vụ, bác sĩ và khung giờ phù hợp chỉ trong vài bước.*
2. Tiếp nhận — *Nhân viên đón bé, ghi nhận tình trạng và thông tin ban đầu.*
3. Thăm khám và chẩn đoán — *Bác sĩ thăm khám và tư vấn hướng xử trí phù hợp với từng bé.*
4. Theo dõi sau khám — *Belwee đồng hành, nhắc lịch tái khám và giải đáp thắc mắc cho bạn.*

Cần xác nhận: tiếp nhận có thật không · bước 3 có làm siêu âm/X-quang không ·
nhắc lịch tái khám qua kênh nào.

Vì dữ liệu chưa duyệt, component **không phát hành JSON-LD** — không nói với
Google một điều chưa được kiểm chứng.

### 4.2 Nhắc lịch (25.7)

Form đã hoàn chỉnh: Server Action + Zod phía server, `aria-invalid`,
`aria-describedby`, vùng `role="status" aria-live="polite"`, ô đồng ý **không
tick sẵn**, chống bấm lặp bằng `disabled` thật.

**Nhưng action không gửi gì cả.** `app/actions/care-reminder.ts` validate xong
rồi trả về thành công, dữ liệu bị bỏ. Hai lý do:

1. Dự án chưa có kênh nhắc lịch cho khách (chỉ có `/api/cron/reminders` nhắn
   **bác sĩ/nhân viên** — `lib/dbReminderQueue.ts`).
2. Nội dung đồng ý và thời hạn lưu dữ liệu **chưa được pháp chế duyệt** theo
   Nghị định 13/2023/NĐ-CP. Tôi không tự kết luận pháp lý.

Vì vậy người dùng **thấy ngay** dòng "Nội dung đồng ý và thời hạn lưu dữ liệu
đang chờ phòng khám/pháp chế duyệt. Biểu mẫu này chưa được nối với dịch vụ gửi
thật." — không ai tưởng mình đã đăng ký xong thật.

Trong file có khối `TODO(chủ dự án)` ghi rõ cần làm gì khi duyệt; không phải
sửa lại form hay schema.

---

## 5. Ghi chú kỹ thuật

### 5.1 `useActionState` / `useFormStatus` không tồn tại — dự án là React 18

§9 và §12 của đề bài yêu cầu `useFormStatus` + `useOptimistic`. Cả hai hook đó
chỉ có ở **React 19**; dự án chạy **React 18.3.1**. Đã thử và build **fail đúng
như vậy**:

```
Attempted import error: 'useActionState' is not exported from 'react'
  → /page không prerender được
```

Đã dùng đường tương thích React 18: `onSubmit` + `useTransition`. Vẫn giữ hai
nguyên tắc quan trọng (một nguồn trạng thái, chống bấm lặp bằng `disabled`
thật). Khi dự án nâng lên React 19 thì đổi lại là một dòng.

### 5.2 Vì sao đường nối dùng `scaleX` chứ không animate gì khác

§25.2 cấm animate `stroke-dashoffset` hay độ rộng. `scaleX` + `origin-left` là
biến đổi compositor, không repaint. Dùng `useScrollProgress` (hook GĐ2A) chứ
không dùng `useScroll` của framer-motion — lý do đã ghi trong JSDoc của hook.

### 5.3 `node_modules/next/dist/docs/` không tồn tại

`AGENTS.md` yêu cầu đọc guide trong đó trước khi viết code. Kiểm lại lần nữa:
thư mục **không có**. Mọi kết luận về hành vi Next.js trong giai đoạn này dựa
trên `next build` thật + đo trên production build.

### 5.4 Trùng chức năng Closing CTA với banner xanh sẵn có

Ngay trên Closing CTA là banner xanh **"BOOK A SERVICE — Ready to take care of
your pet's health?"** với nút "Book Now" (có sẵn từ trước, không phải do GĐ2B
thêm). Hai khối CTA liền nhau, cùng mục đích.

Tôi **không tự xoá** banner cũ — đó là nội dung của chủ dự án. Nhưng theo mắt
thì trang hiện có hai CTA cạnh nhau ở cuối trang. **Cần chủ dự án quyết:**
bỏ banner cũ, hay bỏ Closing CTA mới.

---

## 6. Kết quả kiểm chứng

Tất cả chạy trên **production build** (`next build` + `next start`) ở cổng 3010,
không phải dev server 3001 của chủ dự án.

### Lệnh và kết quả

| Lệnh | Kết quả |
|---|---|
| `npm run typecheck` | **PASS** |
| `npx next lint` | **PASS** — 0 cảnh báo |
| `npm run build` | **PASS** — 87.5 kB shared, `/` prerender tĩnh |
| `npm run test` (json-store) | 26/26 PASS |
| `npm run test:species` | 61/61 PASS |
| `npm run test:tools` | 61/61 PASS |
| `npm run test:motion` | 16/16 PASS |
| `npm run test:timeline` | 45/45 PASS |
| `npm run test:rsc` | 1/1 PASS |
| `npm run test:staff` | 33/34 — **1 fail do môi trường, không phải do thay đổi này**: `Vui lòng khai báo MONGODB_URI trong file .env.local` (kiểm tra "live" cần MongoDB; tôi không đụng vào auth/staff) |
| `node scripts/phase2b-check.js` | **✅ đạt toàn bộ tiêu chí** |
| `node scripts/phase2a-check.js` (hồi quy) | **✅ vẫn xanh** — không phá gì của GĐ2A |
| `node scripts/phase2b-shots.js` | 9 ảnh trong `docs/gd2b-shots/` |

### Số đo cụ thể

| Hạng mục | Kết quả đo |
|---|---|
| 25.1 Dock | 4 mục, nằm trong hero, có `aria-label`, 2 liên kết `tel:` lấy từ `HOTLINE` |
| 25.2 Quy trình | 4 bước, 4 cột ở 1440px, mỗi bước có icon SVG |
| 25.2 Đường nối | `scaleX` **0.136 → 0.757** khi cuộn (đo ở hai vị trí đã xác nhận đã cuộn tới) |
| 25.6 FAQ | `#faq-title` **không có trong DOM** ⇒ không lộ placeholder |
| 25.7 Nhắc lịch | ô đồng ý `checked = false`; gửi dữ liệu sai ⇒ **2 ô `aria-invalid`**, thông báo lỗi hiện, nút trở lại `idle` |
| 25.8 Closing CTA | 2 liên kết, CTA chính là `<a href="/dich-vu">` thật |
| 27 Thanh mobile | ẩn ở đỉnh trang · hiện sau khi cuộn qua hero · `position: fixed`, `bottom = 844 = vh` · **không** chồng nút nổi (`contactBottom 758` < `barTop 778`) · 3 vùng chạm đều **44px** |
| Tràn ngang | 1920/1440/1280/1024/960/768/390/360 → **0px** cả 8 |
| Console | **0** cảnh báo/lỗi, **0** cảnh báo hydration |
| Hồi quy GĐ2A | A1–A7 vẫn xanh |

### Tương phản chữ trên nút (AA cần ≥ 4.5:1)

Nền được **dựng lại từ chuỗi gradient thật** của chính phần tử, không phải
`background-color` (với nút kính, `background-color` là `rgba(0,0,0,0)` nên phép
tính thông thường cho kết quả vô nghĩa).

| Nút | Tương phản |
|---|---|
| Dock — Book now | 10.69:1 ✅ |
| Dock — **24h Emergency** (đỏ `--pt-danger`) | 6.45:1 ✅ |
| Dock — Nearest clinic | 10.69:1 ✅ |
| Dock — Ask a vet | 10.69:1 ✅ |
| Closing CTA — Book now | 10.69:1 ✅ |
| Closing CTA — Call the clinic | 14.41:1 ✅ |
| Thanh mobile — Book | 5.17:1 ✅ |
| Thanh mobile — Call | 14.41:1 ✅ |
| Thanh mobile — Emergency | 4.70:1 ✅ |
| Nhắc lịch — Remind me | 10.69:1 ✅ |

**Cảnh báo về phép đo:** con số này chỉ đúng khi tổ tiên **không** có gradient
(giới hạn đã ghi trong script). Chỗ nào đặt nút lên nền có gradient thì phải mở
rộng, không tin số cũ.

### Ảnh chụp thật

| File | Nội dung |
|---|---|
| `docs/gd2b-shots/01-dock.png` | 25.1 — dock dưới hero (1440px), icon đúng nghĩa, nút cấp cứu đỏ |
| `docs/gd2b-shots/02-journey.png` | 25.2 — 4 bước, đường nối chạy từ tâm icon 1 đến tâm icon 4 |
| `docs/gd2b-shots/03-journey-half.png` | 25.2 — đường nối đang vẽ dở (`scaleX` giữa chừng) |
| `docs/gd2b-shots/04-reminder.png` | 25.7 — ô đồng ý **chưa tick**, dòng "chưa nối dịch vụ gửi thật" hiện rõ |
| `docs/gd2b-shots/05-closing.png` | 25.8 — Closing CTA |
| `docs/gd2b-shots/06-faq-hidden.png` | 25.6 — khoảng trống phải trống, **không có** placeholder |
| `docs/gd2b-shots/07-journey-mobile.png` | 25.2 — 1 cột ở 390px, thẻ vẫn giữ mặt kính, không đường nối ngang |
| `docs/gd2b-shots/08-mobile-bar.png` | 27 — thanh hành động + nút nổi được đẩy lên |
| `docs/gd2b-shots/09-mobile-bar-360.png` | 27 — ở 360px |

---

## 7. Chưa làm / còn mở

| Việc | Lý do |
|---|---|
| 25.3 Teaser giải phẫu | Không có dịch vụ thật cho Tai / Răng / Khớp (§3.1) |
| 25.4 Tìm phòng khám gần bạn | Toạ độ 4 chi nhánh đều `null` — **Q2 vẫn chưa được trả lời** |
| 25.5 Đánh giá chủ nuôi | Không có dữ liệu (đề bài đã loại trừ) |
| 25.6 FAQ | Đã có component, ẩn vì chưa có câu trả lời thật (§3.2) |
| 25.7 Nối kênh gửi thật | Chưa có kênh + chưa duyệt pháp lý (§4.2) |
| §27 P2 Specular theo con trỏ | Chưa làm — đề xuất để GĐ5, khi đã có bộ chuẩn hiệu năng |
| §27 P3 Magnetic button | Chưa làm — đề xuất để GĐ5 |
| Nội dung `journey.*` | Bản nháp, chờ phòng khám duyệt (§4.1) |

**Lưu ý git:** repo vẫn **chưa có commit nào** (`git log` → *"does not have any
commits yet"*), nhánh `feat/gd-2a-homepage` đang có sẵn thay đổi chưa commit.
Tôi không tự `git add -A` toàn repo. **Cần chủ dự án tạo commit nền trên `main`
trước** rồi tách nhánh theo từng giai đoạn.
