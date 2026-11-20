/**
 * A/B attribution probe (temporary): scroll homepage at constant velocity and
 * measure frame intervals with individual render layers disabled.
 * Run: node scripts/perf/ab-scroll.mjs
 */
import { chromium } from "playwright";

const BASE = "http://localhost:3001";
const DURATION = 9000;

const TWO_BLOBS_OFF = ".apple-mesh-blob.is-a2,.apple-mesh-blob.is-a3{display:none!important}";
const TINY_PARTICLE = "document.querySelectorAll('canvas').forEach(c=>{c.width=1;c.height=1})";

const VARIANTS = [
  { name: "warmup", css: "", js: "" },
  { name: "base", css: "", js: "" },
  { name: "mesh-static", css: ".apple-mesh-blob{animation:none!important}", js: "" },
  {
    name: "mesh-static-1",
    css: `.apple-mesh-blob{animation:none!important}${TWO_BLOBS_OFF}`,
    js: "",
  },
  { name: "mesh-on-1", css: TWO_BLOBS_OFF, js: "" },
  { name: "no-mesh", css: ".apple-mesh-bg{display:none!important}", js: "" },
  {
    name: "static+tiny",
    css: ".apple-mesh-blob{animation:none!important}",
    js: TINY_PARTICLE,
  },
  { name: "no-mesh+tiny", css: ".apple-mesh-bg{display:none!important}", js: TINY_PARTICLE },
];

const browser = await chromium.launch({ headless: true, channel: "chromium" });
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 1,
  serviceWorkers: "block",
});
const page = await context.newPage();

for (const variant of VARIANTS) {
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page
    .waitForFunction(() => !document.querySelector(".intro-video-screen, .intro-overlay"), null, {
      timeout: 30000,
    })
    .catch(() => {});
  await page.waitForTimeout(500);
  if (variant.css) await page.addStyleTag({ content: variant.css });
  if (variant.js) await page.evaluate(variant.js);
  await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = "auto";
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(400);

  const result = await page.evaluate(async (duration) => {
    const frames = [];
    const max = document.documentElement.scrollHeight - window.innerHeight;
    let last = performance.now();
    let start = last;
    return await new Promise((resolve) => {
      function step(now) {
        if (now - start > 500) frames.push(now - last);
        last = now;
        const t = now - start;
        window.scrollTo({ top: Math.min(max, (t / duration) * max), behavior: "instant" });
        if (t < duration) requestAnimationFrame(step);
        else resolve({ frames, scrollHeight: max, finalY: window.scrollY });
      }
      requestAnimationFrame(step);
    });
  }, DURATION);

  const f = result.frames.slice().sort((a, b) => a - b);
  const n = f.length;
  const sum = f.reduce((a, b) => a + b, 0);
  const avg = sum / n;
  const p95 = f[Math.floor(n * 0.95)];
  const worst = f[n - 1];
  const over50 = f.filter((x) => x > 50).length;
  console.log(
    `${variant.name.padEnd(14)} fps=${(1000 / avg).toFixed(1).padStart(5)} p95=${p95.toFixed(1).padStart(6)} worst=${worst.toFixed(1).padStart(7)} >50=${String(over50).padStart(3)} frames=${n} y=${Math.round(result.finalY)}/${Math.round(result.scrollHeight)}`
  );
}

await browser.close();
