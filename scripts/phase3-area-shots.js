/* Ảnh xác nhận GĐ3 vòng 2: CareAreaMap (hạng mục 25.3) — vùng "Da & lông".
 *
 * Dùng: node scripts/phase3-area-shots.js [baseUrl] [outDir]
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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-ar-'));
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
    if (r.exceptionDetails) return { __exc: String(r.exceptionDetails.exception?.description || '').slice(0, 200) };
    const v = r.result.value;
    if (typeof v !== 'string') return v;
    try { return JSON.parse(v); } catch { return v; }
  };
  const shot = async (name, sel) => {
    let params = { format: 'png' };
    if (sel) {
      const b = await ev(`(() => {
        const el = document.querySelector(${JSON.stringify(sel)});
        if (!el) return null;
        const r = el.getBoundingClientRect(); const sy = window.scrollY, sx = window.scrollX;
        if (!r.width) return null;
        return { x: Math.max(0, r.left + sx - 10), y: Math.max(0, r.top + sy - 10),
                 width: r.width + 20, height: r.height + 20, scale: 1 };
      })()`);
      if (b) params = { format: 'png', clip: b }; else console.log('  ⚠ không thấy', sel);
    }
    const r = await cmd('Page.captureScreenshot', params);
    fs.writeFileSync(path.join(OUT, `${name}.png`), Buffer.from(r.data, 'base64'));
    console.log('  ✓', name);
  };

  await cmd('Page.enable'); await cmd('Runtime.enable');

  for (const [w, h, tag] of [[1440, 1000, 'desktop'], [390, 900, 'mobile']]) {
    await cmd('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 700 });
    await cmd('Page.navigate', { url: BASE + '/' });
    for (let i = 0; i < 45; i++) {
      await sleep(1000);
      const ok = await ev(`(() => {
        const t = document.querySelector('.template-enter');
        const s = document.querySelector('.intro-video-screen');
        return (!s || s.classList.contains('is-hidden') || getComputedStyle(s).display === 'none')
          && (!t || getComputedStyle(t).filter === 'none' || getComputedStyle(t).filter === 'blur(0px)');
      })()`);
      if (ok && (await ev(`!!document.querySelector('.site-global-links')`))) break;
    }
    await ev(`document.documentElement.style.scrollBehavior='auto'; 1`);
    await sleep(1200);

    // Cuộn bằng chuột thật tới section (IntersectionObserver cần frame thật).
    for (let i = 0; i < 140; i++) {
      const done = await ev(`(() => {
        const el = document.querySelector('#area-map-title');
        if (!el) return false;
        const r = el.getBoundingClientRect();
        return r.top < window.innerHeight * 0.35 && r.bottom > 0;
      })()`);
      if (done) break;
      await cmd('Input.dispatchMouseEvent', { type: 'mouseWheel', x: Math.round(w / 2), y: Math.round(h / 2), deltaX: 0, deltaY: 160, pointerType: 'mouse' });
      await sleep(85);
    }
    for (let i = 0; i < 20; i++) {
      await sleep(400);
      const pend = await ev(`(() => {
        const vh = window.innerHeight;
        return [...document.querySelectorAll('[data-reveal],[data-reveal-group] > *')].filter((el) => {
          const r = el.getBoundingClientRect();
          if (r.bottom < 0 || r.top > vh || !r.height) return false;
          return parseFloat(getComputedStyle(el).opacity) < 0.99;
        }).length;
      })()`);
      if (pend === 0) break;
    }
    await sleep(800);

    const info = await ev(`(() => {
      const sec = document.querySelector('#area-map-title')?.closest('section');
      if (!sec) return { err: 'không thấy section' };
      const cta = sec.querySelector('a[href]');
      const svg = sec.querySelector('svg[role="img"]');
      const pulse = sec.querySelector('.area-map-pulse');
      // Vùng tô sáng có nằm trong khung icon không? So với BBOX THẬT của icon.
      const box = svg ? svg.getBoundingClientRect() : null;
      const pb = pulse ? pulse.getBoundingClientRect() : null;
      const inside = box && pb
        ? pb.left >= box.left - 1 && pb.top >= box.top - 1
          && pb.right <= box.right + 1 && pb.bottom <= box.bottom + 1
        : null;
      // Vùng có che mất phần nào của icon không? Đo icon ở chế độ không có vùng.
      return {
        tieuDe: document.querySelector('#area-map-title').textContent.trim(),
        vungTrongKhung: inside,
        khoIcon: box ? { w: Math.round(box.width), h: Math.round(box.height) } : null,
        khoVung: pb ? { w: Math.round(pb.width), h: Math.round(pb.height) } : null,
        vungChiemPhanTram: pb && box
          ? { w: Math.round((pb.width / box.width) * 100), h: Math.round((pb.height / box.height) * 100) }
          : null,
        ctaHref: cta ? cta.getAttribute('href') : null,
        ctaText: cta ? cta.textContent.trim() : null,
        ariaHinh: svg ? svg.getAttribute('aria-label') : null,
      };
    })()`);
    console.log(`\n[${tag} ${w}x${h}]`, JSON.stringify(info, null, 1));
    // Clip CẢ section, không phải tiêu đề — `#area-map-title` là <h2>, chụp nó
    // chỉ ra đúng mỗi tiêu đề.
    await shot(`area-${tag}`, 'section[aria-labelledby="area-map-title"]');
  }

  console.log(`\nảnh → ${OUT}`);
  try { child.kill(); } catch {}
})().catch((e) => { console.error('❌', e.message); process.exitCode = 1; });