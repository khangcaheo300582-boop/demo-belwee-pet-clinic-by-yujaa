import { chromium } from "playwright-core";

const BASE = process.env.BASE_URL ?? "http://localhost:3001";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 200)); });

const t0 = Date.now();
await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });

const preload = await page.evaluate(() =>
  [...document.querySelectorAll('link[rel="preload"]')].map((l) => ({
    href: l.getAttribute("href"),
    as: l.getAttribute("as"),
    fp: l.getAttribute("fetchpriority"),
  }))
);
console.log("preload links:", JSON.stringify(preload));
console.log("seed:", await page.evaluate(() => window.__belweeIntroVideoIndex));

const marks = {};
const record = (k) => {
  if (!marks[k]) {
    marks[k] = Date.now() - t0;
    console.log(`${String(marks[k]).padStart(6)}  ${k}`);
  }
};

for (let i = 0; i < 220; i++) {
  const s = await page.evaluate(() => {
    const q = (sel) => document.querySelector(sel);
    const op = (el) => (el ? Number(getComputedStyle(el).opacity) : 0);
    const vis = (el) => (el ? Number(getComputedStyle(el).opacity) > 0.5 : false);
    const screen = q(".intro-video-screen");
    const video = q("#intro-video");
    const chars = [...document.querySelectorAll(".hero-title .hero-char")];
    const subChars = [...document.querySelectorAll(".hero-type-char")];
    return {
      videoMounted: !!video,
      videoTime: video ? video.currentTime : null,
      playing: video ? !video.paused && !video.ended && video.currentTime > 0 : false,
      ended: !!video?.ended,
      prerollDone: q(".intro-video-preroll")?.classList.contains("is-done") ?? null,
      screenOpacity: op(screen),
      screenGone: !screen,
      titleVisible: chars.filter((c) => Number(getComputedStyle(c).opacity) > 0.5).length,
      titleTotal: chars.length,
      titleFirstTransform: chars[0] ? getComputedStyle(chars[0]).transform : null,
      accentScale: q(".hero-char--accent") ? getComputedStyle(q(".hero-char--accent")).transform : null,
      subVisible: subChars.filter((c) => Number(getComputedStyle(c).opacity) > 0.5).length,
      subTotal: subChars.length,
      cta: op(q(".hero-cta")),
      dock: [...document.querySelectorAll(".hero-dock li")].map((li) => op(li)),
      cue: op(q(".hero-scroll-cue")),
      bodyIntro: document.body.classList.contains("intro-playing"),
      inert: q("main")?.parentElement?.hasAttribute("inert") ?? null,
      sheen: q(".hero-title")?.classList.contains("is-revealed") || q(".hero")?.classList.contains("is-revealed"),
    };
  }).catch((e) => ({ evalError: String(e).slice(0, 80) }));

  if (s.preload) {}
  if (s.videoMounted) record("video element mounted");
  if (s.playing) record("video playing");
  if (s.prerollDone) record("preroll hidden (playing)");
  if (s.ended) record("video ended");
  if (s.screenOpacity > 0 && s.screenOpacity < 0.99) record("overlay fading");
  if (s.screenGone) record("overlay removed");
  if (s.titleVisible > 0) record("title chars appearing");
  if (s.titleTotal > 0 && s.titleVisible === s.titleTotal) record("title fully visible");
  if (s.subVisible > 0) record("subtitle typing starts");
  if (s.subVisible === s.subTotal && s.subTotal > 0) record("subtitle typed fully");
  if (s.cta > 0.9) record("CTA visible");
  if (s.dock.length && s.dock.every((o) => o > 0.9)) record("dock all visible");
  if (s.cue > 0.9) record("scroll cue visible");
  if (s.sheen) record("sheen/is-revealed armed");
  if (s.preload === undefined && !s.evalError && s.ended && s.cue > 0.9) break;
  await page.waitForTimeout(100);
}

console.log("errors:", errors.slice(0, 5));
await browser.close();
