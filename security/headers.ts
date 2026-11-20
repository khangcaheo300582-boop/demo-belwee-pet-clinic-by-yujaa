import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

/**
 * Content-Security-Policy for the application.
 * Deliberately pragmatic: the app ships inline bootstrap scripts, inline
 * style tags, inline SVGs and next/font self-hosted assets, so a strict
 * nonce-based policy would break rendering. We therefore cap the risky
 * directives (frame-ancestors, object-src, base-uri, form-action, upgrade)
 * while leaving the app's existing inline usage intact. 'unsafe-inline' is
 * kept only for styles/scripts the framework already injects.
 */
function buildCspHeader(): string {
  // Next.js dev runtime (webpack/fast-refresh) and some UI libraries use
  // `eval`/`new Function`. The strict CSP below only ships `'unsafe-eval'` in
  // development; production keeps the hardened policy.
  const scriptSrc =
    process.env.NODE_ENV === 'production'
      ? "script-src 'self' 'unsafe-inline'"
      : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";
  // Host ảnh bản đồ.
  //
  // Leaflet tải ô bản đồ bằng thẻ <img> nên chúng đi qua `img-src`. Nếu thiếu ở
  // đây, bản đồ vẫn khởi tạo, vẫn có marker, nhưng mọi ô đều bị chặn và người
  // dùng thấy một khung xám — đúng trạng thái "trông như hỏng mà không nói lý
  // do". Bộ kiểm thử khói toàn site bắt được lỗi này.
  //
  // Các host a/b/c dùng cho tile phân tầng theo tải; hiện tại chỉ
  // `tile.openstreetmap.org` được dùng nhưng liệt kê cả nhánh phụ để không phải
  // sửa CSP lần sau khi đổi nguồn tile.
  const imgSrc = [
    "'self'",
    "data:",
    "blob:",
    "https://images.unsplash.com",
    "https://tile.openstreetmap.org",
    "https://*.tile.openstreetmap.org",
  ].join(' ');

  const dirs = [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    `img-src ${imgSrc}`,
    "font-src 'self' data: https://fonts.gstatic.com",
    "media-src 'self' blob: data:",
    "connect-src 'self'",
    "frame-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ];
  return dirs.join('; ');
}

export function applySecurityHeaders(
  response: NextResponse,
  request: NextRequest,
): NextResponse {
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  /*
   * GĐ5 — đổi `geolocation=()` thành `geolocation=(self)`.
   *
   * `geolocation=()` là dạng CẤM HOÀN TOÀN: dù người dùng bấm "cho phép",
   * `getCurrentPosition` vẫn trả lỗi mã 1 với thông báo "Geolocation has been
   * disabled in this document by permissions policy". Tính năng "Tìm chi nhánh
   * gần tôi" (hạng mục 25.4) vì thế không chạy được trên bất kỳ trình duyệt nào.
   * Đây là số đo thật từ trình duyệt, không phải suy đoán khi đọc header.
   *
   * `(self)` = chỉ chính trang này được dùng định vị, không mở cho origin khác
   * nhúng vào. Đây là mức tối thiểu cần thiết, vẫn giữ chặt.
   *
   * `camera=()` và `microphone=()` GIỮ NGUYÊN: dự án không dùng hai thứ đó,
   * chặn là biện pháp an toàn đúng đắn. Không mở thêm chỉ vì đã mở geolocation.
   */
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(self)',
  );
  response.headers.set('X-DNS-Prefetch-Control', 'off');
  response.headers.set('X-Permitted-Cross-Domain-Policies', 'none');
  response.headers.set('Origin-Agent-Cluster', '?1');
  response.headers.set('Content-Security-Policy', buildCspHeader());
  response.headers.set('X-XSS-Protection', '0'); // We rely on CSP, not the legacy filter.

  if (request.nextUrl.protocol === 'https:') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains',
    );
  }

  if (request.nextUrl.pathname.startsWith('/api/')) {
    response.headers.set('Cache-Control', 'no-store');
  }

  return response;
}
