import { chromium } from "playwright-core";

const BASE = process.env.BASE_URL ?? "http://localhost:3001";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(8000);

console.log(
  await page.evaluate(() => {
    const v = document.querySelector("#intro-video");
    return {
      canHevc: document.createElement("video").canPlayType('video/mp4; codecs="hvc1.1.6.L93.B0"'),
      canH264: document.createElement("video").canPlayType('video/mp4; codecs="avc1.42E01E"'),
      hasVideo: !!v,
      w: v?.videoWidth,
      h: v?.videoHeight,
      duration: v?.duration,
      t: v?.currentTime,
      paused: v?.paused,
      decoded: v?.webkitDecodedFrameCount,
      dropped: v?.webkitDroppedFrameCount,
    };
  })
);

// Wait until the intro video has played ~2s then sample the actual pixels.
await page
  .waitForFunction(
    () => {
      const v = document.querySelector("#intro-video");
      return v && v.currentTime > 2;
    },
    { timeout: 30000 }
  )
  .catch(() => console.log("never reached t>2"));

const pixels = await page.evaluate(() => {
  const v = document.querySelector("#intro-video");
  if (!v) return null;
  const c = document.createElement("canvas");
  c.width = 160;
  c.height = 90;
  const ctx = c.getContext("2d");
  try {
    ctx.drawImage(v, 0, 0, c.width, c.height);
  } catch (e) {
    return { error: String(e) };
  }
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  let nonBlack = 0;
  let max = 0;
  for (let i = 0; i < d.length; i += 4) {
    const l = d[i] + d[i + 1] + d[i + 2];
    if (l > 24) nonBlack++;
    if (l > max) max = l;
  }
  return { nonBlackPct: ((nonBlack / (c.width * c.height)) * 100).toFixed(1), max, readyState: v.readyState, decoded: v.webkitDecodedFrameCount };
});
console.log("intro frame pixels:", pixels);

await browser.close();
