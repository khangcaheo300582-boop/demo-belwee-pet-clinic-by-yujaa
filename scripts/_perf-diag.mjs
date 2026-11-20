import { chromium } from "playwright";

const BASE = "http://localhost:3001";

const INIT = () => {
  window.__perf = { frames: [], longtasks: [], marks: [], nav: 0 };
  let last = null;
  const tick = (t) => {
    if (last !== null) window.__perf.frames.push([t, t - last]);
    last = t;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  window.__perf.mark = (name) => {
    window.__perf.marks.push({ name, t: performance.now() });
  };
  window.__perf.reset = () => {
    window.__perf.frames = [];
    window.__perf.longtasks = [];
    window.__perf.marks = [];
  };
};

const snap = (p) =>
  p.evaluate(() => ({
    perf: !!window.__perf,
    frames: window.__perf?.frames?.length,
    marks: window.__perf?.marks?.length,
    vis: document.visibilityState,
    focus: document.hasFocus(),
    probeN: window.__probe?.n,
    probedoc: window.__probeDoc?.n,
    rdy: document.readyState,
  }));

const waitServer = async () => {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(BASE, { method: "HEAD" });
      if (r.status < 500) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("server not reachable");
};

let browser;
try {
  await waitServer();
  browser = await chromium.launch({
    headless: true,
    channel: "chromium",
    args: [
      "--autoplay-policy=no-user-gesture-required",
      "--disable-background-timer-throttling",
      "--disable-renderer-backgrounding",
      "--disable-backgrounding-occluded-windows",
      "--disable-features=CalculateNativeWinOcclusion",
    ],
  });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  let navs = 0;
  page.on("framenavigated", (f) => {
    if (f === page.mainFrame()) navs++;
  });
  await page.addInitScript(INIT);
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(3000);
  console.log("A", await snap(page), "navs", navs);

  await page.evaluate(() => {
    window.__probe = { n: 0 };
    const f = () => {
      window.__probe.n++;
      requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
    window.__probeDoc = { n: 0 };
    const g = () => {
      window.__probeDoc.n++;
      requestAnimationFrame(g);
    };
    requestAnimationFrame(g);
  });
  await page.waitForTimeout(2000);
  console.log("B", await snap(page), "navs", navs);

  await page.evaluate(() => window.__perf.reset());
  await page.evaluate(() => window.__perf.mark("start"));
  console.log("C-after-mark", await snap(page));
  await page.waitForTimeout(2000);
  console.log("D", await snap(page), "navs", navs);

  await page.evaluate(() => window.__perf.mark("end"));
  console.log("E", await page.evaluate(() => ({ marks: window.__perf.marks, frames: window.__perf.frames.length })), "navs", navs);
} catch (e) {
  console.error("DIAG-ERROR", e?.stack || e);
} finally {
  try {
    await browser?.close();
  } catch {}
  process.exit(0);
}
