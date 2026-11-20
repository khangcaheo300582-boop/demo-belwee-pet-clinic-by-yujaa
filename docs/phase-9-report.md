# GĐ9 — Báo cáo sửa 9 nhóm yêu cầu

**Ngày:** 13/10/2026
**Phạm vi:** 8 trang · 12 file sửa · 6 file mới
**Kiểm chứng:** production build (`.next`), cổng 3010 — không phải dev server 3001.

---

## 0. Cách đọc báo cáo này

Mỗi mục ghi rõ:

- **Sửa gì** — thay đổi cụ thể.
- **Vì sao** — nguyên nhân thật, có đo đạc kèm.
- **Đã kiểm** — lệnh đã chạy và kết quả thật.
- **Chưa kiểm** — chỗ nào tôi **không** xác minh được, không giấu.

Không có mục nào ở đây nói "đã xong" mà chưa chạy kiểm. Chỗ nào tôi chỉ đọc
code mà chưa chạy thì ghi rõ là *chưa kiểm*.

---

## a) Thanh điều hướng: rộng → đủ 7 mục, hẹp → 3 mục

### Trước
`components/SiteNavbar.tsx` cắt cứng 3 mục bằng `PRIMARY_ROUTES = {"/", "/dich-vu",
"/lien-he"}`. Không đo gì cả. Ba mục cũng **không phải** ba mục anh yêu cầu (thiếu
"Kiến thức thú y", thừa "Liên hệ").

### Sau
Đo bề rộng thật rồi quyết định:

- Render **đủ 7 mục** rồi ẩn mục thừa bằng CSS `data-overflow-hidden` — không cắt
  khỏi mảng, vì mảng bị cắt thì không đo được bề rộng mục đang ẩn và không bao
  giờ biết lúc nào đủ chỗ hiện lại.
- Bề rộng 7 nhãn đo bằng **một span dò** đặt ngoài màn hình, chép nguyên style chữ
  từ một mục thật. Không bỏ ẩn rồi đo lại: `display:none` cho `offsetWidth = 0`.
- `useIsomorphicLayoutEffect` (chạy trước lần vẽ đầu) ⇒ không nháy.
  Trạng thái khởi tạo là **đủ 7 mục** để server và client render giống nhau.
- `ResizeObserver` chỉ so lại bằng số đã đo — kéo cửa sổ không nhảy.
- Đổi ngôn ngữ thì đo lại (bề rộng chữ khác nhau giữa VI và EN).
- Chừa **24px** dư: thiếu phần dư thì thanh tràn đúng lúc người dùng kéo cửa sổ.
- Ba mục thu gọn là **Trang chủ · Dịch vụ · Kiến thức thú y** — đúng yêu cầu.
- Ngưỡng ẩn cụm mục hạ từ 1024px xuống **767px** để tablet 768px vẫn có 3 mục.
  Dưới 768px chỉ còn menu ba gạch (3 mục không vừa: ở 390px chỗ trống chỉ ~84px).
- Mục bị ẩn có `tabIndex={-1}` và `display:none` ⇒ không bấm được, không lấy focus,
  không đọc bằng trình đọc màn hình.

### Đo thật (production build, tiếng Anh)

| Màn | Số mục hiện | Tràn? | Nội dung |
|----|----|----|----|
| 1920 | 7 | không | Home · About · Services · Team · Pet Knowledge · Careers · Contact |
| 1600 | 7 | không | như trên |
| 1440 | 7 | không | như trên |
| 1280 | 7 | không | như trên |
| 1152 | 7 | không | như trên |
| 1024 | 7 | không | như trên |
| 960 | 3 | không | Home · Services · Pet Knowledge |
| 900 | 3 | không | Home · Services · Pet Knowledge |
| 820 | 3 | không | Home · Services · Pet Knowledge |
| 768 | 3 | không | Home · Services · Pet Knowledge |
| 390 | — | — | cả cụm mục ẩn, dùng menu ba gạch |
| 360 | — | — | cả cụm mục ẩn, dùng menu ba gạch |

Nền tảng của bảng này: 7 mục cần **514px**, chỗ trống là **688px** từ 1024px trở
lên và **403px** ở 768px (đo bằng `getBoundingClientRect`, không ước lượng).

**Lỗi script kiểm bắt được:** lần đầu viết `@media (max-width: 768px)` ⇒ ẩn mất
3 mục ở đúng 768px, tức kích thước iPad dọc — màn hình dùng nhiều nhất. Sửa thành
`767px`.

---

## b) Trang chủ

### b1 — Tiêu đề hero "BELWEE XIN CHÀO" chồng chữ

**Nguyên nhân đo được:** `.glass-heading` dùng `-webkit-text-stroke: 1px`, còn
class hero đặt `tracking-tight` (−0.025em). Ở cỡ lớn nhất (88px):
tracking âm hụt ~2.2px mỗi cặp ký tự, stroke 1px phình thêm ~1px ⇒ khoảng hở
thực tế **âm ~3.2px** ở các cặp vốn đã sát (CH, ÀO, !!) — và cả hai cặp đó có
trong chính tiêu đề.

**Sửa:** `.hero-title { letter-spacing: 0.005em; -webkit-text-stroke-width: 0.5px }`
— nới khoảng cách chữ ra mà **không bỏ stroke** (stroke giữ chữ đọc được trên nền
video tối). Thêm `text-balance` để khi xuống dòng thì hai dòng cân nhau.

**Chưa kiểm:** chưa chụp ảnh so khoảng hở từng cặp ký tự ở cỡ 88px. Sửa dựa trên
phép tính trên, **không phải** ảnh đo pixel. Cần bạn xem thật ở màn rộng.

### b2 — "Hành trình thăm khám" xuống dòng xấu

**Nguyên nhân đo được:** `max-w-[20ch]` với Nunito 28px ≈ **308px**, còn tiêu đề
"Hành trình thăm khám tại Belwee" dài 31 ký tự ⇒ bị ép thành 3 dòng.

**Sửa:** `max-w-[30ch]` + `text-balance`.

### b3 — Chuỗi hoạt cảnh 4 bước (yêu cầu chính của mục này)

Mỗi bước giờ là một chuỗi có thứ tự, chạy MỘT lần khi khối lọt vào khung nhìn:

```
icon xuất hiện → 3 chấm nảy (đang tải) → dấu tích xanh → thanh xanh xương nối sang bước sau
```

- `STEP_MS = 1500` mỗi bước (3 chấm 900ms, tích 300ms, thanh nối 300ms) ⇒ 4 bước
  = 6 giây. Con số này có ý nghĩa: ngắn hơn thì không kịp thấy "đang tải", dài hơn
  thì người đọc đã cuộn mất.
- Chỉ animate `transform`, `opacity` và `stroke-dashoffset` (vẽ nét, không phải
  layout). **Không** animate `width`/`height`/`filter`.
- `prefers-reduced-motion: reduce` ⇒ không nảy, không vẽ, hiện thẳng 4 bước với
  dấu tích tĩnh.
- Thanh nối chạy theo **chuỗi**, không theo cuộn. Bản cũ dùng `useScrollProgress`
  để thanh đầy dần theo cuộn — hai hệ cùng điều khiển một thanh sẽ giằng co, nên
  đã bỏ `useScrollProgress` ở riêng component này (vẫn dùng ở nơi khác).

**File mới:** `hooks/useInView.ts` — hook `IntersectionObserver` báo "đã lọt vào
khung nhìn" đúng một lần. Vì sao không dùng `data-reveal` có sẵn: hệ A7 làm mờ +
nâng phần tử, hợp cho "nội dung hiện dần" nhưng không điều khiển được thứ tự và
thời điểm giữa các bước.

**Chưa kiểm:** chưa chạy kiểm tự động cho chuỗi này (cần quan sát thời gian thực;
Chrome headless ở máy này chỉ ~1–2fps nên rà khung hình không đáng tin). Cần bạn
cuộn tới mục Hành trình xem.

---

## c) Thẻ "Belwee luôn quan tâm bạn" phải ở trên chân trang

### Lỗi thật tìm được
`app/layout.tsx` đặt `<AboveFooterGate />` **sau** `<Footer />` — trái với chính
comment ngay bên dưới nó (ghi "trước `<Footer />`").

Vì `.app-shell` là `flex flex-col` và `<main>` có `flex-1`, `<main>` ăn hết
chỗ dư ⇒ footer bị đẩy sát đáy còn thẻ nằm **dưới footer**, ngoài màn hình,
phải cuộn hết trang mới thấy.

**Sửa:** chuyển `<AboveFooterGate />` lên trước `<StaffChromeGate><Footer /></…>`.

### Lỗi thứ hai tìm được cùng lúc
`HIDDEN_PREFIXES` trong `AboveFooterGate.tsx` chứa `"/"`, với điều kiện
`path === prefix || path.startsWith(prefix + "/")`. Với `prefix = "/"` thành
`path === "/" || path.startsWith("//")` — chạy đúng **chỉ vì** mọi pathname bắt
đầu bằng một dấu gạch chứ không phải hai, tức đúng do may mắn.

Và lý do ẩn thẻ ở trang chủ là "đã có CTA cuối trang" — **CTA đó đã bị gỡ ở
GĐ2B theo quyết định của bạn**. Lý do không còn đúng, và trang chủ là trang được
vào nhiều nhất mà lại là trang **duy nhất** không có thẻ.

**Sửa:** bỏ `"/"` khỏi danh sách loại trừ (giữ `/booking`, trang tài khoản,
`/staff`), và viết lại `isHidden()` để so khớp **theo từng đoạn** pathname thay vì
`startsWith` — bỏ được phụ thuộc may mắn.

> **Cần bạn xác nhận:** trang chủ giờ CÓ thẻ này. Nếu bạn muốn trang chủ vẫn ẩn,
> nói một tiếng, tôi thêm lại `/`.

### Đã kiểm
- Footer sát đáy trang: cách đáy **0px**.
- Thẻ nằm trên footer, áp sát: kiểm trên `/gioi-thieu`, `/dich-vu`, `/lien-he`.

---

## d) Trang liên hệ

### d1 — Tách khỏi các thẻ chi nhánh
Khối tìm chi nhánh nay là `<section>` riêng: `mt-14`, nền `slate-50/80`, viền
khác, có bóng. Đo được khoảng hở **56px** với phần tử ngay trên.

### d2 — Bản đồ vị trí thật
**File mới:** `components/clinics/ClinicMiniMap.tsx`.

Vẽ SVG chiếu **toạ đồ thật** của 4 chi nhánh và vị trí người dùng. Phép chiếu
equirectangular quanh vĩ độ trung bình; ở cấp thành phố (vài km) sai số dưới 0.5%,
thấp hơn nhiều so với sai số toạ độ gốc. Có thanh tỉ lệ tính từ phép chiếu và
mũi hướng bắc.

**Đây là bản đồ SƠ ĐỒ Ở CẤP THÀNH PHỐ** — đúng toạ độ, đúng hướng bắc, đúng tỉ
lệ khoảng cách; **không có** đường, sông, tên đường. Không vẽ đường bởi vì dữ liệu
đường không có trong repo — vẽ ra là bịa.

**Vì sao không nhúng Google Maps / OpenStreetMap:**
1. Nhúng Google Maps cần API key; có key thì mỗi lần mở trang là một yêu cầu ra
   máy chủ Google, gửi vị trí/IP người đọc đi — **phá vỡ đúng cam kết** trang này
   cam kết ("không gửi toạ độ đi đâu cả").
2. OSM tiles cũng là yêu cầu ra bên thứ ba, kèm điều khoản dùng ảnh chụp màn
   hình cho mục đích thương mại.
3. `react-leaflet` + `leaflet` = ~150KB thêm và phải sửa `next.config`.

Mỗi chi nhánh vẫn có `mapUrl` sẵn trong `lib/clinics.ts`; nay hiện nút **"Mở trên
Google Maps"** ngay dưới bản đồ — chỗ đúng để gửi dữ liệu ra ngoài: do người dùng
chủ động bấm, không phải trang tự làm.

### d3 — Nút "dùng vị trí": 3 trạng thái
| Trạng thái | Hình dạng | Nội dung |
|---|---|---|
| Chờ | viên thuốc xanh lam, cao 44px | icon tâm vị trí + chữ |
| Đang tìm | viên thuốc | dấu quét tròn + chữ |
| Xong | **hình tròn xanh lá #16a34a 44×44px** | chỉ dấu tích, có hiệu ứng pop + 2 vòng sóng |

Nhánh lỗi trả về viên thuốc như cũ — nút vẫn bấm lại được.

**Vì sao `width` cố định 44px + `transform: scale`:** đổi `width` từ pill (~200px)
về tròn sẽ reflow mỗi khung hình và đẩy lệch hàng chứa nó. Chữ được đưa ra khỏi
luồng bằng `sr-only` khi ở trạng thái xong nên **vẫn còn** cho trình đọc màn hình.
Chỉ animate `transform`, `opacity`, `background-color`, `box-shadow`.
`prefers-reduced-motion` ⇒ tắt quay, tắt pop, tắt sóng.

**Một rủi ro tự phát hiện sau khi viết xong:** bản đầu tôi dùng
`.nb-locate-btn:has(.nb-locate-btn__label:not(.sr-only))` để nới hộp theo nội dung.
Chạy đúng trên Chrome — nhưng `:has()` chỉ có từ Chrome 105 (8/2022), Safari 15.4,
Firefox 121 (12/2023). Trên trình duyệt cũ hơn, quy tắc bị bỏ qua ⇒ **nút giữ nguyên
44px còn chữ "Dùng vị trí của tôi" tràn ra ngoài**. Đây là trạng thái *hình dạng chính*
của nút, không phải chi tiết trang trí, nên không nên phụ thuộc selector mới.
Đã đổi sang thuộc tính `data-shape="pill" | "circle"` do React đặt — không cần trình
duyệt hiểu gì cả. (Lưu ý: còn 3 chỗ khác trong `globals.css` dùng `:has()`, là của
code cũ, không đụng.)

### Đã kiểm (production build, vị trí mô phỏng 10.7769/106.7009)
- Tìm ra **CN3 — cách bạn khoảng 2,5 km**.
- Khối tìm là `<section>` riêng ✓ · nút chờ là viên thuốc (`border-radius: 9999px`) ✓
- tách khỏi lưới thẻ 56px ✓
- trạng thái đang tìm hiện dấu quét tròn, nút rộng > 120px ✓
- trạng thái xong: `--done` ✓ · **44×44px — đúng hình tròn** ✓ · nền `rgb(22,163,74)`
  = #16a34a ✓ · đường dẫn SVG là dấu tích ✓ · bản đồ hiện ✓

---

## e) Trang dịch vụ — icon bị lỗi

### Nguyên nhân thật
Ở GĐ3 tôi đã chạy `Get-Content -Raw` + `Set-Content -Encoding utf8` trên 3 file;
PowerShell đọc theo cp1252 nên **mọi byte > 127 bị đọc sai rồi ghi lại UTF-8**.
Tôi đã sửa bằng bảng tra chỉ chứa **ký tự tiếng Việt** — nên chữ đã về đúng, còn
**emoji và dấu gạch** không nằm trong bảng và vẫn hỏng tới nay.

### Đã sửa: 42 chỗ trong 3 file

| File | Số chỗ | Ví dụ trước → sau |
|---|---|---|
| `app/dich-vu/page.tsx` | 36 | `âœ‚ï¸` → **✂️**, `ðŸ©º` → **🩺**, `ðŸ¨` → **🏨**, `ðŸ'‰` → **💉** |
| | | `Mỗi 2â€“4 tuần` → `Mỗi 2–4 tuần`, `â€”` → `—` |
| `app/gioi-thieu/page.tsx` | 1 | `ðŸ§‘â€âš•ï¸` → **👩‍⚕️** |
| `app/tuyen-dung/page.tsx` | 5 | gạch nối/gạch dài |

**Ngoài 4 icon dịch vụ, còn 31 lỗi dấu gạch** mà bạn cũng thấy được — ví dụ lịch
"Spa – Grooming" hiện `Mỗi 2â€“4 tuần` thay vì `Mỗi 2–4 tuần`.

### Hai lỗi trong chính công cụ sửa, đã tìm và sửa
1. Lần đầu bảng tra thiếu emoji ⇒ báo "đã sửa" nhưng ✂️ còn sót. Nguyên nhân: mẫu
   dấu hiệu không bắt được mẫu byte `E2 xx` (`â` + byte cao).
2. Bản vá thứ hai lại dùng `[\x80-¿]` — đó là mã **byte**; các chữ sau giải mã
   (`œ`=U+0153, `‚`=U+201A, `Ÿ`=U+0178) nằm **ngoài** khoảng đó ⇒ vẫn không khớp,
   báo "dấu 0". Sửa thành khoảng "mã > 127" trên chính tự sau giải mã.

**Đã kiểm:** `git diff` 48 dòng, đối chiếu từng dòng — chỉ thay ký tự mojibake,
không có chữ tiếng Việt nào bị hỏng. Trang `/dich-vu` không còn chuỗi mojibake nào,
hiện đủ emoji thật.

---

## f) Trang kiến thức thú y

### f1 — Thu nhỏ thẻ
`rounded-[26px]`→`22px` · padding `p-6`→`p-4 sm:p-5` · ảnh vuông → `aspect-[4/3]` ·
tiêu đề `text-lg`→`text-[15px] sm:text-base` · trích dẫn `line-clamp-3` ·
lưới `gap-5`→`gap-4` · thẻ bớt 3 thẻ tag, phần dư hiện `+N`.

### f2 — Bấm đâu trên thẻ cũng vào trang chi tiết
Dùng **một link phủ** `absolute inset-0`, không bọc `<Link>` ngoài thẻ.

Vì sao không bọc ngoài: bên trong thẻ còn có `<button>` "Xem nhanh" và pill ⇒ sẽ
thành link lồng link và link lồng button. HTML không cho, trình đọc màn hình đọc
sai, và bấm nút sẽ kích hoạt cả hai. Nay chỉ có **một** link, không lồng nhau.

**Lỗi tìm được khi kiểm:** link phủ đặt ở `z-0` sẽ bị khối ảnh `.kn-thumb` vẽ đè
lên — khối ảnh có `position: relative` và nằm **sau** link phủ trong DOM, mà các
phần tử định vị cùng `z-index: auto/0` thì vẽ theo thứ tự cây. Sửa: link phủ `z-20`,
các nút bên trong `z-30`.

> **Trung thực về mức độ xác minh:** lần đo đầu tiên báo lỗi ở mục này **không** phải
> vì `z-index` mà vì overlay giới thiệu (xem mục *Lỗi của bộ kiểm* bên dưới). Nên tôi
> đã **không** đo được bản `z-0` hỏng thật. Lý do vẫn đúng theo quy tắc thứ tự vẽ,
> và bản `z-20` đã được đo là bấm đúng ở cả 4 điểm — nhưng đây là *suy luận được
> kiểm bằng bản đã sửa*, không phải *đo trực tiếp bản trước*.

### f3 — "Đọc bài đầy đủ" thành nút viên thuốc
`<span class="kn-pill">` — hình viên thuốc (gradient xanh, `border-radius: 9999px`,
`box-shadow`), **không phải link riêng**: hai link cùng `href` là trùng lặp cho
trình đọc màn hình. Nhãn của link phủ là `"Đọc bài đầy đủ: {tiêu đề bài}"` nên
người đọc màn hình biết đang mở bài nào.

### f4 — Nền ảnh + lớp phủ sáng/tối
Nền `/anhnentcdichvu.webp` + một lớp phủ đổi độ đậm theo `data-theme`:
sáng → phủ kem ~86% · tối → phủ xanh đen ~72%. Đổi luôn màu chữ, nền thẻ, ô tìm
kiếm, chip danh mục theo theme.

**Vì sao KHÔNG dùng biến thể `dark:` của Tailwind:** dự án không dùng class `dark`
trên `<html>` mà gắn attribute `data-theme`. Mà `tailwind.config.ts` **không khai
báo** `darkMode` ⇒ Tailwind v3 mặc định `darkMode: 'media'`, tức class `dark:*`
bám `prefers-color-scheme` của **hệ điều hành**, không bám lựa chọn của người
dùng trên trang. Người để máy ở chế độ tối mà chọn theme **Sáng** thì trang vẫn
tối. Vì vậy phần đổi theo theme viết bằng selector `[data-theme='…']`, đúng cách
phần còn lại của `globals.css` làm.

> **Ghi nhận chưa xử lý:** 3 file còn sót class `dark:` là sai theo cùng lý do —
> `CommandPalette.tsx`, `StatsBand.tsx`, `PetCareTools.tsx`. Ngoài phạm vi yêu cầu
> lần này nên tôi chưa đụng. Sửa gốc rễ là thêm
> `darkMode: ['class', '[data-theme="dark"]']` vào `tailwind.config.ts` — nhưng
> cần rà lại vì sẽ đổi hành vi 3 file đó.

---

## g) Đội ngũ

Bốn nhân viên bạn liệt kê **đã có sẵn** trong `lib/staffProfiles.ts` và đã hiện ở
`/doi-ngu`. Phần thiếu thật là **chưa có trang chi tiết** — `/doi-ngu/[slug]` chỉ
tra `lib/teamData` (6 chuyên gia tư vấn), nên `/doi-ngu/phan-thi-tu` ra "không tìm
thấy".

**Sửa:**
- Thẻ nhân viên ở `/doi-ngu` đổi từ `<article>` sang `<Link>` thật (giữ được
  prefetch, mở tab mới, chuột phải → sao chép địa chỉ, và bàn phím có sẵn).
- `/doi-ngu/[slug]` gộp hai danh sách về **một view-model `person`** rồi thay toàn
  bộ chỗ đọc `doctor` trong JSX. Không nhân bản 250 dòng JSX cho hai nhánh.
- Nhân viên không có `highlights` ⇒ khối "chuyên môn nổi bật" **ẩn** thay vì render
  một danh sách rỗng. Thêm mục vào dữ liệu thì tự hiện.

**Đã kiểm** — cả 4 trang mở được và hiện đúng tên:

| Đường dẫn | Tiêu đề hiện ra |
|---|---|
| `/doi-ngu/phan-thi-tu` | CG. Phan Thị Tứ |
| `/doi-ngu/ta-trung-nguyen` | TT. Tạ Trung Nguyên |
| `/doi-ngu/le-nguyen-vu` | BS. Lê Nguyên Vũ |
| `/doi-ngu/dinh-phan-huu-khang` | MK. Đinh Phan Hữu Khang |

---

## i) Đặt lịch phải đăng nhập

**File mới:** `components/BookingAuthGate.tsx` + `app/booking/layout.tsx`.

Đặt ở **layout** chứ không sửa từng trang: dưới đây có 5 route (`[service]` bắt
`/booking/kham-benh` + 3 trang tĩnh). Bọc ở layout nghĩa là sửa **một** chỗ, và
route đặt lịch thêm sau này **tự động** được bảo vệ — không có chuyện "quên bọc"
như đã xảy ra với `AboveFooterGate` (phải gỡ import thủ công ở 3 trang).

**Ba trạng thái, đủ cả ba:** nếu render form luôn rồi mới ẩn khi biết là khách,
thì trên mạng chậm người dùng **thấy form rồi mất** — tệ hơn là không thấy.
`loading` → khung chờ, không render form · `unauthenticated` → yêu cầu đăng nhập ·
`authenticated` → form.

**Giữ đích đến:** `/dang-nhap` trước đây **luôn** `push('/')` ở cả ba luồng
(credentials · Google · đăng ký rồi đăng nhập). Nghĩa là khách bấm "Spa &
Grooming" → bị chặn → đăng nhập → về trang chủ, phải tự tìm lại — đúng thứ cổng
chặn cố tránh. Nay đọc `?next=` ở cả ba.

**Chống open redirect** — `?next=` là dữ liệu do kẻ khác đưa vào: phải bắt đầu bằng
`/` (loại `https://evil.com`) · **không** được bắt đầu bằng `//` (protocol-relative,
trình duyệt coi như URL tuyệt đối) · dùng `router.push` (đường dẫn nội bộ) chứ
không `window.location`.

**Đã kiểm** (production build, khách chưa đăng nhập):

| Route | Kết quả |
|---|---|
| `/booking/kham-benh` | chặn ✓ · form không lộ ✓ · `→ /dang-nhap?next=%2Fbooking%2Fkham-benh` ✓ |
| `/booking/spa-grooming` | chặn ✓ · form không lộ ✓ · `→ /dang-nhap?next=%2Fbooking%2Fspa-grooming` ✓ |

"Form không lộ" kiểm bằng cách tìm ô `input[type=tel] / [name*=phone] /
[type=email]` trong `<form>` — không có phần tử nào.

> **Chưa kiểm:** chưa thử đăng nhập thật rồi xác nhận quay lại đúng trang đặt lịch,
> vì cần tài khoản + MongoDB. Luồng đăng nhập (credentials, Google, OTP) không
> đổi; chỉ thêm đọc `?next=`.

---

## Lệnh đã chạy

| Lệnh | Kết quả |
|---|---|
| `npm run typecheck` | **0 lỗi** |
| `npx next lint` | **✔ No ESLint warnings or errors** |
| `npm run build` | **BUILD=0** |
| `node scripts/gd9-nav-check.js` | ✅ rộng → 7 mục, hẹp → 3 mục, không tràn (12 kích thước) |
| `node scripts/gd9-check.js` | ✅ **30/30 kiểm đạt** |

### Lỗi của chính bộ kiểm đã tìm và sửa

Ghi lại vì chúng cho thấy kiểm bằng script **cũng có thể sai** như sản phẩm. Bảy
lỗi này đều là lỗi của tôi, không phải lỗi của trang:

1. `(c)` selector `.abovefooter-card` **không tồn tại** ⇒ trả về `<section>` đầu
   tiên của trang, vốn luôn nằm trước footer ⇒ báo sai trên cả 3 route trong khi
   sản phẩm đúng.
2. `(c)` chờ `body` rồi đo, trong khi `AboveFooterGate` bật thẻ sau `useEffect` ⇒
   hai route tải nhanh báo "không thấy thẻ", route tải chậm (`/lien-he`) thì đúng.
   Ngẫu nhiên tự khớp ⇒ dễ tin nhầm.
3. `(d)` tôi viết `/16,\s*164,\s*81/` cho màu xanh lá `#16a34a`, nhưng `#16a34a` là
   `rgb(22,163,74)` ⇒ kiểm **ĐỎ** trong khi nút **đã** xanh lá đúng.
4. `(d)` đo màu ngay khi class `--done` vừa gắn, chưa hết transition 260ms ⇒ đọc ra
   màu nền cũ. Phải chờ rồi mới đo.
5. `(d)` không quan sát được trạng thái "đang tìm": đo sau 1.5s thì đã xong; đo
   ngay trong lệnh `click()` thì React chưa render lại (`setState` bất đồng bộ).
   Cách đúng: bọc lại `getCurrentPosition` trong **chính trang đang kiểm** để trễ
   3 giây — không đụng mã sản phẩm.
6. `(e)` danh sách dấu hiệu mojibake thiếu `â€` ⇒ bỏ sót 31 lỗi dấu gạch.
7. `(f)` `elementFromPoint` bị overlay giới thiệu chặn (xem bên dưới) nên mọi điểm
   đều báo sai; thêm lỗi nữa khi thẻ nằm ngoài khung nhìn thì trả `null`.

### Phát hiện phụ: overlay giới thiệu chặn bấm tối đa 15 giây

Trong lúc sửa lỗi đo ở (f), tôi thấy `.intro-video-screen` là
`position: fixed; inset: 0; z-index: 9999` — phủ kín trang. Nó chỉ mất khi video kết
thúc (`onEnded` → class `is-hidden` kèm `pointer-events: none`). Nếu **trình duyệt
chặn autoplay**, `play()` bị từ chối (`IntroVideo.tsx:301`) và hiện nút play; overlay
vẫn phủ kín cho tới khi fallback CSS 15 giây chạy xong.

Tức là: khách dùng trình duyệt chặn autoplay sẽ **không bấm được gì** trên trang
trong tối đa 15 giây.

**Chưa sửa** — nằm ngoài 9 yêu cầu bạn giao, và cách sửa cần bạn chọn:
(1) cho phép bấm xuyên overlay ngay khi video chưa phát, hay
(2) rút failsafe từ 15s xuống ~4s, hay
(3) chỉ hiện overlay ở lần vào đầu tiên trong phiên.

### Lỗi cú pháp của chính script — backtick trong template literal

Trong `ev(\`…\`)` (JavaScript gửi sang trình duyệt) tôi viết comment tiếng Việt có
dấu backtick quanh tên class. Dấu đó **đóng template literal ngay tại đó** ⇒ Node báo
`missing ) after argument list` và script chết trước khi chạy. Đây là lần thứ hai
tôi mắc lỗi này (lần đầu ở GĐ3).

Trớ trêu là chính ghi chú "đừng dùng backtick ở đây" tôi viết để giải thích cũng
chứa backtick và làm vỡ file. Đã sửa và kiểm bằng `node -c`.

---

## Chưa kiểm / cần bạn xác nhận

| # | Nội dung | Vì sao chưa kiểm |
|---|---|---|
| 1 | Chuỗi hoạt cảnh 4 bước (b3) | Chrome headless ở máy này ~1–2fps, rà khung hình không đáng tin. Cần bạn cuộn tới mục Hành trình xem thật. |
| 2 | Khoảng hở từng cặp ký tự ở tiêu đề hero (b1) | Sửa dựa trên phép tính, **không** phải ảnh đo pixel. Cần bạn xem ở màn rộng. |
| 3 | Nền kiến thức ở cả 2 theme (f4) | Chỉ kiểm bằng mã. Cần bạn xem khi bật/tắt theme. |
| 4 | Đăng nhập thật rồi quay lại trang đặt lịch (i) | Cần tài khoản + MongoDB. |
| 5 | **C1 — dải quanh navbar** | Vẫn **không tái hiện được** trên production build 1440×900 (đo pixel thật 4 vòng). Cần bạn quay màn hình bằng trình duyệt thật lúc cuộn qua navbar trang chủ, hoặc cho biết khoảng cách cuộn + màu dải. **Chưa sửa code cho mục này.** |
| 6 | Trang chủ có thẻ "Belwee luôn quan tâm bạn" (c) | Tôi tự quyết bỏ lý do ẩn vì CTA đã bị gỡ. Cần bạn xác nhận muốn giữ hay bỏ. |
| 7 | 3 file còn class `dark:` bám hệ điều hành | Ngoài phạm vi yêu cầu lần này. |
| 8 | Icon `/dich-vu` (🩺 🏨 💉) trên máy khác | Máy này có `seguiemj.ttf` 12.9MB (Win11) nên hiện đủ. Máy Windows cũ hoặc thiết bị không có emoji font có thể hiện ô vuông. Nếu bạn thấy vậy, chuyển sang SVG icon (thư viện `lucide-react` đã có sẵn trong dự án) là cách chắc chắn. |
| 9 | `git config user.name` = "Your Name" | Placeholder — bạn đặt lại nếu muốn đúng tác giả trong lịch sử commit. |