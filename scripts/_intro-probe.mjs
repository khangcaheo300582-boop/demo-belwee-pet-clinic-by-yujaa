import { chromium } from "playwright-core";

const BASE = process.env.BASE_URL ?? "http://localhost:3001";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

page.on("console", (m) => {
  if (m.type() === "error") console.log("CONSOLE ERROR:", m.text().slice(0, 200));
});
page.on("pageerror", (e) => console.log("PAGE ERROR:", String(e).slice(0, 300)));

const t0 = Date.now();
await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });

const sample = async () =>
  page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const op = (el) => (el ? Number(getComputedStyle(el).opacity) : null);
    const screen = q(".intro-video-screen");
    const video = q("#intro-video");
    const chars = [...document.querySelectorAll(".hero-title .hero-char")];
    const subChars = [...document.querySelectorAll(".hero-type-char")];
    const dockItems = [...document.querySelectorAll(".hero-dock li")];
    return {
      introPhaseClass: screen ? screen.className : null,
      screenOpacity: op(screen),
      video: video
        ? { t: Number(video.currentTime.toFixed(2)), ended: video.ended, paused: video.paused, rs: video.readyState, err: video.error?.code ?? null }
        : null,
      bodyIntro: document.body.classList.contains("intro-playing"),
      titleFirst: op(chars[0]),
      titleCharsVisible: chars.filter((c) => Number(getComputedStyle(c).opacity) > 0.5).length,
      titleTotal: chars.length,
      subVisible: subChars.filter((c) => Number(getComputedStyle(c).opacity) > 0.5).length,
      subTotal: subChars.length,
      cta: op(q(".hero-cta")),
      dock: dockItems.map((li) => op(li)),
      cue: op(q(".hero-scroll-cue")),
      shellInert: q("main")?.parentElement?.hasAttribute("inert") ?? null,
      heroTitleVisible: op(q(".hero-title")),
    };
  });

const rows = [];
for (let i = 0; i < 120; i++) {
  const s = await sample().catch((e) => ({ err: String(e).slice(0, 100) }));
  rows.push({ ms: Date.now() - t0, ...s });
  if (i > 20 && s.screenOpacity === 0 && (s.dock?.[3] ?? 0) > 0.9 && (s.cue ?? 0) > 0.9) break;
  await page.waitForTimeout(100);
}

for (const r of rows) {
  if (r.ms % 300 > 120) continue;
  console.log(
    `${String(r.ms).padStart(5)} op=${r.screenOpacity} cls=${(r.introPhaseClass || "").replace("intro-video-screen", "").trim()} vid=${r.video ? r.video.t + (r.video.ended ? "E" : "") + (r.video.paused ? "P" : "") : "-"} title=${r.titleFirst}/${r.titleCharsVisible}/${r.titleTotal} sub=${r.subVisible}/${r.subTotal} cta=${r.cta} dock=${JSON.stringify(r.dock)} cue=${r.cue} inert=${r.shellInert} bodyIntro=${r.bodyIntro}`
  );
}

await browser.close();
