// scripts/verify-motion.ts
// Chốt chặn cho cổng chuyển động của cả site.
//
// VÌ SAO FILE NÀY TỒN TẠI
//   `prefersReducedMotion()` trong lib/motion.ts từng viết `return !FORCE_MOTION`.
//   Với `FORCE_MOTION = true` thì đúng vô hình, nhưng khi cờ được đặt lại false
//   để tôn trọng thiết lập của hệ điều hành, hàm trả `true` VÔ ĐIỀU KIỆN —
//   nghĩa là "giảm chuyển động" cho mọi khách, kể cả người không bật tuỳ chọn.
//   Doc comment ghi "restore respect for the OS setting" là một lời hứa mà code
//   không thực hiện: hàm chưa từng đọc `matchMedia`.
//
//   Đây đúng loại lỗi mà TypeScript không bắt được — kiểu trả về vẫn là boolean,
//   chỉ giá trị sai — nên chỉ test mới giữ được.
//
// Run with: npx tsx scripts/verify-motion.ts

let passed = 0;
let failed = 0;

function check(label: string, ok: boolean, why: string) {
  if (ok) {
    passed += 1;
    console.log(`  + ${label}`);
  } else {
    failed += 1;
    console.log(`  x ${label}`);
    console.log(`      ${why}`);
  }
}

/**
 * Dựng lại môi trường trình duyệt giả cho lib/motion.ts, vì hàm đó đọc `window`
 * ở thời điểm GỌI chứ không lúc import — nên mock được sau khi import.
 */
function withBrowser(
  reduced: boolean | null,
  run: () => void
) {
  const g = globalThis as unknown as { window?: unknown; matchMedia?: unknown };
  const savedWindow = g.window;
  const savedMatchMedia = g.matchMedia;

  if (reduced === null) {
    // Không có `window` — đúng như lúc render trên server.
    delete g.window;
  } else {
    g.window = {
      matchMedia: (query: string) => ({
        matches: query.includes('prefers-reduced-motion') ? reduced : false,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        onchange: null,
        dispatchEvent: () => false,
      }),
    };
  }

  try {
    run();
  } finally {
    if (savedWindow === undefined) delete g.window;
    else g.window = savedWindow;
    if (savedMatchMedia === undefined) delete g.matchMedia;
    else g.matchMedia = savedMatchMedia;
  }
}

console.log('\n1. Cổng chuyển động đọc thiết lập thật của hệ điều hành');

withBrowser(false, () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { prefersReducedMotion, FORCE_MOTION } = require('../lib/motion') as {
    prefersReducedMotion: () => boolean;
    FORCE_MOTION: boolean;
  };

  check(
    'khách KHÔNG bật giảm chuyển động thì được xem',
    prefersReducedMotion() === false,
    'hàm trả true, tức site tắt mọi hiệu ứng cho người không yêu cầu — đây chính là lỗi của bản `return !FORCE_MOTION`',
  );

  check(
    'FORCE_MOTION đang tắt',
    FORCE_MOTION === false,
    'cờ còn bật thì hàm không bao giờ đọc matchMedia, tức reduced-motion vẫn bị vô hiệu',
  );
});

withBrowser(true, () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { prefersReducedMotion } = require('../lib/motion') as {
    prefersReducedMotion: () => boolean;
  };

  check(
    'khách BẬT giảm chuyển động thì bị tắt hiệu ứng',
    prefersReducedMotion() === true,
    'hàm trả false, tức site vẫn chạy hiệu ứng cho người không chịu được chúng',
  );
});

console.log('\n2. Render trên server không được nổ');

withBrowser(null, () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { prefersReducedMotion } = require('../lib/motion') as {
    prefersReducedMotion: () => boolean;
  };

  check(
    'không có `window` thì trả false, không ném lỗi',
    prefersReducedMotion() === false,
    'server render phải cho ra HTML có hiệu ứng; client mới đánh giá lại trong effect',
  );
});

console.log('\n3. Nhất quán giữa cổng JS và truy vấn CSS');

// Nếu JS nói "tắt hiệu ứng" mà CSS vẫn chạy animation, người dùng thấy trang
// nhảy loạn mà không có nút nào để dừng. Ngược lại thì hiệu ứng treo vĩnh viễn.
const fs = require('fs') as typeof import('fs');
const path = require('path') as typeof import('path');

const root = path.resolve(__dirname, '..');

/**
 * Bỏ comment trước khi dò.
 *
 * Cần thiết: globals.css ghi lại chính cái tên `prefers-reduced-motion-disabled`
 * trong khối comment giải thích lịch sử. Dò thô thì báo động giả — tên đó nằm
 * trong chú thích, trình duyệt không đọc. Chỉ `@media` ngoài comment mới là
 * query thật.
 */
function stripCssComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '');
}

const css = stripCssComments(
  fs.readFileSync(path.join(root, 'app/globals.css'), 'utf8')
);
const inlineStyleSources = [
  'app/dang-nhap/page.tsx',
  'components/ClinicSystem.tsx',
].map((rel) => ({
  rel,
  text: stripCssComments(
    fs.readFileSync(path.join(root, rel), 'utf8')
  ),
}));

check(
  'globals.css không còn @media nào dùng media feature bịa đặt',
  !css.includes('prefers-reduced-motion-disabled'),
  '`prefers-reduced-motion-disabled` không phải media feature thật, nên mọi query tên đó luôn false và fallback bên trong chết',
);

check(
  'globals.css có dùng tên thật `prefers-reduced-motion: reduce`',
  css.includes('@media (prefers-reduced-motion: reduce)'),
  'không tìm thấy query nào dùng tên thật — CSS sẽ không tắt hiệu ứng',
);

for (const { rel, text } of inlineStyleSources) {
  check(
    `${rel} không còn @media nào dùng media feature bịa đặt`,
    !text.includes('prefers-reduced-motion-disabled'),
    'còn sót lại tên bịa đặt trong thẻ <style> nội tuyến',
  );
}

console.log('\n4. Animation không được xoá tiêu đề khỏi cây trợ năng');

// `autoAlpha` của GSAP = `opacity` + `visibility`. Khi opacity về 0 nó bật
// `visibility: hidden`, mà `visibility: hidden` xoá phần tử khỏi cây trợ năng.
// Hậu quả đã đo được trên production: tiêu đề `<h2>` của khối dịch vụ trang chủ
// dùng `data-reveal-exit`, nên trước khi cuộn tới nó là `visibility: hidden`;
// axe-core không thấy nó, `<h3>` trong thẻ carousel thành heading đầu tiên sau
// `<h1>`, và Lighthouse báo `heading-order` (vi phạm WCAG 1.3.1).
//
// Ngoài ra `visibility` cũng trái với ràng buộc của dự án: chuyển động chỉ được
// đụng `transform` / `opacity`. Các check dưới chốt lại ràng buộc đó ở mức
// nguồn: KHÔNG được truyền thẳng trạng thái ẩn thô cho `gsap.fromTo`, mọi
// call site phải đi qua `fadeFrom` / `fadeTo` vốn đã hỏi `keepsInA11yTree`.
const animationProvider = fs.readFileSync(
  path.join(root, 'components/AnimationProvider.tsx'),
  'utf8'
);

/** Đếm số lần xuất hiện của một mẫu, không phân biệt hoa thường. */
function countOccurrences(haystack: string, needle: string): number {
  let count = 0;
  let at = haystack.indexOf(needle);
  while (at !== -1) {
    count += 1;
    at = haystack.indexOf(needle, at + needle.length);
  }
  return count;
}

/**
 * Bỏ comment (`//`, `/* ... *\/`) trước khi kiểm tra mã.
 *
 * BẮT BUỘC: nếu không, các check "cấm nội suy toạ độ" sẽ khớp chính dòng
 * comment giải thích lỗi cũ (`x += (targetX - x) * 0.35`) và luôn đỏ — một
 * check vừa chậm vừa sai.
 */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1 ');
}

/** Cắt thân một hàm cấp cao nhất kế tiếp, để đếm lần đọc "bên ngoài helper". */
function sliceTopLevelFn(src: string, name: string): string {
  const start = src.indexOf(`function ${name}(`);
  if (start === -1) return '';
  const next = src.indexOf('\nfunction ', start + 1);
  return next === -1 ? src.slice(start) : src.slice(start, next);
}

const fadeFromBody = sliceTopLevelFn(animationProvider, 'fadeFrom');
const fadeToBody = sliceTopLevelFn(animationProvider, 'fadeTo');
// `VARIANT_FROM[...]`/`REVEAL_TO` xuất hiện 2 lần TRONG mỗi helper (bản gốc và
// bản đã bỏ `autoAlpha`), nên điều cần đo là: có lần đọc nào NẰM NGOÀI helper hay
// không — số dư tính bằng cách trừ phần trong thân ra khỏi tổng.
const strayFromReads =
  countOccurrences(animationProvider, 'VARIANT_FROM[') -
  countOccurrences(fadeFromBody, 'VARIANT_FROM[');
const strayToReads =
  countOccurrences(animationProvider, 'REVEAL_TO') -
  countOccurrences(fadeToBody, 'REVEAL_TO');

check(
  '`keepsInA11yTree` có dò cả heading lẫn container của heading',
  /HEADING_SELECTOR\s*=\s*["']h1,h2,h3,h4,h5,h6["']/.test(animationProvider) &&
    /el\.closest\(HEADING_SELECTOR\)/.test(animationProvider) &&
    /el\.querySelector\(HEADING_SELECTOR\)/.test(animationProvider),
  'hàm phải dùng `closest` (bản thân nó là heading) và `querySelector` (chứa heading) — thiếu một trong hai thì container bọc tiêu đề lại quay về `autoAlpha`',
);

check(
  'chỉ `fadeFrom` được đọc trạng thái ẩn thô `VARIANT_FROM[...]`',
  countOccurrences(fadeFromBody, 'VARIANT_FROM[') > 0 && strayFromReads === 0,
  `có ${strayFromReads} lần đọc VARIANT_FROM[...] ngoài fadeFrom — mỗi chốt là một reveal tự quyết ẩn/hiện, không hỏi cây trợ năng`,
);

check(
  'chỉ `fadeTo` được đọc trạng thái hiện thô `REVEAL_TO`',
  countOccurrences(fadeToBody, 'REVEAL_TO') > 0 && strayToReads === 1,
  `có ${strayToReads} lần đọc REVEAL_TO ngoài fadeTo (mong đợi đúng 1 — phần khai báo) — chỗ dư nghĩa là một call site đang né nhánh keepsInA11yTree`,
);

check(
  'nhánh hai chiều (`data-reveal-exit`) cũng đi qua fadeFrom/fadeTo',
  /fadeFrom\(el, variant\)/.test(animationProvider) &&
    /keepTree\s*\?\s*\{\s*opacity:\s*0/.test(animationProvider),
  'exit đang tự viết `autoAlpha: 0` riêng, nên tiêu đề biến mất khỏi cây trợ năng đúng lúc người dùng cuộn khỏi vùng nhìn',
);

check(
  'stagger `[data-reveal-group]` quyết định nhánh ẩn theo cả nhóm',
  /keepsInA11yTree\(group\)/.test(animationProvider),
  'nhóm con chứa tiêu đề mà vẫn `autoAlpha` thì tiêu đề bị xoá khỏi cây trợ năng cho tới khi nhóm hiện',
);

console.log('\n5. Không còn hiệu ứng con trỏ tuỳ biến');

const rootLayout = fs.readFileSync(path.join(root, 'app/layout.tsx'), 'utf8');
const cursorComponentPath = path.join(root, 'components/PawCursor.tsx');

check(
  'PawCursor đã được gỡ khỏi mã nguồn',
  !fs.existsSync(cursorComponentPath),
  'xoá component con trỏ tuỳ biến để không còn vòng lắng nghe pointermove',
);
check(
  'layout không khởi tạo con trỏ tuỳ biến',
  !/PawCursor|data-paw-cursor/.test(rootLayout),
  'loại bỏ import/render PawCursor khỏi layout gốc',
);
check(
  'CSS không ẩn con trỏ hệ thống hay giữ hiệu ứng PawCursor',
  !/\.paw-cursor|data-paw-cursor|cursor:\s*none/.test(css),
  'loại bỏ toàn bộ rule con trỏ tuỳ biến khỏi globals.css',
);

console.log(
  `\nmotion-gate: ${passed} passed, ${failed} failed`
);

if (failed > 0) process.exit(1);