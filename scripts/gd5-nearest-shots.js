/* Ảnh xác nhận "Tìm chi nhánh gần tôi" sau khi tìm ra chi nhánh gần nhất.
 *
 * Dùng: node scripts/gd5-nearest-shots.js [baseUrl] [outDir]
 */
'use strict';
const { spawn } = require('child_process');
const fs = require('fs'); const os = require('os'); const path = require('path');
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = process.argv[2] || 'http://localhost:3010';
const OUT = process.argv[3] || path.resolve(__dirname, '..', 'docs', 'gd5-shots');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-ns-'));
  const child = spawn(CHROME, ['--headless=new', '--remote-debugging-pipe', '--no-first-run',
    '--no-default-browser-check', '--disable-gpu', '--force-device-scale-factor=1',
    `--user-data-dir=${dir}`, 'about:blank'],
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
    return r.result.value;
  };
  const shot = async (name, sel) => {
    let params = { format: 'png' };
    if (sel) {
      const b = await ev(`(() => {
        const el = document.querySelector(${JSON.stringify(sel)});
        if (!el) return null;
        const r = el.getBoundingClientRect(); const sy = window.scrollY, sx = window.scrollX;
        if (!r.width) return null;
        return { x: Math.max(0, r.left + sx - 8), y: Math.max(0, r.top + sy - 8),
                 width: r.width + 16, height: r.height + 16, scale: 1 };
      })()`);
      if (b) params = { format: 'png', clip: b };
    }
    const r = await cmd('Page.captureScreenshot', params);
    fs.writeFileSync(path.join(OUT, `${name}.png`), Buffer.from(r.data, 'base64'));
    console.log('  ✓', name);
  };

  await cmd('Page.enable'); await cmd('Runtime.enable');

  for (const [w, h, tag] of [[1440, 1000, 'desktop'], [390, 900, 'mobile']]) {
    await cmd('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 700 });
    await cmd('Page.navigate', { url: BASE + '/lien-he' });
    for (let i = 0; i < 40; i++) {
      if (await ev(`!!document.querySelector('.clinic-branch-card')`)) break;
      await sleep(500);
    }
    await send('Browser.grantPermissions', { origin: BASE, permissions: ['geolocation'] });
    // Đứng ở Nguyễn Kiệm ⇒ kỳ vọng ra CN2.
    await cmd('Emulation.setGeolocationOverride', { latitude: 10.815, longitude: 106.679, accuracy: 10 });
    await sleep(800);

    // Cuộn BẰNG CHUỘT THẬT tới khối tìm chi nhánh trước khi chụp.
    //
    // Hai lý do, đều đã học được ở GĐ2A/GĐ3:
    //   • `scrollIntoView` bằng JS không đánh thức IntersectionObserver ở Chrome
    //     headless ⇒ `data-reveal` giữ opacity 0 ⇒ ảnh chụp ra TRẮNG (đã gặp).
    //   • Chụp toàn trang lúc đang ở đỉnh chỉ ra hero tối, không thấy gì cần
    //     kiểm. Phải cuộn tới đúng chỗ rồi mới chụp.
    for (let i = 0; i < 120; i++) {
      const done = await ev(`(() => {
        const b = [...document.querySelectorAll('button')].find(x => /location|vị trí/i.test(x.textContent || ''));
        if (!b) return false;
        const r = b.closest('div').getBoundingClientRect();
        return r.top < window.innerHeight * 0.5 && r.bottom > 0;
      })()`);
      if (done) break;
      await cmd('Input.dispatchMouseEvent', { type: 'mouseWheel', x: Math.round(w / 2), y: Math.round(h / 2), deltaX: 0, deltaY: 200, pointerType: 'mouse' });
      await sleep(90);
    }
    // Chờ mọi `data-reveal` trong khung nhìn thấy đã mờ hẳn.
    for (let i = 0; i < 25; i++) {
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

    await ev(`(() => {
      const b = [...document.querySelectorAll('button')].find(x => /location|vị trí/i.test(x.textContent || ''));
      b.click(); return 1;
    })()`);
    for (let i = 0; i < 60; i++) {
      await sleep(400);
      const has = await ev(`(document.querySelector('[aria-live="polute"]')||document.querySelector('[aria-live="polite"]')||{}).textContent||''`);
      if (has && has.trim()) break;
    }
    await sleep(800);

    /*
     * Cuộn LẠI đúng thẻ vừa được đánh dấu trước khi chụp.
     * Trong lúc chờ định vị (hơn 20 giây) hiệu ứng reveal chạy và bố cục dịch
     * chuyển, nên toạ độ đo từ lúc đầu đã cũ — clip theo toạ độ cũ ra ảnh
     * trắng hoặc trúng vùng khác (đã gặp cả hai). Phải đo lại ngay trước lúc
     * chụp. Trên mobile dùng bước cuộn lớn hơn vì 1 thẻ/hàng.
     */
    for (let i = 0; i < 120; i++) {
      const ok = await ev(`(() => {
        const c = document.querySelector('[data-nearest]');
        if (!c) return false;
        const r = c.getBoundingClientRect();
        return r.top < window.innerHeight * 0.35 && r.bottom > window.innerHeight * 0.3;
      })()`);
      if (ok) break;
      await cmd('Input.dispatchMouseEvent', { type: 'mouseWheel', x: Math.round(w / 2), y: Math.round(h / 2), deltaX: 0, deltaY: w < 700 ? -240 : -110, pointerType: 'mouse' });
      await sleep(90);
    }
    await sleep(1400);

    const info = await ev(`(() => {
      const marked = [...document.querySelectorAll('[data-nearest]')];
      const live = document.querySelector('[aria-live="polite"]');
      return {
        soTheDanh: marked.length,
        soThuTu: marked.length ? marked[0].querySelector('.clinic-branch-num').textContent.trim() : null,
        badge: marked.length ? (marked[0].querySelector('.absolute.right-5')||{}).textContent : null,
        ariaCurrent: marked.length ? marked[0].getAttribute('aria-current') : null,
        ketQua: live ? live.textContent.replace(/\\s+/g,' ').trim() : '',
      };
    })()`);
    console.log(`\n[${tag} ${w}x${h}]`, JSON.stringify(info, null, 1));
    await shot(`nearest-${tag}-full`);
    await shot(`nearest-${tag}-card`, '[data-nearest]');
  }
  console.log(`\n  ảnh → ${OUT}`);
  try { child.kill(); } catch {}
})().catch((e) => { console.error('❌', e.message); process.exitCode = 1; });