/* Ảnh xác nhận các thay đổi sau khi chủ dự án trả lời (GĐ3).
 *  - /gioi-thieu: tiếng Việt từng bị mojibake + "hơn 12 năm"
 *  - trang chủ: dải số liệu 12+ / 30+ / 4 / bài kiến thức
 *  - trang chủ: đã BỎ Closing CTA, còn banner BOOK A SERVICE
 * Dùng: node scripts/phase3-answers-shots.js [baseUrl] [outDir]
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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-ans-'));
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
    if (r.exceptionDetails) return 'EXC ' + String(r.exceptionDetails.exception?.description || '').slice(0, 200);
    const v = r.result.value;
    if (typeof v !== 'string') return v;
    try { return JSON.parse(v); } catch { return v; }
  };
  const waitFor = async (sel, ms = 40000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { if (await ev(`!!document.querySelector(${JSON.stringify(sel)})`)) return true; await sleep(600); }
    return false;
  };
  const waitIntro = async () => {
    for (let i = 0; i < 45; i++) {
      await sleep(1000);
      const ok = await ev(`(() => {
        const t = document.querySelector('.template-enter');
        const s = document.querySelector('.intro-video-screen');
        return (!s || s.classList.contains('is-hidden') || getComputedStyle(s).display === 'none')
          && (!t || getComputedStyle(t).filter === 'none' || getComputedStyle(t).filter === 'blur(0px)');
      })()`);
      if (ok) return true;
    }
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
        return { x: Math.max(0, b.left + sx - 14), y: Math.max(0, b.top + sy - 14), width: b.width + 28, height: b.height + 28, scale: 2 };
      })()`);
      if (box) params = { format: 'png', clip: box };
      else console.log('  ⚠ không thấy', clipSelector);
    }
    const r = await cmd('Page.captureScreenshot', params);
    fs.writeFileSync(path.join(OUT, `${name}.png`), Buffer.from(r.data, 'base64'));
    console.log('  ✓', name);
  };

  await cmd('Page.enable'); await cmd('Runtime.enable');
  await cmd('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });

  // ── 1. /gioi-thieu: tiếng Việt + "hơn 12 năm" ─────────────────────────
  console.log('/gioi-thieu');
  await cmd('Page.navigate', { url: BASE + '/gioi-thieu' });
  await waitFor('.site-global-links', 40000);
  await sleep(2500);
  const aboutText = await ev(`(() => {
    const t = document.body.innerText || '';
    return {
      coHoi12Nam: /hơn 12 năm/i.test(t),
      coHoi10Nam: /hơn 10 năm/i.test(t),
      mojibake: (t.match(/Ã.|áº.|Ä.|Æ.|Â./g) || []).length,
      mauDoiNgu: (t.match(/Đội ngũ bác sĩ[^]{0,40}/) || [''])[0].slice(0, 60),
    };
  })()`);
  console.log('  ', JSON.stringify(aboutText));
  await ev(`window.scrollTo({top:0,behavior:'auto'}); 'ok'`);
  await sleep(1200);
  // Cuộn tới đúng tiêu đề có "hơn 12 năm" bằng chuột thật (IntersectionObserver
  // + reveal của trang cần frame thật mới chạy) rồi chờ reveal ổn định.
  for (let i = 0; i < 80; i++) {
    const done = await ev(`(() => {
      const h = [...document.querySelectorAll('h2')].find(x => /12 năm/.test(x.textContent || ''));
      if (!h) return false;
      const r = h.getBoundingClientRect();
      return r.top < window.innerHeight * 0.4 && r.bottom > 0;
    })()`);
    if (done) break;
    await cmd('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 720, y: 500, deltaX: 0, deltaY: 150, pointerType: 'mouse' });
    await sleep(90);
  }
  for (let i = 0; i < 20; i++) {
    await sleep(400);
    const pending = await ev(`(() => {
      const vh = window.innerHeight;
      return [...document.querySelectorAll('[data-reveal], [data-reveal-group] > *')]
        .filter(el => {
          const r = el.getBoundingClientRect();
          if (r.bottom < 0 || r.top > vh || !r.height) return false;
          return parseFloat(getComputedStyle(el).opacity) < 0.99;
        }).length;
    })()`);
    if (pending === 0) break;
  }
  await sleep(600);
  await shot('a1-gioi-thieu-top');

  // ── 2. trang chủ: dải số liệu ──────────────────────────────────────────
  console.log('trang chủ — dải số liệu');
  await cmd('Page.navigate', { url: BASE + '/' });
  console.log('  intro xong:', await waitIntro());
  await waitFor('.site-global-links', 45000);
  await ev("document.documentElement.style.scrollBehavior='auto'; 'ok'");
  await sleep(2000);
  const stats = await ev(`(() => {
    const el = document.querySelector('.stats-surface');
    if (!el) return { err: 'không thấy dải số liệu' };
    const nums = [...el.querySelectorAll('dd')].map(d => d.textContent.trim());
    const labels = [...el.querySelectorAll('dt')].map(d => d.textContent.trim());
    return { nums, labels };
  })()`);
  console.log('  ', JSON.stringify(stats));
  // Cuộn bằng mouseWheel THẬT tới dải số liệu.
  //
  // `scrollIntoView` bằng JS không đánh thức IntersectionObserver ở Chrome
  // headless ⇒ CountUp không chạy ⇒ ảnh ra "0+ 0+ 0 0". Đo lại bằng sự kiện
  // chuột thật cho ra 12+ / 30+ / 4 / 11 đúng ngay. (Đã học ở GĐ2A.)
  for (let i = 0; i < 90; i++) {
    const done = await ev(`(() => {
      const el = document.querySelector('.stats-surface');
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return r.top < window.innerHeight * 0.45 && r.bottom > window.innerHeight * 0.35;
    })()`);
    if (done) break;
    await cmd('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 720, y: 500, deltaX: 0, deltaY: 120, pointerType: 'mouse' });
    await sleep(90);
  }
  await sleep(2500);
  const statsAfter = await ev(`(() => {
    const el = document.querySelector('.stats-surface');
    return el ? [...el.querySelectorAll('dd')].map(d => d.textContent.trim()) : [];
  })()`);
  console.log('   sau khi cuộn thật:', JSON.stringify(statsAfter));
  await shot('a2-stats-band', '.stats-surface > div.relative');

  // Quay lại đỉnh để phần cuối trang được chụp đúng bối cảnh.
  for (let i = 0; i < 90; i++) {
    const atBottom = await ev(`(() => {
      const el = document.querySelector('.cta-panel');
      if (!el) return true;
      const r = el.getBoundingClientRect();
      return r.top < window.innerHeight * 0.5 && r.bottom > window.innerHeight * 0.2;
    })()`);
    if (atBottom) break;
    await cmd('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 720, y: 500, deltaX: 0, deltaY: 200, pointerType: 'mouse' });
    await sleep(80);
  }
  await sleep(2000);

  // ── 3. trang chủ: cuối trang — KHÔNG có Closing CTA ────────────────────
  console.log('trang chủ — cuối trang');
  await sleep(1500);
  const bottom = await ev(`(() => ({
    coBanner: !!document.querySelector('.cta-panel'),
    coClosingCta: !!document.querySelector('section[aria-labelledby="closing-cta-title"]'),
    coTheD: !!document.querySelector('.abovefooter-bright'),
  }))()`);
  console.log('  ', JSON.stringify(bottom));
  await shot('a3-bottom-banner');

  console.log(`\n  ảnh → ${OUT}`);
  try { child.kill(); } catch {}
})().catch((e) => { console.error('❌ lỗi:', e.message); process.exitCode = 1; });
