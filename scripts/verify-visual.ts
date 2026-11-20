/**
 * Visual verification: homepage intro + hero reveal.
 * Checks autoplay state, video progress, and hero reveal.
 */
import { chromium } from "playwright-core";

const BASE = `http://localhost:3001`;

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.type() === "warning")
      console.log("[PAGE]", msg.type(), msg.text());
  });

  console.log("=== Going to / ===");
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });

  // Wait for intro overlay to appear
  await page.waitForSelector(".intro-video-screen", { state: "attached", timeout: 10000 });
  console.log("Intro overlay appeared");

  // Check initial state: video element, autoplay classes, play button
  const initialState = await page.evaluate(() => {
    const v = document.querySelector("video#intro-video") as HTMLVideoElement | null;
    const screen = document.querySelector(".intro-video-screen");
    const playBtn = document.querySelector(".intro-play-btn");
    const classes = screen ? screen.className : "";
    return {
      hasVideo: !!v,
      videoPaused: v ? v.paused : null,
      videoCurrentTime: v ? v.currentTime : null,
      videoDuration: v ? v.duration : null,
      hasPlayButton: !!playBtn,
      screenClasses: classes,
      hasIntroVideoJs: classes.includes("intro-video-js"),
      hasAutoplayBlocked: classes.includes("intro-autoplay-blocked"),
      hasVideoPlaying: classes.includes("intro-video-playing"),
      bodyHasIntroPlaying: document.body.classList.contains("intro-playing"),
    };
  });
  console.log("Initial state:", JSON.stringify(initialState, null, 2));

  // Screenshot: intro playing
  await page.screenshot({ path: "C:\\Users\\khang\\AppData\\Local\\Temp\\opencode\\intro-playing.png", fullPage: true });
  console.log("Screenshot: intro-playing.png");

  // If autoplay blocked, click the play button
  if (initialState.hasPlayButton) {
    console.log("Autoplay blocked — clicking play button");
    await page.click(".intro-play-btn");
    await page.waitForTimeout(1000);
  }

  // Wait for video to end (~8.3s) + fade (700ms) = ~9s, plus buffer
  console.log("Waiting ~11s for video to end + fade + reveal...");
  await page.waitForTimeout(11000);

  // Check state after video should have ended
  const afterVideo = await page.evaluate(() => {
    const v = document.querySelector("video#intro-video") as HTMLVideoElement | null;
    const screen = document.querySelector(".intro-video-screen");
    const hero = document.querySelector(".hero");
    const title = document.querySelector(".hero-title");
    const subtitle = document.querySelector(".hero-subtitle");
    const cta = document.querySelector(".hero-cta");
    const dock = document.querySelector(".hero-dock");
    const introScreen = document.querySelector(".intro-video-screen");
    return {
      videoEnded: v ? v.ended : null,
      videoPaused: v ? v.paused : null,
      screenGone: introScreen ? introScreen.classList.contains("is-gone") : null,
      screenPresent: !!introScreen,
      heroIsRevealed: hero ? hero.classList.contains("is-revealed") : null,
      bodyNotPlaying: !document.body.classList.contains("intro-playing"),
      hasTitle: !!title,
      hasSubtitle: !!subtitle,
      hasCTA: !!cta,
      hasDock: !!dock,
      titleChars: title ? title.querySelectorAll(".hero-char").length : 0,
      subtitleChars: subtitle ? subtitle.querySelectorAll(".hero-subtitle-char").length : 0,
      titleMeasured: title?.getAttribute("data-hero-measured"),
    };
  });
  console.log("After video state:", JSON.stringify(afterVideo, null, 2));

  // Screenshot: after reveal
  await page.screenshot({ path: "C:\\Users\\khang\\AppData\\Local\\Temp\\opencode\\after-reveal.png", fullPage: true });
  console.log("Screenshot: after-reveal.png");

  // Check gradient continuity on title chars
  const gradientInfo = await page.evaluate(() => {
    const chars = document.querySelectorAll(".hero-char");
    if (chars.length === 0) return { noChars: true };
    const samples = [];
    for (let i = 0; i < Math.min(5, chars.length); i++) {
      const cs = getComputedStyle(chars[i]);
      samples.push({
        idx: i,
        char: chars[i].textContent,
        bgImage: cs.backgroundImage.slice(0, 80),
        bgPositionX: cs.backgroundPositionX,
        opacity: cs.opacity,
        transform: cs.transform,
      });
    }
    return { totalChars: chars.length, samples };
  });
  console.log("Gradient info:", JSON.stringify(gradientInfo, null, 2));

  // Check a11y
  const a11y = await page.evaluate(() => {
    const h1 = document.querySelector(".hero-title h1");
    const visibleChars = document.querySelectorAll(".hero-char[aria-hidden='true']").length;
    const srOnly = document.querySelector(".sr-only");
    return {
      h1AriaLabel: h1 ? h1.getAttribute("aria-label") : null,
      visibleCharsAriaHidden: visibleChars,
      hasSrOnly: !!srOnly,
      subtitleSrOnly: document.querySelector(".hero-subtitle .sr-only") ? true : false,
    };
  });
  console.log("A11y:", JSON.stringify(a11y, null, 2));

  // Check diacritics
  const diacritics = await page.evaluate(() => {
    const text = document.body.textContent || "";
    const vn = text.match(/[áàảãạâấầẩẫậăắằẳẵặéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỵđ]/gi);
    return { hasVietnamese: !!vn, sample: vn ? vn.slice(0, 8).join("") : "" };
  });
  console.log("Diacritics:", JSON.stringify(diacritics));

  // Check caret
  const caret = await page.evaluate(() => {
    const caret = document.querySelector(".hero-subtitle-caret");
    return caret ? { hasCaret: true, opacity: getComputedStyle(caret).opacity } : { hasCaret: false };
  });
  console.log("Caret:", JSON.stringify(caret));

  // Check pointer parallax
  await page.mouse.move(700, 400);
  await page.waitForTimeout(500);
  const parallax = await page.evaluate(() => {
    const ambient = document.querySelector(".hero-ambient");
    return ambient ? { hasAmbient: true, hasInlineStyle: !!ambient.getAttribute("style") } : { hasAmbient: false };
  });
  console.log("Parallax:", JSON.stringify(parallax));

  // Final screenshot
  await page.screenshot({ path: "C:\\Users\\khang\\AppData\\Local\\Temp\\opencode\\final-state.png", fullPage: true });
  console.log("Screenshot: final-state.png");

  await browser.close();
  console.log("DONE");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
