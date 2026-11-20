import { chromium } from "playwright-core";

const BASE = process.env.BASE_URL ?? "http://localhost:3001";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const t0 = Date.now();
await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });

const sample = () =>
  page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const op = (el) => (el ? Number(getComputedStyle(el).opacity) : null);
    const chars = [...document.querySelectorAll(".hero-title .hero-char")];
    const subChars = [...document.querySelectorAll(".hero-type-char")];
    const screen = q(".intro-video-screen");
    const video = q("#intro-video");
    return {
      screen: op(screen),
      ending: screen?.classList.contains("is-hidden") ?? null,
      vidT: video ? Number(video.currentTime.toFixed(2)) : null,
      ended: video?.ended ?? null,
      titleVisible: chars.filter((c) => Number(getComputedStyle(c).opacity) > 0.5).length,
      titleStyle: chars[0]?.getAttribute("style") ?? null,
      titleTransform: chars[0] ? getComputedStyle(chars[0]).transform : null,
      subVisible: subChars.filter((c) => Number(getComputedStyle(c).opacity) > 0.5).length,
      cta: op(q(".hero-cta")),
      dock: [...document.querySelectorAll(".hero-dock li")].map((li) => op(li)),
      cue: op(q(".hero-scroll-cue")),
    };
  });

let last = "";
for (let i = 0; i < 160; i++) {
  const s = await sample().catch((e) => ({ err: String(e).slice(0, 80) }));
  const key = JSON.stringify(s);
  if (key !== last) {
    console.log(String(Date.now() - t0).padStart(6), key);
    last = key;
  }
  if (s.ended && s.screen === 0 && (s.cue ?? 0) > 0.9) break;
  await page.waitForTimeout(120);
}
await browser.close();
