"use client";

/**
 * components/bravecto/BravectoDoctorVideo.tsx
 *
 * Khung video bác sĩ (dùng cho CẢ video nam ở Section 2 và video nữ ở Section 4).
 *
 * Khác video intro ở ba điểm, đúng yêu cầu:
 *   • KHÔNG tự phát, KHÔNG loop, chỉ phát khi người dùng bấm.
 *   • `preload="metadata"` + chỉ nạp khi gần vào viewport (không kéo 1.4 MB
 *     video về ngay khi mở trang).
 *   • Sau lần phát ĐẦU TIÊN mới bật `controls` để người xem tua/âm lượng/toàn
 *     màn hình. Trước đó hiện nút Play tròn ở giữa; đang phát thì ẩn, tạm dừng
 *     thì hiện lại.
 *
 * `#t=0.1` cuối src: iOS/Safari không dùng được `poster` trong vài ngữ cảnh
 * (chế độ tiết kiệm pin, phát inline) — neo media vào giây 0.1 buộc nó HIỂN THỊ
 * khung hình đầu thay vì ô đen. Vẫn giữ `poster` thật (đã xuất bằng ffmpeg) để
 * các trình duyệt khác có ảnh ngay từ paint đầu tiên.
 */

import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";
import styles from "./Bravecto365Page.module.css";
import {
  createPlayerId,
  registerPlayer,
  releasePlayback,
  requestExclusivePlayback,
} from "@/lib/videoPlayback";

interface BravectoDoctorVideoProps {
  /** Ảnh poster đã xuất từ khung hình đầu (ffmpeg). */
  poster: string;
  /** Bản H.264 — phát được ở Chrome/Firefox/Safari. */
  h264Src: string;
  /** File gốc (HEVC) — chất lượng cao hơn trên máy Apple. */
  hevcSrc: string;
  /** Nhãn cho trình đọc màn hình, ví dụ "Video bác sĩ nam tư vấn". */
  label: string;
  /** Class bổ sung cho khung ngoài (Section 4 cần canh theo cột). */
  className?: string;
}

export default function BravectoDoctorVideo({
  poster,
  h264Src,
  hevcSrc,
  label,
  className,
}: BravectoDoctorVideoProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playerIdRef = useRef<string>("");
  if (!playerIdRef.current) playerIdRef.current = createPlayerId("bravecto-doctor");

  const [near, setNear] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [hasPlayed, setHasPlayed] = useState(false);

  // Chỉ nạp metadata khi khung video tới gần viewport (dư 400px).
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || typeof IntersectionObserver === "undefined") {
      setNear(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setNear(true);
        observer.disconnect();
      },
      { rootMargin: "400px 0px" }
    );

    observer.observe(wrap);
    return () => observer.disconnect();
  }, []);

  // Đổi `preload` không tự kéo dữ liệu — phải gọi load() một lần.
  useEffect(() => {
    if (!near) return;
    const video = videoRef.current;
    if (!video || video.readyState > 0) return;
    video.load();
  }, [near]);

  // Ra khỏi viewport "lâu" (1.5s) ⇒ tạm dừng, tránh video tiếp tục chạy tiếng.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || typeof IntersectionObserver === "undefined") return;

    let timer: number | null = null;
    const clearTimer = () => {
      if (timer === null) return;
      window.clearTimeout(timer);
      timer = null;
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          clearTimer();
          return;
        }
        if (timer !== null) return;
        timer = window.setTimeout(() => {
          timer = null;
          videoRef.current?.pause();
        }, 1500);
      },
      { threshold: 0.25 }
    );

    observer.observe(wrap);
    return () => {
      clearTimer();
      observer.disconnect();
    };
  }, []);

  // Đăng ký với sổ "chỉ một video phát" + dừng khi unmount.
  useEffect(() => {
    const id = playerIdRef.current;
    // Chốt node ngay khi effect chạy: cleanup phải dừng ĐÚNG phần tử đã phát,
    // không phải `ref.current` lúc unmount (có thể đã trỏ sang node khác).
    const video = videoRef.current;

    const unregister = registerPlayer(id, () => {
      if (video && !video.paused) video.pause();
    });

    return () => {
      unregister();
      releasePlayback(id);
      video?.pause();
    };
  }, []);

  const startPlayback = () => {
    const video = videoRef.current;
    if (!video) return;
    requestExclusivePlayback(playerIdRef.current);
    void video.play().catch(() => {
      // Không phát được: giữ nút Play để người dùng thử lại.
      setPlaying(false);
    });
  };

  const toggle = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      startPlayback();
      return;
    }
    video.pause();
  };

  return (
    <div className={`${styles.videoFrame} ${className ?? ""}`}>
      <div className={styles.videoInner}>
        <video
          ref={videoRef}
          className={styles.videoEl}
          poster={poster}
          preload={near ? "metadata" : "none"}
          playsInline
          controls={hasPlayed}
          aria-label={label}
          onPlay={() => {
            setPlaying(true);
            setHasPlayed(true);
            requestExclusivePlayback(playerIdRef.current);
          }}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onClick={() => {
            // Sau lần phát đầu tiên, `controls` đã bật nên trình duyệt tự xử lý
            // cú bấm; chỉ can thiệp khi chưa có thanh điều khiển.
            if (!hasPlayed) toggle();
          }}
        >
          <source src={`${h264Src}#t=0.1`} type="video/mp4" />
          <source src={`${hevcSrc}#t=0.1`} type="video/mp4" />
        </video>

        {!playing && (
          <button
            type="button"
            className={styles.videoPlay}
            onClick={toggle}
            aria-label={hasPlayed ? "Phát tiếp video" : "Phát video"}
          >
            <span className={styles.videoPlayDot}>
              <Play size={26} strokeWidth={2.4} aria-hidden="true" />
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
