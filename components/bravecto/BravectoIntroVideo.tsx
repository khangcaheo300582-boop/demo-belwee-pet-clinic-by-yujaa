"use client";

/**
 * components/bravecto/BravectoIntroVideo.tsx
 *
 * Video intro CÓ ÂM THANH ở đầu trang Bravecto 365.
 *
 * ── TRÌNH TỰ ÂM THANH (đúng yêu cầu) ─────────────────────────────────────────
 *   1. mount → `muted = false`, `volume = 1`, gọi `play()`.
 *   2. Thành công ⇒ phát có tiếng.
 *   3. Bị `NotAllowedError` (chưa có tương tác) ⇒ phát lại ở chế độ MUTED
 *      (autoplay im lặng luôn được phép) và hiện pill "Chạm để bật âm thanh".
 *      Pill bật tiếng từ vị trí hiện tại — KHÔNG `currentTime = 0`.
 *   4. Listener một lần trên document (`pointerdown`/`keydown`/`touchend`) tự bật
 *      tiếng ở lần tương tác đầu tiên. Cuộn không phát sự kiện nào trong ba loại
 *      này nên "cuộn đơn thuần không tính là tương tác".
 *
 * ── HAI LOẠI "TẠM DỪNG" PHẢI PHÂN BIỆT ──────────────────────────────────────
 * `userPausedRef` = người dùng TỰ bấm tạm dừng ⇒ không bao giờ tự phát lại.
 * `autoPausedRef` = máy tự tạm dừng (ra khỏi viewport, ẩn tab, video khác chiếm
 * quyền phát) ⇒ được tự phát lại khi quay về. Gộp hai cờ này là lỗi kinh điển:
 * hoặc video tự chạy lại sau khi người dùng đã bấm dừng, hoặc im lặng mãi sau
 * khi cuộn qua cuộn lại.
 *
 * ── FALLBACK CODEC ──────────────────────────────────────────────────────────
 * File gốc `/intro-dsm-belwee.mp4` là HEVC (hvc1). Safari/iOS phát tốt, Chrome
 * và Firefox thì không. Nên source H.264 xếp TRƯỚC (xem `BravectoDoctorVideo`
 * cho cùng lý do), file gốc giữ làm nguồn thứ hai cho máy Apple.
 */

import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";
import styles from "./Bravecto365Page.module.css";
import {
  createPlayerId,
  registerPlayer,
  releasePlayback,
  requestExclusivePlayback,
} from "@/lib/videoPlayback";

export default function BravectoIntroVideo() {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playerIdRef = useRef<string>("");
  if (!playerIdRef.current) playerIdRef.current = createPlayerId("bravecto-intro");

  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [ended, setEnded] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [reduced, setReduced] = useState(false);

  const userPausedRef = useRef(false);
  const autoPausedRef = useRef(false);
  const inViewRef = useRef(true);

  /** Phát video (không đổi âm lượng) — dùng chung cho mọi nhánh tự phát. */
  const resume = () => {
    const video = videoRef.current;
    if (!video || !video.paused) return;
    requestExclusivePlayback(playerIdRef.current);
    void video.play().catch(() => {
      // Tự phát lại bị chặn (pin tiết kiệm, autoplay policy) — giữ nguyên khung
      // hình, người dùng vẫn bấm nút Phát được.
      autoPausedRef.current = false;
    });
  };

  // ── 1..3: tự phát có tiếng, rơi về muted + pill khi bị chặn ───────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setReduced(reduce);
    video.volume = 1;
    video.muted = false;

    // Reduced motion: KHÔNG tự phát. Chỉ hiện nút Phát lớn.
    if (reduce) return;

    const attempt = video.play();
    if (!attempt || typeof attempt.then !== "function") return;

    attempt
      .then(() => {
        setPlaying(true);
        setMuted(false);
        setBlocked(false);
      })
      .catch(() => {
        const el = videoRef.current;
        if (!el) return;
        el.muted = true;
        setMuted(true);
        setBlocked(true);
        void el
          .play()
          .then(() => setPlaying(true))
          .catch(() => setPlaying(false));
      });
  }, []);

  // ── 4: lần tương tác ĐẦU TIÊN trên document ⇒ bật tiếng ───────────────────
  useEffect(() => {
    if (reduced) return;

    const remove = () => {
      document.removeEventListener("pointerdown", handleInteraction);
      document.removeEventListener("keydown", handleInteraction);
      document.removeEventListener("touchend", handleInteraction);
    };

    function handleInteraction() {
      remove();
      const video = videoRef.current;
      if (!video || !video.muted) return;
      video.muted = false;
      video.volume = 1;
      setMuted(false);
      setBlocked(false);
      if (
        video.paused &&
        !video.ended &&
        inViewRef.current &&
        !userPausedRef.current
      ) {
        resume();
      }
    }

    document.addEventListener("pointerdown", handleInteraction, { passive: true });
    document.addEventListener("keydown", handleInteraction);
    document.addEventListener("touchend", handleInteraction, { passive: true });

    return remove;
    // `resume` chỉ đọc ref nên không cần vào deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  // ── Tạm dừng khi ra khỏi viewport, tự phát lại khi quay về ────────────────
  useEffect(() => {
    const wrap = wrapRef.current;
    const video = videoRef.current;
    if (!wrap || !video || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        inViewRef.current = entry.isIntersecting;
        if (!entry.isIntersecting) {
          if (!video.paused) {
            video.pause();
            autoPausedRef.current = true;
          }
          return;
        }
        if (autoPausedRef.current && !userPausedRef.current && !video.ended) {
          autoPausedRef.current = false;
          resume();
        }
      },
      { threshold: 0.2 }
    );

    observer.observe(wrap);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Tab bị ẩn ⇒ dừng; hiện lại ⇒ phát tiếp nếu không phải người dùng dừng ──
  useEffect(() => {
    const handleVisibility = () => {
      const video = videoRef.current;
      if (!video) return;

      if (document.hidden) {
        if (!video.paused) {
          video.pause();
          autoPausedRef.current = true;
        }
        return;
      }

      if (autoPausedRef.current && !userPausedRef.current && !video.ended && inViewRef.current) {
        autoPausedRef.current = false;
        resume();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Chỉ một video phát tại một thời điểm + dọn dẹp khi rời trang ──────────
  useEffect(() => {
    const id = playerIdRef.current;
    // Chốt node ngay khi effect chạy — cleanup phải dừng ĐÚNG phần tử đã phát.
    const video = videoRef.current;

    const unregister = registerPlayer(id, () => {
      if (!video || video.paused) return;
      video.pause();
      // Bị video KHÁC giành quyền phát ⇒ không được tự phát lại khi cuộn về.
      autoPausedRef.current = false;
    });

    return () => {
      unregister();
      releasePlayback(id);
      if (!video) return;
      // Rời trang: dừng hẳn để âm thanh không chạy tiếp sang trang khác.
      video.pause();
      userPausedRef.current = true;
    };
  }, []);

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    const nextMuted = !video.muted;
    video.muted = nextMuted;
    if (!nextMuted) video.volume = 1;
    setMuted(nextMuted);
    setBlocked(false);
  };

  /** Bấm pill "Chạm để bật âm thanh": bật tiếng, phát tiếp từ đúng vị trí. */
  const unmuteFromPill = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = false;
    video.volume = 1;
    setMuted(false);
    setBlocked(false);
    if (video.paused && !video.ended) {
      userPausedRef.current = false;
      resume();
    }
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.ended) {
      video.currentTime = 0;
      setEnded(false);
    }

    if (video.paused) {
      userPausedRef.current = false;
      autoPausedRef.current = false;
      // Bấm nút là một hành động chủ động ⇒ bật tiếng luôn.
      if (video.muted) {
        video.muted = false;
        video.volume = 1;
        setMuted(false);
        setBlocked(false);
      }
      resume();
      return;
    }

    userPausedRef.current = true;
    video.pause();
  };

  const showBigPlay = !playing && !ended;

  return (
    <div className={styles.intro} ref={wrapRef}>
      <video
        ref={videoRef}
        className={styles.introVideo}
        poster="/intro-dsm-belwee-poster.jpg"
        preload="auto"
        playsInline
        aria-label="Video giới thiệu chương trình Bravecto 365 của MSD Animal Health và Bệnh viện thú y Belwee"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setEnded(true);
        }}
        onVolumeChange={(event) => setMuted(event.currentTarget.muted)}
      >
        <source src="/intro-dsm-belwee-h264.mp4" type="video/mp4" />
        <source src="/intro-dsm-belwee.mp4" type="video/mp4" />
      </video>

      <div className={styles.introScrim} aria-hidden="true" />
      <div className={styles.introFade} aria-hidden="true" />

      {showBigPlay && (
        <button
          type="button"
          className={styles.introPlayBig}
          onClick={togglePlay}
          aria-label="Phát video giới thiệu"
        >
          <Play size={30} strokeWidth={2.4} aria-hidden="true" />
        </button>
      )}

      {blocked && muted && (
        <button type="button" className={styles.introPill} onClick={unmuteFromPill}>
          <VolumeX size={18} strokeWidth={2.2} aria-hidden="true" />
          Chạm để bật âm thanh
        </button>
      )}

      <div className={styles.introControls}>
        <button
          type="button"
          className={styles.introBtn}
          onClick={toggleMute}
          aria-label={muted ? "Bật âm thanh" : "Tắt âm thanh"}
          aria-pressed={!muted}
        >
          {muted ? (
            <VolumeX size={20} strokeWidth={2.2} aria-hidden="true" />
          ) : (
            <Volume2 size={20} strokeWidth={2.2} aria-hidden="true" />
          )}
        </button>

        <button
          type="button"
          className={styles.introBtn}
          onClick={togglePlay}
          aria-label={ended ? "Phát lại" : playing ? "Tạm dừng" : "Phát"}
        >
          {ended ? (
            <RotateCcw size={19} strokeWidth={2.4} aria-hidden="true" />
          ) : playing ? (
            <Pause size={19} strokeWidth={2.4} aria-hidden="true" />
          ) : (
            <Play size={19} strokeWidth={2.4} aria-hidden="true" />
          )}
        </button>
      </div>

      <span className="sr-only" role="status" aria-live="polite">
        {ended ? "Video giới thiệu đã kết thúc." : ""}
      </span>
    </div>
  );
}
