import { chromium } from 'playwright-core';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const pending = new Map();
page.on('request', r => pending.set(r.url(), Date.now()));
page.on('requestfinished', r => pending.delete(r.url()));
page.on('requestfailed', r => pending.delete(r.url()));
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message.slice(0, 300)));
try {
  await page.goto('http://localhost:3001/dich-vu', { waitUntil: 'domcontentloaded', timeout: 30000 });
  console.log('domcontentloaded OK');
} catch (e) { console.log('DCL timeout:', e.message.slice(0,120)); }
await page.waitForTimeout(12000);
console.log('--- still pending after 12s ---');
for (const [u, t] of pending) console.log('  ', Math.round((Date.now()-t)/1000)+'s', u.slice(0, 150));
console.log('--- console errors:', errors.length);
errors.slice(0,5).forEach(e => console.log('  !', e));
const res = await page.evaluate(() => ({
  imgs: [...document.images].filter(i => !i.complete).map(i => i.currentSrc || i.src),
  videos: [...document.querySelectorAll('video')].map(v => ({ src: v.currentSrc || v.src, ready: v.readyState })),
  fonts: document.fonts.status,
})).catch(() => ({}));
console.log('--- incomplete resources ---');
console.log(JSON.stringify(res, null, 1));
await browser.close();
