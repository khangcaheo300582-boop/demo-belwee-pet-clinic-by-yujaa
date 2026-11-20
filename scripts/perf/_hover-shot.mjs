import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true, channel: "chromium" });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  serviceWorkers: "block",
});
const page = await context.newPage();
await page.goto("http://localhost:3001/", { waitUntil: "domcontentloaded", timeout: 60000 });
await page
  .waitForFunction(() => !document.querySelector(".intro-video-screen, .intro-overlay"), null, {
    timeout: 30000,
  })
  .catch(() => {});
await page.waitForTimeout(1200);
await page.evaluate(() => {
  document.documentElement.style.scrollBehavior = "auto";
  document.querySelectorAll("video").forEach((v) => v.pause());
  window.scrollTo({ top: 0, behavior: "instant" });
});
await page.waitForTimeout(900);

const links = page.locator(".site-global-nav .site-global-link");
const target = links.nth(1);
const box = await target.boundingBox();
console.log("target box", box, "text", await target.textContent());

await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.waitForTimeout(700);
const state = await page.evaluate(() => {
  const pill = document.querySelector(".site-global-hover-pill");
  const target = document.querySelectorAll(".site-global-nav .site-global-link")[1];
  if (!pill) return { pill: null };
  const cs = getComputedStyle(pill);
  const r = pill.getBoundingClientRect();
  return {
    pill: {
      inlineOpacity: pill.style.opacity,
      inlineTransform: pill.style.transform,
      opacity: cs.opacity,
      transform: cs.transform,
      background: cs.backgroundImage.slice(0, 120),
      rect: { x: r.x, y: r.y, w: r.width, h: r.height },
      zIndex: cs.zIndex,
    },
    target: {
      color: getComputedStyle(target).color,
      rect: target.getBoundingClientRect().toJSON(),
    },
  };
});
console.log(JSON.stringify(state, null, 2));

const navBox = await page.locator(".site-global-nav").boundingBox();
await page.screenshot({ path: "docs/perf/nav-hover-top.png", clip: { ...navBox, height: navBox.height + 10 } });

await page.evaluate(() => window.scrollTo({ top: 900, behavior: "instant" }));
await page.waitForTimeout(1000);
await page.mouse.move(10, 500);
await page.waitForTimeout(200);
const box2 = await links.nth(1).boundingBox();
await page.mouse.move(box2.x + box2.width / 2, box2.y + box2.height / 2);
await page.waitForTimeout(700);
const navBox2 = await page.locator(".site-global-nav").boundingBox();
await page.screenshot({ path: "docs/perf/nav-hover-scrolled.png", clip: { ...navBox2, height: navBox2.height + 10 } });
console.log(
  "pill after scroll",
  await page.evaluate(() => {
    const pill = document.querySelector(".site-global-hover-pill");
    return { inlineOpacity: pill?.style.opacity, inlineTransform: pill?.style.transform };
  })
);

await browser.close();
