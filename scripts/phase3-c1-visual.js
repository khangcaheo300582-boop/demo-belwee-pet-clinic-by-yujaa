/* Ảnh kiểm chứng trực quan hạng mục C1 (GĐ3).
 *
 * Số đo cho biết `.site-global-nav-glow` tràn 34.6px mỗi bên ở opacity 1.
 * Nhưng gradient của nó là radial fade tới transparent ở 55% ⇒ 3% ngoài cùng
 * CÓ THỂ đã trong suốt và không ai nhìn thấy. Chỉ ảnh mới trả lời được:
 * người dùng có THẬT SỰ thấy vệt xanh ngoài viền thanh không.
 *
 * Chụp mép trái và mép phải của thanh lúc đang cuộn xuống (is-morph bật),
 * kèm trạng thái TẮT (is-at-top) để so sánh.
 *
 * Dùng: node scripts/phase3-c1-visual.js [baseUrl] [outDir]
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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-c1-'));
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
  await sleep(1500);

  /**
   * Clip = mép trái/phải thanh, rộng 260px, cao 130px, phóng 3×.
   *
   * `clip` của Page.captureScreenshot dùng toạ độ TRANG, không phải viewport.
   * Navbar là `position: fixed` ⇒ rect.top là toạ độ viewport, phải cộng
   * `window.scrollY`. Lần đầu quên ⇒ clip rơi vào vùng trống và ảnh ra màu kem
   * trơn (đã mắc phải một lần).
   */
  const clipEdge = async (side) => {
    const box = await ev(`(() => {
      const nav = document.querySelector('.site-global-nav');
      const r = nav.getBoundingClientRect();
      const sy = window.scrollY, sx = window.scrollX;
      const w = 260, h = 130, m = 60;
      const left = r.left + sx;
      const x = ${side === 'left' ? `Math.max(0, left - m)` : `Math.max(0, left + r.width + m - w)`};
      return { x, y: Math.max(0, r.top + sy - m), width: w, height: h, scale: 3 };
    })()`);
    if (!box || typeof box !== 'object') throw new Error('clip lỗi: ' + JSON.stringify(box));
    const res = await cmd('Page.captureScreenshot', { format: 'png', clip: box });
    return Buffer.from(res.data, 'base64');
  };

  const shotWhole = async (name) => {
    const res = await cmd('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(OUT, `${name}.png`), Buffer.from(res.data, 'base64'));
    console.log('  ✓', name);
  };

  // ── 1. Đỉnh trang: nav is-at-top ────────────────────────────────────
  console.log('\n[1] đỉnh trang (is-at-top)');
  await ev(`window.scrollTo({top:0,behavior:'auto'}); 'ok'`);
  await sleep(1200);
  let st = await ev(`(() => {
    const nav = document.querySelector('.site-global-nav');
    const glow = nav.querySelector('.site-global-nav-glow');
    const gr = glow.getBoundingClientRect(), nr = nav.getBoundingClientRect();
    return JSON.stringify({
      cls: nav.className,
      glowOpacity: getComputedStyle(glow).opacity,
      glowW: Math.round(gr.width), navW: Math.round(nr.width),
      overhang: Math.round(((gr.width - nr.width) / 2) * 10) / 10,
      glowBg: getComputedStyle(glow).backgroundImage.slice(0, 120),
    });
  })()`);
  console.log('   ', st);
  fs.writeFileSync(path.join(OUT, 'c1-01-edge-left-at-top.png'), await clipEdge('left'));
  fs.writeFileSync(path.join(OUT, 'c1-02-edge-right-at-top.png'), await clipEdge('right'));
  console.log('  ✓ mép trái/phải @ đỉnh');
  await shotWhole('c1-00-at-top-whole');

  // ── 2. Đang cuộn xuống: is-morph bật ────────────────────────────────
  console.log('\n[2] đang cuộn xuống (is-morph)');
  for (let i = 0; i < 10; i++) {
    await cmd('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 720, y: 450, deltaX: 0, deltaY: 70, pointerType: 'mouse' });
    await sleep(60);
  }
  st = await ev(`(() => {
    const nav = document.querySelector('.site-global-nav');
    const glow = nav.querySelector('.site-global-nav-glow');
    const gr = glow.getBoundingClientRect(), nr = nav.getBoundingClientRect();
    return JSON.stringify({
      cls: nav.className, scrollY: Math.round(window.scrollY),
      glowOpacity: getComputedStyle(glow).opacity,
      glowW: Math.round(gr.width), navW: Math.round(nr.width),
      overhang: Math.round(((gr.width - nr.width) / 2) * 10) / 10,
      glowBg: getComputedStyle(glow).backgroundImage.slice(0, 120),
    });
  })()`);
  console.log('   ', st);
  fs.writeFileSync(path.join(OUT, 'c1-03-edge-left-morph.png'), await clipEdge('left'));
  fs.writeFileSync(path.join(OUT, 'c1-04-edge-right-morph.png'), await clipEdge('right'));
  console.log('  ✓ mép trái/phải @ đang cuộn');
  await shotWhole('c1-05-morph-whole');

  // ── 3. Tắt tạm lớp glow để so sánh A/B ─────────────────────────────
  console.log('\n[3] TẮT lớp glow (A/B)');
  await ev(`(() => {
    const s = document.createElement('style');
    s.id = 'ab-off-glow';
    s.textContent = '.site-global-nav-glow{display:none !important}';
    document.head.appendChild(s);
    return 'ok';
  })()`);
  await sleep(600);
  fs.writeFileSync(path.join(OUT, 'c1-06-edge-left-morph-noglow.png'), await clipEdge('left'));
  fs.writeFileSync(path.join(OUT, 'c1-07-edge-right-morph-noglow.png'), await clipEdge('right'));
  console.log('  ✓ mép trái/phải @ đang cuộn, ĐÃ TẮT glow');
  await shotWhole('c1-08-morph-noglow-whole');

  await ev(`(() => { const s = document.getElementById('ab-off-glow'); if (s) s.remove(); return 'ok'; })()`);

  console.log(`\n  ảnh → ${OUT}`);
  try { child.kill(); } catch {}
})().catch((e) => { console.error('❌ lỗi:', e.message); process.exitCode = 1; });
