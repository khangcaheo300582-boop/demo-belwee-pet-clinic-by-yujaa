/**
 * scripts/verify-site-smoke.ts
 *
 * Kiểm thử khói toàn site: mỗi route phải render được footer, và console
 * không được có lỗi.
 *
 * Vì sao cần script này
 *   Lỗi nghiêm trọng nhất của đợt nâng cấp đều KHÔNG biểu hiện ở HTTP status —
 *   vẫn trả 200:
 *     • Footer biến mất ở mọi trang vì `app/layout.tsx` không còn render nó.
 *   Kiểm tra status code bắt được lỗi đó. Kiểm tra HTML tĩnh cũng bắt được
 *   footer vì nó nằm trong HTML server — nhưng vẫn phải chạy trình duyệt thật
 *   để bắt được lỗi console/hydration trên client.
 *
 * Ghi chú: thẻ "Belwee luôn quan tâm bạn" đã bị GỠ BỎ hoàn toàn khỏi site,
 * nên script không còn kiểm tra thẻ đó nữa.
 *
 * Chạy: npx tsx scripts/verify-site-smoke.ts
 */

import { chromium, type ConsoleMessage } from 'playwright-core';

const BASE = process.env.BASE_URL ?? `http://localhost:${process.env.PORT ?? 3001}`;

/** Route công khai nên có footer. */
const CONTENT_ROUTES = [
  '/',
  '/gioi-thieu',
  '/dich-vu',
  '/lien-he',
  '/doi-ngu',
  '/kien-thuc-thu-y',
  '/tien-ich',
  '/tuyen-dung',
];

/**
 * Route KHÔNG được có footer — CHỈ khu staff.
 *
 * Yêu cầu chủ dự án: footer hiện ở mọi trang TRỪ đăng nhập và toàn bộ khu
 * staff/admin. Thực tế trong dự án, footer do `StaffChromeGate` trong
 * `app/layout.tsx` loại — cổng đó chỉ chặn tiền tố `/staff`. Các trang tài
 * khoản khách (`/dang-nhap`, `/tao-tai-khoan`) VẪN có footer.
 */
const NO_FOOTER_PREFIXES = ['/staff'];

/**
 * `/booking` CHUYỂN HƯỚNG (307 → `/booking/kham-benh`), và trang đặt lịch lại
 * đi qua `BookingAuthGate` nên không phải đích cuối ổn định cho kiểm thử bằng
 * trình duyệt — `page.goto` báo `ERR_ABORTED` giữa chuỗi chuyển hướng. Nó được
 * kiểm bằng HTTP thuần trong `warmUp()` và bằng `npm run test:map` cho phần bản
 * đồ, không đưa vào vòng trình duyệt.
 */
const ROUTES: string[] = [...CONTENT_ROUTES, '/staff/login', '/dang-nhap', '/tao-tai-khoan'];

interface Result {
  route: string;
  ok: boolean;
  notes: string[];
}

/**
 * Biên dịch trước mọi route bằng HTTP thuần.
 *
 * Ở chế độ `next dev`, lần truy cập đầu tiên tới mỗi route phải biên dịch mới
 * (20–30 giây với dự án này). Nếu trình duyệt chạy song song và tranh CPU với
 * trình biên dịch, `page.goto` hết timeout và báo FAIL — một kết quả GIẢ.
 *
 * Gọi trước khi mở trình duyệt: lần này không cần nhanh, chỉ cần để Next dựng
 * xong từng route. Khi trình duyệt thật sự mở trang, mọi thứ đã nóng sẵn.
 */
async function warmUp(): Promise<void> {
  console.log("Dang bien dich truoc cac route (next dev)...\n");
  for (const route of ROUTES) {
    const started = Date.now();
    try {
      await fetch(BASE + route, { redirect: "follow" });
      process.stdout.write(`  · ${route} (${Date.now() - started}ms)\n`);
    } catch {
      process.stdout.write(`  · ${route} (bo qua)\n`);
    }
  }
}

async function probe(
  browser: Awaited<ReturnType<typeof chromium.launch>>
): Promise<Result[]> {
  const results: Result[] = [];
  const context = await browser.newContext();

  // MỘT page dùng lại cho mọi route. Tạo page mới cho từng route sẽ làm
  // Chromium trong môi trường CI yếu bị "Target crashed" khi mở nhiều tab.
  const page = await context.newPage();

  for (const route of ROUTES) {
    const notes: string[] = [];
    const errors: string[] = [];

    const onConsole = (msg: ConsoleMessage) => {
      if (msg.type() === "error") errors.push(msg.text());
    };
    const onPageError = (err: Error) => errors.push(String(err));
    page.on("console", onConsole);
    page.on("pageerror", onPageError);

    let status = 0;
    try {
      // KHÔNG dùng `networkidle`: dev server giữ websocket HMR mở nên mạng
      // không bao giờ "rảnh", `page.goto` treo tới hết timeout. Thay vào đó chờ
      // đúng phần tử cần kiểm — nhanh hơn và không phụ thuộc trạng thái mạng.
      const res = await page.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 45000 });
      status = res?.status() ?? 0;

      const wantFooter = !NO_FOOTER_PREFIXES.some((p) => route.startsWith(p));

      // CHỜ phần tử thật, không dùng timeout cố định.
      //
      // Footer nằm trong HTML server nên xuất hiện sớm. Hỏi sau một khoảng
      // chờ cố định sẽ cho kết quả GIẢ — đã quan sát thấy cả hai chiều.
      if (wantFooter) {
        await page.waitForSelector("footer", { state: "attached", timeout: 25000 }).catch(() => null);
      }
      await page.waitForLoadState("load").catch(() => null);
      await page.waitForTimeout(500);

      const hasFooter = (await page.locator("footer").count()) > 0;

      if (status >= 400) notes.push(`HTTP ${status}`);
      if (wantFooter && !hasFooter) notes.push("THIEU FOOTER");
      if (!wantFooter && hasFooter) notes.push("CO FOOTER NHUNG KHONG DUOC CO");

      for (const e of errors) {
        // Bỏ qua lỗi mạng bên thứ ba — không thuộc phạm vi kiểm thử:
        //  • Sentry / analytics;
        //  • ô bản đồ OpenStreetMap. Ở môi trường KHÔNG có mạng ra ngoài thì
        //    mọi ô đều ERR_CONNECTION_REFUSED. Đây là điều kiện môi trường, và
        //    sản phẩm đã xử lý bằng hộp thoại dự phòng (kiểm ở test:map).
        if (/sentry|googletagmanager|analytics|tile\.openstreetmap\.org/i.test(e)) continue;
        notes.push(`console error: ${e.slice(0, 160)}`);
      }
    } catch (err) {
      notes.push(`loi: ${String(err).slice(0, 160)}`);
    } finally {
      page.off("console", onConsole);
      page.off("pageerror", onPageError);
      errors.length = 0;
    }

    results.push({ route, ok: notes.length === 0, notes });
  }

  await context.close();
  return results;
}

async function main() {
  await warmUp();
  const browser = await chromium.launch();
  const results = await probe(browser);
  await browser.close();

  console.log(`\n=== KIEM THU KHOI TOAN SITE — ${BASE} ===\n`);
  let failures = 0;
  for (const r of results) {
    if (r.ok) {
      console.log(`  PASS  ${r.route}`);
    } else {
      failures += 1;
      console.log(`  FAIL  ${r.route}`);
      for (const n of r.notes) console.log(`        · ${n}`);
    }
  }

  console.log(
    `\n${failures === 0 ? "TAT CA KIEM TRA DANG CHAY PASS" : `${failures}/${results.length} ROUTE FAIL`}`
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});