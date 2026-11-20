/**
 * Intro boot gate — chia sẻ trạng thái video intro cho toàn bộ trang.
 *
 * Mục đích:
 * - Video intro là ưu tiên cao nhất mỗi lần tải lại trang (reload).
 * - Mọi hiệu ứng nội dung nặng (hero, marquee, reveal, video nền...) chờ đến
 *   khi intro đi vào pha "fading" mới bắt đầu — tránh chạy song song ngay lúc
 *   boot gây lag/quá tải.
 * - Có auto-release dự phòng: nếu intro không bao giờ kết thúc (lỗi JS, autoplay
 *   bị chặn mà người dùng không bấm...), trang tự nhả sau một khoảng thời gian
 *   để không bao giờ kẹt nội dung.
 */

export type IntroPhase = "boot" | "playing" | "fading" | "done";

/**
 * Thời gian overlay intro tan (ms) — MỘT nguồn sự thật duy nhất.
 *
 * CSS `.intro-video-screen` khai `transition: opacity 700ms ease` và không thể
 * import TS, nên hai chỗ phải khớp nhau bằng tay; đổi một chỗ mà quên chỗ kia
 * sẽ khiến timeline hero bắt đầu khi overlay còn che (hiệu ứng bị "ăn") hoặc
 * trễ thành một khoảng lặng. `scripts/verify-intro-gate.ts` (mục e) đo lại
 * đúng nhịp này trên trình duyệt thật để bắt lệch.
 *
 * `useHeroReveal` dùng hằng số này thay vì số 0.72 viết tay trước đây.
 */
export const INTRO_FADE_MS = 700;

// Server / pre-hydration: coi như đã xong để không chặn render.
const INITIAL: IntroPhase = typeof window === "undefined" ? "done" : "boot";

let phase: IntroPhase = INITIAL;
const subscribers = new Set<(next: IntroPhase) => void>();
let releaseTimer: number | null = null;
const AUTO_RELEASE_MS = 30000;

export function getIntroPhase(): IntroPhase {
  return phase;
}

function clearReleaseTimer() {
  if (releaseTimer !== null) {
    window.clearTimeout(releaseTimer);
    releaseTimer = null;
  }
}

function armReleaseTimer() {
  if (typeof window === "undefined") return;
  clearReleaseTimer();
  releaseTimer = window.setTimeout(() => setPhase("done"), AUTO_RELEASE_MS);
}

function setPhase(next: IntroPhase) {
  if (phase === next) return;
  phase = next;
  subscribers.forEach((fn) => fn(next));

  if (next === "playing" || next === "boot") {
    // Mỗi lần intro bắt đầu (kể cả quay lại trang chủ từ trang khác) phải có
    // một đồng hồ auto-release mới. Trước đây timer chỉ đặt một lần lúc
    // subscribe, nên lần chơi thứ hai không còn đường thoát dự phòng.
    armReleaseTimer();
  } else {
    clearReleaseTimer();
  }
}

/** Gọi bởi IntroVideo (client) khi trạng thái intro thay đổi. */
export function setIntroPhase(next: IntroPhase) {
  setPhase(next);
}

/**
 * Đăng ký theo dõi pha intro. Callback được gọi ngay với pha hiện tại, sau đó
 * mỗi lần đổi pha.
 *
 * KHÔNG xoá subscriber khi intro "done": điều hướng về "/" sẽ đưa pha trở lại
 * "playing", và những consumer đã đăng ký từ trước (usePageReady, navbar,
 * footer...) phải nhận được lần đóng cổng mới. Chỉ component unmount mới huỷ
 * đăng ký.
 */
export function subscribeIntro(onChange: (next: IntroPhase) => void): () => void {
  subscribers.add(onChange);
  onChange(phase);

  if ((phase === "boot" || phase === "playing") && releaseTimer === null) {
    armReleaseTimer();
  }

  return () => {
    subscribers.delete(onChange);
  };
}
