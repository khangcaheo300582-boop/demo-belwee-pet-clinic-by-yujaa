# BƯỚC 1 - ĐIỀU TRA HIỆU NĂNG

## 1. Animation/transition nặng chạy trên mọi trang

| Nguyên nhân nghi ngờ | File + dòng | Mức độ ảnh hưởng | Lý do |
|---|---|---|---|
| **MotionConfig forced to never respect reduced motion** | `app/providers.tsx:86` - `<MotionConfig reducedMotion="never">` | Cao | Buộc framer-motion chạy TẤT CẢ animation trên mọi thiết bị, bỏ qua cài đặt "giảm chuyển động" của hệ điều hành. Trên mobile yếu, nhiều animation đồng thời gây giật mạnh. |
| **Apple mesh blobs - infinite animations với blur 60px** | `app/globals.css:277-320` - `.apple-mesh-blob` với `filter: blur(60px)`, `animation: appleAurora1/2/3` (26s/32s/38s) infinite | Cao | 3 blob nền chạy vô hạn, mỗi blob có `filter: blur(60px)` - rất tốn GPU. Nằm fixed toàn trang, vẽ lại liên tục. Trên PC mạnh có thể chịu được, mobile yếu bị giật khi cuộn. |
| **Infinite CSS animations trong toàn app** | `app/globals.css:213-216` - `.anim-float { animation: floatBob 6s infinite }`, `.anim-float-slow { 9s infinite }`, `emergencyPulse 1.8s infinite`, nhiều keyframes khác | Trung-Cao | Nhiều animation vô hạn chạy dù không nhìn thấy (hero, buttons). Dùng `transform` nhưng kèm với `box-shadow`/`background-color` (ví dụ emergencyPulse đổi box-shadow). |
| **Global reveal animations với GSAP** | `components/AnimationProvider.tsx:88-205` | Cao | Tự động quét mọi element có `[data-reveal]` và tạo ScrollTrigger. Tạo nhiều tween đồng thời, refresh liên tục khi ảnh load. Chạy sau khi pageReady, trên tất cả trang. |
| **ParticleDNAField - canvas continuous loop** | `components/ParticleDNAField.tsx:1-400` (toàn bộ file) | Cao | Canvas render liên tục với rAF (~30fps), tính toán 100-320 particles mỗi frame. Có scroll listener cập nhật velocity, resize listener debounce. Dù có throttle 30fps và dừng khi ẩn, vẫn rất nặng trên mobile. | 

## 2. JS chạy liên tục không cần thiết

| Nguyên nhân nghi ngờ | File + dòng | Mức độ ảnh hưởng | Lý do |
|---|---|---|---|
| **ParticleDNAField - multiple listeners không được optimize đúng cách** | `ParticleDNAField.tsx:330-370` - `scroll` (passive), `resize` (debounced 180ms), `visibilitychange`, `IntersectionObserver` | Cao | Scroll listener gọi `tryRestart()` mỗi lần cuộn - chỉ check đơn giản nhưng vẫn kích hoạt. Resize debounce có, nhưng canvas resize + particle repositioning tốn CPU. Loop chỉ dừng khi globalFade <= 0.005, có nghĩa chạy trên nhiều section. |
| **AnimationProvider - nhiều event listeners** | `AnimationProvider.tsx:140-170, 175-205` | Trung-Cao | Thêm `load` listener, và `load` listener cho từng ảnh chưa complete. Có throttling với `scheduleRefresh()` (220ms + rAF) nhưng vẫn có thể tạo nhiều refresh đồng thời khi nhiều ảnh load cùng lúc. |
| **Home page - nhiều ScrollTrigger/GSAP** | `app/page.tsx:280-380, 420-480` | Cao | Nhiều GSAP context, ScrollTrigger. ScrollTrigger tự động theo dõi scroll - trên mobile yếu gây jank. Có resizeObserver trong effect (dòng ~460-500 trong đoạn đọc được). |
| **Session activity listeners** | `app/providers.tsx:35-73` | Thấp | Chỉ lắng nghe `pointerdown`, `keydown`, `touchstart`, `wheel` - passive listeners, ít tốn. Nhưng chạy trên mọi trang. |

## 3. Ảnh không tối ưu cho mobile

| Nguyên nhân nghi ngờ | File + dòng | Mức độ ảnh hưởng | Lý do |
|---|---|---|---|
| **Sử dụng <img> thay vì next/image ở nhiều nơi** | `components/FloatingContact.tsx:95-103` - dùng `Image` component nhưng check: nhiều component khác có thể dùng `<img>` | Trung | FloatingContact dùng next/Image (tốt). Cần kiểm tra toàn bộ - home page có dùng next/Image (vd dòng ~1000+). Nhưng nhiều ảnh SVG/PNG không được lazy load đúng cách. |
| **Hero video lớn, preload behavior** | `app/page.tsx:820-870` | Cao | Hero có 2 video (`/belwee-hero.mp4`, `/belwee-super.mp4`), ban đầu `preload="none"` nhưng sau pageReady set `preload="auto"` + `load()`. Video lớn, trên 4G mobile load chậm + tranh CPU decode. |
| **Remote images config có remotePatterns** | `next.config.mjs:25-40` | Thấp | Chỉ images.unsplash.com - không nhiều ảnh remote. formats khác nhau dev/prod (WebP only in dev, AVIF+WebP in prod) - tốt cho prod. |

## 4. Font/web font

| Nguyên nhân nghi ngờ | File + dòng | Mức độ ảnh hưởng | Lý do |
|---|---|---|---|
| **Sử dụng next/font/google đúng cách** | `app/layout.tsx:115-127` | Thấp-Tốt | Dùng `Nunito` với `subsets: ["latin", "vietnamese"]`, `display: "swap"`, `variable: "--font-nunito"`. next/font tự host, không load từ googleapis - đúng, tránh font swap lớn. Comment giải thích rõ tại sao cần vietnamese subset. |

## 5. Component nặng mount ở layout gốc

| Nguyên nhân nghi ngờ | File + dòng | Mức độ ảnh hưởng | Lý do |
|---|---|---|---|
| **ParticleDNAField mount ở layout** | `app/layout.tsx:172-175` | Cao | Canvas component chạy rAF loop ngay khi mount, dù user chưa scroll tới vùng hiển thị. Mặc dù có logic dừng, nhưng component đã khởi tạo, tạo particles, thêm listeners. |
| **AnimationProvider mount ở layout** | `app/layout.tsx:159` | Cao | Quét DOM, tạo GSAP context, ScrollTrigger trên toàn trang. Chạy sau pageReady nhưng vẫn ảnh hưởng performance. |
| **MotionProvider wrap toàn app** | `app/layout.tsx:154, 210` | Trung | Chỉ là wrapper, không chạy animation riêng nhưng ép reducedMotion="never". |
| **FloatingContact luôn mount** | `app/layout.tsx:209-211` (trong StaffChromeGate) | Trung | Component nhỏ nhưng có animation mở/đóng với CSS transitions. Không loop liên tục. |
| **ThemeToggleDock conditional render** | `components/ThemeToggleDock.tsx:48-73` | Thấp | Chỉ render ở `/trang-ca-nhan`, trả null ở các trang khác - tốt. |
| **Apple mesh background CSS always present** | `app/layout.tsx:167-171` - `.apple-mesh-bg` với 3 animated blobs | Cao | CSS animations chạy liên tục toàn trang dù user không cần. Có media query prefers-reduced-data nhưng KHÔNG có prefers-reduced-motion cho blobs. |

## 6. Theme toggle / dark mode

| Nguyên nhân nghi ngờ | File + dòng | Mức độ ảnh hưởng | Lý do |
|---|---|---|---|
| **ThemeToggleDock chỉ render ở 1 route** | Như trên | Thấp | Không gây re-render toàn cây. Theme system dùng CSS variables + localStorage - không tính toán mỗi frame. |
| **Không thấy animation mỗi frame liên quan theme** | Kiểm tra nhanh qua code đọc được | Thấp | ThemeProvider/ThemeInitializer chủ yếu set data-theme attribute, không chạy rAF. |

## 7. Bundle nặng cho mobile

| Nguyên nhân nghi ngờ | File + dòng | Mức độ ảnh hưởng | Lý do |
|---|---|---|---|
| **Framer-motion toàn cục** | `app/providers.tsx` wrap với MotionConfig | Cao | Framer-motion là thư viện nặng. Dùng nhiều (motion.div, AnimatePresence) ở home page. |
| **GSAP + ScrollTrigger** | `lib/gsap.ts` (import gsap, ScrollTrigger) | Cao | GSAP core + plugin ScrollTrigger khá nặng. AnimationProvider dùng cả hai. |
| **next-auth client-side** | `app/providers.tsx` SessionProvider | Trung | Cần thiết cho auth, nhưng client bundle. |
| **Nhiều dynamic imports** | `app/layout.tsx:18-25` - `FloatingContact` dynamic với ssr:false | Tốt | FloatingContact được dynamic import - code-split tốt. Các component khác thường import trực tiếp. |
| **Canvas API (ParticleDNAField)** | Component riêng, chỉ load khi cần? | Trung | Chỉ mount ở homepage? Check layout: ParticleDNAField nằm trong layout (app/layout.tsx:174) nên mount ở TẤT CẢ trang. Nên tách ra chỉ dùng ở trang chủ. |

## 8. next.config.mjs

| Nguyên nhân nghi ngờ | File + dòng | Mức độ ảnh hưởng | Lý do |
|---|---|---|---|
| **reactStrictMode: true** | `next.config.mjs:42` | Thấp | Double-render ở dev là bình thường, không phải bug. Không ảnh hưởng performance runtime đáng kể. |
| **devIndicators cấu hình mặc định** | Không thấy tắt | Thấp | Next.js devIndicators mặc định bật - có thể gây một ít overhead nhưng không lớn. |
| **compress: true** | `next.config.mjs:41` | Tốt | Bật gzip/brotli - tốt cho network. |
| **distDir riêng dev/prod** | `next.config.mjs:20-23` | Tốt | Tránh xung đột build/dev - không liên quan perf runtime. |
| **Image formats khác nhau dev/prod** | `next.config.mjs:28-39` | Trung | Dev chỉ dùng WebP (nhanh hơn encode), prod dùng AVIF+WebP (nhỏ hơn). Ở dev mode, encoding nhanh hơn nhưng file size lớn hơn một chút - không phải nguyên nhân chính gây giật. |

## 9. Phân biệt Dev mode vs Code issue

**Kết luận: Đây là LỖI CODE THỰC SỰ (cần sửa), KHÔNG chỉ do đặc điểm dev mode.**

Lý do:
- **ParticleDNAField canvas loop**: Chạy rAF liên tục với 320 particles, đầy đủ tính toán mỗi frame - đây là code design nặng, sẽ còn tồn tại cả khi `npm run build && npm start` (production). Mặc dù đã có throttle 30fps, optimization, nhưng vẫn nặng cho mobile.
- **MotionConfig reducedMotion="never"**: Ép buộc animations chạy mọi lúc - đây là quyết định code. Ở production vẫn y vậy.
- **Infinite CSS animations (aurora blobs, floatBob, emergencyPulse)**: Chạy vô hạn - tồn tại cả production.
- **Nhiều ScrollTrigger/GSAP đồng thời**: AnimationProvider tạo nhiều trigger - production cũng vậy.
- **Component nặng mount ở layout**: ParticleDNAField, AnimationProvider mount ở mọi trang - production cũng vậy.

**Tuy nhiên dev mode CŨNG làm trầm trọng thêm:**
- Next dev không compress, có Fast Refresh, source maps, HMR - tất cả đều thêm overhead so với production build.
- reactStrictMode double-render ở dev làm tăng load.
- Ảnh formats chỉ WebP ở dev nhưng không phải nguyên nhân chính gây "đơ/giật".

**Kết luận quan trọng**: Lỗi chủ yếu là do CODE (quá nhiều animation nặng chạy đồng thời, đặc biệt là canvas ParticleDNAField + GSAP ScrollTrigger + infinite CSS animations). Ở production (build+start) sẽ nhanh hơn chút nhờ minify/compress, nhưng với cấu hình hiện tại, nhiều trang vẫn sẽ giật trên mobile thực do CPU/GPU yếu không theo kịp.

## TỔNG KẾT ƯU TIÊN (Step 2 preview)

Theo quan điểm mobile thực tế (CPU/GPU yếu hơn PC):
1. **Cao nhất**: ParticleDNAField - canvas full-screen rAF loop. CPU-intensive. Cần tắt hoàn toàn hoặc giảm mạnh trên mobile, hoặc chỉ enable khi `prefers-reduced-motion` false VÀ không phải mobile.
2. **Cao nhất**: Apple mesh blobs blur(60px) infinite - GPU intensive. Blur lớn trên mobile rất nặng.
3. **Cao**: MotionConfig forced never - gây tất cả animations chạy dù user muốn giảm. Cần tôn trọng `prefers-reduced-motion`.
4. **Cao**: AnimationProvider tạo nhiều ScrollTrigger - có thể gây jank khi scroll trên mobile.
5. **Trung-Cao**: ParticleDNAField mount ở layout thay vì chỉ homepage - chạy trên TẤT CẢ trang dù không cần.