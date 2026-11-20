/**
 * lib/videoPlayback.ts
 *
 * Sổ đăng ký "chỉ MỘT video phát tại một thời điểm".
 *
 * ── VÌ SAO KHÔNG DÙNG REACT CONTEXT ──────────────────────────────────────────
 * Trang Bravecto có 3 video nằm trong 3 nhánh cây khác nhau (intro ở đầu trang,
 * hai video bác sĩ ở hai section). Context sẽ phải bọc cả trang và mọi video
 * đều re-render mỗi khi một video đổi trạng thái — trong khi thứ duy nhất cần
 * truyền đi là một lệnh "pause". Một module singleton làm đúng việc đó, không
 * thêm provider, không thêm re-render.
 *
 * Hợp đồng:
 *   registerPlayer(id, pause)  → trả về hàm huỷ đăng ký.
 *   requestExclusivePlayback(id) → pause MỌI player khác rồi ghi nhận id.
 *   releasePlayback(id)        → player dừng hẳn (unmount).
 *
 * Thứ tự trong `requestExclusivePlayback` quan trọng: đặt `current = id` TRƯỚC
 * khi pause các player khác, vì `pause()` của họ có thể chạy handler `onPause`
 * và gọi `releasePlayback(id của họ)` — nếu chưa ghi nhận chủ sở hữu mới, lời
 * gọi đó sẽ xoá mất trạng thái vừa đặt.
 */

export type PlayerId = string;

let sequence = 0;

/** id duy nhất cho mỗi <video>, không phụ thuộc React `useId` (chỉ chạy ở client). */
export function createPlayerId(prefix = "player"): PlayerId {
  sequence += 1;
  return `${prefix}-${sequence}`;
}

/** pause() của từng player — do chính component video cài đặt. */
const players = new Map<PlayerId, () => void>();

let current: PlayerId | null = null;

/** Đăng ký một player. Trả về hàm huỷ đăng ký để gọi trong cleanup của effect. */
export function registerPlayer(id: PlayerId, pause: () => void): () => void {
  players.set(id, pause);
  return () => {
    players.delete(id);
    if (current === id) current = null;
  };
}

/** Player `id` chuẩn bị phát ⇒ dừng tất cả các player còn lại. */
export function requestExclusivePlayback(id: PlayerId): void {
  if (current === id) return;
  current = id;
  players.forEach((pause, otherId) => {
    if (otherId === id) return;
    try {
      pause();
    } catch {
      // Một player lỗi (video đã bị gỡ khỏi DOM…) không được chặn các player khác.
    }
  });
}

/** Player `id` dừng hẳn, không còn giữ "quyền phát". */
export function releasePlayback(id: PlayerId): void {
  if (current === id) current = null;
}

/** Player `id` có đang là video được phép phát hay không. */
export function isPlaybackOwner(id: PlayerId): boolean {
  return current === id;
}
