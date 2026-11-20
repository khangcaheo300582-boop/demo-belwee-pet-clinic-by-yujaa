/* Dò đỉnh thật của `::before` / `gooeyStretch` — hạng mục C1 (GĐ3).
 *
 * VÌ SAO CẦN FILE NÀY: trace chạy được ~1fps nên bỏ lọt animation 0.8s của
 * `gooeyStretch` (chỉ bắt 2 mẫu, đều ở tràn 2px). Đó là lý do chưa kết luận
 * được lớp nào là thủ phạm.
 *
 * CÁCH DÒ: bơm CSS làm `gooeyStretch` chạy 12 giây thay vì 0.8s. Animation
 * chậm ⇒ poll thường bắt được ĐỈNH (keyframe 40%: scaleX 1.03, opacity 1),
 * đồng thời chụp được ảnh lúc đỉnh để xác nhận bằng mắt.
 *
 * Đây chỉ là bơm CSS trong phiên trình duyệt, KHÔNG sửa file nguồn.
 *
 * Dùng: node scripts/phase3-c1-before.js [baseUrl] [outDir]
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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-b4-'));
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
    if (r.exceptionDetails) throw new Error('eval: ' + JSON.stringify(r.exceptionDetails).slice(0, 250));
    const v = r.result.value;
    if (typeof v !== 'string') return v;
    try { return JSON.parse(v); } catch { return v; }
  };

  const SAMPLE = `(() => {
    const nav = document.querySelector('.site-global-nav');
    const b = getComputedStyle(nav, '::before');
    const r = nav.getBoundingClientRect();
    const m = b.transform.match(/matrix\\(([^)]+)\\)/);
    const scaleX = m ? parseFloat(m[1].split(',')[0]) : 1;
    const opa = parseFloat(b.opacity) || 0;
    return {
      t: Math.round(performance.now()),
      navW: Math.round(r.width * 10) / 10,
      scaleX: Math.round(scaleX * 10000) / 10000,
      opacity: Math.round(opa * 100) / 100,
      overhang: Math.round((((r.width + 4) * scaleX) - r.width) / 2 * 10) / 10,
      overhangVisible: opa > 0.02 ? Math.round((((r.width + 4) * scaleX) - r.width) / 2 * 10) / 10 : 0,
      morph: nav.classList.contains('is-morph'),
      scrollY: Math.round(window.scrollY),
    };
  })()`;

  const clipEdge = async (side) => {
    const box = await ev(`(() => {
      const nav = document.querySelector('.site-global-nav');
      const r = nav.getBoundingClientRect();
      const sy = window.scrollY, sx = window.scrollX;
      const w = 300, h = 140, m = 70;
      const left = r.left + sx;
      const x = ${side === 'left' ? `Math.max(0, left - m)` : `Math.max(0, left + r.width + m - w)`};
      return { x, y: Math.max(0, r.top + sy - m), width: w, height: h, scale: 3 };
    })()`);
    const res = await cmd('Page.captureScreenshot', { format: 'png', clip: box });
    return Buffer.from(res.data, 'base64');
  };

  await cmd('Page.enable'); await cmd('Runtime.enable');
  await cmd('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await cmd('Page.navigate', { url: BASE + '/' });

  let ready = false;
  for (let i = 0; i < 45 && !ready; i++) {
    await sleep(1000);
    ready = await ev(`(() => {
      const t = document.querySelector('.template-enter');
      const s = document.querySelector('.intro-video-screen');
      const introGone = !s || s.classList.contains('is-hidden') || getComputedStyle(s).display === 'none';
      const entered = !t || (getComputedStyle(t).filter === 'none' || getComputedStyle(t).filter === 'blur(0px)');
      return introGone && entered;
    })()`);
  }
  if (!ready) console.log('⚠ intro/effect chưa xong');
  await ev("document.documentElement.style.scrollBehavior='auto'; 'ok'");
  await sleep(1200);

  // BƠM: gooeyStretch 0.8s → 12s để poll bắt được đỉnh.
  console.log('bơm gooeyStretch: 0.8s → 12s');
  await ev(`(() => {
    const s = document.createElement('style');
    s.id = 'slow-gooey';
    s.textContent = '.site-global-nav.is-morph::before{animation-duration:12s !important}';
    document.head.appendChild(s);
    return getComputedStyle(document.querySelector('.site-global-nav'), '::before').animationDuration;
  })()`);

  // Kích hoạt is-morph: cuộn xuống rồi đứng yên.
  console.log('kích hoạt is-morph…');
  await cmd('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 720, y: 450, deltaX: 0, deltaY: 300, pointerType: 'mouse' });
  await sleep(400);

  const samples = [];
  let peakShot = false;
  for (let i = 0; i < 40; i++) {
    const s = await ev(SAMPLE);
    if (s) samples.push(s);
    // chụp đúng lúc ::before rộng nhất VÀ đang nhìn thấy
    if (!peakShot && s && s.overhangVisible > 10 && s.opacity > 0.5) {
      peakShot = true;
      fs.writeFileSync(path.join(OUT, 'c1-09-before-peak-left.png'), await clipEdge('left'));
      fs.writeFileSync(path.join(OUT, 'c1-10-before-peak-right.png'), await clipEdge('right'));
      const res = await cmd('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(OUT, 'c1-11-before-peak-whole.png'), Buffer.from(res.data, 'base64'));
      console.log(`  ✓ chụp đỉnh t=${i * 150}ms — tràn ${s.overhangVisible}px, opacity ${s.opacity}`);
    }
    await sleep(150);
  }

  const vis = samples.filter((s) => s.overhangVisible > 0);
  const maxVis = samples.reduce((m, s) => Math.max(m, s.overhangVisible), 0);
  console.log(`\n──── KẾT QUẢ ::before / gooeyStretch ────`);
  console.log(`  mẫu: ${samples.length}  ·  mẫu có tràn khi nhìn thấy: ${vis.length}`);
  console.log(`  TRÀN TỐI ĐA khi nhìn thấy: ${maxVis}px mỗi bên`);
  console.log(`  scaleX tối đa: ${samples.reduce((m, s) => Math.max(m, s.scaleX), 0)}`);
  console.log(`  nav rộng ${samples[0] ? samples[0].navW : '?'}px → scaleX 1.03 = ${samples[0] ? Math.round(((samples[0].navW + 4) * 0.03) / 2 * 10) / 10 : '?'}px tràn`);
  console.log('  dòng thời gian (mỗi 3 mẫu):');
  samples.filter((_, i) => i % 3 === 0).forEach((s) => {
    console.log(`    t=${String(s.t - samples[0].t).padStart(6)}ms morph=${s.morph ? 'Y' : 'n'} ` +
      `scaleX=${s.scaleX} opa=${s.opacity} tràn=${s.overhang}px nhìnThấy=${s.overhangVisible}px`);
  });
  if (!peakShot) console.log('  ⚠ không chụp được ảnh đỉnh (không bắt được mẫu tràn > 10px ở opacity > 0.5)');

  console.log(`\n  ảnh → ${OUT}`);
  try { child.kill(); } catch {}
})().catch((e) => { console.error('❌ lỗi:', e.message); process.exitCode = 1; });
