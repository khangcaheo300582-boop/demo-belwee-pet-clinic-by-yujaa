/**
 * scripts/load-env.ts
 *
 * Nạp `.env.local` vào `process.env` cho các script chạy bằng `tsx`.
 *
 * ── VÌ SAO PHẢI LÀ MỘT MODULE RIÊNG ĐỨNG ĐẦU, KHÔNG PHẢI LỜI GỌI TRONG SCRIPT ──
 * `lib/mongodb.ts` đọc biến môi trường ở CẤP MODULE:
 *
 *     const MONGODB_URI = process.env.MONGODB_URI;   // dòng 5
 *
 * Trong ESM, MỌI câu lệnh `import` đều được đánh giá trước MỌI câu lệnh thường
 * trong thân module. Nên nếu ta viết:
 *
 *     import { sanitizeStaff } from '../lib/staff-service';
 *     loadEnvConfig(process.cwd());          // <- chạy SAU
 *
 * thì `lib/staff-service` (kéo theo `lib/mongodb`) đã được đánh giá, và
 * `MONGODB_URI` bị chốt là `undefined` trước khi `loadEnvConfig` kịp chạy.
 * Hệ quả: `npm run test:staff` luôn đỏ với "Vui lòng khai báo MONGODB_URI",
 * dù `.env.local` có đầy đủ. Đây chính xác là lỗi đã gặp.
 *
 * Giải pháp: gói việc nạp env vào MỘT module có tác dụng phụ (side effect) và
 * `import` nó ở vị trí ĐẦU TIÊN. ESM đánh giá các import theo đúng thứ tự khai
 * báo, nên module này chạy xong thì `process.env` đã sẵn sàng cho mọi import
 * phía sau nó.
 *
 * Dùng `loadEnvConfig` của chính Next thay vì thêm dependency `dotenv`: nạp
 * đúng bộ biến mà app nạp, theo đúng thứ tự ưu tiên. Xem
 * scripts/import-json-to-mongo.ts và scripts/migrate-otp-per-purpose.ts.
 */

import { loadEnvConfig } from '@next/env';

loadEnvConfig(process.cwd());