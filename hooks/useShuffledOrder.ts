"use client";

/**
 * hooks/useShuffledOrder.ts
 *
 * Xáo trộn danh sách một cách AN TOÀN VỚI HYDRATION.
 *
 * ── VẤN ĐỀ NÓ GIẢI QUYẾT ────────────────────────────────────────────────────
 * Cách làm sai từng xuất hiện ở thẻ "Belwee luôn quan tâm bạn" (đã gỡ bỏ):
 *
 *     const picked = useMemo(() => shuffle(EXPERTS).slice(0, 3), []);
 *
 * Trông thì "chỉ chạy một lần", nhưng `useMemo` **có chạy ở lần render đầu
 * tiên** — và lần render đầu tiên diễn ra ở HAI nơi với hai kết quả khác nhau:
 * một lần trên server (sinh HTML) và một lần trên client (hydrate). Vì
 * `Math.random()` cho hai kết quả khác nhau, HTML của server không khớp cây
 * React dựng ở client. React phản ứng bằng cách **vứt bỏ toàn bộ HTML đó và
 * dựng lại từ đầu** (lỗi `#422` / `#425` trong bản production).
 *
 * Hậu quả thật, đo được: `npm run build` rồi mở `/gioi-thieu`, `/dich-vu`,
 * `/tuyen-dung` đều báo hai lỗi này trong console, và React phải render lại cả
 * subtree — đúng thứ chi phí mà "trang tĩnh" không đáng phải trả.
 *
 * ── CÁCH LÀM ĐÚNG ──────────────────────────────────────────────────────────
 *   1. Lần render đầu: thứ tự GỐC (deterministic) ⇒ HTML server và cây client
 *      đầu tiên giống nhau tuyệt đối ⇒ không mismatch.
 *   2. Sau khi mount (`useEffect`), mới xáo và cập nhật state ⇒ đổi thứ tự
 *      trong DOM một lần duy nhất, khi React đã nắm quyền.
 *
 * Không dùng `Math.random()` ở bất kỳ đâu trong thân render.
 *
 * ── VỀ CLS ──────────────────────────────────────────────────────────────────
 * Hook KHÔNG bảo đảm chống nhảy bố cục. Nó chỉ giữ nguyên SỐ LƯỢNG phần tử.
 * Người dùng hook phải bảo đảm các phần tử cùng kích thước (hoặc cùng số dòng)
 * — khi đó việc đổi thứ tự chỉ đổi nội dung, chiều cao không đổi.
 */

import { useEffect, useState } from "react";

/** Fisher-Yates trên chỉ số — trả về mảng MỚI, không mutate gốc. */
export function shuffledIndices(length: number): number[] {
  const indices = Array.from({ length: Math.max(0, length) }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices;
}

/** Thứ tự gốc — dùng cho lần render đầu để server và client khớp nhau. */
function identityIndices(length: number): number[] {
  return Array.from({ length: Math.max(0, length) }, (_, i) => i);
}

/**
 * Trả về `count` phần tử của `items` theo thứ tự ngẫu nhiên, ổn định qua
 * hydration.
 *
 * @param items  Mảng nguồn. Nên là hằng ở cấp module để tham chiếu không đổi.
 * @param count  Số phần tử lấy ra. Bỏ trống = lấy hết (chỉ xáo thứ tự).
 */
export default function useShuffledOrder<T>(items: readonly T[], count?: number): T[] {
  // `null` = chưa mount ⇒ dùng thứ tự gốc.
  const [order, setOrder] = useState<number[] | null>(null);

  useEffect(() => {
    setOrder(shuffledIndices(items.length));
  }, [items.length]);

  const indices = order ?? identityIndices(items.length);
  const picked = count === undefined ? indices : indices.slice(0, Math.max(0, count));
  return picked.map((index) => items[index]);
}
