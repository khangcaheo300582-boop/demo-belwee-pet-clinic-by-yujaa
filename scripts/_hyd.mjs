import { chromium } from 'playwright-core';

async function launch() {
  for (let i = 0; i < 8; i++) {
    try {
      return await chromium.launch({ headless: true });
    } catch {
      await new Promise((r) => setTimeout(r, 1200));
    }
  }
  throw new Error('launch failed');
}

const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const routes = [
  '/dich-vu',
  '/doi-ngu',
  '/doi-ngu/bac-si-nguyen-van-a',
  '/gioi-thieu',
  '/tuyen-dung',
  '/booking/spa-grooming',
];

for (const r of routes) {
  const hits = [];
  const onCons = async (m) => {
    if (m.type() !== 'error') return;
    const s = (await Promise.all(m.args().map((a) => a.jsonValue().catch(() => '')))).join(' ');
    if (/did not match|hydrat/i.test(s)) hits.push(s.slice(0, 90));
  };
  page.on('console', onCons);
  try {
    await page.goto('http://localhost:3001' + r, { waitUntil: 'domcontentloaded', timeout: 25000 });
  } catch {
    console.log(r.padEnd(30), 'NAV FAIL');
    page.off('console', onCons);
    continue;
  }
  await page.waitForTimeout(3500);
  page.off('console', onCons);
  console.log(r.padEnd(30), hits.length ? 'HYDRATION ERRORS: ' + hits.length : 'clean');
  if (process.env.VERBOSE) hits.forEach((h) => console.log('      ↳', h.replace(/\\n/g, ' ').slice(0, 260)));
}

await browser.close();
