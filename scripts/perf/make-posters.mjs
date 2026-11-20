/**
 * Trích poster từ chính khung hình video hero (không thay thế video gốc).
 * Chạy: node scripts/perf/make-posters.mjs  (cần server ở localhost:3001)
 * Ghi ra public/belwee-hero-poster.jpg và public/belwee-super-poster.jpg
 */
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const BASE = "http://localhost:3001";
const JOBS = [
  { src: "/belwee-hero.mp4", out: "public/belwee-hero-poster.jpg", at: 1.2 },
  { src: "/belwee-super.mp4", out: "public/belwee-super-poster.jpg", at: 0.6 },
];

const browser = await chromium.launch({ headless: true, channel: "chromium" });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });

for (const job of JOBS) {
  const dataUrl = await page.evaluate(async ({ src, at }) => {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = src;
    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("timeout loading " + src)), 30000);
      video.addEventListener("loadeddata", () => { clearTimeout(t); resolve(); }, { once: true });
      video.addEventListener("error", () => { clearTimeout(t); reject(new Error("error " + src)); }, { once: true });
    });
    await new Promise((resolve) => {
      const done = () => resolve();
      video.addEventListener("seeked", done, { once: true });
      video.currentTime = Math.min(at, (video.duration || at) * 0.25);
    });
    const canvas = document.createElement("canvas");
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext("2d");
    const scale = Math.max(canvas.width / video.videoWidth, canvas.height / video.videoHeight);
    const w = video.videoWidth * scale;
    const h = video.videoHeight * scale;
    ctx.drawImage(video, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
    return { data: canvas.toDataURL("image/jpeg", 0.82), w: video.videoWidth, h: video.videoHeight, dur: video.duration };
  }, { src: job.src, at: job.at });

  const base64 = dataUrl.data.split(",")[1];
  writeFileSync(job.out, Buffer.from(base64, "base64"));
  console.log(`${job.out}  source=${dataUrl.w}x${dataUrl.h}  duration=${dataUrl.dur.toFixed(1)}s`);
}

await browser.close();
