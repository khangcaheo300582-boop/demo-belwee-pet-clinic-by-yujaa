/* Đo tương phản tiêu đề + nhãn trên trang chủ (production build).
 *
 * Ảnh `docs/gd3-shots/c1-11-before-peak-whole.png` lộ ra tiêu đề
 * "Our comprehensive care system" hiện màu xám RẤT NHẠT trên nền kem.
 * Mắt thấy vậy, nhưng "thấy là nhạt" không đủ — phải có số.
 *
 * Vì sao phải dựng lại nền: phần lớn tiêu đề nằm trên nền trang có gradient
 * ảnh, `background-color` là `rgba(0,0,0,0)` ⇒ tính kiểu thường cho số vô
 * nghĩa. Ở đây dựng nền từ gradient của chính phần tử + tổ tiên, rồi dò
 * THÊM một chỗ: chụp ảnh thật và so mẫu. Vì không giải mã PNG được, script
 * báo cả số dựng lại, kèm cảnh báo giới hạn.
 *
 * Dùng: node scripts/phase3-contrast.js [baseUrl]
 */
'use strict';
const { spawn } = require('child_process');
const fs = require('fs'); const os = require('os'); const path = require('path');

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = process.argv[2] || 'http://localhost:3010';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-ct-'));
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
      return (!s || s.classList.contains('is-hidden') || getComputedStyle(s).display === 'none')
        && (!t || getComputedStyle(t).filter === 'none' || getComputedStyle(t).filter === 'blur(0px)');
    })()`);
  }
  await ev("document.documentElement.style.scrollBehavior='auto'; 'ok'");
  await sleep(1200);

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
      return {
        r: (fg.r * fg.a + bg.r * bg.a * (1 - fg.a)) / a,
        g: (fg.g * fg.a + bg.g * bg.a * (1 - fg.a)) / a,
        b: (fg.b * fg.a + bg.b * bg.a * (1 - fg.a)) / a, a };
    };
    const lum = (c) => {
      const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
      return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
    };
    const ratio = (a, b) => {
      const l1 = lum(a), l2 = lum(b);
      return +(((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05))).toFixed(2);
    };
    // Nền: gradient của chính el + background-color của tổ tiên, dừng khi đục.
    const bgOf = (el) => {
      let acc = null;
      const cs = getComputedStyle(el);
      for (const layer of [...(cs.backgroundImage.match(/[^()]+(?:\\([^()]*\\))?/g) || [])]) {
        const c = parse(layer);
        if (!c) continue;
        acc = acc === null ? c : over(acc, c);
      }
      if (acc === null) acc = parse(cs.backgroundColor) || { r: 255, g: 255, b: 255, a: 0 };
      let node = el, guard = 0;
      while (acc.a < 0.99 && node.parentElement && guard++ < 24) {
        node = node.parentElement;
        const p = getComputedStyle(node);
        const c = parse(p.backgroundColor);
        if (c && c.a > 0) acc = over(acc, c);
        // tổ tiên có gradient riêng thì lấy lớp CUỐI của nó làm nền
        else if (p.backgroundImage && p.backgroundImage !== 'none') {
          const ls = [...(p.backgroundImage.match(/[^()]+(?:\\([^()]*\\))?/g) || [])];
          for (let i = ls.length - 1; i >= 0; i--) {
            const cc = parse(ls[i]);
            if (cc && cc.a > 0) { acc = over(acc, cc); break; }
          }
        }
      }
      if (acc.a < 0.99) acc = { ...acc, a: 1 };
      return acc;
    };

    const out = [];
    const sel = 'h1, h2, h3';
    for (const el of document.querySelectorAll(sel)) {
      const r = el.getBoundingClientRect();
      if (!r.height || !el.textContent.trim()) continue;
      const cs = getComputedStyle(el);
      const fg0 = parse(cs.color) || { r: 0, g: 0, b: 0, a: 1 };
      const bg = bgOf(el);
      const fg = fg0.a < 1 ? over(fg0, bg) : fg0;
      const size = parseFloat(cs.fontSize);
      const weight = parseInt(cs.fontWeight, 10) || 400;
      // AA: chữ lớn (>=24px, hoặc >=18.66px đậm) cần 3:1; còn lại 4.5:1
      const large = size >= 24 || (size >= 18.66 && weight >= 700);
      const need = large ? 3 : 4.5;
      const got = ratio(fg, bg);
      out.push({
        tag: el.tagName,
        text: (el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 46),
        color: cs.color, size: Math.round(size), weight,
        need, got, pass: got >= need,
      });
    }
    return out;
  })()`;

  const rows = await ev(AUDIT) || [];
  console.log(`\n──── Tương phản tiêu đề trên trang chủ (1440px) · ${rows.length} phần tử ────`);
  const bad = [];
  rows.forEach((r) => {
    if (r.pass) return;
    bad.push(r);
  });
  console.log(`  đạt: ${rows.length - bad.length}/${rows.length}`);
  if (bad.length) {
    console.log('  KHÔNG ĐẠT:');
    bad.forEach((r) => console.log(`    ${String(r.got).padStart(5)}:1 (cần ${r.need})  ${r.tag} ${r.size}px/${r.weight}  "${r.text}"  màu ${r.color}`));
  }
  console.log('\n  Ghi chú: nền được DỰNG LẠI từ gradient, không phải pixel thật.');
  console.log('  Số dưới 2:1 gần như chắc chắn sai với mắt; số 3–4.5 cần xem ảnh mới tin.');

  // Chụp ảnh chứng minh cho tối đa 3 tiêu đề tệ nhất
  const worst = bad.slice(0, 3);
  for (let i = 0; i < worst.length; i++) {
    const box = await ev(`(() => {
      const els = [...document.querySelectorAll('h1,h2,h3')].filter(e => e.textContent.trim());
      const el = els.find(e => (e.textContent||'').trim().replace(/\\s+/g,' ').startsWith(${JSON.stringify(worst[i].text.slice(0, 24))}));
      if (!el) return null;
      el.scrollIntoView({ block: 'center', behavior: 'auto' });
      return 1;
    })()`);
    if (!box) { console.log(`  (không tìm thấy "${worst[i].text}")`); continue; }
    await sleep(2500);
    const res = await cmd('Page.captureScreenshot', { format: 'png' });
    const out = path.resolve(__dirname, '..', 'docs', 'gd3-shots', `contrast-${i + 1}-${worst[i].text.slice(0, 18).replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, Buffer.from(res.data, 'base64'));
    console.log(`  ✓ ảnh: ${path.basename(out)}`);
  }

  try { child.kill(); } catch {}
})().catch((e) => { console.error('❌ lỗi:', e.message); process.exitCode = 1; });
