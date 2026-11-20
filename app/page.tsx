"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { motion, AnimatePresence, useScroll, useSpring, useTransform } from "framer-motion";
import { useSession } from "next-auth/react";
import Reveal from "@/components/Reveal";
import { usePageReady } from "@/hooks/usePageReady";
import { useHeroReveal } from "@/hooks/useHeroReveal";
import useShuffledOrder from "@/hooks/useShuffledOrder";
import useScrollProgress from "@/hooks/useScrollProgress";
import GlassButton from "@/components/ui/GlassButton";
import GlassPill from "@/components/ui/GlassPill";
import GlassSurface from "@/components/ui/GlassSurface";
import BookingLensButton from "@/components/BookingLensButton";
import HeroTitle from "@/components/home/HeroTitle";
import HeroSubtitle from "@/components/home/HeroSubtitle";
import { gsap, prefersReducedMotion } from "@/lib/gsap";
import { useLanguage } from "@/components/LanguageProvider";
import StatsBand from "@/components/StatsBand";
import WhyChooseBelwee from "@/components/WhyChooseBelwee";
import { STAFF_PROFILES, staffDisplayName } from "@/lib/staffProfiles";

const IS_TOUCH_DEVICE =
  typeof window !== "undefined" ? "ontouchstart" in window : false;

/**
 * Có nên tự phát video nền hero không?
 *
 * Trước đây tắt hẳn khi `window.innerWidth < 768` ("giảm tải CPU/GPU cho
 * mobile") ⇒ điện thoại, iPad mini (744px dọc) và mọi cửa sổ hẹp chỉ thấy
 * poster tĩnh, video không bao giờ chạy luân phiên dù PC rộng vẫn chạy.
 * Chủ dự án yêu cầu video nền chạy luân phiên ở MỌI kích thước trang.
 *
 * Nay chỉ bỏ qua khi khách chủ động giảm chuyển động/tiết kiệm dữ liệu —
 * đó là ý muốn của khách, không phải đoán mò theo bề rộng:
 *   - `prefers-reduced-motion: reduce` — WCAG 2.3.3, chuyển động nền là
 *     thứ người rối loạn tiền đình cần tránh.
 *   - `prefers-reduced-data: reduce` hoặc `navigator.connection.saveData` —
 *     tiết kiệm băng thông (mỗi video nền ~2,5–4,5MB).
 * Các màn còn lại đều tự phát bình thường (video luôn `muted` +
 * `playsInline` nên iOS/Android cho phép autoplay).
 *
 * Đọc lại tại thời điểm gọi (thay vì khoá cứng một lần lúc module được
 * đánh giá) để phản ứng đúng khi OS/trình duyệt đổi cài đặt giữa phiên.
 */
function shouldAutoplayHeroVideo(): boolean {
  if (typeof window === "undefined") return false;
  if (prefersReducedMotion()) return false;
  try {
    if (window.matchMedia("(prefers-reduced-data: reduce)").matches) {
      return false;
    }
  } catch {
    // matchMedia không khả dụng — coi như khách không bật tiết kiệm dữ liệu.
  }
  const conn = (
    navigator as Navigator & { connection?: { saveData?: boolean } }
  ).connection;
  return !conn?.saveData;
}

/** Dynamically imported below-fold components to reduce initial bundle size. */
const ParticleDNAField = dynamic(() => import("@/components/ParticleDNAField"), {
  loading: () => null,
  ssr: false,
});const CareJourney = dynamic(() => import("@/components/home/CareJourney"), {
  loading: () => null,
  ssr: false,
});

const BranchesSection = dynamic(() => import("@/components/home/BranchesSection"), {
  loading: () => null,
  ssr: false,
});
const CareAreaMap = dynamic(() => import("@/components/home/CareAreaMap"), {
  loading: () => null,
  ssr: false,
});
const CareReminder = dynamic(() => import("@/components/home/CareReminder"), {
  loading: () => null,
  ssr: false,
});
const HomeFaq = dynamic(() => import("@/components/home/HomeFaq"), {
  loading: () => null,
  ssr: false,
});
const BelweeNewsSection = dynamic(() => import("@/components/BelweeNewsSection"), {
  loading: () => null,
  ssr: false,
});
const QuickActionDock = dynamic(() => import("@/components/home/QuickActionDock"), {
  loading: () => null,
  ssr: false,
});
const HeroPaws = dynamic(() => import("@/components/HeroPaws"), {
  loading: () => null,
  ssr: false,
});

/**
 * Cleanup của vòng particle, gắn theo từng nút CTA.
 * Dùng WeakMap thay vì gắn property tùy ý lên DOM node (`btn.__particleCleanup`):
 * có kiểu an toàn, không phải ép `as any`, và khoá được GC khi nút bị tháo.
 */
const buttonParticleCleanup = new WeakMap<Element, () => void>();

const services = [
  { titleKey: "home.serviceExam", textKey: "home.serviceExamText", image: "/khamchuabenh.webp" },
  { titleKey: "home.serviceXray", textKey: "home.serviceXrayText", image: "/xquang-ctsan.webp" },
  { titleKey: "home.serviceSpa", textKey: "home.serviceSpaText", image: "/spagroming.webp" },
  { titleKey: "home.serviceHotel", textKey: "home.serviceHotelText", image: "/khachsan.webp" },
] as const;

/**
 * Số slide của carousel — hằng số module-level.
 *
 * Không dùng `services.length` trong dependency array của useCallback: đó là
 * "outer scope value" theo quy tắc của react-hooks, và việc nó thuộc dependency
 * khiến mỗi lần đổi danh sách phải tạo lại callback. Vì `services` là hằng
 * module, số phần tử của nó không bao giờ đổi trong vòng đời ứng dụng.
 */
const SERVICE_COUNT = 4;

/** Góc nghiêng Y của 2 lớp ảnh hai bên trong slider 3D coverflow (độ). */
const SERVICE_SLIDE_ROTATE = 38;
/**
 * GĐ2A — Khoảng dịch chuyển ngang của 2 lớp ảnh hai bên KHÔNG còn là hằng số px.
 *
 * Với 210px cứng, ở màn 360px cả hai thẻ bên bị đẩy ra ngoài khung nhìn (không
 * còn thấy "card hai bên nghiêng") và làm bề rộng cuộn của section tăng lên.
 * Giá trị nay nằm ở biến `--slide-offset` trong `app/globals.css`
 * (`.service-stage-3d`) dưới dạng `clamp()` ⇒ co giãn bằng CSS, không rẽ nhánh
 * theo `window.innerWidth`, không cần đo lại khi resize.
 */
/** Độ thu nhỏ của 2 lớp ảnh hai bên (scale). */
const SERVICE_SLIDE_SCALE = 0.78;

const knowledge = [
  { titleKey: "home.k1", tagKey: "home.k1Tag", image: "/top1.webp" },
  { titleKey: "home.k2", tagKey: "home.k2Tag", image: "/top2.webp" },
  { titleKey: "home.k3", tagKey: "home.k3Tag", image: "/top3.webp" },
  { titleKey: "home.k4", tagKey: "home.k4Tag", image: "/top4.webp" },
  { titleKey: "home.k5", tagKey: "home.k5Tag", image: "/top5.webp" },
] as const;

// Particle icons — dễ thương, liên quan thú y (12 icon phong phú)
const PARTICLE_ICONS = ["🩺", "🐾", "🌸", "💊", "🩹", "🌷", "🐶", "🐱", "💚", "🫀", "✨", "🌼"];

/**
 * Đốm sáng ambient của hero — vị trí/kích thước cố định (không random trong
 * render để server và client giống nhau). Chuyển động trôi do CSS đảm nhận;
 * GSAP chỉ fade opacity khi hé lộ.
 */
const HERO_SPARKS = [
  { left: "9%", top: "22%", size: 4, delay: 0, duration: 8 },
  { left: "18%", top: "68%", size: 3, delay: 1.4, duration: 7 },
  { left: "27%", top: "38%", size: 5, delay: 0.7, duration: 9 },
  { left: "42%", top: "82%", size: 3, delay: 2.1, duration: 6.5 },
  { left: "55%", top: "16%", size: 4, delay: 1.1, duration: 8.5 },
  { left: "66%", top: "62%", size: 3, delay: 0.4, duration: 7.5 },
  { left: "76%", top: "30%", size: 5, delay: 1.8, duration: 9.5 },
  { left: "86%", top: "74%", size: 4, delay: 0.9, duration: 7 },
  { left: "93%", top: "44%", size: 3, delay: 2.4, duration: 8 },
] as const;

/**
 * Button particle burst — spawns 7-8 icons exploding outward from behind the button.
 * Used on booking CTA buttons for a fun interactive effect.
 */
function spawnButtonParticles(canvas: HTMLCanvasElement): (() => void) | undefined {
  const ctx = canvas.getContext("2d");
  if (!ctx) return undefined;
  const w = canvas.width;
  const h = canvas.height;

  const count = 7 + Math.floor(Math.random() * 2); // 7-8 icons
  const particles = Array.from({ length: count }, (_, i) => {
    // Each icon bursts outward from a different edge of the button
    // Distribute evenly: top-left corner, top, top-right, right, bottom-right, bottom, bottom-left, left
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.3;
    const speed = 2.0 + Math.random() * 3.0;
    // Spawn origin: scatter across the button edges
    const edgeT = i / count;
    let sx: number, sy: number;
    if (edgeT < 0.125)      { sx = w * 0.1; sy = 0; }        // top-left
    else if (edgeT < 0.25)  { sx = w * 0.5; sy = 0; }        // top-center
    else if (edgeT < 0.375) { sx = w * 0.9; sy = 0; }        // top-right
    else if (edgeT < 0.5)   { sx = w;       sy = h * 0.5; }  // right
    else if (edgeT < 0.625) { sx = w * 0.9; sy = h; }        // bottom-right
    else if (edgeT < 0.75)  { sx = w * 0.5; sy = h; }        // bottom-center
    else if (edgeT < 0.875) { sx = w * 0.1; sy = h; }        // bottom-left
    else                     { sx = 0;       sy = h * 0.5; }  // left
    return {
      x: sx + (Math.random() - 0.5) * 16,
      y: sy + (Math.random() - 0.5) * 16,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0,
      maxLife: 40 + Math.random() * 25,
      delay: i * 1.8,
      icon: PARTICLE_ICONS[Math.floor(Math.random() * PARTICLE_ICONS.length)],
      size: 16 + Math.random() * 8,
      rotation: Math.random() * 0.8 - 0.4,
      rotSpeed: (Math.random() - 0.5) * 0.05,
    };
  });

  let animId = 0;
  let running = true;

  const draw = () => {
    if (!running) return;
    // Canvas đã bị gỡ khỏi DOM (vd đổi trang khi đang hover) → dừng hẳn vòng
    // lặp, không để requestAnimationFrame chạy ngầm trên phần tử đã orph
    // (gây lag âm ỉ / leak bộ nhớ sau nhiều lần điều hướng).
    if (!canvas.isConnected) {
      running = false;
      cancelAnimationFrame(animId);
      return;
    }
    ctx.clearRect(0, 0, w, h);
    let alive = false;

    for (const p of particles) {
      if (p.delay > 0) { p.delay--; alive = true; continue; }
      p.life++;
      if (p.life > p.maxLife) continue;
      alive = true;

      const t = p.life / p.maxLife;
      let alpha: number;
      if (t < 0.08) alpha = t * 12;
      else if (t < 0.35) alpha = 1;
      else alpha = 1 - (t - 0.35) / 0.65;
      alpha = Math.max(0, Math.min(1, alpha));

      const scale = t < 0.12 ? 0.3 + t * 6 : t > 0.65 ? 1 - (t - 0.65) * 2 : 1;

      ctx.save();
      ctx.globalAlpha = alpha * 0.92;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.scale(scale, scale);
      ctx.font = `${p.size}px serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(p.icon, 0, 0);
      ctx.restore();

      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.01; // gentle gravity, mostly radial outward
      p.vx *= 0.99;
      p.rotation += p.rotSpeed;
    }

    if (alive) {
      animId = requestAnimationFrame(draw);
    } else {
      ctx.clearRect(0, 0, w, h);
    }
  };

  animId = requestAnimationFrame(draw);
  return () => {
    running = false;
    cancelAnimationFrame(animId);
  };
}

export default function HomePage() {
  const { status } = useSession();
  const router = useRouter();
  // `lang` (không chỉ `t`) cần cho tiêu đề hero: chuỗi tiếng Việt
  // "BELWEE XIN CHÀO!!!" ngắn hơn "BELWEE HELLO WELCOME" nên được phép to hơn
  // mà vẫn vừa MỘT hàng — xem `whitespace-nowrap` ở GlassHeading bên dưới.
  const { t, lang } = useLanguage();
  // HẠNG MỤC A3 — mỗi lần tải trang hiển thị 5 thẻ kiến thức theo thứ tự KHÁC
  // NHAU. `useShuffledOrder` trả về thứ tự GỐC ở lần render đầu (server và
  // client giống nhau ⇒ không hydration mismatch) rồi mới xáo sau khi mount;
  // nó cũng là một hoán vị nên KHÔNG thẻ nào bị lặp trong cùng một lượt.
  // KHÔNG dùng `Math.random()` trong thân render — xem hooks/useShuffledOrder.ts.
  const orderedKnowledge = useShuffledOrder(knowledge, knowledge.length);
  const [heroPlayFailed, setHeroPlayFailed] = useState(false);
  const [activeHeroVideo, setActiveHeroVideo] = useState(0);
  // Nội dung chỉ chạy hiệu ứng sau khi video intro bắt đầu fade ra
  const pageReady = usePageReady();
  // Slide đang giữa trong slider 3D coverflow phần "Hệ thống chăm sóc toàn diện"
  const [activeService, setActiveService] = useState(0);
  const serviceStageRef = useRef<HTMLDivElement>(null);
  // Bao quanh CẢ stage lẫn bộ điều khiển (pill). Vùng bàn phím ←/→ phải phủ cả
  // hai: nếu bám riêng `serviceStageRef` thì sau khi bấm nút trên pill, tiêu
  // điểm nằm ở nút (anh em của stage, không phải con) và phím mũi tên bị bỏ qua.
  const serviceCarouselRef = useRef<HTMLDivElement>(null);
  const servicesHeadingRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const heroVideoRefs = useRef<Array<HTMLVideoElement | null>>([]);
  const knowledgeScrollRef = useRef<HTMLDivElement>(null);

  // Hé lộ hero sau khi lớp intro tan: ký tự tiêu đề → phụ đề gõ chữ → CTA →
  // dock. Tách khỏi effect lớn bên dưới để giữ một timeline duy nhất.
  useHeroReveal(heroRef, pageReady);

  const handleBook = useCallback(() => {
    if (status !== "authenticated") {
      router.push("/dang-nhap?next=/dich-vu");
      return;
    }
    router.push("/dich-vu");
  }, [status, router]);

  // Ref callback của hero video — dùng lại cho cả onCanPlay (gọn, tránh lặp logic)
  const heroPlayReady = (index: number) => {
    if (!shouldAutoplayHeroVideo()) return;
    /* CHỈ video đang hiển thị được phát. Trước đây không kiểm tra index nên khi
       cả hai video báo `canplay` (warm-up nạp song song), cả hai cùng decode →
       hai bộ giải mã 720p chạy nền suốt thời gian trang mở. */
    if (index !== activeHeroVideo) return;
    const el = heroVideoRefs.current[index];
    if (el && el.paused && el.muted && !heroPlayFailed && pageReady) {
      void el.play().catch(() => setHeroPlayFailed(true));
    }
  };

  /* ---------- Hero video: tự phát sau intro + tạm dừng khi rời viewport ---------- */
  // Video nền vẫn tiếp tục decode mỗi frame kể cả khi đã cuộn xuống vùng
  // marquee — cạnh tranh CPU/GPU với dải thẻ đang chạy. Dừng hẳn khi khuất
  // để giữ cuộn + marquee mượt, tự phát lại khi quay lên đầu trang.
  useEffect(() => {
    if (!shouldAutoplayHeroVideo()) return;
    const video = heroVideoRefs.current[activeHeroVideo];
    const hero = heroRef.current;
    if (!video || !hero || !pageReady) return;

    // Chỉ phát lại khi video đã từng được phát (hoặc lần đầu vào viewport)
    // để không giật video ngay khi hero chưa từng hiện.
    const io = new IntersectionObserver(
      (entries) => {
        const el = heroVideoRefs.current[activeHeroVideo];
        if (!el) return;
        if (entries[0]?.isIntersecting) {
          if (el.paused && !heroPlayFailed) {
            el.play().catch(() => setHeroPlayFailed(true));
          }
        } else if (!el.paused) {
          el.pause();
        }
      },
      { threshold: 0.05 }
    );
    io.observe(hero);
    return () => io.disconnect();
  }, [activeHeroVideo, pageReady, heroPlayFailed]);

  // Warm-up: khi intro bắt đầu tan → mới set preload auto + load để video nền
  // phát từ cache (QuietPreloader) ngay lập tức, không giật và không tranh tài
  // nguyên với video intro đang phát.
  useEffect(() => {
    if (!pageReady) return;
    // Khách bật giảm chuyển động / tiết kiệm dữ liệu ⇒ không nạp video nền
    if (!shouldAutoplayHeroVideo()) return;
    heroVideoRefs.current.forEach((node) => {
      if (!node) return;
      node.preload = "auto";
      node.load();
    });
  }, [pageReady]);

  // Tạm dừng video nền khi tab bị ẩn (trình duyệt không decode frame vô ích);
  // quay lại trang → phát lại nếu hero đang ở trong viewport.
  useEffect(() => {
    if (!pageReady || !shouldAutoplayHeroVideo()) return;
    const onVisibility = () => {
      const el = heroVideoRefs.current[activeHeroVideo];
      if (!el) return;
      if (document.hidden) {
        if (!el.paused) el.pause();
        return;
      }
      const hero = heroRef.current;
      if (!hero) return;
      const r = hero.getBoundingClientRect();
      const inViewport = r.bottom > 0 && r.top < window.innerHeight;
      if (inViewport && el.paused && !heroPlayFailed) {
        el.play().catch(() => setHeroPlayFailed(true));
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [pageReady, activeHeroVideo, heroPlayFailed]);

  useEffect(() => {
    if (!pageReady) return;
    // Khách bật giảm chuyển động / tiết kiệm dữ liệu ⇒ không tự phát video nền
    if (!shouldAutoplayHeroVideo()) return;
    // Bảo đảm bất biến "một video decode": dừng mọi video không hiển thị trước
    // khi phát video đang hiển thị (đổi cảnh khi video kết thúc).
    heroVideoRefs.current.forEach((node, index) => {
      if (node && index !== activeHeroVideo && !node.paused) node.pause();
    });
    const active = heroVideoRefs.current[activeHeroVideo];
    if (!active) return;
    void active.play().catch(() => setHeroPlayFailed(true));
  }, [activeHeroVideo, pageReady]);

/* ---------- A1: cross-fade nền theo vị trí HERO (không theo trang) ---------- */
/*
 * VÌ SAO ĐỔI TỪ "scrub cả trang" SANG "bám hero":
 *   Bản cũ dùng `trigger: mainRef` + `start: "top top"` / `end: "60% top"` —
 *   tức mốc cuộn tính theo CHIỀU CAI CỦA CẢ TRANG. Trang dài thêm bao nhiêu
 *   (thêm section 2B, thêm ảnh…) thì lúc nào nền hiện cũng lệch, và hiệu ứng
 *   không còn gắn với "đáy hero" nữa — mà đáy hero mới là ranh giới thật giữa
 *   video và ảnh. Nay hai mốc đều neo vào chính `heroRef`.
 *
 * VÌ SAO KHÔNG `useScroll({ target })` CỦA FRAMER-MOTION:
 *   Đo trên Chrome thật: offset `["start start","end start"]` khiến MotionValue
 *   đứng yên ở 0 (hero cao đúng một viewport ⇒ đường tăng tốc ViewTimeline
 *   không phát giá trị). Chi tiết + bằng chứng ở hooks/useScrollProgress.ts.
 *
 * `useTransform` vẫn giữ nguyên ⇒ phần ánh xạ 0→1 vẫn là MotionValue thuần,
 * không render lại React theo mỗi pixel cuộn.
 *
 * Reduced-motion: KHÔNG dùng `useReducedMotion` của framer-motion vì
 * `app/layout.tsx` đặt `reducedMotion: "never"` cho MotionConfig (xem
 * lib/motion.ts) — hàm đó luôn trả false ở đây. Dùng đúng cổng của dự án.
 */
const heroProgress = useScrollProgress(heroRef);

/** Ảnh nền dịch vụ mờ dần từ 0 → 1 trong khoảng 35%→92% chiều cao hero.
 *
 *  `reducedValue` mặc định = 1: khi người dùng bật giảm chuyển động, ảnh hiện
 *  thẳng và video tắt hẳn (xem hooks/useScrollProgress.ts) — KHÔNG branch ở
 *  đây bằng state, vì state cần một lần render thứ hai và mở ra khoảng thời
 *  gian mà hiệu ứng vẫn chạy. */
const bgOpacity = useTransform(heroProgress, [0.35, 0.92], [0, 1]);

/**
 * A3 — tiến độ cuộn ngang của dải thẻ kiến thức, đọc thẳng từ scroll
 * container. MotionValue ⇒ cuộn ngang KHÔNG render lại React (bản cũ gọi
 * `scrollTo({behavior:"smooth"})` nhưng không có phản hồi trực quan).
 * `useSpring` để thanh không giật khi vuốt.
 */
const { scrollXProgress: knowledgeScrollRaw } = useScroll({
  container: knowledgeScrollRef,
});
const knowledgeProgress = useSpring(knowledgeScrollRaw, {
  stiffness: 260,
  damping: 34,
  restDelta: 0.001,
});

/**
 * Video mờ đi theo CHIỀU NGƯỢC lại — đây mới đúng là cross-fade hai lớp.
 * Bản cũ chỉ làm mờ video bằng CSS mask theo vị trí dọc trong hero, còn ảnh thì
 * hiện dần bên dưới; hai lớp vì vậy không thay thế nhau mà chồng lên nhau ở
 * ranh giới.
 */
const heroVideoOpacity = useTransform(heroProgress, [0.35, 0.92], [1, 0]);

  /* ---------- CTA parallax scroll ---------- */
  useEffect(() => {
    const root = mainRef.current;
    if (!root || !pageReady || prefersReducedMotion()) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".cta-panel",
        { y: 60, autoAlpha: 0 },
        {
          y: 0,
          autoAlpha: 1,
          duration: 1,
          ease: "power3.out",
          scrollTrigger: { trigger: ".cta-panel", start: "top 85%", once: true },
        }
      );
    }, root);

    return () => ctx.revert();
  }, [pageReady]);

  /**
   * Mờ dần tiêu đề "Dịch vụ nổi bật / Hệ thống chăm sóc toàn diện" theo tiến
   * độ cuộn, đồng thời đẩy nó đi cùng bộ thẻ.
   *
   * VÌ SAO GHI THẲNG VÀO DOM THAY VÌ setState: giá trị này đổi ở MỌI khung
   * hình khi người dùng cuộn. Nếu đưa vào state thì mỗi lần cuộn đều kích hoạt
   * một lượt render lại toàn trang (hero, danh sách dịch vụ, đội ngũ y tế…),
   * rơi xuống dưới 60fps. Ở đây chỉ đụng vào style của đúng một phần tử.
   *
   * VÌ SAO BỎ QUA reduced-motion: nhảy đột ngột 0/1 về mặt hiển thị không phải
   * chuyển động, nên người bật "giảm chuyển động" không bị mất thông tin nào.
   *
   * Mốc: bám theo thẻ cho tới khi thẻ ra giữa màn hình, rồi tan dần khi
   * khối chữ áp sát navbar.
   */
  useEffect(() => {
    const heading = servicesHeadingRef.current;
    const stage = serviceStageRef.current;
    if (!heading || !stage) return;

    if (prefersReducedMotion()) {
      heading.style.opacity = "";
      heading.style.transform = "";
      return;
    }

    // Cache rect của stage để không đo lại mỗi frame cuộn (tránh layout thrashing).
    // Chỉ đo lại khi resize hoặc khi kích thước stage đổi (ResizeObserver).
    let stageRectCache: DOMRect | null = null;
    let frame = 0;

    const measureStage = () => {
      stageRectCache = stage.getBoundingClientRect();
    };
    measureStage();

    const update = () => {
      frame = 0;
      if (!stageRectCache) return;
      const vh = window.innerHeight || 1;
      const centreY = stageRectCache.top + stageRectCache.height / 2;

      // Vùng bám: cho tới khi giữa bộ thẻ đi qua giữa màn hình.
      const STICK_END = vh * 0.5;
      // Vùng tan: từ giữa màn hình tới khi sát navbar.
      const FADE_END = vh * 0.2;

      let opacity = 1;
      let shift = 0;

      if (centreY <= STICK_END) {
        const span = Math.max(1, STICK_END - FADE_END);
        const p = Math.min(1, Math.max(0, (STICK_END - centreY) / span));
        // easeOutQuad: bắt đầu mờ chậm, tăng dần về cuối — nhìn mềm hơn
        // so với tuyến tính vốn tạo cảm giác chớp.
        opacity = 1 - p * (2 - p);
        // Trôi lên nhẹ cùng hướng thẻ để hai khối cảm giác là một.
        shift = -p * 18;
      }

      heading.style.opacity = opacity.toFixed(3);
      heading.style.transform = `translate3d(0, ${shift.toFixed(2)}px, 0)`;
    };

    const onScroll = () => {
      // Chỉ lên lịch MỘT khung hình, bất kể người dùng cuộn nhanh cỡ nào.
      if (!frame) frame = window.requestAnimationFrame(update);
    };

    // ResizeObserver đo lại rect khi kích thước stage đổi (ảnh lazy load, font render…)
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => {
        measureStage();
        update();
      });
      ro.observe(stage);
    }

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", () => {
      measureStage();
      onScroll();
    }, { passive: true });
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      ro?.disconnect();
    };
  }, []);

  /* ---------------------------------------------------------------------------
     goToService — mỗi lần bấm nút < / > PHẢI lùi đúng một slide.
     ---------------------------------------------------------------------------
     LỖI CŨ: một khoá 480ms (isServiceAnimatingRef) chặn mọi lần bấm trong
     khoảng đó. Bấm lần đầy còn chạy, bấm lần hai trong 480ms bị bỏ rơi →
     người dùng thấy phải bấm hai lần mới chuyển. Đó chính là cảm giác
     "double-tap / lag" mà người dùng phản ánh.

     CÁCH SỬA: không khoá theo thời gian. Thay vào đó giữ MỘT BẢN SAO của
     chỉ số hiện tại trong ref, tính slide kế tiếp ngay trong lúc bấm rồi cập
     nhật cả ref lẫn state. Nhờ vậy:
       • lần bấm nào cũng được tính đúng, không bị nuốt;
       • bấm liên tiếp rất nhanh vẫn mở đúng số slide (mỗi bấm +1);
       • không cần setState dạng updater (updater phải thuần khiết, không được
         phụ thuộc thời gian hay ghi ref bên trong).

     KHOÁ CÒN LẠI (ref, 160ms) chỉ để nuốt SỰ TRÙNG SỰ KIỆN của một cú chạm
     duy nhất — trình duyệt phát cả touch lẫn click cho cùng một ngón tay. Đây
     là khoá chống trùng theo khung hình, không phải khoá chống bấm lặp, nên nó
     không bao giờ làm mất một cú bấm có chủ đích. Bỏ qua isDebouncingRef vì
     React 18 chạy updater hai lần trong StrictMode nên mọi side-effect bên
     trong updater đều không đáng tin. */
  const activeServiceRef = useRef(activeService);
  const duplicateEventRef = useRef(false);
  const goToService = useCallback((index: number) => {
    if (duplicateEventRef.current) return;
    duplicateEventRef.current = true;
    window.setTimeout(() => {
      duplicateEventRef.current = false;
    }, 0);

    const next = ((index % SERVICE_COUNT) + SERVICE_COUNT) % SERVICE_COUNT;
    const current = activeServiceRef.current;
    if (next === current) return;

    activeServiceRef.current = next;
    setActiveService(next);
  }, []);

  /**
   * Phím mũi tên trái/phải chuyển slide.
   *
   * Chỉ khi carousel đang nhận tiêu điểm hoặc con trỏ đang nằm trong vùng nó,
   * để không cướp phím mũi tên của những cuộn trang khác (và không chặn phím
   * cuộn dọc của người dùng khi đang đọc trang).
   */
  useEffect(() => {
    const region = serviceCarouselRef.current;
    if (!region) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const active = document.activeElement;
      const focused = active === region || (active instanceof Node && region.contains(active));
      if (!focused && !region.matches(":hover")) return;
      e.preventDefault();
      goToService(activeServiceRef.current + (e.key === "ArrowRight" ? 1 : -1));
    };
    region.addEventListener("keydown", onKeyDown);
    return () => region.removeEventListener("keydown", onKeyDown);
  }, [goToService]);

  // Chạm/kéo ngang trên stage để đổi slide (hỗ trợ mobile)
  useEffect(() => {
    const stage = serviceStageRef.current;
    if (!stage) return;
    let startX = 0;
    const SWIPE_THRESHOLD = IS_TOUCH_DEVICE ? 80 : 40;
    const onStart = (e: TouchEvent) => {
      startX = e.touches[0]?.clientX ?? 0;
    };
    const onEnd = (e: TouchEvent) => {
      const endX = e.changedTouches[0]?.clientX ?? startX;
      const dx = endX - startX;
      if (Math.abs(dx) < SWIPE_THRESHOLD) return;
      // Đọc chỉ số hiện tại từ ref chứ không phải từ state: nếu kéo hai ngón
      // tay liên tiếp rất nhanh, state có thể chưa kịp cập nhật và cả hai cú
      // kéo sẽ tính ra cùng một slide đích, khiến người dùng phải kéo lại.
      goToService(activeServiceRef.current + (dx < 0 ? 1 : -1));
    };
    stage.addEventListener("touchstart", onStart, { passive: true });
    stage.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      stage.removeEventListener("touchstart", onStart);
      stage.removeEventListener("touchend", onEnd);
    };
  }, [goToService]);

  const scrollKnowledge = (direction: "left" | "right") => {
    if (knowledgeScrollRef.current) {
      const container = knowledgeScrollRef.current;
      // Bề rộng thẻ đổi theo breakpoint (300px ở mobile, 340px từ sm) — bản cŽ
      // hardcode 340 nên ở 390px mỗi lần bấm lệch, bấm vài lần mới sang thẻ.
      const firstCard = container.firstElementChild as HTMLElement | null;
      const styles = getComputedStyle(container);
      const gap = parseFloat(styles.columnGap || styles.gap || "0") || 24;
      const cardWidth = (firstCard ? firstCard.getBoundingClientRect().width : 340) + gap;
      const currentScroll = container.scrollLeft;
      const maxScroll = Math.max(0, container.scrollWidth - container.clientWidth);
      const targetScroll = direction === "left"
        ? Math.max(0, Math.round((currentScroll - cardWidth) / cardWidth) * cardWidth)
        : Math.min(maxScroll, Math.round((currentScroll + cardWidth) / cardWidth) * cardWidth);
      container.scrollTo({
        left: targetScroll,
        behavior: prefersReducedMotion() ? "auto" : "smooth",
      });
    }
  };

  /* A3 — phím ←/→ điều khiển dải kiến thức khi tiêu điểm nằm trong khu vực.
     Cùng nguyên tắc với carousel dịch vụ: chỉ cướp phím khi focus thật sự ở
     đây (hoặc con trỏ đang ở trên khu vực), không chặn phím mũi tên của người
     dùng ở các vùng cuộn dọc khác. */
  useEffect(() => {
    const section = document.getElementById("vet-knowledge");
    if (!section) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const active = document.activeElement;
      const focused = active === section || (active instanceof Node && section.contains(active));
      if (!focused && !section.matches(":hover")) return;
      e.preventDefault();
      scrollKnowledge(e.key === "ArrowRight" ? "right" : "left");
    };
    section.addEventListener("keydown", onKeyDown);
    return () => section.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={mainRef} className="relative text-slate-800 w-full">
      {/* A1 — ảnh nền dịch vụ + gradient overlay, gộp MỘT lớp fixed.
          `opacity` lấy từ MotionValue `bgOpacity` (đảo chiều với video), nên
          mỗi frame cuộn chỉ blend lại một lớp full-screen chứ không render
          lại React. Không còn `opacity-0` cứng + GSAP scrub trên cả trang —
          xem khối "A1: cross-fade nền" ở trên. */}
      <motion.div
        className="fixed inset-0 z-0 pointer-events-none"
        aria-hidden="true"
        style={{
          opacity: bgOpacity,
          /* GĐ2A — ĐỔI LỚP PHỦ. Vì sao:
             Lớp này là `fixed inset-0` ⇒ gradient "to bottom" tính theo CHIỀU
             CAO VIEWPORT chứ không phải theo trang, nên vùng 0–25% luôn dính
             rgba(15,23,42,.5) — một màn navy 50% phủ lên MỌI section nằm dưới
             hero. Tiêu đề các section màu slate-900 (#0f172a) nằm trên nền đó
             gần như vô hình (đã chụp màn hình xác nhận: "Our comprehensive
             care system", "The best place to care for your pet" đều chìm).

             LỖI NÀY CÓ TRƯỚC, KHÔNG DO GĐ2A: bản cũ dùng GSAP scrollTrigger
             { start: "top top", end: "60% top" } — `end` nhỏ hơn `start` (scrollY
             âm) nên progress bị kẹp ở 1 ⇒ ảnh nền đã ở opacity 1 NGAY TỪ ĐẦU
             TRANG suốt thời gian qua. Sửa ở đây vì A1 đã tiếp quản lớp này và
             để nguyên là bàn giao một lỗi tương phản đang nổ.

             Nay: vớt kem/trắng đục đè lên ảnh, đậm dần xuống dưới ⇒ ảnh vẫn
             thấy (mềm, kiểu nền mờ) mà chữ tối vẫn đọc được. Giữ một lớp navy
             rất nhạt ở mép trên chỉ để navbar không bị chói. */
          backgroundImage:
            "linear-gradient(to bottom, rgba(15,23,42,0.16) 0%, rgba(253,246,227,0.58) 26%, rgba(253,246,227,0.80) 55%, rgba(253,246,227,0.88) 100%), url(/anhnentcdichvu.webp)",
          backgroundSize: "cover, cover",
          backgroundPosition: "center, center 30%",
          backgroundRepeat: "no-repeat, no-repeat",
          willChange: "opacity",
        }}
      />

      {/* Trường hạt DNA tương tác — full-screen fixed, morph theo cuộn:
          dải sóng hero → dày đặc sau thẻ dịch vụ → 2 cột xoắn ADN giữa 2 mục
          → túa dày dưới thẻ bác sĩ → dạt 2 bên biến mất. Bên trên ảnh nền
          fixed, dưới nội dung (z-10), pointer-events-none nên không cản click. */}
      <div className="fixed inset-0 z-[5] pointer-events-none" aria-hidden="true">
        <ParticleDNAField />
      </div>

      <div className="relative z-10">
        {/* Hero Section */}
        <section ref={heroRef} className="hero relative min-h-screen flex items-center justify-center overflow-hidden pt-28 pb-20">
          {/* A1 — lớp video. `opacity` là CHIỀU NGƯỢC của ảnh nền ⇒ hai lớp
              thay thế nhau thật sự khi cuộn, thay vì chồng lên nhau ở ranh giới. */}
          <motion.div
            className="hero-video-layer absolute inset-0 z-0"
            style={{
              willChange: "transform, opacity",
              contain: "layout style paint",
              opacity: heroVideoOpacity,
              maskImage: "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.95) 20%, rgba(0,0,0,0.7) 40%, rgba(0,0,0,0.3) 60%, rgba(0,0,0,0.08) 80%, rgba(0,0,0,0) 100%)",
              WebkitMaskImage: "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.95) 20%, rgba(0,0,0,0.7) 40%, rgba(0,0,0,0.3) 60%, rgba(0,0,0,0.08) 80%, rgba(0,0,0,0) 100%)",
            }}
          >
            {[
              { src: "/belwee-hero.mp4", poster: "/belwee-hero-poster.jpg" },
              { src: "/belwee-super.mp4", poster: "/belwee-super-poster.jpg" },
            ].map(({ src: source, poster }, index) => (
              <video
                key={source}
                poster={poster}
                ref={(node) => {
                  heroVideoRefs.current[index] = node;
                  if (node) {
                    node.muted = true;
                    // KHÔNG set `node.preload = "none"` ở đây: ref inline có
                    // identity mới ở MỖI lần render nên React gỡ/gắn lại ref
                    // liên tục — gán preload ở đây sẽ đè mất `preload = "auto"`
                    // mà warm-up effect đặt sau khi intro tan. Trạng thái
                    // preload ban đầu đã nằm sẵn ở thuộc tính `preload="none"`
                    // bên dưới; muốn nạp thì chỉ warm-up effect được phép đổi.
                  }
                }}
                muted
                playsInline
                disablePictureInPicture
                controlsList="nodownload noremoteplayback nofullscreen"
                data-quiet-prefetch
                preload="none"
                className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-[1000ms] ease-in-out will-change-opacity pointer-events-none ${
                  activeHeroVideo === index ? "opacity-100" : "opacity-0"
                }`}
                onCanPlay={() => heroPlayReady(index)}
                onEnded={() => {
                  const next = (index + 1) % 2;
                  setActiveHeroVideo(next);
                  window.setTimeout(() => {
                    const nextVideo = heroVideoRefs.current[next];
                    if (nextVideo) {
                      nextVideo.currentTime = 0;
                      void nextVideo.play().catch(() => setHeroPlayFailed(true));
                    }
                  }, 40);
                }}
                onError={() => {
                  if (index === activeHeroVideo) {
                    setHeroPlayFailed(true);
                    setActiveHeroVideo((current) => (current + 1) % 2);
                  }
                }}
              >
                <source src={source} type="video/mp4" />
              </video>
            ))}
            {/* Hero video is muted autoplay background; no play control shown. */}
            <div className="absolute inset-0 bg-slate-900/35" />
          </motion.div>

          {/* Lớp ambient (z-2) nằm giữa video và nội dung: aurora, tia sáng
              một lần, đốm lấp lánh. Tất cả `pointer-events: none` và
              `aria-hidden` — chỉ để tạo chiều sâu, không phải nội dung. */}
          <div className="hero-ambient" aria-hidden="true">
            <div className="hero-aurora hero-aurora--a" />
            <div className="hero-aurora hero-aurora--b" />
            <div className="hero-flare" />
            <div className="hero-sparkles">
              {HERO_SPARKS.map((spark, index) => (
                <span
                  key={index}
                  className="hero-spark"
                  style={
                    {
                      left: spark.left,
                      top: spark.top,
                      width: spark.size,
                      height: spark.size,
                      "--spark-delay": `${spark.delay}s`,
                      "--spark-duration": `${spark.duration}s`,
                    } as React.CSSProperties
                  }
                />
              ))}
            </div>
          </div>

          {/* Dấu chân trôi (I1). Nằm SAU khối chữ (z-5 so với z-10) để chữ
              luôn đọc trước, và `pointer-events: none` để không chặn thao tác
              lên video hay nút bấm. */}
          <HeroPaws />

          {/* KHÔNG render nút bật/tắt Sáng–Tối ở đây nữa — yêu cầu: homepage
              không có bất kỳ control đổi theme nào. Trước đây nút này nằm
              trong hero, cộng thêm một bản nữa ở app/layout.tsx (dùng chung
              mọi trang). Bản layout được gate theo route trong
              components/ThemeToggleDock.tsx, nên các trang khác giữ nguyên
              còn trang chủ thì không render — xem file đó để rõ lý do. Không
              dùng `hidden`/`opacity: 0`: bỏ hẳn khỏi cây DOM để không còn
              chiếm layout. */}

          <div className="relative z-10 px-4 sm:px-6 lg:px-8 w-full max-w-4xl mx-auto text-center">
            {/* Tiêu đề hero — tách từng ký tự để chạy reveal nhưng KHÔNG thành
                sọc gradient: `HeroTitle` đo vị trí layout của từng ký tự rồi
                chia sẻ một `background-size` bằng bề rộng cả dòng, dịch nền
                bằng `background-position-x` (xem components/home/HeroTitle.tsx).

                MỘT HÀNG NGANG (yêu cầu chủ trang chủ): `.hero-title` được
                full-bleed bằng `width: 100vw; margin-left: calc(50% - 50vw)`
                trong globals.css, vì khối `max-w-4xl` (~832px) hẹp hơn dòng
                chữ Việt (~903px). `nowrap` phải đặt NGAY TRÊN `h1` (không chỉ
                lớp bọc) vì quy tắc toàn cục `h1 { text-wrap: balance }` đè giá
                trị thừa hưởng. Cỡ chữ chọn theo ngôn ngữ để một hàng luôn vừa:
                  · vi  "BELWEE XIN CHÀO!!!"   ≈ 10,26em → 9vw  ⇒ 92,3vw
                  · en  "BELWEE HELLO WELCOME" ≈ 13,24em → 7vw  ⇒ 92,7vw
                đều < 100vw nên không bị `overflow-hidden` của hero cắt.

                Không gate sau animation: chữ nằm sẵn trong HTML (chỉ mờ đi khi
                GSAP bắt đầu), nên no-JS và reduced-motion vẫn đọc được đầy đủ. */}
            <HeroTitle
              title={`${t("home.heroTitleBrand")} ${t("home.heroWord2")} ${t("home.heroWord3")}`}
              accent={t("home.heroAccent")}
              ariaLabel={t("home.heroTitleAria")}
              className={`mb-6 text-center whitespace-nowrap font-extrabold leading-tight ${
                lang === "vi"
                  ? "text-[clamp(1.6rem,9vw,5.5rem)]"
                  : "text-[clamp(1.25rem,7vw,5.5rem)]"
              }`}
            />

            {/* Phụ đề gõ từng ký tự. Bản đầy đủ cho screen reader nằm trong
                `sr-only`; phần chữ động là `aria-hidden` (xem HeroSubtitle). */}
            <HeroSubtitle
              text={t("home.heroSub")}
              className="text-lg sm:text-2xl text-slate-100 drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)] mb-10 leading-relaxed font-medium max-w-3xl mx-auto"
            />

            {/* Quầng sáng nằm SAU nút. Không GSAP-transform chính
                `.booking-lens-button` vì hover/active của nó đã dùng transform
                trong CSS — inline style sẽ chặn hiệu ứng. */}
            <div className="hero-cta">
              <span className="hero-cta-glow" aria-hidden="true" />
              <BookingLensButton
                onClick={handleBook}
                aria-label={t("home.bookCtaAria")}
                icon={<span>📅</span>}
              >
                {t("home.bookCta")}
              </BookingLensButton>
            </div>

            {/* GĐ2B · 25.1 — Dock hành động nhanh: Đặt lịch · Cấp cứu 24h ·
                Phòng khám gần bạn · Gọi tư vấn (HOTLINE thật từ lib/clinics.ts).

                GĐ2A — hiện ở MỌI kích thước, không còn `hidden lg:block`.
                Trước đây trên màn hẹp nó bị ẩn vì đã có "thanh hành động cố
                định" đáy màn hình; thanh đó đã bị GỠ (nó đè lên nội dung và
                chiếm diện tích), nên dock này là chỗ giữ các hành động đó.
                Nó nằm TRONG luồng trang nên không che nội dung nào. */}
            <div className="hero-dock">
              <QuickActionDock className="mt-8" />
            </div>
          </div>

          {/* Gợi ý cuộn — trang trí, không phải điều khiển (tránh thêm một
              focus stop ngay dưới CTA). */}
          <div className="hero-scroll-cue" aria-hidden="true">
            <span className="hero-scroll-cue__dot" />
          </div>
        </section>



        {/* Services Section */}
        <section id="home-services" className="relative px-4 py-20 sm:px-6 lg:px-8 overflow-x-clip">
          {/* Soft radial glow behind services */}
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full pointer-events-none"
            style={{ background: "radial-gradient(closest-side, rgba(191, 219, 254, 0.28), transparent)" }}
            aria-hidden="true"
          />
          <div className="mx-auto max-w-full">
            {/* TIÊU ĐỀ BÁM THEO CAROUSEL.
                `sticky` giữ khối chữ này lơ lửng cùng bộ thẻ khi người dùng
                cuộn, nên tiêu đề không trôi lên trên trước rồi bỏ rơi thẻ.

                VÌ SAO KHÔNG dùng `overflow-hidden` ở section: `overflow: hidden`
                tạo ra scroll container, mà scroll container đó không cuộn được
                → position: sticky bên trong sẽ chết lặng. `overflow-x: clip`
                cắt đúng phần tràn ngang (quầng sáng) mà vẫn để sticky sống. */}
            <div
              ref={servicesHeadingRef}
              className="sticky top-24 z-20 mb-10 text-center will-change-[transform,opacity]"
            >
              <span
                data-reveal="fade"
                data-reveal-exit
                className="inline-block rounded-full bg-blue-100/80 border border-blue-200/80 backdrop-blur-md px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.28em] text-blue-700 shadow-sm"
              >
                {t("home.featuredServices")}
              </span>
              <h2 data-reveal="fade-up" data-reveal-exit className="mt-4 text-3xl sm:text-4xl font-light tracking-tight text-slate-900 drop-shadow-sm">
                {t("home.comprehensiveCare")}
              </h2>
            </div>

            {/* Slider 3D coverflow — thay marquee vô tận. perspective 1300px tạo
                chiều sâu; 2 lớp ảnh hai bên bị thu nhỏ + nghiêng nhẹ, ảnh giữa
                nổi bật như bộ sưu tập tối giản */}
            <div ref={serviceCarouselRef} className="relative mx-auto w-full max-w-4xl">
              <div
                ref={serviceStageRef}
                tabIndex={0}
                className="service-stage-3d relative h-[380px] sm:h-[440px]"
                aria-roledescription="carousel"
                aria-label={t("home.servicesAria")}
              >
                {services.map((item, index) => {
                  const offset = index - activeService;
                  const isActive = offset === 0;
                  const isHidden = Math.abs(offset) > 2;
                  const title = t(item.titleKey);
                  const icon = title.includes("Khám") ? "🏥" : title.includes("X-quang") ? "🔬" : title.includes("Spa") ? "🛁" : "🏨";
                  return (
                    <div
                      key={item.titleKey}
                      className="service-card-3d absolute inset-0 m-auto h-[300px] w-[248px] sm:h-[340px] sm:w-[280px]"
                      style={{
                        transform: `translate3d(calc(var(--slide-offset) * ${offset}), 0, 0) rotateY(${offset * -SERVICE_SLIDE_ROTATE}deg) scale(${isActive ? 1 : SERVICE_SLIDE_SCALE})`,
                        // Nâng lớp kính riêng cho mỗi thẻ: trình duyệt không phải
                        // dựng lại texture mỗi khung hình khi transform đổi.
                        willChange: "transform",
                        zIndex: 10 - Math.abs(offset),
                        opacity: isHidden ? 0 : 1,
                        visibility: isHidden ? "hidden" : "visible",
                        pointerEvents: isActive ? "auto" : "none",
                        transition: "transform 480ms cubic-bezier(0.22, 1, 0.36, 1), opacity 400ms ease, visibility 0s",
                      }}
                    >
                      {/* A2 — thẻ GIỮA dùng vật liệu kính thật (`GlassSurface`
                          ⇒ `.pt-glass`: backdrop-filter + rim + glare), hai thẻ
                          bên giữ nền phẳng như cũ. Lý do phân tách: chỉ một
                          thẻ được nhoè cùng lúc, nền phía sau thẻ bên đã bị
                          thu nhỏ + nghiêng nên nhoè thêm gần như không đổi gì
                          mà vẫn tốn GPU — đúng nguyên tắc "≤ 3 lớp kính thật
                          trong viewport" của mục 20.
                          Kích thước bên trong (ảnh 4/3, padding, cỡ chữ) giữ
                          nguyên ⇒ đổi vật liệu KHÔNG làm thay đổi chiều cao
                          thẻ, không CLS. */}
                      <div
                        onClick={() => { if (!isActive) goToService(index); }}
                        className={`group relative h-full w-full ${
                          isActive ? "cursor-default" : "cursor-pointer"
                        }`}
                      >
                        <GlassSurface
                          as="div"
                          radius="xl"
                          className={`h-full w-full overflow-hidden transition-shadow duration-300 ${
                            isActive
                              ? "pt-glass shadow-[0_24px_50px_-12px_rgba(30,64,175,0.36)]"
                              : "bg-gradient-to-b from-white to-blue-50 shadow-[0_18px_40px_-12px_rgba(30,64,175,0.28)] ring-1 ring-white/80"
                          }`}
                        >
                        {/* Header màu xanh dương đậm phía trên ảnh */}
                        <div className="flex items-center gap-2.5 bg-gradient-to-r from-blue-600 via-sky-600 to-blue-700 px-4 py-3">
                          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/20 text-base" aria-hidden="true">{icon}</span>
                          <h3 className="text-[15px] font-semibold tracking-tight text-white">{title}</h3>
                        </div>
                        {/* Khung ảnh ngà — ảnh dịch vụ */}
                        <div className="p-3">
                          <div className="aspect-[4/3] w-full overflow-hidden rounded-[16px] border-2 border-[#f5f0e6] bg-slate-100 relative shadow-inner">
                            <Image
                              src={item.image}
                              alt={title}
                              fill
                              sizes="(max-width: 640px) 248px, 280px"
                              className="object-cover transition-transform duration-500 group-hover:scale-105"
                              loading="lazy"
                            />
                          </div>
                          <p className="mt-3 line-clamp-2 px-1 text-[13px] leading-5 text-slate-600">{t(item.textKey)}</p>
                        </div>
                        </GlassSurface>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* GĐ2A — BỘ ĐIỀU KHIỂN CAROUSEL: MỘT kiểu duy nhất ở MỌI kích thước.
                          Trước đây có HAI bộ: pill kính từ `lg` trở lên, và
                          dưới `lg` là 2 nút tròn + 4 chấm. Hai bộ cho cùng một
                          carousel vừa trùng chức năng vừa khiến cùng một trang
                          hành xử khác nhau tuỳ bề rộng. Nay chỉ còn pill này.

                          • Cao cố định 48px, hai nút mũi tên 44×44 (≥ 44px cho
                            cảm ứng — WCAG 2.5.5) nên vùng bấm đủ lớn ở cả mobile.
                          • Dưới `sm`: pill giãn hết bề rộng khả dụng và tên thẻ
                            tự cắt bằng `truncate`; từ `sm` trở lên: pill co theo
                            nội dung với ô tên rộng tối thiểu 13rem như trước —
                            nhờ vậy bề rộng pill không đổi trên desktop.
                          • Tên thẻ đổi bằng AnimatePresence, kèm `aria-live`
                            đọc cả tên lẫn chỉ số "n/4".
                          • CHỮ dùng `layout="position"` (đo vị trí, KHÔNG scale)
                            — `layout` mặc định sẽ scale chữ theo animation và
                            làm méo.
                          • `tabular-nums` cho chỉ số "2/4" — nếu không, con số
                            đổi độ rộng mỗi lần bấm và làm pill giật.
                          • Phím ←/→ xử lý ở effect phía trên; vùng bàn phím là
                            KHỐI BAO quanh cả stage lẫn pill
                            (`serviceCarouselRef`), nên bấm nút rồi bấm phím vẫn
                            chạy. Vuốt (touch) do effect `touchstart/touchend` lo. */}
              <div className="mt-4 flex justify-center">
                <GlassPill
                  as="div"
                  ariaLabel={t("home.servicesAria")}
                  className="flex h-12 w-full max-w-[22rem] items-center gap-1 px-1.5 sm:w-auto sm:max-w-none"
                >
                  <GlassButton
                    onClick={() => goToService(activeService - 1)}
                    aria-label={t("home.prevService")}
                    className="h-11 w-11 shrink-0 p-0"
                    icon={
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                      </svg>
                    }
                  />

                  <div className="relative flex min-w-0 flex-1 items-center justify-center px-1 sm:min-w-[13rem] sm:flex-none sm:px-2">
                    <span className="sr-only" aria-live="polite">
                      {`${t(services[activeService].titleKey)} ${activeService + 1}/${SERVICE_COUNT}`}
                    </span>
                    <AnimatePresence mode="popLayout" initial={false}>
                      <motion.span
                        key={activeService}
                        aria-hidden="true"
                        layout="position"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{
                          opacity: { duration: 0.18 },
                          y: { type: "spring", stiffness: 420, damping: 34 },
                        }}
                        className="block w-full truncate text-center text-sm font-semibold text-[var(--pt-heading)]"
                      >
                        {t(services[activeService].titleKey)}
                      </motion.span>
                    </AnimatePresence>
                  </div>

                  <span
                    aria-hidden="true"
                    className="shrink-0 px-1.5 text-xs font-semibold tabular-nums text-[var(--pt-fg-muted)]"
                  >
                    {activeService + 1}/{SERVICE_COUNT}
                  </span>

                  <GlassButton
                    onClick={() => goToService(activeService + 1)}
                    aria-label={t("home.nextService")}
                    className="h-11 w-11 shrink-0 p-0"
                    icon={
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    }
                  />
                </GlassPill>
              </div>

            </div>
          </div>
        </section>



        {/* GĐ2B · 25.2 — Quy trình thăm khám 4 bước.
            Vị trí theo §25: ngay dưới "Hệ thống chăm sóc toàn diện" (A2), trước
            "Nơi chăm sóc thú cưng của bạn tốt nhất" (A6).
            Nội dung là BẢN NHÁP chờ phòng khám duyệt — xem báo cáo GĐ2B. */}
        <CareJourney />

        {/* GĐ3 · 25.3 — Teaser "vùng cơ thể".
            CHỈ có vùng "Da & lông": đề bài gốc liệt kê 4 vùng nhưng dự án chỉ
            có dịch vụ thật cho vùng này (Spa - Grooming), và chủ dự án đã xác
            nhận chỉ làm vùng Da & lông. Ba vùng Tai / Răng / Khớp KHÔNG được
            vẽ — vẽ rồi bấm không có gì xảy ra thì tệ hơn không có.
            Vị trí: ngay sau quy trình 4 bước, trước A6. */}
        <CareAreaMap />

        {/* Hạng mục A6 — "Nơi chăm sóc thú cưng của bạn tốt nhất".
            Vị trí theo yêu cầu: NGAY DƯỚI "Hệ thống chăm sóc toàn diện"
            (#home-services) và NGAY TRÊN "Các chuyên gia thú y của chúng tôi"
            (#home-vets). Section tự lo container + lưới + reveal, nên ở đây chỉ
            cần một dòng — không thêm markup vào file vốn đã 1164 dòng này. */}
        <WhyChooseBelwee />

        {/* Vet Experts Section */}
        <section id="home-vets" className="relative px-4 py-20 sm:px-6 lg:px-8 overflow-hidden">
          {/* Soft radial glow behind vet section */}
          <div
            className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[350px] rounded-full pointer-events-none"
            style={{ background: "radial-gradient(closest-side, rgba(167, 243, 208, 0.24), transparent)" }}
            aria-hidden="true"
          />
          <div className="mx-auto max-w-full">
            <div className="mb-10 text-center">
              <span
                data-reveal="fade"
                data-reveal-exit
                className="inline-block rounded-full bg-emerald-50/80 backdrop-blur-md px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700"
              >
                {t("home.vetDoctors")}
              </span>
              <h2 data-reveal="fade-up" data-reveal-exit className="mt-4 text-3xl sm:text-4xl font-light tracking-tight text-slate-900">
                {t("home.vetDoctorsTitle")}
              </h2>
            </div>

            {/* Nhân sự Belwee — 4 thẻ, 2 mỗi hàng trên mobile.
                grid-cols-2 from 360px up. Previously grid-cols-1, so ONE card
                filled the whole 360px viewport: a 340×340 portrait plus padding
                is a full screen, and the visitor had to swipe four times to
                reach the CTA below the grid. */}
            <div
              data-reveal-group
              className="mx-auto grid max-w-5xl grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4 lg:gap-6"
            >
              {STAFF_PROFILES.map((member) => (
                <article
                  key={member.id}
                  className="doctor-card group rounded-[20px] p-2.5 sm:rounded-[24px] sm:p-4"
                >
                  <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[14px] bg-slate-100 shadow-inner sm:aspect-square sm:rounded-[16px]">
                    {member.image ? (
                      <Image
                        src={member.image}
                        alt={member.name}
                        fill
                        sizes="(min-width: 1024px) 260px, (min-width: 640px) 45vw, 45vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                        loading="lazy"
                      />
                    ) : (
                      <span
                        aria-hidden="true"
                        className="flex h-full w-full items-center justify-center bg-gradient-to-br from-emerald-100 to-sky-100 text-4xl"
                      >
                        {member.emoji}
                      </span>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                  </div>
                  <div className="mt-2.5 px-0.5 pb-1 sm:mt-3">
                    <h3 className="text-[13px] font-semibold leading-tight text-slate-900 transition-colors duration-300 group-hover:text-emerald-700 sm:text-[15px]">
                      {staffDisplayName(member)}
                    </h3>
                    <p className="mt-1 text-[10px] font-semibold leading-snug text-emerald-600 sm:text-[11px]">
                      {member.title}
                    </p>
                  </div>
                </article>
              ))}
            </div>

            {/* Link to the full roster — the advisory doctors keep bio pages. */}
            <div className="mt-6 text-center">
              <Link
                href="/doi-ngu"
                className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50/80 px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-emerald-700 transition-all hover:bg-emerald-100 active:scale-[0.98]"
              >
                Xem toàn bộ đội ngũ chuyên gia
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </section>



        {/* Knowledge Section */}
        <section id="vet-knowledge" className="relative px-4 py-20 text-slate-800 sm:px-6 lg:px-8">
          <div className="apple-glass mx-auto max-w-6xl rounded-[36px] border border-white/70 p-8 sm:p-12">
            <div className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
              <Reveal variant="fade-up">
                <div>
                  <span className="inline-block rounded-full bg-blue-100/80 border border-blue-200/80 backdrop-blur-md px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.28em] text-blue-700">
                    {t("home.knowledge")}
                  </span>
                  <h2 className="mt-4 text-3xl font-light tracking-tight text-slate-900">{t("home.knowledgeTitle")}</h2>
                </div>
              </Reveal>

              {/* HẠNG MỤC A3 — MỘT pill điều khiển thay cho hai nút rời rạc.
                  Vì sao gộp: bản cũ có nút ◀ ▶ Ở GÓC TRÊN PHẢI *và* thanh cu���n
                  ngang mặc định của trình duyệt ở đáy — hai bộ điều khiển cho
                  cùng một dải, trông như lỗi. Nay còn một bộ, và thanh cuộn
                  mặc định bị ẩn (class `no-scrollbar`, xem app/globals.css §0.9b)
                  trong khi `overflow-x` + `scroll-snap` GIỮ NGUYÊN ⇒ vuốt và
                  snap vẫn chạy, chỉ mất thanh xám có nút ▲▼.

                  Thanh tiến độ giữa là `scaleX` điều khiển bằng MotionValue
                  của `useScroll({ container, horizontal: true })` ⇒ không
                  setState, không render lại React khi cuộn. `origin-left` +
                  `scaleX` là thuộc tính compositor. */}
              <div className="flex items-center gap-3 self-end sm:self-auto">
                <GlassPill as="div" className="flex h-12 items-center gap-2 px-2">
                  <GlassButton
                    onClick={() => scrollKnowledge("left")}
                    aria-label={t("home.knowledgePrev")}
                    className="h-11 w-11 shrink-0 p-0"
                    icon={
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                      </svg>
                    }
                  />
                  <span
                    aria-hidden="true"
                    className="relative block h-1 w-16 overflow-hidden rounded-full bg-slate-900/10 sm:w-24"
                  >
                    <motion.span
                      style={{ scaleX: knowledgeProgress }}
                      className="absolute inset-0 origin-left rounded-full bg-blue-600/70"
                    />
                  </span>
                  <GlassButton
                    onClick={() => scrollKnowledge("right")}
                    aria-label={t("home.knowledgeNext")}
                    className="h-11 w-11 shrink-0 p-0"
                    icon={
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    }
                  />
                </GlassPill>
              </div>
            </div>

            <div
              ref={knowledgeScrollRef}
              /* `no-scrollbar` ẩn thanh cuộn mặc định của trình duyệt; `overflow-x`
                 và `scroll-snap` giữ nguyên nên vuốt vẫn hoạt động đúng. */
              className="no-scrollbar flex gap-6 overflow-x-auto scroll-smooth snap-x snap-mandatory pt-4 pb-4"
            >
              {orderedKnowledge.map((item) => (
                <Link
                  key={item.titleKey}
                  href="/kien-thuc-thu-y"
                  /* HẠNG MỤC A3 — thẻ dùng vật liệu kính dùng chung
                     (`pt-glass glass-surface`, đúng bộ class mà
                     components/ui/GlassSurface.tsx ghép) thay cho
                     `.apple-glass` — bản cũ là nền trắng alpha cao, KHÔNG có
                     `backdrop-filter` nên không thật sự là kính.
                     Giữ `knowledge-card` làm marker và giữ nguyên hiệu ứng
                     hover của thẻ. */
                  /* `!rounded-[28px]`: BẮT BUỘC có `!`. Các luật .pt-glass /
                     .glass-surface nằm SAU khối @tailwind utilities trong
                     globals.css nên cùng độ ưu tiên (0,1,0) thì chúng thắng,
                     và thẻ sẽ bị ép về 24px. `!` đưa utility lên trên — cùng
                     cách mà StaffDashboard đang dùng `!rounded-2xl`. */
                  className="pt-glass glass-surface knowledge-card group flex w-[300px] flex-shrink-0 snap-start flex-col justify-between overflow-hidden !rounded-[28px] p-5 transition-transform duration-300 hover:-translate-y-2 sm:w-[340px]"
                >
                  <div>
                    <div className="mb-4 flex items-center justify-between">
                      <span className="rounded-full bg-blue-100/90 border border-blue-200 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-700">
                        {t(item.tagKey)}
                      </span>
                      <span className="text-lg text-blue-600 transition group-hover:translate-x-1">→</span>
                    </div>

                    <div className="mb-4 h-48 w-full overflow-hidden rounded-[20px] border border-slate-200 bg-slate-100 relative shadow-inner">
                      <Image
                        src={item.image}
                        alt={t(item.titleKey)}
                        fill
                        sizes="(max-width: 640px) 300px, 340px"
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                        loading="lazy"
                      />
                    </div>

                    {/* Chữ dùng token theme thay vì slate-900/slate-600 cứng:
                        `.pt-glass` ở theme TỐI là kính tối, nếu giữ màu chữ
                        tối cứng thì thẻ mất khả năng đọc. Hai thuộc tính này là
                        toàn bộ phần chữ của thẻ nên chỉ cần đổi ở đúng hai chỗ. */}
                    <h3 className="text-lg font-semibold text-[var(--pt-heading)] transition-colors group-hover:text-[var(--pt-accent)]">{t(item.titleKey)}</h3>
                    <p className="mt-2 text-sm leading-6 text-[var(--pt-fg-muted)]">
                      {t("home.knowledgeDesc")}
                    </p>
                  </div>
                </Link>
              ))}

              {/* THẺ "ĐỌC THÊM" — thẻ mờ cuối dải kiến thức, không nội dung bài;
                  cùng class/hover/scroll-snap như các thẻ trước, dẫn thẳng tới
                  /kien-thuc-thu-y */}
              <Link
                href="/kien-thuc-thu-y"
                /* KHÔNG đặt aria-label ở đây. Chữ hiển thị ("Đọc thêm" +
                   "Kiến thức thú y →") tự nó đã là một accessible name đầy
                   đủ; thêm aria-label chỉ khiến tên không chứa hết chữ nhìn
                   thấy, vi phạm WCAG 2.5.3 (Label in Name) — Lighthouse bắt
                   đúng lỗi này ở thẻ này. */
                className="apple-glass knowledge-card knowledge-readmore group w-[300px] sm:w-[340px] flex-shrink-0 overflow-hidden rounded-[28px] border border-white/70 p-5 transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_8px_28px_-4px_rgba(37,99,235,0.15)] snap-start flex flex-col items-center justify-center gap-3 text-center"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 border border-blue-200 text-2xl text-blue-600 transition-transform duration-300 group-hover:rotate-8 group-hover:scale-110" aria-hidden="true">
                  📖
                </span>
                <span className="text-base font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                  {t("home.knowledgeReadMore")}
                </span>
                <span className="text-sm font-medium text-blue-600 group-hover:text-blue-700 transition-colors">
                  {t("home.knowledgeReadMoreLink")} →
                </span>
              </Link>
            </div>
          </div>
        </section>

        {/* Hệ thống phòng khám — căn chỉnh theo sinh thiết kế Ảnh 1 (đặt sau kiến thức) */}
        <BranchesSection />

        {/* Dải số liệu (I1) — đặt sau ClinicSystem: đây là lúc người đọc đã
            xem dịch vụ và đội ngũ, nên con số "4 chi nhánh / 10 bác sĩ" mới có
            sức nặng chứ không phải lời hứa suông ngay dưới hero. */}
        <StatsBand />

        {/* Featured activities — thẻ kính sáng, mỗi thẻ là link tới /kien-thuc-thu-y */}
        <BelweeNewsSection />


        {/* CTA Section — pb-6 (24px): khoảng cách cố ý tới wave của footer,
            thống nhất qua biến --footer-gap trong globals.css */}
        <CareReminder />

        <HomeFaq />

        <section className="px-4 pt-20 pb-6 sm:px-6 lg:px-8">
          <div className="cta-panel mx-auto max-w-5xl rounded-[32px] border border-blue-300/40 bg-gradient-to-r from-blue-600 via-sky-500 to-blue-700 backdrop-blur-xl p-8 text-white shadow-[0_16px_50px_rgba(37,99,235,0.35)] sm:p-12">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-blue-100">{t("home.bookingSection")}</p>
                <h3 className="mt-3 text-3xl font-light tracking-tight">{t("home.bookingTitle")}</h3>
                <p className="mt-2 text-sm text-blue-50">{t("home.bookingDesc")}</p>
              </div>
              <button
                onClick={handleBook}
                className="relative overflow-visible inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full bg-white px-8 py-4 text-blue-600 font-semibold text-base transition-all duration-300 hover:bg-blue-50 hover:scale-105 shadow-lg"
                onMouseEnter={(e) => {
                  if (IS_TOUCH_DEVICE) return;
                  const btn = e.currentTarget;
                  // Huỷ vòng particle đang chạy (nếu có) trước khi bùng hiệu ứng mới
                  const prevCleanup = buttonParticleCleanup.get(btn);
                  if (prevCleanup) prevCleanup();
                  let canvas = btn.querySelector('canvas') as HTMLCanvasElement;
                  if (!canvas) {
                    canvas = document.createElement('canvas');
                    canvas.className = 'pointer-events-none absolute left-0 right-0 z-0 w-full';
                    canvas.style.top = '-30px';
                    canvas.style.left = '-30px';
                    canvas.style.right = '-30px';
                    canvas.style.bottom = '-30px';
                    canvas.style.width = 'calc(100% + 60px)';
                    canvas.style.height = 'calc(100% + 60px)';
                    btn.appendChild(canvas);
                  }
                  const dpr = Math.min(window.devicePixelRatio || 1, 2);
                  const padW = btn.offsetWidth + 60;
                  const padH = btn.offsetHeight + 60;
                  canvas.width = padW * dpr;
                  canvas.height = padH * dpr;
                  const ctx2d = canvas.getContext('2d');
                  if (ctx2d) ctx2d.scale(dpr, dpr);
                  const cleanup = spawnButtonParticles(canvas);
                  if (cleanup) buttonParticleCleanup.set(btn, cleanup);
                }}
                onMouseLeave={(e) => {
                  const btn = e.currentTarget;
                  const cleanup = buttonParticleCleanup.get(btn);
                  if (cleanup) cleanup();
                  const canvas = btn.querySelector('canvas') as HTMLCanvasElement;
                  if (canvas) {
                    const ctx2d = canvas.getContext('2d');
                    if (ctx2d) ctx2d.clearRect(0, 0, canvas.width, canvas.height);
                  }
                }}
              >
                <span className="relative z-10">📅</span>
                <span className="relative z-10">{t("home.ctaBtn")}</span>
              </button>
            </div>
          </div>

          {/* GĐ3 — ĐÃ BỎ <ClosingCta /> (hạng mục 25.8).

              Lý do (quyết định của chủ dự án): banner xanh "BOOK A SERVICE"
              ngay phía trên đã làm đúng việc đó, có sẵn từ trước và đã ổn
              định. Để cả hai thì cuối trang có HAI khối CTA liền nhau cùng
              mục đích — nhìn như lặp, và mất độ tin cậy.

              Component `components/home/ClosingCta.tsx` và khoá i18n
              `closing.*` vẫn còn nguyên, chỉ không được render. Nếu sau này
              cần lại, gọi `<ClosingCta />` là xong — không phải viết lại. */}
        </section>

      </div>
    </div>
  );
}
