// lib/typingState.ts
// Tiến trình "đang nhập" của phiên chăm sóc khách hàng.
//
// VÌ SAO LÀ GLOBALTHISINGLETON
//   Next.js (dev) đóng gói lib module riêng cho từng route bundle. Một `Map`
//   khai báo ở cấp module sẽ có nhiều bản sao: route POST ghi vào bản của nó,
//   route GET đọc bản khác → khách không bao giờ thấy nhân viên đang nhập.
//   Cùng lý do đã phải sửa SSE hub trong lib/realtime.ts; ở đây giữ một hub
//   duy nhất trên globalThis để mọi bundle nhìn thấy cùng dữ liệu.
//
// TTL 8 GIÂY
//   Trạng thái "đang nhập" không phải dữ liệu bền — nó chỉ đúng trong vài
//   giây. Client gửi heartbeat 4 giây/lần khi ô soạn còn focus và gửi `false`
//   ngay khi blur. TTL là lưới an toàn khi tab bị đóng đột ngột hoặc request
//   cuối thất lạc.

export type TypingRole = 'customer' | 'staff';

interface TypingEntry {
  sessionId: string;
  role: TypingRole;
  name: string;
  expiresAt: number;
}

interface TypingHub {
  entries: Map<string, TypingEntry>;
}

export const TYPING_TTL_MS = 8_000;

const HUB_KEY = '__belweeTypingHub';

function hub(): TypingHub {
  const scope = globalThis as typeof globalThis & { [HUB_KEY]?: TypingHub };
  if (!scope[HUB_KEY]) scope[HUB_KEY] = { entries: new Map() };
  return scope[HUB_KEY];
}

function entryKey(sessionId: string, role: TypingRole): string {
  return `${sessionId}:${role}`;
}

/** Ghi nhận / gia hạn trạng thái đang nhập. */
export function markTyping(sessionId: string, role: TypingRole, name = ''): void {
  hub().entries.set(entryKey(sessionId, role), {
    sessionId,
    role,
    name,
    expiresAt: Date.now() + TYPING_TTL_MS,
  });
}

/** Xoá ngay khi người dùng blur khỏi ô soạn. */
export function clearTyping(sessionId: string, role: TypingRole): void {
  hub().entries.delete(entryKey(sessionId, role));
}

/** True khi role đang thực sự gõ (và mốc TTL chưa trôi qua). */
export function isTyping(sessionId: string, role: TypingRole): boolean {
  const key = entryKey(sessionId, role);
  const entry = hub().entries.get(key);
  if (!entry) return false;
  if (entry.expiresAt <= Date.now()) {
    hub().entries.delete(key);
    return false;
  }
  return true;
}
