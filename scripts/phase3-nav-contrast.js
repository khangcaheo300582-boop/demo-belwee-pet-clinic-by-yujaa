/* Đo tương phản các phần tử trong thanh điều hướng, ở CẢ HAI trạng thái.
 *
 * Ảnh `docs/gd3-shots/c2-01-navbar.png` cho thấy nút "Book now" ở đỉnh trang
 * trông rất nhạt trên nền kính sáng. Mắt thấy vậy, nhưng cần số.
 *
 * Vì sao phải đo cả hai trạng thái: `.site-global-nav` đổi hệ số vật liệu hoàn
 * toàn giữa `is-at-top` và `is-active` (--lg-tint-a .52 vs .34+.2*progress), và
 * đổi màu chữ theo. Chỉ đo trạng thái đang nhìn thấy lúc chụp là thiếu.
 *
 * Dùng: node scripts/phase3-nav-contrast.js [baseUrl]
 */
'use strict';
const { spawn } = require('child_process');
const fs = require('fs'); const os = require('os'); const path = require('path');
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = process.argv[2] || 'http://localhost:3010';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-nc-'));
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
    if (r.exceptionDetails) return 'EXC ' + String(r.exceptionDetails.exception?.description || '').slice(0, 180);
    const v = r.result.value;
    if (typeof v !== 'string') return v;
    try { return JSON.parse(v); } catch { return v; }
  };

  const AUDIT = `(() => {
    const parse = (c) => {
      const m = c.match(/rgba?\\(([^)]+)\\)/);
      if (!m) return null;
      const p = m[1].split(/[,\\s\\/]+/).filter(Boolean).map(Number);
      return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
    };
    const over = (fg, bg) => {
      const a = fg.a + bg.a * (1 - fg.a);
      if (a <= 0) return { r: 255, g: 255, b: 255, a: 0 };
      return { r: (fg.r*fg.a + bg.r*bg.a*(1-fg.a))/a, g: (fg.g*fg.a + bg.g*bg.a*(1-fg.a))/a, b: (fg.b*fg.a + bg.b*bg.a*(1-fg.a))/a, a };
    };
    const lum = (c) => {
      const f = (v) => { v /= 255; return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); };
      return 0.2126*f(c.r) + 0.7152*f(c.g) + 0.0722*f(c.b);
    };
    const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); return +(((Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05)).toFixed(2)); };
    // Nền THẬT của phần tử: lớp cuối trong chuỗi background-image (nằm dưới
    // cùng), rồi background-color, rồi màu nền của tổ tiên gần nhất đục.
    const bgOf = (el) => {
      let acc = null;
      const cs = getComputedStyle(el);
      const layers = cs.backgroundImage && cs.backgroundImage !== 'none'
        ? [...cs.backgroundImage.match(/[^()]+(?:\\([^()]*\\))?/g) || []] : [];
      for (let i = layers.length - 1; i >= 0; i--) {
        const c = parse(layers[i]);
        if (c && c.a > 0) { acc = c; break; }
      }
      if (!acc) {
        const c = parse(cs.backgroundColor);
        acc = c && c.a > 0 ? c : null;
      }
      let node = el, guard = 0;
      while ((!acc || acc.a < 0.99) && node.parentElement && guard++ < 24) {
        node = node.parentElement;
        const p = getComputedStyle(node);
        const ls = p.backgroundImage && p.backgroundImage !== 'none'
          ? [...p.backgroundImage.match(/[^()]+(?:\\([^()]*\\))?/g) || []] : [];
        let found = null;
        for (let i = ls.length - 1; i >= 0 && !found; i--) { const c = parse(ls[i]); if (c && c.a > 0) found = c; }
        const c = parse(p.backgroundColor);
        if (!found && c && c.a > 0) found = c;
        // found có thể null (tổ tiên trong suốt) — trộn với null là lỗi.
        if (found) acc = acc ? over(acc, found) : found;
      }
      if (!acc) acc = { r: 255, g: 255, b: 255, a: 1 };
      if (acc.a < 0.99) acc = { ...acc, a: 1 };
      return acc;
    };
    const rows = [];
    const nav = document.querySelector('.site-global-nav');
    if (!nav) return { err: 'không thấy .site-global-nav', rows: [] };
    const targets = [
      ['.site-global-link', 'mục nav'],
      ['.site-global-emergency-label', 'Emergency 24h'],
      ['.site-global-booking', 'Book now'],
      ['.site-global-hamburger-label', 'nhãn More'],
    ];
    for (const [sel, label] of targets) {
      for (const el of document.querySelectorAll(sel)) {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        const cs = getComputedStyle(el);
        // nền = phần tử CHA (vì phần tử cha mới mang vật liệu kính)
        const host = el.closest('.site-global-booking, .site-global-emergency, .site-global-hamburger') || el.parentElement;
        const bg = bgOf(host);
        const fg0 = parse(cs.color) || { r: 0, g: 0, b: 0, a: 1 };
        const fg = fg0.a < 1 ? over(fg0, bg) : fg0;
        const size = parseFloat(cs.fontSize);
        const weight = parseInt(cs.fontWeight, 10) || 400;
        const large = size >= 24 || (size >= 18.66 && weight >= 700);
        const need = large ? 3 : 4.5;
        const got = ratio(fg, bg);
        rows.push({ label, text: (el.textContent||'').trim().slice(0,18), color: cs.color, size: Math.round(size), weight, need, got, pass: got >= need });
      }
    }
    return { cls: nav.className, rows };
  })()`;

  const show = (label, a) => {
    console.log(`\n════ ${label} ════`);
    if (typeof a === 'string') { console.log('  lỗi:', a); return; }
    if (!a) { console.log('  không có dữ liệu'); return; }
    if (a.err) { console.log('  lỗi:', a.err); return; }
    console.log('  class:', a.cls);
    if (!a.rows.length) console.log('  (không đo được phần tử nào — có thể links đang bị ẩn)');
    a.rows.forEach((r) => console.log(`   ${String(r.got).padStart(5)}:1 cần ${r.need}  ${r.pass ? 'ok' : '❌'}  ${r.label} "${r.text}" ${r.color} ${r.size}px/${r.weight}`));
  };

  await cmd('Page.enable'); await cmd('Runtime.enable');
  await cmd('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
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
  const waitNav = async () => { for (let i = 0; i < 40; i++) { if (await ev(`!!document.querySelector('.site-global-links')`)) return; await sleep(600); } };
  await waitNav();
  await ev("document.documentElement.style.scrollBehavior='auto'; 'ok'");
  await sleep(2500);

  console.log('\n════ TRẠNG THÁI ĐỈNH TRANG (is-at-top) ════');
  show('ĐỈNH TRANG (is-at-top)', await ev(AUDIT));

  console.log('\n════ SAU KHI CUỘN XUỐNG (is-active is-morph) ════');
  for (let i = 0; i < 8; i++) {
    await cmd('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 720, y: 450, deltaX: 0, deltaY: 90, pointerType: 'mouse' });
    await sleep(120);
  }
  await sleep(2500);
  show('SAU KHI CUỘN XUỐNG (is-active is-morph)', await ev(AUDIT));

  console.log('\n  Ghi chú: nền dựng lại từ gradient, không phải pixel thật.');
  console.log('  Dưới 2:1 gần như chắc chắn sai; 3–4.5 cần xem ảnh gd3-shots/c2-01-navbar.png.');
  try { child.kill(); } catch {}
})().catch((e) => { console.error('❌ lỗi:', e.message); process.exitCode = 1; });
