/**
 * scripts/verify-intro-gate.ts
 *
 * Kiểm chứng bốn tình huống của cổng video intro (Mục 5.5 / G1):
 *
 *   (a) Mở hoặc F5 ở Trang chủ            → intro CHẠY
 *   (b) Điều hướng từ trang khác về "/"    → intro CHẠY
 *   (c) Mở thẳng trang khác               → intro KHÔNG chạy, nội dung hiện ngay
 *   (d) Rời khỏi "/" khi intro đang chạy  → trang được mở khoá (không kẹt inert)
 *
 * Vì sao cần script này: (d) là trường hợp dễ hỏng nhất — `IntroVideo` đặt
 * `inert` + `aria-hidden` lên wrapper của trang, và khoá cuộn bằng class
 * `intro-playing` trên <body>. Nếu ai đó sau này đổi cổng mà quên cleanup, người
 * dùng sẽ thấy trang "bấm không ăn" — đúng triệu chứng mà chính comment trong
 * IntroVideo.tsx cảnh báo. Test này bắt đúng lỗi đó.
 *
 * Chạy:  npx tsx scripts/verify-intro-gate.ts
 * Cần:   dev server đang chạy ở PORT (mặc định 3001)
 */

import { chromium, type Page } from "playwright-core";

const BASE = process.env.BASE_URL ?? `http://localhost:${process.env.PORT ?? 3001}`;

const INTRO = ".intro-video-screen, .intro-overlay";

interface Probe {
  url: string;
  introUp: boolean;
  inert: boolean;
  ariaHidden: string | null;
  bodyLocked: boolean;
  mainOpacity: string;
  anchors: number;
}

async function probe(page: Page): Promise<Probe> {
  return page.evaluate((introSel) => {
    const wrapper = document.querySelector("main")?.parentElement;
    const main = document.querySelector("main");
    return {
      url: location.pathname,
      introUp: !!document.querySelector(introSel),
      inert: wrapper?.hasAttribute("inert") ?? false,
      ariaHidden: wrapper?.getAttribute("aria-hidden") ?? null,
      bodyLocked: document.body.classList.contains("intro-playing"),
      mainOpacity: main ? getComputedStyle(main).opacity : "n/a",
      anchors: document.querySelectorAll("a").length,
    };
  }, INTRO);
}

/** Trang có dùng được (không bị kẹt) không: không inert, không khoá cuộn. */
function isUnlocked(p: Probe): boolean {
  return !p.inert && !p.bodyLocked && p.mainOpacity !== "0";
}

let failures = 0;
function check(name: string, ok: boolean, detail: unknown) {
  if (ok) {
    console.log(`  PASS  ${name}`);
  } else {
    failures += 1;
    console.log(`  FAIL  ${name}`);
    console.log(`        ${JSON.stringify(detail)}`);
  }
}

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext();

  // ── (c) Mở thẳng trang khác: KHÔNG intro, nội dung dùng được ngay ──────────
  console.log("\n(c) Mo thang trang khac — khong intro, noi dung dung ngay");
  {
    const page = await context.newPage();
    await page.goto(`${BASE}/lien-he`, { waitUntil: "domcontentloaded" });
    // Không chờ: nếu intro chạy ở đây thì overlay phải xuất hiện ngay.
    await page.waitForTimeout(2500);
    const p = await probe(page);
    check("khong co overlay intro", p.introUp === false, p);
    check("trang khong bi ket inert", isUnlocked(p), p);
    check("khong khoa cuon body", p.bodyLocked === false, p);
    check("noi dung co that su (co <a>)", p.anchors > 0, p);
    await page.close();
  }

  // ── (a) F5 ở Trang chủ: intro CHẠY ──────────────────────────────────────
  console.log("\n(a) F5 o Trang chu — intro phai chay");
  {
    const page = await context.newPage();
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    // `state: "attached"` chứ không phải mặc định "visible": overlay tan bằng
    // opacity nên khoảnh khắc script chạy tới nó có thể đang ở opacity 0 —
    // đó vẫn là "intro có chạy", chỉ là đang fade. Cần nó CÓ MẶT trong DOM.
    const appeared = await page
      .waitForSelector(INTRO, { state: "attached", timeout: 8000 })
      .then(() => true)
      .catch(() => false);
    check("overlay intro xuat hien", appeared, await probe(page));
    await page.close();
  }

  // ── (b) Điều hướng từ trang khác về "/" : intro CHẠY ─────────────────────
  console.log("\n(b) Dieu huong tu trang khac ve / — intro phai chay");
  {
    const page = await context.newPage();
    await page.goto(`${BASE}/lien-he`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    // Bấm link "Trang chủ" ở navbar (bỏ qua link trong footer).
    // Dùng page.click thay vì page.evaluate(() => el.click()) để Playwright
    // gửi đầy đủ chuỗi sự kiện chuột (mousedown/mouseup/click) mà React's
    // synthetic event system cần để kích hoạt onClick trên <Link>.
    await page.click('header a[href="/"]:not(footer a)', { timeout: 10000 });

    const appeared = await page
      .waitForSelector(INTRO, { state: "attached", timeout: 10000 })
      .then(() => true)
      .catch(() => false);
    const p = await probe(page);
    check("da den Trang chu", p.url === "/", p);
    check("overlay intro xuat hien", appeared, p);
    await page.close();
  }

  // ── (d) Rời khỏi "/" khi intro đang chạy → phải mở khoá ──────────────────
  console.log("\n(d) Roi khoi Trang chu khi intro dang chay — trang phai mo khoa");
  {
    const page = await context.newPage();
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(INTRO, { state: "attached", timeout: 8000 }).catch(() => null);

    // `history.back()` đi qua ngoài DOM nên `inert` không chặn được — đây là
    // đường thoát mà người dùng thật sự có thể dùng trong lúc intro chạy.
    await page.goBack({ waitUntil: "domcontentloaded" }).catch(() => null);
    await page.waitForTimeout(1500);

    const p = await probe(page);
    check("khong con overlay intro", p.introUp === false, p);
    check("da go khoi Trang chu", p.url !== "/", p);
    check("khong ket inert", isUnlocked(p), p);
    check("aria-hidden da duoc go", p.ariaHidden === null, p);
    await page.close();
  }

  await context.close();
  await browser.close();

  console.log(`\n${failures === 0 ? "TAT CA KIEM TRA DANG CHAY PASS" : `${failures} KIEM TRA FAIL`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});