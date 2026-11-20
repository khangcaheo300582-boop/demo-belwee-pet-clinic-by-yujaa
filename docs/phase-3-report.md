# GĐ3 — Navbar (C1, C2) và thẻ "Belwee luôn quan tâm bạn" (D)

> Trạng thái: **C2 và D đã kiểm chứng GREEN**. **C1 KHÔNG tái hiện được bằng
> đo** — chi tiết ở §2, đây là phần chưa giải quyết được và cần bạn xác nhận.

---

## 1. Tóm tắt

| Hạng mục | Yêu cầu | Kết quả |
|---|---|---|
| **C2** | Thanh 3 mục + "Thêm" | ✅ Xong — 3 mục trên thanh, thẻ danh mục **đủ 7 mục + tài khoản** |
| **D** | Thẻ "Belwee luôn quan tâm bạn" theo route | ✅ Xong — gắn 1 lần ở `layout.tsx`, danh sách loại trừ tập trung |
| **C1** | "Dải xanh trỡ phía sau navbar" | ⚠️ **Đo được hiện tượng hình học, nhưng KHÔNG nhìn thấy** — không sửa gì đoán |
| phụ | `useEffect` khai trùng | ✅ Đã gỡ |
| phụ | Focus trap sai phạm vi | ✅ Đã sửa (phát hiện mới, không nằm trong đề bài) |

---

## 2. C1 — đo trước, kết luận không như dự kiến

Đề bài bắt buộc quay Performance trace **trước khi sửa**. Đã quay:
`scripts/phase3-trace.js` (mẫu thô: `docs/phase3-trace.json`),
`scripts/phase3-c1-visual.js`, `scripts/phase3-c1-before.js`
(ảnh: `docs/gd3-shots/c1-*`).

### 2.1 Ba giả thuyết của audit GĐ0 — kết quả từng cái

| Giả thuyết | Đo được | Kết luận |
|---|---|---|
| 1. `--scroll-progress` nhảy nấc, transform chạy 500ms | `--scroll-progress` đi đủ 12 nấc; `nav scaleX` đạt 0.985 ở t=5314ms | Có thật nhưng **không phải nguyên nhân nhìn thấy được** |
| 2. `::before` tràn ra ngoài viền nav | **CÓ**: đo được `scaleX 1.0146, opacity 0.86, tràn 10.3px mỗi bên** khi đang nhìn thấy. Đỉnh lý thuyết của keyframe 40% là `scaleX 1.03, opacity 1` ⇒ **17.3px** | Tràn có thật, nhưng chỉ trong 0.8s và ở alpha 0.12 |
| 3. `ripple-reverse` remount mỗi lần về đỉnh | 0/78 mẫu thấy `.site-global-ripple-reverse` hiện; số phần tử luôn = 1 qua 3 vòng cuộn lên–xuống | **Không xác nhận** |
| — | **Lớp `.site-global-nav-glow` tràn 34.6px mỗi bên ở `opacity: 1`**, ở 34/36 mẫu khi cuộn xuống | Tròn nhất, **nhưng ảnh cho thấy không nhìn thấy** |

### 2.2 Vì sao "tràn 34.6px" vẫn không nhìn thấy

`docs/gd3-shots/c1-04-edge-right-morph.png`: chụp mép phải của thanh lúc đang cuộn,
phóng 3×. Ngoài viền pill là ảnh nền mờ, **không có vệt xanh nào**.

Lý do đo được: gradient của lớp glow là
`radial-gradient(ellipse at 50% 0%, rgba(59,130,246,0.22), transparent 55%)` ⇒ đã
**tắt hẳn trước khi tới 3% ngoài cùng**, đúng chỗ bị tràn.

Tương tự, `::before` mang `rgba(96,165,250,0.12)` ở hai đầu — 12% alpha trên
ảnh nền là gần như vô hình (`docs/gd3-shots/c1-10-before-peak-right.png`).

### 2.3 Kết luận của tôi — và phần tôi KHÔNG làm

> **Không sửa gì cho C1.**

Cả hai lớp đều tràn ra ngoài viền thanh, nhưng ở alpha và gradient khiến vệt đó
không hiện trên production build. Sửa chúng sẽ là **thay đổi hình thức dựa trên
đoán**, đúng thứ đề bài cấm.

**Cần bạn xác nhận:** "dải xanh trễ" bạn thấy là
(a) lúc bấm/đang cuộn ở **60fps trên máy thật** — headless ở đây chỉ chạy ~1–2fps
nên bắt hơi khác; hay
(b) ở trang/màn hình khác; hay
(c) đã hết xuất hiện từ trước?

Nếu là (a), có khả năng nguyên nhân là hiệu ứng rất ngắn (~0.8s) mà mắt thấy
thành "trễ". Khi đó hướng sửa hợp lý là **giảm độ trễ** (rút animation về 0.3s
hoặc bỏ `::before`), chứ không phải chặn tràn.

### 2.4 Bug "nút Book now chồng mục Pet Knowledge ở 1440px" — **không tái hiện**

Đo trên production build ở 1440×900 (`docs/gd3-shots/c1-11-before-peak-whole.png`):
7 mục nav + `Emergency 24h` + `Book now` đều **vừa khít, không chồng**.

Script `phase3-check.js` đo khoảng cách thật ở cả 8 bề rộng:
`logo↔link = 16px`, `link↔nút = 16px` — đều dương, tức không chồng.

**Cơ chế** vẫn có thật và **C2 đã loại bỏ nó**: `.site-global-links` có `flex: 1`
nhưng mặc định `min-width: auto` ⇒ không co được dưới bề rộng nội dung, trong khi
`.site-global-actions` có `flex-shrink: 0`. Bảy mục ở 13px + padding 14px là ngay
tại ngưỡng tràn. Rủi ro vẫn còn nếu ai đó thêm mục thứ 8, nhưng với 3 mục thì
thoáng rất xa.

---

## 3. C2 — Thanh 3 mục + "Thêm"

### 3.1 Chọn 3 mục nào

`PRIMARY_ROUTES = { "/", "/dich-vu", "/lien-he" }` → **Trang chủ · Dịch vụ · Liên hệ**.

Đây là ba ý định chính của người dùng: về trang chủ, xem và đặt dịch vụ, liên hệ.
Bốn mục còn lại (Giới thiệu, Đội ngũ, Kiến thức thú y, Tuyển dụng) là nội dung đọc
thêm. **Đây là quyết định của tôi** — nếu bạn muốn ưu tiên mục khác, sửa một
dòng trong `PRIMARY_ROUTES`.

### 3.2 Không route nào bị mất

Thẻ danh mục **vẫn liệt kê đủ 7 mục** + mục tài khoản. Script kiểm cả 3 mục trên
thanh đều có mặt trong thẻ (`barInMenu: 3`).

### 3.3 Portal nhân viên không bị ảnh hưởng

`SiteNavbar` được portal nhân viên dùng lại với `items` riêng. Điều kiện thu gọn
là **so sánh danh tính** `items === NAV_ITEMS`, nên portal tự truyền mảng riêng
⇒ không thu gọn, không phải sửa 4 file trong `components/staff/`.

### 3.4 Nút "Thêm"

- Nhãn chữ **"Thêm" / "More"** hiện từ 900px trở lên; dưới ngưỡng đó giữ nguyên
  nút tròn ba gạch.
- Ba gạch được bọc trong `.site-global-hamburger-icon`. **Bắt buộc**: CSS cũ dùng
  selector con trực tiếp `.site-global-hamburger > span` cho gạch; thêm nhãn
  thành con thứ tư sẽ khiến gạch cuối nhận luôn `width:16px; height:2px;
  background:#fff` và thành một ô chữ trắng 16×2px.
- `aria-label` đổi từ "Mở danh mục" sang "Mục khác" / "More items" khi đóng, và
  `aria-expanded` / `aria-controls` giữ nguyên cơ chế.

---

## 4. D — Thẻ "Belwee luôn quan tâm bạn"

### 4.1 Vấn đề gốc

Trước GĐ3 chỉ có 3 trang tự `import AboveFooterCard` và tự quyết định. Dự án có
32 route, không route group. Thêm trang mới mà quên sửa ⇒ thẻ biến mên im lặng.

### 4.2 Cách làm

`components/AboveFooterGate.tsx` — client component đọc `usePathname()`, danh sách
loại trừ tập trung, gắn **một lần** trong `app/layout.tsx` ngay trước `<Footer />`.
Ba trang cũ đã gỡ import để không render hai lần (script kiểm `n > 1`).

### 4.3 Bảng route đã kiểm thật

| Route | Thẻ | Ghi chú |
|---|---|---|
| `/gioi-thieu` `/dich-vu` `/tuyen-dung` | ✅ có | gắn tay trước GĐ3, nay do gate lo |
| `/doi-ngu` `/kien-thuc-thu-y` `/lien-he` `/tien-ich` | ✅ có | thêm mới ở GĐ3 |
| `/` | ❌ ẩn | theo yêu cầu loại trừ |
| `/dang-nhap` `/tao-tai-khoan` | ❌ ẩn | auth |
| `/booking/**` `/ChiTietBookingForm` `/trang-ca-nhan` `/client-portal` `/staff/**` | ❌ ẩn | theo danh sách loại trừ |

Mặc định là **hiện** (route mới không cần khai báo cũng có thẻ). Muốn ẩn thì phải
thêm vào `HIDDEN_PREFIXES` — hướng mặc định an toàn hơn mặc định ẩn.

---

## 5. Lỗi phát hiện ngoài danh sách

### 5.1 Focus trap truy vấn `document` thay vì giới hạn trong thẻ — **lỗi a11y thật**

Cả danh sách bẫy Tab lẫn chỗ focus mở đều dùng `document.querySelector(All)` với
selector toàn trang. Hậu quả đo được: mở thẻ danh mục xong **focus nhảy ra
ngoài** (`focusInCard: false`), và Tab ở cuối danh sách quay về đầu **trang** chứ
không phải đầu thẻ.

Sau khi sửa: `focusInCard: true`, focus nằm ở
`BUTTON.site-global-hamburger-item.is-current`.

### 5.2 Có hai bẫy focus trùng nhau, một cái chạy cả khi thẻ đang đóng

Một bẫy gắn với `hamburgerMounted` (chạy ngay khi thẻ được mount, **kể cả lúc
đóng**, `aria-hidden="true"`), bẫy kia gắn với `isHamburgerOpen`. Hai cái chồng
nhau ⇒ Escape bắn `closeHamburger()` hai lần, Tab quay vòng hai vòng, và khi menu
đang đóng thì Tab trên trang vẫn bị giao cắt.

Đã xoá bẫy thừa, giữ bẫy gắn với `isHamburgerOpen` (đã sửa phạm vi ở §5.1).

### 5.3 `useEffect` khai trùng

`document.body.classList.add("site-global-nav-active")` bị khai ở hai chỗ như
audit GĐ0 đã chỉ ra. Đã gỡ một, giữ lại một kèm chú thích.

---

## 6. Kiểm chứng

Tất cả chạy trên **production build** cổng 3010.

| Lệnh | Kết quả |
|---|---|
| `npm run typecheck` | ✅ |
| `npx next lint` | ✅ 0 cảnh báo |
| `npm run build` | ✅ |
| `node scripts/phase3-check.js` | ✅ xanh |

### Số đo

| Mục | Kết quả |
|---|---|
| Thanh | 3 mục: Home · Services · Contact |
| Thẻ danh mục | 8 mục (7 nav + 1 tài khoản), 3/3 mục trên thanh đều có trong thẻ |
| Nút "Thêm" | nhãn hiện ở 1440px, có `aria-label`, `aria-expanded=false` |
| Khoảng cách | `logo↔link = 16px`, `link↔nút = 16px` ở 1920/1440/1280; ≤1024px links ẩn đúng theo CSS |
| Bàn phím | focus được nút · bấm thật mở thẻ · `aria-expanded=true` · `aria-hidden=false` · focus vào **mục đầu tiên trong thẻ** · Escape đóng |
| Thẻ D | 7/7 route có **đúng 1 bản**; `/`, `/dang-nhap`, `/tao-tai-khoan` **0 bản** |
| Tràn ngang | `/dich-vu` ở 8 bề rộng → **0px** |
| Console | **0** cảnh báo/lỗi, **0** hydration |

---

## 7. Chưa làm / còn mở

| Việc | Lý do |
|---|---|
| **C1** | Đo được tràn hình học nhưng **không nhìn thấy**; không sửa đoán (§2.3). Cần bạn xác nhận triệu chứng. |
| Lighthouse mobile/desktop | Chưa chạy ở GĐ3 — đề xuất chạy một lần gom ở GĐ5 |
| Performance trace ở 60fps | Headless ở máy này chỉ ~1–2fps; cần chạy trên máy thật có GPU |

### 7.1 Tương phản navbar — phép đo không đáng tin, chưa kết luận được

`scripts/phase3-nav-contrast.js` cho hai kết quả trái ngược:

| Trạng thái | Kết quả đo |
|---|---|
| Sau khi cuộn (`is-active is-morph`) | **5.4–6.5:1** mọi phần tử — đạt AA ✅ |
| Đỉnh trang (`is-at-top`) | 1.02–1.19:1 — báo **rất kém** ❌ |

Con số 1.0x **mâu thuẫn với ảnh**: `docs/gd3-shots/c1-00-at-top-whole.png` cho thấy
navbar ở đỉnh trang có **chữ tối trên nền kính sáng**, đọc rõ.

Nguyên nhân khả dĩ: trạng thái navbar phụ thuộc `html.has-particle-field` (class
do client component gắn **sau** khi hydrate) và các biến `--lg-*` đổi theo. Probe
có thể đọc trước khi lớp đó được gắn, lúc kính còn tint tối và chữ còn trắng.

**Vì vậy tôi KHÔNG coi đây là lỗi tương phản và KHÔNG sửa gì.** Muốn kết luận thì
phải đo lại sau khi chờ `html.has-particle-field` xuất hiện — nên làm ở GĐ5 cùng
lúc chạy Lighthouse.

Cùng cảnh báo áp dụng cho `scripts/phase3-contrast.js`: 2/49 kết quả "không đạt"
đều là **artifact** (h1 dùng `background-clip: text` nên `color` là `transparent`;
nhãn "Belwee at a glance" nằm trên nền tối mà thuật toán dựng ra nền sáng).

---

## 8. Sai lầm của chính tôi trong GĐ3 — ghi lại để không lặp

Phần lớn thời gian GĐ3 tôi đi sai vì **số đo của script báo sai**, không phải vì
sản phẩm sai:

1. **Quên `Page.navigate`** khi sửa một khối code ⇒ cả lượt chạy đo trên
   `about:blank`, mọi con số bằng 0.
2. **`display:none` cho `getBoundingClientRect() = 0,0,0,0`** ⇒ báo "logo chồng
   link −151px" ở ≤1024px trong khi links đúng ra đã bị ẩn.
3. **Bật `Page.startScreencast` mà không ack** ⇒ mỗi lần lấy mẫu mất 1.9s.
4. **Đo trước khi hydrate** ⇒ thẻ D báo "THIẾU" trên các route nặng.
5. **Kỳ vọng 7 mục trong thẻ danh mục** trong khi đúng là 8 (7 nav + 1 tài khoản).
6. **Đo `::before` bằng công thức scaleX** ra "tràn 13.39px" ở `opacity: 0` — vệt
   không hề hiện.
7. **rAF headless ~1–2fps** ⇒ không phân giải được animation 500ms; phải bơm CSS
   làm animation chạy 12s mới bắt được đỉnh.

Nguyên tắc rút ra và đã áp dụng: **ảnh chụp thật và `elementFromPoint` hơn mọi
phép tính suy ra**, và số đo nào trái ngược ảnh thì mặc định nghi ngờ phép đo trước.
