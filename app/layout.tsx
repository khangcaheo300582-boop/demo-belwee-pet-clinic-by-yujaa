import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Nunito } from "next/font/google";
import dynamic from "next/dynamic";
import ThemeInitializer from "@/components/ThemeInitializer";
import { THEME_INIT_SCRIPT, ThemeProvider } from "@/components/ThemeProvider";
import { BOOT_CURTAIN_SCRIPT } from "@/lib/bootCurtain";
import { INTRO_PRELOAD_SCRIPT } from "@/lib/introPreload";
import ThemeToggleDock from "@/components/ThemeToggleDock";
import { AuthProvider, MotionProvider } from "./providers";
import SiteNavbar from "@/components/SiteNavbar";
import Footer from "@/components/Footer";
import AnimationProvider from "@/components/AnimationProvider";
import HomeOnlyMeshBackground from "@/components/HomeOnlyMeshBackground";
import AmbientPause from "@/components/AmbientPause";
import SpeculationRules from "@/components/SpeculationRules";
import QuietPreloader from "@/components/QuietPreloader";
import IntroVideo from "@/components/HomeOnlyIntroVideo";
import RouteSkeletonOverlay from "@/components/RouteSkeletonOverlay";
import ScrollProgressBar from "@/components/ScrollProgressBar";
import CommandPalette from "@/components/CommandPalette";
import { LanguageProvider } from "@/components/LanguageProvider";
import LiquidGlassDefs from "@/components/LiquidGlassDefs";
import StaffChromeGate from "@/components/StaffChromeGate";
import { SITE_NAME, SITE_DESCRIPTION } from "@/lib/clinics";
import { structuredDataJsonLd } from "@/lib/structuredData";
import { getBaseUrl } from "@/lib/site-url";

const FloatingContact = dynamic(() => import("@/components/FloatingContact"), {
  ssr: false,
  loading: () => null,
});

export const metadata: Metadata = {
  metadataBase: new URL(getBaseUrl()),
  title: {
    default: `${SITE_NAME} — Phòng khám thú cưng TP. Hồ Chí Minh`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: SITE_NAME,
  },
  formatDetection: {
    telephone: true, // iOS tự nhận diện số hotline → chạm là gọi
  },
  openGraph: {
    type: "website",
    locale: "vi_VN",
    siteName: SITE_NAME,
    title: `${SITE_NAME} — Phòng khám thú cưng TP. Hồ Chí Minh`,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: "/logo-belwee.png",
        width: 351,
        height: 117,
        alt: `${SITE_NAME} — Logo`,
      },
    ],
  },
  twitter: {
    card: "summary",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: ["/logo-belwee.png"],
  },
  icons: {
    icon: [{ url: "/icon-512.png", sizes: "512x512", type: "image/png" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

// Viewport + themeColor tách khỏi metadata (Next 14) — chỉ định rõ ràng cho
// trình duyệt mobile tô màu đúng vùng thanh trạng thái/tai thỏ/Dynamic Island.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5, // KHÔNG khóa zoom — người lớn tuổi cần phóng to
  themeColor: "#f4f8ff",
  viewportFit: "cover", // vẽ tràn vào vùng safe-area (tai thỏ, thanh dưới)
};

/**
 * JSON-LD cho SEO local (Google Maps / Search).
 *
 * TRƯỚC ĐÂY: một node `VeterinaryCare` duy nhất mô tả trụ sở ở Gò Vấp, nên
 * khách tìm "phòng khám thú y quận X" không thấy schema của chi nhánh đó.
 * NAY: `lib/structuredData.ts` dựng một `@graph` — Organization + phòng khám
 * chính + 4 chi nhánh CN1…CN4 (`branchOf` trỏ về Organization).
 *
 * Nguồn sự thật vẫn là lib/clinics.ts. Sửa địa chỉ/giờ ở đó là toàn site +
 * schema đổi theo. Toạ độ/điện thoại chi nhánh đang `null` thì schema BỎ field
 * đó, không điền số bịa.
 */
function StructuredDataJsonLd() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: structuredDataJsonLd(getBaseUrl()) }}
    />
  );
}

const nunito = Nunito({
  // PERF/A11Y: subset "vietnamese" BẮT BUỘC — không có nó, các ký tự có dấu
  // (ạ, ế, ộ, ữ...) bị rơi về font fallback khác cỡ/độ dày → chữ nhấp nháy
  // đổi kiểu khi font tải xong, worst case mất dấu ở tiêu đề trong 1-2 giây
  // đầu. Đây là lỗi hiển thị tiếng Việt phổ biến nhất trên web Việt Nam.
  subsets: ["latin", "vietnamese"],
  variable: "--font-nunito",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={`scroll-smooth ${nunito.variable}`} suppressHydrationWarning>
      <head>
        {/* ---------------------------------------------------------------
            CHỐNG NHÁY (FOUC) — ghi data-theme TRƯỚC khi trình duyệt vẽ lần
            đầu. Đặt ở đầu <head> và KHÔNG defer: React chỉ render script này
            khi server gửi HTML, còn parser chạy nó ngay lập tức, nên <html>
            có data-theme đúng trước khi phần <body> được vẽ ra. Nếu để React
            hydrate rồi mới set, người dùng sẽ thấy 1–2 nhịp nháy sáng/tối.

            Cố ý KHÔNG đọc matchMedia: mặc định là SÁNG, kể cả khi hệ điều
            hành đang ở dark mode (yêu cầu rõ ràng) — nếu theo OS, mở trang
            trên máy dark mà chưa từng lưu lựa chọn sẽ ra nền tối trong khi
            navbar/footer vẫn giữ diện mạo sáng, trông lạc lõng.
            try/catch vì Safari ẩn danh / chế độ riêng tư chặn localStorage —
            nếu đọc lỗi mà không bắt thì cả script chết và trang mất theme.
        ----------------------------------------------------------------*/}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        {/* RÈM SKELETON TRƯỚC PAINT — lần tải đầu tiên ở trang KHÔNG phải
            trang chủ (F5 / mở URL trực tiếp). Script thêm class `boot-curtain`
            lên <html> trước paint đầu tiên, CSS vẽ rèm phủ toàn viewport
            bằng token nền site → không nháy trang trắng. Sau hydration,
            RouteSkeletonOverlay hiện skeleton React rồi fade rèm này đi
            (lib/bootCurtain.ts). Trang chủ KHÔNG có rèm — video intro tự boot. */}
        <script dangerouslySetInnerHTML={{ __html: BOOT_CURTAIN_SCRIPT }} />
        {/* NẠP TRƯỚC VIDEO INTRO — chỉ trang chủ, chạy trước paint đầu tiên.
            `<video>` của IntroVideo chỉ tồn tại sau hydration nên nếu đợi nó
            thì video logo bắt đầu muộn (đo được ~5s màn đen trên dev). Script
            chọn ngẫu nhiên 1 trong 2 video, ghi lựa chọn lên window rồi chèn
            <link rel="preload" as="video" fetchpriority="high">; IntroVideo
            đọc lại đúng lựa chọn đó (lib/introPreload.ts) nên không tải hai
            file và không có hydration mismatch. */}
        <script dangerouslySetInnerHTML={{ __html: INTRO_PRELOAD_SCRIPT }} />
        {/* next/font tự host font + preload đúng cách → KHÔNG preconnect
            fonts.googleapis.com/gstatic nữa. Preconnect 2 domain này khi font
            đã self-host chỉ tạo thêm 2 kết nối TLS lãng phí (mỗi kết nối tốn
            ~100-300ms handshake trên 4G chậm). */}
        <StructuredDataJsonLd />
      </head>
      {/* Nền/chữ lấy từ CSS variable (--bg-color/--text-color) thay vì mã màu
          cứng, để đổi theo data-theme. class Tailwind cứng sẽ thắng CSS
          class theo độ ưu tiên nên phải bỏ hẳn, không sửa thêm ở globals.css. */}
      <body className="bg-[var(--bg-color)] text-[var(--text-color)] antialiased m-0 p-0 font-nunito transition-colors duration-[450ms]" suppressHydrationWarning>
        <MotionProvider>
          <LiquidGlassDefs />
          {/* Intro / preloader / mesh backdrop stay on: the staff pages paint
              their own full-bleed background and do not read them.
              HomeOnlyIntroVideo: video intro CHỈ chạy ở Trang chủ (Mục 5.5).
              Các trang khác vào thẳng qua cổng navGate/skeleton, không bị chặn
              ~8s bởi overlay intro. */}
          <StaffChromeGate>
            <IntroVideo />
          </StaffChromeGate>
          <QuietPreloader />
          <RouteSkeletonOverlay />
          {/* Thanh tiến độ cuộn 3px (I1). Fixed nên nằm ngoài .app-shell để không
              bị các lớp overflow của shell cắt mất. */}
          <ScrollProgressBar />
          <HomeOnlyMeshBackground />
          <AuthProvider>
            <LanguageProvider>
              {/* Quét [data-reveal] cho TOÀN SITE — trước đây bọc bởi
                  HomeOnlyAnimationProvider nên CHỈ trang chủ có hiệu ứng
                  xuất hiện khi cuộn, các trang khác mất hẳn. Provider tự
                  quét lại theo pathname, trang không có marker thì no-op. */}
              <AnimationProvider />
              {/* ThemeProvider owns the light/dark state. ThemeInitializer (the
                  older "glass intensity" control) is kept alongside it — the two
                  adjust different things and both write --theme-*. */}
              <ThemeProvider>
                <div className="app-shell min-h-dvh flex flex-col">
                  <ThemeInitializer />
                  <SpeculationRules />
                  <StaffChromeGate>
                    <SiteNavbar />
                  </StaffChromeGate>
                  {/* Pet Theme Toggle — the light/dark switch.
                      Deliberately a SIBLING of <main>, and outside the
                      StaffChromeGate: the navbar and footer keep their own fixed
                      appearance in both modes (see ThemeProvider), so the switch
                      cannot live inside either.
                      ThemeToggleDock là client component vì layout (server) không
                      đọc được pathname; nó tự quyết định theo route — trang chủ
                      KHÔNG render nút này. Hệ thống theme (ThemeProvider, token,
                      script chống FOUC) giữ nguyên, chỉ control bị gate lại. */}
                  <ThemeToggleDock />
                  {/* KHÔNG bọc wrapper chuyển trang nào cả — hiệu ứng vào/ra
                      do navGate (class `page-exit` mờ dần trang cũ) +
                      `.template-enter`/`page-reveal` (trang mới trượt vào)
                      đảm nhiệm, xem khối "HIỆU ỨNG VÀO/RA TRANG" trong
                      globals.css. <main> là đích của class page-exit. */}
                  <main className="flex-1 pt-scope">{children}</main>
                  {/* Chân trang — MỘT nơi duy nhất cho toàn site.
                      Bọc trong StaffChromeGate: nested layout KHÔNG gỡ được
                      chrome của layout cha (xem components/StaffChromeGate.tsx),
                      nên khu /staff/* tự loại footer ở đây.
                      Thẻ "Belwee luôn quan tâm bạn" từng nằm TRƯỚC <Footer />;
                      đã được gỡ bỏ hoàn toàn (component, i18n, CSS). */}
                  <StaffChromeGate>
                    <Footer />
                  </StaffChromeGate>
                  <AmbientPause />
                  {/* Tìm kiếm toàn trang Cmd/Ctrl + K (I2). Đặt trong ThemeProvider
                      để hộp thoại đọc được --pt-*, tức đổi nền/chữ theo theme
                      hiện tại thay vì cứng một màu. */}
                  <CommandPalette />
                </div>
              </ThemeProvider>
            </LanguageProvider>
          </AuthProvider>
          {/* Nút liên hệ nhanh nổi góc phải dưới (Gọi ngay / Zalo / Đặt lịch) */}
          <StaffChromeGate>
            <FloatingContact />
          </StaffChromeGate>
        </MotionProvider>
      </body>
    </html>
  );
}
