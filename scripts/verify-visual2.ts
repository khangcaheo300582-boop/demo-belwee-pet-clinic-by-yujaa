/**
 * Wait longer for intro video to complete, then check full hero reveal.
 */
import { chromium } from "playwright-core";

const BASE = `http://localhost:3001`;

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  page.on("console", (msg) => {
    if (msg.type() === "error")
      console.log("[PAGE ERROR]", msg.text());
  });

  console.log("=== Going to / ===");
  const t0 = Date.now();
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  console.log("domcontentloaded in", Date.now() - t0, "ms");

  // Wait for intro overlay
  await page.waitForSelector(".intro-video-screen", { state: "attached", timeout: 10000 });
  console.log("Intro overlay appeared at", Date.now() - t0, "ms");

  // Wait a generous amount for video (8.3s) + fade (0.7s) + hydration delay
  console.log("Waiting 20s for video + fade + reveal...");
  await page.waitForTimeout(20000);

  const final = await page.evaluate(() => {
    const v = document.querySelector("video#intro-video") as HTMLVideoElement | null;
    const screen = document.querySelector(".intro-video-screen");
    const hero = document.querySelector(".hero");
    const title = document.querySelector(".hero-title");
    const subtitle = document.querySelector(".hero-subtitle");
    const cta = document.querySelector(".hero-cta");
    const dock = document.querySelector(".hero-dock");
    const introScreen = document.querySelector(".intro-video-screen");
    const h1 = document.querySelector("h1.hero-title");
    const chars = document.querySelectorAll(".hero-char");
    const wrapper = document.querySelector(".hero-title__chars");
    const subtitleChars = document.querySelectorAll(".hero-subtitle-char");
    const caret = document.querySelector(".hero-subtitle-caret");
    const ambient = document.querySelector(".hero-ambient");
    return {
      videoEnded: v ? v.ended : null,
      videoPaused: v ? v.paused : null,
      screenGone: introScreen ? introScreen.classList.contains("is-gone") : null,
      screenPresent: !!introScreen,
      heroIsRevealed: hero ? hero.classList.contains("is-revealed") : null,
      bodyNotPlaying: !document.body.classList.contains("intro-playing"),
      hasTitle: !!title,
      h1AriaLabel: h1 ? h1.getAttribute("aria-label") : null,
      charsWrapperAriaHidden: wrapper ? wrapper.getAttribute("aria-hidden") : null,
      totalChars: chars.length,
      subtitleChars: subtitleChars.length,
      hasCaret: !!caret,
      hasAmbient: !!ambient,
      ambientStyle: ambient ? ambient.getAttribute("style") : null,
      titleMeasured: title?.getAttribute("data-hero-measured"),
    };
  });
  console.log("Final state:", JSON.stringify(final, null, 2));

  await page.screenshot({ path: "C:\\Users\\khang\\AppData\\Local\\Temp\\opencode\\final-reveal.png", fullPage: true });
  console.log("Screenshot saved");

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
