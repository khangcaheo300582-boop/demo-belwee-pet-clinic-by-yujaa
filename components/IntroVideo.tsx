"use client";

/**
 * IntroVideo — Trình tự mở đầu Belwee, chạy mỗi lần tải lại trang.
 *
 * TRÌNH TỰ BẮT BUỘC (mặc định hiện tại):
 *   VIDEO → APP
 *
 * Trước đây là VIDEO → WELCOME → LANGUAGE → APP; nay theo yêu cầu, khi video
 * intro kết thúc thì NGAY LẬP TỨC mở màn hình chính (và toàn bộ hiệu ứng nội
 * dung — hero, reveal, video nền — chạy ngay phía sau lớp mờ đang tan). Màn
 * chào + chọn ngôn ngữ vẫn giữ nguyên trong code, chỉ bị bỏ qua nhờ flag:
 *   - AUTO_ENTER_APP_AFTER_VIDEO = true  → VIDEO → APP (chọn ngôn ngữ trước
 *     đây do thẻ ngôn ngữ đặt, nay dùng ngôn ngữ đã lưu/nền tảng của trình
 *     duyệt; người dùng vẫn đổi được qua nút ngôn ngữ trên navbar).
 *   - AUTO_ENTER_APP_AFTER_VIDEO = false → trở lại chuỗi VIDEO → WELCOME →
 *     LANGUAGE → APP cũ.
 *
 * Quy tắc:
 *  - Chỉ sự kiện "ended" của video mới kết thúc intro. Không dùng setTimeout
 *    để thay thế sự kiện ended.
 *  - Nếu autoplay bị chặn → hiển thị nút "Phát video", người dùng PHẢI bấm.
 *  - Nếu video lỗi → thử tải lại một lần, nếu vẫn lỗi → hiện nút phát.
 *  - Người dùng đã có ngôn ngữ vẫn phải xem video intro.
 */

import React, { useRef, useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { prefersReducedMotion } from "@/lib/motion";
import { INTRO_FADE_MS, setIntroPhase } from "@/lib/introGate";
import { INTRO_VIDEOS } from "@/lib/introPreload";
import { acquireInertLock, releaseInertLock } from "@/lib/pageInert";
import {
  getInitialLanguage,
  getStoredLanguage,
  LANG_KEY,
  translate,
  type Language,
  type MessageKey,
} from "@/lib/i18n";

// ─── CẤU HÌNH ────────────────────────────────────────────────
/** Danh sách video nằm ở lib/introPreload.ts — cùng nguồn với script nạp trước. */

/** Khi false (mặc định): luôn chạy đầy đủ intro để kiểm tra. */
const SKIP_INTRO_FOR_RETURNING_USERS = false;

/**
 * Khi true (mặc định hiện tại): video intro kết thúc → mở NGAY màn hình chính.
 * Màn chào + thẻ chọn ngôn ngữ bị bỏ qua (vẫn giữ code, chỉ không được gọi).
 * Set false để khôi phục chuỗi VIDEO → WELCOME → LANGUAGE → APP.
 */
const AUTO_ENTER_APP_AFTER_VIDEO = true;

const WELCOME_HOLD_MS = 2200;
const WELCOME_HOLD_REDUCED_MS = 1200;
/** Dùng chung với CSS + timeline hero — xem INTRO_FADE_MS trong lib/introGate.ts. */
const CROSSFADE_MS = INTRO_FADE_MS;

/**
 * Các mốc failsafe phía JS. Video intro dài ~8.3s + 0.7s fade nên đường bình
 * thường luôn kết thúc trước các mốc này rất xa.
 *
 * - `INITIAL`: trang vừa boot, chưa rõ autoplay có chạy hay không.
 * - `BLOCKED`: autoplay bị chặn, đang chờ người dùng bấm nút phát.
 * - `PLAYING`: video đã thật sự chạy; nếu treo giữa chừng vẫn có đường thoát.
 *
 * Failsafe CSS 15s (cho no-JS) được đẩy lùi bằng class `intro-video-js` và
 * tắt hẳn khi `intro-video-playing` — xem app/globals.css.
 */
const FAILSAFE_INITIAL_MS = 30000;
const FAILSAFE_BLOCKED_MS = 60000;
const FAILSAFE_PLAYING_MS = 90000;

/**
 * Tên khoá `inert` của video intro trong sổ đăng ký (lib/pageInert.ts).
 *
 * Khoá này giữ TOÀN BỘ `.app-shell` bị khoá (navbar + main + footer) vì
 * overlay intro chiếm trọn màn hình. Nhả đúng tên này ở mọi đường thoát
 * (kết thúc bình thường, failsafe, unmount) để trang không bị kẹt.
 */
const INTRO_LOCK_ID = "home-intro-video";

// ─── COMPONENT ────────────────────────────────────────────────
export default function IntroVideo() {
  // Trạng thái chính — chỉ tiến lên, không quay lại.
  const [phase, setPhase] = useState<"video" | "welcome" | "language" | "done">("video");

  // Video — gán src 1 lần ở client-side (server không render src video)
  const [videoSrc, setVideoSrc] = useState<string>("");
  const [videoFading, setVideoFading] = useState(false);
  const [videoGone, setVideoGone] = useState(false);

  // Trạng thái phát — quyết định failsafe nào đang có hiệu lực và có hiện nút
  // "Phát video" hay không.
  const [jsReady, setJsReady] = useState(false);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  // Welcome content
  const [contentVisible, setContentVisible] = useState(false);
  const [welcomeFading, setWelcomeFading] = useState(false);

  // Language card
  const [cardVisible, setCardVisible] = useState(false);
  const [cardLeaving, setCardLeaving] = useState(false);
  const [selectedLang, setSelectedLang] = useState<Language | null>(null);
  const [displayLang, setDisplayLang] = useState<Language>("en");

  // Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoScreenRef = useRef<HTMLDivElement | null>(null);
  const phaseRef = useRef(phase);
  const fallbackTriedRef = useRef(false);
  const unmountedRef = useRef(false);
  const timersRef = useRef<number[]>([]);
  const reducedMotionRef = useRef(false);
  const failsafeRef = useRef<number | null>(null);
  // Tránh gọi showBlocked nhiều lần (mỗi lần lại gia hạn failsafe).
  const autoplayBlockedRef = useRef(false);

  // ─── Helpers ───────────────────────────────────────────────
  const later = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timersRef.current.push(id);
  }, []);

  /**
   * Mở khoá trang — đường thoát DUY NHẤT, dùng cho cả lúc bình thường lẫn
   * failsafe. Luôn gỡ `inert`/`aria-hidden`/khoá cuộn của body, đẩy introGate
   * sang "done" rồi gỡ overlay. Tách riêng để không đường nào có thể bỏ sót
   * việc gỡ `inert` (xem FAILSAFE_MS bên dưới).
   *
   * Chỉ nhả khoá CỦA INTRO (xem lib/pageInert.ts) — không đụng tới khoá `inert`
   * của menu hamburger nếu nó đang mở.
   */
  const unlockPage = useCallback(() => {
    releaseInertLock(INTRO_LOCK_ID);
    document.body.classList.remove("intro-playing");
    setIntroPhase("done");
    if (!unmountedRef.current) setPhase("done");
  }, []);

  /**
   * Đặt lại đồng hồ failsafe theo trạng thái phát hiện tại. Luôn thay timer cũ
   * thay vì cộng dồn — nếu không, một lần autoplay bị chặn rồi người dùng bấm
   * phát sẽ vẫn bị timer 60s cũ mở khoá ngang.
   */
  const armFailsafe = useCallback(
    (ms: number) => {
      if (failsafeRef.current !== null) {
        window.clearTimeout(failsafeRef.current);
        failsafeRef.current = null;
      }
      failsafeRef.current = window.setTimeout(() => {
        // Đường cưỡng chế: gỡ overlay ngay, không chờ fade, để không ăn mất
        // click của người dùng thêm một giây nào nữa.
        setVideoGone(true);
        unlockPage();
      }, ms);
    },
    [unlockPage]
  );

  /** Autoplay bị chặn (hoặc cả hai video lỗi) → hiện nút phát thật. */
  const showBlocked = useCallback(() => {
    if (unmountedRef.current || phaseRef.current !== "video") return;
    if (autoplayBlockedRef.current) return;
    autoplayBlockedRef.current = true;
    setVideoPlaying(false);
    setAutoplayBlocked(true);
    armFailsafe(FAILSAFE_BLOCKED_MS);
  }, [armFailsafe]);

  /** Video thật sự vào trạng thái phát → gỡ nút phát và đổi failsafe. */
  const handleVideoPlaying = useCallback(() => {
    if (unmountedRef.current) return;
    autoplayBlockedRef.current = false;
    setAutoplayBlocked(false);
    setVideoPlaying(true);
    armFailsafe(FAILSAFE_PLAYING_MS);
  }, [armFailsafe]);

  // ─── Lifecycle ─────────────────────────────────────────────
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    // PHẢI reset trước mọi thứ. `reactStrictMode: true` (next.config.mjs) khiến
    // React 18 chạy effect 2 lần ở dev: mount → cleanup → mount. Cleanup set
    // `unmountedRef.current = true`, và nếu mount thứ hai không reset lại thì
    // cờ này dính true vĩnh viễn → mọi callback kết thúc intro (goToWelcome /
    // enterAppDirectly / finish) đều bail ở dòng đầu → intro không bao giờ kết
    // thúc → `inert` kẹt trên wrapper (navbar + main + footer) → toàn bộ trang
    // chết với chuột, trong khi overlay đã bị failsafe CSS ẩn đi nên nhìn vẫn
    // thấy trang bình thường.
    unmountedRef.current = false;
    reducedMotionRef.current = prefersReducedMotion();

    document.body.classList.add("intro-playing");
    setIntroPhase("playing");
    setDisplayLang(getInitialLanguage());

    // A11Y: trong lúc intro che toàn màn, nội dung thật vẫn nằm phía sau →
    // khoá `inert` + aria-hidden cho wrapper trang (navbar/main/footer) để
    // bàn phím và screen reader không "đi lạc" vào nội dung vô hình. Gỡ đúng
    // lúc component intro rời khỏi DOM.
    //
    // Dùng sổ đăng ký khoá (lib/pageInert.ts) thay vì ghi thuộc tính trực
    // tiếp: nhờ vậy việc effect mount của navbar (chạy sau) không xoá nhầm
    // khoá của intro, và ngược lại khoá của intro không làm chết thẻ menu.
    acquireInertLock(INTRO_LOCK_ID, "shell");

    // Failsafe cuối: overlay intro có failsafe CSS tự tan sau 15s khi KHÔNG có
    // JS, nhưng `inert` là JS nên không có failsafe nào gỡ được. Chỉ cần sự
    // kiện `ended` bị bỏ lỡ (mạng lag, autoplay bị chặn, video lỗi, hydration
    // trễ) là trang hiện ra mà không bấm được gì — đúng triệu chứng "bấm không
    // ăn". Mốc 30s là lúc chưa biết autoplay có chạy; khi video phát thật hoặc
    // bị chặn, `armFailsafe` sẽ đổi sang mốc dài hơn.
    setJsReady(true);
    armFailsafe(FAILSAFE_INITIAL_MS);

    const timers = timersRef.current;
    return () => {
      unmountedRef.current = true;
      if (failsafeRef.current !== null) {
        window.clearTimeout(failsafeRef.current);
        failsafeRef.current = null;
      }
      timers.forEach((id) => clearTimeout(id));
      releaseInertLock(INTRO_LOCK_ID);
      document.body.classList.remove("intro-playing");
      setIntroPhase("done");
    };
  }, [armFailsafe, unlockPage]);

  // ─── Gán src video 1 lần ở client-side (tránh hydration mismatch) ───
  useEffect(() => {
    // Intro logo cố định: LUÔN phát /belwee-logo-intro-a.mp4 (không random).
    // Script trong <head> (lib/introPreload.ts) cũng nạp trước đúng file này
    // ⇒ dùng đúng file đang bay về, không tải thêm video thứ hai.
    setVideoSrc(INTRO_VIDEOS[0]);
    // Reset fallback flag khi video được gán src
    fallbackTriedRef.current = false;
  }, []);

  // ─── Kết thúc intro ────────────────────────────────────────
  const finish = useCallback(() => {
    if (unmountedRef.current) return;
    document.body.classList.remove("intro-playing");
    setCardLeaving(true);
    setIntroPhase("fading");
    later(() => {
      if (unmountedRef.current) return;
      unlockPage();
    }, 350);
  }, [later, unlockPage]);

  // ─── VIDEO → APP (mặc định): video kết thúc, mở ngay màn hình chính ───
  // Gọi đúng lúc video "ended". Tan lớp video nhanh; đồng thời đẩy introGate
  // sang "fading" → usePageReady() bật ngay → toàn bộ hiệu ứng nội dung trang
  // chính (hero, reveal, video nền...) chạy song song với việc lớp này tan.
  const enterAppDirectly = useCallback(() => {
    if (unmountedRef.current || phaseRef.current !== "video") return;

    document.body.classList.remove("intro-playing");
    setVideoFading(true);
    setIntroPhase("fading");

    // PERF/UX: gỡ overlay ĐÚNG LÚC fade CSS kết thúc (lắng nghe transitionend
    // trên chính overlay). Trước đây dùng setTimeout 300ms cứng trong khi CSS
    // tan 700ms → overlay biến mất đột ngột giữa chừng fade (opacity còn
    // ~0.55) gây nhấp nháy rõ ràng ngay trước khi lộ video nền.
    // Failsafe phòng trường hợp transitionend không bao giờ fire (tab bị ẩn,
    // element bị display:none...). Mốc = fade + 200ms đệm.
    const overlay = videoScreenRef.current;
    let finished = false;
    const complete = () => {
      if (finished) return;
      finished = true;
      overlay?.removeEventListener("transitionend", onFadeEnd);
      // Nhả will-change ngay khi fade xong, trước khi gỡ khỏi DOM.
      overlay?.classList.add("is-gone");
      unlockPage();
    };
    const onFadeEnd = (e: TransitionEvent) => {
      // Chỉ nhận transition opacity của chính overlay, bỏ qua event bubble
      // từ element con (video, glow...).
      if (e.target !== overlay || e.propertyName !== "opacity") return;
      complete();
    };
    overlay?.addEventListener("transitionend", onFadeEnd);
    later(complete, CROSSFADE_MS + 200);
  }, [later, unlockPage]);

  // ─── VIDEO → WELCOME (chỉ gọi từ sự kiện "ended") ─────────
  const goToWelcome = useCallback(() => {
    if (unmountedRef.current || phaseRef.current !== "video") return;

    // Chế độ mặc định: bỏ qua màn chào + chọn ngôn ngữ, mở thẳng màn hình chính.
    if (AUTO_ENTER_APP_AFTER_VIDEO) {
      enterAppDirectly();
      return;
    }

    setPhase("welcome");
    setVideoFading(true);

    // Gỡ video khỏi DOM sau khi crossfade xong
    later(() => {
      if (!unmountedRef.current) setVideoGone(true);
    }, CROSSFADE_MS);

    // Fade in content layer
    requestAnimationFrame(() => {
      if (!unmountedRef.current) setContentVisible(true);
    });

    // Giữ welcome rồi chuyển sang language
    const holdMs = reducedMotionRef.current
      ? WELCOME_HOLD_REDUCED_MS
      : WELCOME_HOLD_MS;

    later(() => {
      if (unmountedRef.current || phaseRef.current !== "welcome") return;
      setWelcomeFading(true);

      later(() => {
        if (unmountedRef.current) return;
        if (SKIP_INTRO_FOR_RETURNING_USERS && getStoredLanguage()) {
          finish();
        } else {
          setPhase("language");
          later(() => {
            if (!unmountedRef.current) setCardVisible(true);
          }, 60);
        }
      }, CROSSFADE_MS);
    }, holdMs);
  }, [later, finish, enterAppDirectly]);

// ─── Kết thúc intro ────────────────────────────────────────
  // (định nghĩa ở trên, trước `goToWelcome` để tránh TDZ)

  // ─── Event handlers ────────────────────────────────────────
  const handleVideoEnded = useCallback(() => {
    goToWelcome();
  }, [goToWelcome]);

  const handleVideoError = useCallback(() => {
    if (unmountedRef.current || phaseRef.current !== "video") return;
    if (!fallbackTriedRef.current) {
      fallbackTriedRef.current = true;
      // Chỉ có MỘT video intro cố định ⇒ thử tải lại chính nó một lần.
      videoRef.current?.load();
      return;
    }
    // Video vẫn lỗi sau khi tải lại → không còn nguồn nào để "xem hết". Hiện
    // nút phát để người dùng thử lại; failsafe 60s vẫn bảo đảm trang không kẹt.
    showBlocked();
  }, [showBlocked]);

  const handleContinue = useCallback(() => {
    if (!selectedLang || cardLeaving) return;
    window.localStorage.setItem(LANG_KEY, selectedLang);
    finish();
  }, [selectedLang, cardLeaving, finish]);

  /**
   * Nút phát dự phòng. Giữ trạng thái "blocked" cho tới khi sự kiện `playing`
   * bắn ra — nếu gỡ nút ngay lúc bấm mà video vẫn bị chặn thì người dùng sẽ
   * nhìn vào màn hình đen mà không biết bấm lại vào đâu.
   */
  const handlePlayRequest = useCallback(() => {
    const el = videoRef.current;
    if (!el || unmountedRef.current || phaseRef.current !== "video") return;
    if (el.error) el.load();
    void el.play().catch(() => showBlocked());
  }, [showBlocked]);

  /**
   * Phát hiện autoplay bị chặn. `autoPlay` không trả lỗi cho ai; cách duy nhất
   * để biết là gọi `play()` và bắt `NotAllowedError`. Chờ 700ms để trình duyệt
   * kịp khởi động autoplay tự nhiên trước, tránh báo chặn nhầm.
   */
  useEffect(() => {
    if (!videoSrc) return;
    const el = videoRef.current;
    if (!el || phaseRef.current !== "video") return;

    let alive = true;
    const attempt = () => {
      if (!alive || unmountedRef.current) return;
      if (phaseRef.current !== "video" || el.ended || !el.paused) return;
      void el.play().catch((error: unknown) => {
        const name = (error as { name?: string } | null)?.name;
        if (name === "NotAllowedError" || name === "SecurityError") {
          showBlocked();
        }
      });
    };

    const timer = window.setTimeout(attempt, 700);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [videoSrc, showBlocked]);

  // ─── Keyboard cho language options ──────────────────────────
  const handleOptionKeyDown = useCallback(
    (e: React.KeyboardEvent, self: HTMLButtonElement) => {
      const siblings = Array.from(
        self.parentElement?.querySelectorAll<HTMLButtonElement>(
          '[role="radio"]'
        ) ?? []
      );
      const idx = siblings.indexOf(self);
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        siblings[(idx + 1) % siblings.length]?.focus();
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        siblings[(idx - 1 + siblings.length) % siblings.length]?.focus();
      }
    },
    []
  );

  // ─── RENDER ────────────────────────────────────────────────
  if (phase === "done") return null;

  const tIntro = (key: MessageKey) => translate(displayLang, key);
  const showContent = phase === "welcome" || phase === "language";

  return (
    <>
      {/* ═══════ MÀN HÌNH VIDEO ═══════ */}
      {!videoGone && (
        <div
          ref={videoScreenRef}
          className={`intro-video-screen ${videoFading ? "is-hidden" : ""} ${
            jsReady ? "intro-video-js" : ""
          } ${autoplayBlocked ? "intro-autoplay-blocked" : ""} ${
            videoPlaying ? "intro-video-playing" : ""
          }`}
        >
          {/* CHỈ render <video> khi ĐÃ có src.
              `videoSrc` khởi tạo là "" và được gán ở effect (ở client, tránh
              hydration mismatch). Nếu render <video src="">
              ngay từ đầu, trình duyệt coi "" là URL của trang hiện tại ⇒
              MEDIA_ERR_SRC_NOT_SUPPORTED ⇒ `onError` bắn ra NGAY LẬP TỨC ⇒
              dùng mất lần fallback một-shot ⇒ mất ~3s trước khi video thật
              bắt đầu chạy (đo được: lỗi ở giây 1, video chỉ chạy từ giây 4).

              Render sau khi có src thì `<video>` được mount MỘT LẦN với src
              đúng ⇒ `autoPlay` chạy ngay, không có lỗi giả nào. */}
          {videoSrc && (
            <video
              ref={(node) => {
                videoRef.current = node;
                if (node) {
                  node.muted = true;
                  // File đã được <link rel="preload"> trong <head> kéo về; ưu
                  // tiên cao để nó không bị xếp sau ảnh/hero video.
                  node.setAttribute("fetchpriority", "high");
                }
              }}
              key={videoSrc}
              id="intro-video"
              src={videoSrc}
              autoPlay
              muted
              playsInline
              preload="auto"
              onEnded={handleVideoEnded}
              onError={handleVideoError}
              onPlaying={handleVideoPlaying}
              className="intro-video"
              aria-hidden="true"
            />
          )}

          {/* Lớp chờ: trong lúc video còn buffer (hoặc chưa hydrate xong) màn
              intro trước đây là một khối đen trơn. Ảnh logo + vòng sáng giúp
              khoảng chờ có chủ đích thay vì tưởng trang bị treo. Lớp này phủ
              TRÊN video và tự tan khi `onPlaying` bắn ra; nếu autoplay bị chặn
              thì nút phát thật (z-index cao hơn) vẫn nằm trên cùng. */}
          <div
            className={`intro-video-preroll ${videoPlaying ? "is-done" : ""}`}
            aria-hidden="true"
          >
            <span className="intro-preroll-halo" />
            <Image
              src="/logo-belwee.png"
              alt=""
              width={96}
              height={32}
              priority
              className="intro-preroll-logo"
            />
            <span className="intro-preroll-bar" />
          </div>

          {/* Autoplay bị chặn (hoặc cả hai nguồn lỗi) → nút phát thật, dùng
              đúng bộ style `.intro-play-btn` đã có sẵn trong globals.css. */}
          {autoplayBlocked && (
            <button
              type="button"
              className="intro-play-btn"
              onClick={handlePlayRequest}
              aria-label={tIntro("intro.playAria")}
            >
              <span className="intro-play-btn-inner" aria-hidden="true">
                <svg
                  className="h-8 w-8 text-white"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M8 5.14v13.72a1 1 0 0 0 1.54.84l10.3-6.86a1 1 0 0 0 0-1.68L9.54 4.3A1 1 0 0 0 8 5.14Z" />
                </svg>
              </span>
              <span className="intro-play-btn-label">
                {tIntro("intro.playAria")}
              </span>
            </button>
          )}

          <div className="intro-video-glow" aria-hidden="true" />
        </div>
      )}

      {/* ═══════ MÀN CHÀO + CHỌN NGÔN NGỮ (nền chung) ═══════ */}
      {showContent && (
        <div
          className={`welcome-screen ${contentVisible ? "is-visible" : ""}`}
        >
          {/* Quả cầu ambient */}
          <div className="glass-orb glass-orb-1" aria-hidden="true" />
          <div className="glass-orb glass-orb-2" aria-hidden="true" />

          {/* ── Welcome text ── */}
          {!cardVisible && (
            <div
              className={`welcome-content ${welcomeFading ? "is-fading" : ""}`}
            >
              <span className="welcome-dot" aria-hidden="true" />
              <h1 className="welcome-brand">Belwee</h1>
              <p className="welcome-title">{tIntro("intro.hello")}</p>
              <p className="welcome-description">
                {tIntro("intro.welcome")}
              </p>
            </div>
          )}

          {/* ── Card chọn ngôn ngữ ── */}
          {phase === "language" && (
            <div
              className={`intro-lang-card-wrap ${
                cardVisible && !cardLeaving ? "is-visible" : ""
              } ${cardLeaving ? "is-leaving" : ""}`}
            >
              <div className="intro-glass-card" role="dialog" aria-label={tIntro("langCard.title")}>
                <span className="intro-glass-sheen" aria-hidden="true" />

                <h2 className="intro-lang-title">
                  {tIntro("langCard.title")}
                </h2>
                <p className="intro-lang-desc">
                  {tIntro("langCard.description")}
                </p>

                <div
                  className="intro-lang-options"
                  role="radiogroup"
                  aria-label={tIntro("langCard.title")}
                >
                  {(["en", "vi"] as Language[]).map((code, idx) => {
                    const active = selectedLang === code;
                    const label = translate(
                      displayLang,
                      code === "en" ? "langCard.en" : "langCard.vi"
                    );
                    return (
                      <button
                        key={code}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setSelectedLang(code)}
                        onKeyDown={(e) =>
                          handleOptionKeyDown(e, e.currentTarget)
                        }
                        style={{ ["--intro-opt-i"]: idx } as React.CSSProperties}
                        className={`intro-lang-option ${
                          active ? "is-selected" : ""
                        }`}
                      >
                        <span
                          className={`intro-lang-check ${
                            active ? "is-checked" : ""
                          }`}
                          aria-hidden="true"
                        >
                          {active && (
                            <svg
                              className="h-3 w-3 text-slate-900"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={4}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </span>
                        <span className="intro-lang-label">{label}</span>
                        <span className="intro-lang-code">
                          {code.toUpperCase()}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  disabled={!selectedLang}
                  onClick={handleContinue}
                  className={`intro-lang-continue ${
                    selectedLang ? "is-ready" : "is-disabled"
                  }`}
                >
                  {tIntro("langCard.continue")}
                </button>

                <p className="intro-lang-hint">
                  {tIntro("langCard.hint")}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
