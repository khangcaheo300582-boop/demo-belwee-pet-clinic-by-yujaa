/* Chụp màn hình trang chủ ở production build để kiểm bằng MẮT (GĐ2A).
   Dùng: node scripts/phase2a-shots.js [baseUrl] [outDir]
*/
'use strict';
const { spawn } = require('child_process');
const fs = require('fs'); const os = require('os'); const path = require('path');

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = process.argv[2] || 'http://localhost:3010';
const OUT = process.argv[3] || path.resolve(__dirname, '..', 'docs', 'gd2a-shots');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-shot-'));
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
      if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result || {}); }
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
  await cmd('Page.enable'); await cmd('Runtime.enable');
  const ev = async (expr) => (await cmd('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.value;

  await cmd('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await cmd('Page.navigate', { url: BASE + '/' });

  // CHỜ INTRO TAN — không đoán bằng số giây.
  // Lần đầu chụp ra toàn màn hình logo trắng: `.intro-video-screen` vẫn đang phủ
  // (video intro mở khoảng 10s, cộng thời gian tải). Chờ tới khi lớp này mang
  // `is-hidden` rồi mới chụp, nếu không ảnh nói gì về trang cả.
  let introDone = false;
  for (let i = 0; i < 40 && !introDone; i++) {
    await sleep(1000);
    introDone = await ev(`(() => {
      const s = document.querySelector('.intro-video-screen');
      if (!s) return true;
      return s.classList.contains('is-hidden') || getComputedStyle(s).opacity === '0'
        || getComputedStyle(s).display === 'none' || !s.isConnected;
    })()`);
  }
  console.log('  intro đã tan:', introDone, `(chờ ${introDone ? 'ok' : 'HẾT GIỜ — ảnh có thể bị overlay che'})`);
  await ev("document.documentElement.style.scrollBehavior='auto'; window.scrollTo({top:0,behavior:'auto'}); 'ok'");
  await sleep(2000);

  const shot = async (name, scrollExpr, label, clipSelector) => {
    if (scrollExpr) { await ev(scrollExpr); await sleep(1600); }
    let params = { format: 'png' };
    if (clipSelector) {
      const box = JSON.parse(await ev(`(() => {
        const el = document.querySelector(${JSON.stringify(clipSelector)});
        if (!el) return 'null';
        const b = el.getBoundingClientRect();
        if (!b.width) return 'null';
        return JSON.stringify({ x: Math.max(0, b.x - 12), y: Math.max(0, b.y - 12), width: b.width + 24, height: b.height + 24, scale: 2 });
      })()`) || 'null');
      if (box) params = { format: 'png', clip: box };
      else console.log('  ⚠ không tìm thấy', clipSelector, '— chụp toàn màn hình');
    }
    const r = await cmd('Page.captureScreenshot', params);
    const file = path.join(OUT, `${name}.png`);
    fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
    console.log('  ✓', label, '→', file);
  };

  await shot('01-hero', null, 'hero (tiêu đề kính §24)');
  await shot('02-a2-pill', "document.querySelector('.service-stage-3d').closest('section').querySelector('.glass-pill').scrollIntoView({block:'center',behavior:'auto'}); 'ok'", 'A2 — pill điều khiển coverflow');
  await shot('03-a4-pill', "document.querySelector('a[href=\"/doi-ngu\"] .glass-pill')?.scrollIntoView({block:'center',behavior:'auto'}); 'ok'", 'A4 — pill \"Chúng tôi là ai?\"');
  await shot('04-a3-knowledge', "document.getElementById('vet-knowledge').scrollIntoView({block:'start',behavior:'auto'}); 'ok'", 'A3 — dải kiến thức + thanh tiến độ');
  await shot('05-a5-stats', "document.querySelector('.stats-surface').scrollIntoView({block:'center',behavior:'auto'}); 'ok'", 'A5 — dải số liệu');
  await shot('06-a1-crossfade', "window.scrollTo({top: Math.round(window.innerHeight*0.66), behavior:'auto'}); 'ok'", 'A1 — ranh giới video ↔ ảnh nền');
await shot('07-a6-heading-contrast', "document.getElementById('why-belwee').scrollIntoView({block:'center',behavior:'auto'}); 'ok'", 'A6 — tiêu đề + mô tả (kiểm tương phản)', '#why-belwee > div > div[data-reveal]');

  try { child.kill(); } catch {}
})();