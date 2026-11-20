/**
 * components/SocialIcons.tsx
 *
 * MỘT bộ icon mạng xã hội dùng chung cho footer và nút nổi. Trước đây mỗi nơi
 * vẽ lại SVG riêng (và footer còn hardcode `href="#"` cho TikTok/YouTube) nên dễ
 * lệch. Nay icon lấy theo khoá từ `SOCIAL_LINKS` (lib/clinics.ts) — mục nào có
 * `href` thì mới render thành link, không có thì không hiện, tuyệt đối không
 * sinh `href="#"`.
 */

import type { SocialLink } from "@/lib/clinics";

type IconName = SocialLink["icon"];

const PATHS: Record<IconName, React.ReactNode> = {
  facebook: (
    <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.268h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
  ),
  zalo: (
    <text
      x="4.5"
      y="19"
      fontSize="19"
      fontWeight="900"
      fontFamily="Arial, Helvetica, sans-serif"
    >
      Z
    </text>
  ),
  tiktok: (
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
  ),
  youtube: (
    <path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.38.5A3.02 3.02 0 0 0 .5 6.19C0 8.07 0 12 0 12s0 3.93.5 5.81a3.02 3.02 0 0 0 2.12 2.14c1.88.5 9.38.5 9.38.5s7.5 0 9.38-.5a3.02 3.02 0 0 0 2.12-2.14C24 15.93 24 12 24 12s0-3.93-.5-5.81zM9.55 15.57V8.43L15.82 12l-6.27 3.57z" />
  ),
};

export function SocialIcon({ name }: { name: IconName }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      {PATHS[name]}
    </svg>
  );
}

/**
 * Chỉ trả về các mục ĐÃ có URL thật — nơi gọi không cần lọc lại.
 *
 * Kiểu trả về phải giữ `href: string` (không phải `SocialLink[]`), nếu không
 * TypeScript sẽ nới lại `href` về `string | null` và `<a href={s.href}>` báo
 * lỗi TS2322.
 */
export function resolvableSocials(
  links: readonly SocialLink[]
): (SocialLink & { href: string })[] {
  return links.filter((l): l is SocialLink & { href: string } => l.href !== null);
}
