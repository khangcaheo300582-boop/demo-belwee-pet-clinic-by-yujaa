"use client";

import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "@/lib/motion";

/**
 * ParticleDNAField — trường hạt full-screen dính theo cuộn.
 *
 * "Hạt nguyên bản" — không glow, không bokeh, không tia sparkle:
 * - Mỗi hạt là một chấm tròn phẳng (màu trắng / xanh), chỉ có alpha.
 * - Vẫn bám viền ngoài viewport, trôi chậm dọc cạnh, rung nhẹ theo cuộn.
 * - Càng đi sâu vào trong càng thưa và mờ dần (falloff theo độ sâu).
 * - Chỉ xuất hiện khi cuộn tới mục "Hệ thống chăm sóc toàn diện" và giữ
 *   qua mục "Các chuyên gia thú y"; không lấn lên phần mờ phía trên (hero),
 *   và tự ẩn trước khi chạm thẻ "Kiến thức thú y".
 *
 * Vẫn giữ: trail mờ dần, scroll-warp stretch, pause tab ẩn / offscreen,
 * prefers-reduced-motion, DPR-aware, cleanup đầy đủ.
 */

const TAU = Math.PI * 2;

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Đọc vị trí top tuyệt đối của phần tử so với trang. */
function pageTop(el: HTMLElement | null): number {
  if (!el) return 0;
  const r = el.getBoundingClientRect();
  return r.top + window.scrollY;
}

/** Độ sâu tối đa tính từ viền (phần trăm của chiều nhỏ hơn viewport). */
const EDGE_DEPTH_MAX = 0.18;

/**
 * PERF: trần độ phân giải backing store (device px). Trường hạt chỉ là chấm mờ
 * + trail tan dần nên không cần raster ở đúng DPR màn hình — trên màn 2K/4K,
 * kẹp backing store về ~1.4–1.6MP cắt thẳng chi phí `fillRect` full-screen mỗi
 * frame (phép raster đắt nhất) mà mắt gần như không phân biệt được. Canvas được
 * CSS kéo giãn trở lại full màn hình.
 */
const MAX_RASTER_W = 1600;
const MAX_RASTER_H = 1000;

/**
 * PERF: chạy vòng hạt ~30fps thay vì 60fps. Đây là ambience trôi chậm, 30fps
 * không lộ khác biệt nhưng giảm một nửa số lần clear/vẽ → cuộn êm hơn, đồng
 * thời giảm một nửa tần suất backdrop-filter phía sau phải blur lại.
 */
const FRAME_INTERVAL_MS = 1000 / 30;

interface Particle {
  // Tọa độ chuẩn hóa 0-1 dọc theo cạnh đã chọn
  bx: number;
  by: number;
  // Cạnh phân bố: 0 = trái, 1 = phải, 2 = trên, 3 = dưới
  edge: 0 | 1 | 2 | 3;
  // Độ sâu tính từ viền (phần của min(width,height))
  depth: number;
  // Vị trí đang vẽ + vận tốc (spring về mục tiêu)
  x: number;
  y: number;
  vx: number;
  vy: number;
  // Vệt scroll-warp (độ dài vệt dọc hiện tại, px)
  stretch: number;
  // Trôi chậm dọc theo cạnh
  alongAmp: number; // phần của minDim
  alongFreq: number;
  alongPhase: number;
  // Rung nhẹ vuông góc với cạnh
  intoAmp: number;
  intoFreq: number;
  intoPhase: number;
  // Kích thước & alpha cơ bản
  size: number;
  baseAlpha: number;
  // PERF: giá trị không đổi theo thời gian — tính 1 lần lúc tạo hạt thay vì
  // Math.pow/`*1.6` cho từng hạt, từng frame.
  rr: number;
  edgeFalloff: number;
  // Màu: trắng / xanh
  white: boolean;
  // Twinkle alpha
  tw: number;
}

interface ParticleDNAFieldProps {
  blueColor?: string;
  whiteColor?: string;
  servicesSelector?: string;
  vetsSelector?: string;
  knowledgeSelector?: string;
  className?: string;
}

export default function ParticleDNAField({
  blueColor = "rgba(96,165,250,0.9)",
  whiteColor = "rgba(255,255,255,0.95)",
  servicesSelector = "#home-services",
  vetsSelector = "#home-vets",
  knowledgeSelector = "#vet-knowledge",
  className = "",
}: ParticleDNAFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (prefersReducedMotion()) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    document.documentElement.classList.add("has-particle-field");

    // ---------- Màu ----------
    const parseRgba = (s: string): number[] => {
      const m = s.match(/[\d.]+/g);
      if (!m || m.length < 3) return [255, 255, 255, 1];
      return [
        parseFloat(m[0]),
        parseFloat(m[1]),
        parseFloat(m[2]),
        m.length > 3 ? parseFloat(m[3]) : 1,
      ];
    };
    const BLUE = parseRgba(blueColor);
    const WHITE = parseRgba(whiteColor);
    const strokeCol = (col: number[]): string =>
      `rgba(${col[0] | 0},${col[1] | 0},${col[2] | 0},1)`;
    // PERF: cache chuỗi màu 1 lần — trước đây strokeCol() tạo chuỗi mới cho
    // TỪNG hạt, TỪNG frame (hàng chục nghìn string/giây → áp lực GC gây chớp
    // ngắn định kỳ). Vẽ màu bằng fillStyle constant + globalAlpha biến thiên.
    const BLUE_STR = strokeCol(BLUE);
    const WHITE_STR = strokeCol(WHITE);

    // ---------- Trạng thái ----------
    let width = 0;
    let height = 0;
    let particles: Particle[] = [];
    let raf: number | null = null;
    let running = false;
    let inView = true;
    let time = 0;
    let resizeTimer: number | null = null;
    let refreshTimer: number | null = null;
    let observer: IntersectionObserver | null = null;
    // Mỗi frame chạy 1 lần fillRect full-màn hình để làm mờ vệt (trail) — chi
    // phí raster đắt nhất. Giảm tần suất xuống 1/2 frame: vệt chỉ đậm hơn chút
    // nhưng giảm ~50% raster full-screen → cuộn mượt hơn hẳn (giữ nguyên hiệu ứng).
    let trailSkip = false;
    // PERF: timestamp frame vẽ gần nhất, dùng để throttle ~30fps + suy ra dt
    // thật (giữ nguyên tốc độ trôi/kéo vệt dù số frame giảm).
    let lastFrameTs = 0;

    // Scroll warp: vận tốc cuộn đã làm mượt
    let lastScroll = typeof window !== "undefined" ? window.scrollY : 0;
    let scrollVel = 0;

    // Điểm neo cuộn: services .. vets .. knowledge
    const anchors = { services: 0, vets: 0, vetsEnd: 0, knowledge: 0 };
    const readAnchors = () => {
      const svcs = document.querySelector<HTMLElement>(servicesSelector);
      const vets = document.querySelector<HTMLElement>(vetsSelector);
      const know = document.querySelector<HTMLElement>(knowledgeSelector);
      const vTop = pageTop(vets);
      const vetH = vets ? vets.offsetHeight : 0;
      anchors.services = pageTop(svcs);
      anchors.vets = vTop;
      anchors.vetsEnd = vTop + vetH;
      anchors.knowledge = pageTop(know);
    };

    /** Trọng số hiển thị của trường hạt tại độ cuộn `sy` (0..1, không dùng
     *  viewport state nên gọi được từ scroll listener khi loop đã dừng). */
    const globalFadeAt = (sy: number): number => {
      const sA = anchors.services;
      const vE = anchors.vetsEnd;
      const kA = anchors.knowledge;
      const wIn = clamp01((sy - (sA - height * 0.12)) / (height * 0.5));
      const fadeStart = vE - height * 0.2;
      const fadeSpan = Math.max(height * 0.5, (kA - vE) * 1.05);
      const wOut = clamp01((sy - fadeStart) / fadeSpan);
      return clamp01(wIn * (1 - wOut));
    };

    // ---------- Tạo hạt ----------
    const pickEdge = (): 0 | 1 | 2 | 3 => {
      const r = Math.random();
      if (r < 0.34) return 0; // trái
      if (r < 0.68) return 1; // phải
      if (r < 0.84) return 2; // trên
      return 3; // dưới
    };

    const makeParticle = (): Particle => {
      const edge = pickEdge();
      // Độ sâu tập trung sát viền: pow > 1 làm đa số hạt bám cạnh ngoài,
      // càng vào trong càng thưa (kết hợp alpha falloff bên dưới).
      const depthFrac = Math.pow(Math.random(), 1.7);
      const depth = depthFrac * EDGE_DEPTH_MAX;
      const size = 0.9 + (1 - depthFrac) * 1.6;
      return {
        bx: Math.random(),
        by: Math.random(),
        edge,
        depth,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        stretch: 0,
        alongAmp: 0.008 + Math.random() * 0.035,
        alongFreq: 0.25 + Math.random() * 0.7,
        alongPhase: Math.random() * TAU,
        intoAmp: 0.003 + Math.random() * 0.009,
        intoFreq: 0.5 + Math.random() * 1.0,
        intoPhase: Math.random() * TAU,
        size,
        baseAlpha: 0.3 + (1 - depthFrac) * 0.6,
        rr: size * 1.6,
        edgeFalloff: Math.pow(1 - depthFrac, 1.15),
        white: Math.random() < 0.3,
        tw: Math.random() * TAU,
      };
    };

    const createParticles = () => {
      const isMobile = width < 768;
      // Tăng cường tối ưu cho mobile: giảm mạnh số hạt để cải thiện FPS
      const maxCount = isMobile ? 60 : 320;
      const density = isMobile ? 0.06 : 0.13;
      const count = Math.min(Math.floor((width + height) * density), maxCount);
      particles = Array.from({ length: count }, () => {
        const p = makeParticle();
        p.x = p.bx * width;
        p.y = p.by * height;
        return p;
      });
    };

    // ---------- Vòng lặp ----------
    const draw = (ts = 0) => {
      // ---- Throttle ~30fps ----
      // Vẫn giữ rAF sống để tiếp tục nhận timestamp, nhưng bỏ qua frame chưa
      // đủ nhịp → nửa chi phí raster/giây. dt suy từ timestamp thật nên hạt
      // vẫn trôi đúng tốc độ. Ngưỡng 0.85×33.3ms (~28ms) để trên màn 60Hz vừa
      // khớp "cách 2 frame" (đúng 30fps) chứ không rơi xuống 20fps.
      const elapsed = ts - lastFrameTs;
      if (elapsed < FRAME_INTERVAL_MS * 0.85) {
        raf = requestAnimationFrame(draw);
        return;
      }
      const dt = lastFrameTs === 0 ? 1 / 30 : Math.min(0.05, elapsed / 1000);
      lastFrameTs = ts;
      time += dt;

      // --- Scroll velocity (làm mượt) ---
      // Chuẩn hoá về "px mỗi khung 60fps" bằng dt thật để trọng số làm mượt và
      // độ lớn warp giữ nguyên như khi chạy 60fps (không phóng đại vệt khi 30fps).
      const sy0 = window.scrollY;
      const rawVel = (sy0 - lastScroll) * ((1 / 60) / dt);
      lastScroll = sy0;
      scrollVel = scrollVel * 0.82 + rawVel * 0.18;
      const warp = Math.max(-60, Math.min(60, scrollVel * 0.55)); // px stretch

      const sy = sy0;
      const globalFade = globalFadeAt(sy);

      // ---- Dừng vòng lặp khi trường hạt hoàn toàn ẩn ----
      // Canvas là fixed inset-0 nên IntersectionObserver trên canvas luôn báo
      // "trong viewport" — không bao giờ giúp dừng loop. Trước đây loop chạy
      // 60fps + fillRect full-screen xoá trail NGAY CẢ khi không còn hạt nào
      // khả kiến (khu vực hero / sau mục kiến thức) → nguồn giật khi cuộn.
      // Giờ: ẩn hẳn → huỷ rAF + xoá canvas + tắt content-visibility để trình
      // duyệt không giữ layer GPU cho phần tử này; scroll listener khởi động
      // lại khi cuộn ngược vào vùng hoạt động (services → vets → knowledge).
      if (globalFade <= 0.005) {
        if (raf !== null) cancelAnimationFrame(raf);
        raf = null;
        running = false;
        lastFrameTs = 0;
        canvas.style.contentVisibility = "auto";
        ctx.globalCompositeOperation = "source-over";
        ctx.clearRect(0, 0, width, height);
        return;
      }
      canvas.style.contentVisibility = "visible";

      // --- Trail: giảm alpha dần thay vì xóa sạch (canvas trong suốt nên
      // CHỈ dùng destination-out — fill màu thường sẽ tạo màn đen che trang) ---
      // Fill full-screen là phép raster đắt nhất; chạy 1 lần mỗi 2 frame.
      trailSkip = !trailSkip;
      if (!trailSkip) {
        // 30fps → trailSkip còn ~15 lần xoá/s (trước ~30). Tăng nhẹ alpha để
        // vệt tan với tốc độ tương đương, tránh vệt dài bất thường.
        const trailAlpha = 0.4 + Math.abs(scrollVel) * 0.0016;
        ctx.globalCompositeOperation = "destination-out";
        ctx.fillStyle = `rgba(0,0,0,${Math.min(0.6, trailAlpha)})`;
        ctx.fillRect(0, 0, width, height);
      } else {
        ctx.globalCompositeOperation = "destination-out";
      }
      ctx.globalCompositeOperation = "lighter";

      const minDim = Math.min(width, height);
      for (const p of particles) {
        let tx: number;
        let ty: number;

        // Độ sâu (px) + trôi chậm dọc cạnh + rung nhẹ vuông góc cạnh
        const inset = p.depth * minDim;
        const driftA = Math.sin(time * p.alongFreq + p.alongPhase) * p.alongAmp * minDim;
        const driftI = Math.sin(time * p.intoFreq + p.intoPhase) * p.intoAmp * minDim;

        // ---- Bám viền ngoài màn hình ----
        if (p.edge === 0) {
          tx = inset + driftI;
          ty = p.by * height + driftA;
        } else if (p.edge === 1) {
          tx = width - inset + driftI;
          ty = p.by * height + driftA;
        } else if (p.edge === 2) {
          tx = p.bx * width + driftA;
          ty = inset + driftI;
        } else {
          tx = p.bx * width + driftA;
          ty = height - inset + driftI;
        }

        tx += Math.sin(time * 0.4 + p.alongPhase) * 4;
        ty += Math.cos(time * 0.35 + p.intoPhase) * 4;

        // ---- Spring ----
        const k = 0.02;
        const damp = 0.86;
        p.vx += (tx - p.x) * k;
        p.vy += (ty - p.y) * k;

        p.vx *= damp;
        p.vy *= damp;
        p.x += p.vx;
        p.y += p.vy;

        // ---- Scroll warp stretch ----
        const targetStretch = clamp01(Math.abs(warp) / 40) * 26;
        p.stretch += (targetStretch - p.stretch) * 0.15;

        // ---- Alpha: mờ dần khi càng vô trong, nhân với trạng thái cuộn ----
        const twinkle = 0.8 + 0.2 * Math.sin(time * 2 + p.tw);
        const alpha = Math.min(
          1,
          p.baseAlpha * p.edgeFalloff * twinkle * globalFade
        );
        if (alpha <= 0.015) {
          continue;
        }

        const rr = p.rr;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.white ? WHITE_STR : BLUE_STR;

        if (p.stretch > 2) {
          // Vệt dọc khi cuộn nhanh
          const ry = rr * (1 + p.stretch * 0.06);
          ctx.beginPath();
          ctx.ellipse(p.x, p.y + warp * 0.4, rr + 0.4, ry, 0, 0, TAU);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, rr, 0, TAU);
          ctx.fill();
        }
      }

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      raf = requestAnimationFrame(draw);
    };

    const start = () => {
      if (running || !inView || document.hidden) return;
      running = true;
      lastFrameTs = 0;
      // Đồng bộ mốc cuộn khi vòng lặp "thức dậy" — tránh frame đầu tính ra vận
      // tốc khổng lồ tích tụ từ lúc loop dừng → vệt kéo dài đột ngột.
      lastScroll = window.scrollY;
      scrollVel = 0;
      raf = requestAnimationFrame(draw);
    };
    const stop = () => {
      running = false;
      lastFrameTs = 0;
      if (raf !== null) {
        cancelAnimationFrame(raf);
        raf = null;
      }
      ctx.clearRect(0, 0, width, height);
    };

    // Khởi động lại loop khi cuộn vào vùng hiển thị (chỉ lúc loop đã dừng).
    // Đây là listener duy nhất chịu trách nhiệm "wake up" — rẻ (vài phép toán)
    // và passive nên không gây cản trở cuộn.
    const tryRestart = () => {
      if (running || !inView || document.hidden) return;
      if (globalFadeAt(window.scrollY) > 0.008) {
        readAnchors();
        start();
      }
    };

    // ---------- Resize ----------
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const oldW = width;
      const oldH = height;
      width = rect.width;
      height = rect.height;
      // PERF: DPR cap 1.5 rồi kẹp thêm trần backing store (MAX_RASTER_W/H).
      // Trên màn 2K/4K, trần này quan trọng hơn DPR — backing store giữ ~1.4MP
      // thay vì 3–8MP, tức `fillRect` trail full-screen rẻ đi 2–5 lần. Hạt vốn
      // mờ + CSS kéo giãn nên không lộ.
      const isMobile = width < 768;
      const dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.2 : 1.5);
      const rawW = width * dpr;
      const rawH = height * dpr;
      const cap = Math.min(1, MAX_RASTER_W / rawW, MAX_RASTER_H / rawH);
      const scaleX = (rawW * cap) / width;
      const scaleY = (rawH * cap) / height;
      canvas.width = Math.max(1, Math.round(rawW * cap));
      canvas.height = Math.max(1, Math.round(rawH * cap));
      ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);
      if (particles.length === 0) {
        createParticles();
      } else if (oldW > 0 && oldH > 0) {
        for (const p of particles) {
          p.x = (p.x / oldW) * width;
          p.y = (p.y / oldH) * height;
        }
      }
      readAnchors();
      if (refreshTimer !== null) clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(readAnchors, 600);
    };

    const onResize = () => {
      if (resizeTimer !== null) clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        resize();
        // Sau khi resize (vd xoay màn hình), nếu đang nằm trong vùng hoạt động
        // mà loop đã dừng thì khởi động lại ngay.
        tryRestart();
      }, 180);
    };

    // ---------- Khởi tạo ----------
    resize();

    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", tryRestart, { passive: true });
    const onVisibility = () => {
      if (document.hidden) stop();
      else start();
    };
    document.addEventListener("visibilitychange", onVisibility);

    if (typeof IntersectionObserver !== "undefined") {
      observer = new IntersectionObserver(
        (entries) => {
          inView = entries[0]?.isIntersecting ?? false;
          if (inView) start();
          else stop();
        },
        { threshold: 0 }
      );
      observer.observe(canvas);
    } else {
      inView = true;
    }

    start();

    return () => {
      stop();
      observer?.disconnect();
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", tryRestart);
      document.removeEventListener("visibilitychange", onVisibility);
      if (resizeTimer !== null) clearTimeout(resizeTimer);
      if (refreshTimer !== null) clearTimeout(refreshTimer);
      document.documentElement.classList.remove("has-particle-field");
    };
  }, [blueColor, whiteColor, servicesSelector, vetsSelector, knowledgeSelector]);

  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none ${className}`}
      style={{ display: "block", width: "100%", height: "100%" }}
      aria-hidden="true"
    />
  );
}