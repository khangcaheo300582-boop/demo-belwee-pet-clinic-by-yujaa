/* Ảnh xác nhận GĐ3 — thanh 3 mục + nút "Thêm" + thẻ D.
 * Dùng: node scripts/phase3-shots.js [baseUrl] [outDir]
 */
'use strict';
const { spawn } = require('child_process');
const fs = require('fs'); const os = require('os'); const path = require('path');
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = process.argv[2] || 'http://localhost:3010';
const OUT = process.argv[3] || path.resolve(__dirname, '..', 'docs', 'gd3-shots');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-s3-'));
  const child = spawn(CHROME, ['--headless=new', '--remote-debugging-pipe', '--no-first-run',
    '--no-default-browser-check', '--disable-gpu', '--autoplay-policy=no-user-gesture-required',
    '--force-device-scale-factor=1', `--user-data-dir=${dir}`, 'about:blank'],
    { stdio: ['pipe', 'pipe', 'pipe', 'pipe', 'pipe'] });
  let buf = ''; const pending = new Map(); let id = 0;
  child.stdio[4].setEncoding('utf8');
  child.stdio[4].on('data', (chunk) => {
    buf += chunk; let i;
    while ((i = buf.indexOf('\0')) !== -1) {
      const p = buf.slice(0, i); buf = buf.slice(i + 1);
      if (!p) continue;
      let m; try { m = JSON.parse(p); } catch { continue; }
      if (m.id && pending.has(m.id)) {
        const { res, rej } = pending.get(m.id); pending.delete(m.id);
        m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result || {});
      }
    }
  });
  const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
    const n = ++id; pending.set(n, { res, rej });
    const msg = { id: n, method, params }; if (sessionId) msg.sessionId = sessionId;
    child.stdio[3].write(JSON.stringify(msg) + '\0');
  });
  const { targetInfos } = await send('Target.getTargets');
  const page = targetInfos.find((t) => t.type === 'page');
  const { sessionId } = await send('Target.attachToTarget', { targetId: page.targetId, flatten: true });
  const cmd = (m, p) => send(m, p, sessionId);
  const ev = async (e) => {
    const r = await cmd('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('eval: ' + String(r.exceptionDetails.exception?.description || r.exceptionDetails.text).slice(0, 220));
    const v = r.result.value;
    if (typeof v !== 'string') return v;
    try { return JSON.parse(v); } catch { return v; }
  };
  const waitFor = async (sel, ms = 45000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { if (await ev(`!!document.querySelector(${JSON.stringify(sel)})`)) return true; await sleep(600); }
    return false;
  };
  const shot = async (name, clipSelector) => {
    let params = { format: 'png' };
    if (clipSelector) {
      const box = await ev(`(() => {
        const el = document.querySelector(${JSON.stringify(clipSelector)});
        if (!el) return null;
        const b = el.getBoundingClientRect();
        const sy = window.scrollY, sx = window.scrollX;
        if (!b.width) return null;
        return { x: Math.max(0, b.left + sx - 16), y: Math.max(0, b.top + sy - 16), width: b.width + 32, height: b.height + 32, scale: 2 };
      })()`);
      if (box) params = { format: 'png', clip: box };
      else console.log('  ⚠ không thấy', clipSelector);
    }
    const r = await cmd('Page.captureScreenshot', params);
    fs.writeFileSync(path.join(OUT, `${name}.png`), Buffer.from(r.data, 'base64'));
    console.log('  ✓', name);
  };

  await cmd('Page.enable'); await cmd('Runtime.enable');
  await cmd('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await cmd('Page.navigate', { url: BASE + '/' });
  // chờ intro + hiệu ứng vào trang tan (chúng chạy SAU nhau)
  for (let i = 0; i < 45; i++) {
    await sleep(1000);
    const ok = await ev(`(() => {
      const t = document.querySelector('.template-enter');
      const s = document.querySelector('.intro-video-screen');
      return (!s || s.classList.contains('is-hidden') || getComputedStyle(s).display === 'none')
        && (!t || getComputedStyle(t).filter === 'none' || getComputedStyle(t).filter === 'blur(0px)');
    })()`);
    if (ok) break;
  }
  await waitFor('.site-global-links');
  await ev("document.documentElement.style.scrollBehavior='auto'; 'ok'");
  await sleep(2500);

  console.log('desktop 1440');
  await shot('c2-01-navbar', '.site-global-header');

  // mở thẻ danh mục bằng bấm chuột thật
  const box = await ev(`(() => {
    const b = document.querySelector('.site-global-hamburger').getBoundingClientRect();
    return { x: Math.round(b.left + b.width / 2), y: Math.round(b.top + b.height / 2) };
  })()`);
  for (const type of ['mousePressed', 'mouseReleased']) {
    await cmd('Input.dispatchMouseEvent', { type, x: box.x, y: box.y, button: 'left', clickCount: 1 });
  }
  await sleep(2000);
  await shot('c2-02-more-open');

  await ev(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); 'ok'`);
  await sleep(1800);

  // mobile 390
  console.log('mobile 390');
  await cmd('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await sleep(2500);
  await shot('c2-03-navbar-390', '.site-global-header');

  // thẻ D trên /lien-he
  console.log('thẻ D');
  await cmd('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await cmd('Page.navigate', { url: BASE + '/lien-he' });
  await waitFor('.abovefooter-bright', 45000);
  await sleep(2500);
  await shot('d-01-card-lien-he', '.abovefooter-bright');

  // trang chủ: KHÔNG được có thẻ
  await cmd('Page.navigate', { url: BASE + '/' });
  for (let i = 0; i < 45; i++) {
    await sleep(1000);
    const ok = await ev(`(() => {
      const t = document.querySelector('.template-enter');
      const s = document.querySelector('.intro-video-screen');
      return (!s || s.classList.contains('is-hidden') || getComputedStyle(s).display === 'none')
        && (!t || getComputedStyle(t).filter === 'none' || getComputedStyle(t).filter === 'blur(0px)');
    })()`);
    if (ok) break;
  }
  await sleep(2500);
  const homeCard = await ev(`!!document.querySelector('.abovefooter-bright')`);
  console.log('  trang chủ có thẻ D không:', homeCard, homeCard ? '(SAI)' : '(đúng)');

  console.log(`\n  ảnh → ${OUT}`);
  try { child.kill(); } catch {}
})().catch((e) => { console.error('❌ lỗi:', e.message); process.exitCode = 1; });
