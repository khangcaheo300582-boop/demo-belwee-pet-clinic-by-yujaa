/* Chụp màn hình các section GĐ2B ở production build để kiểm bằng MẮT.
   Dùng: node scripts/phase2b-shots.js [baseUrl] [outDir]
 */
'use strict';
const { spawn } = require('child_process');
const fs = require('fs'); const os = require('os'); const path = require('path');

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = process.argv[2] || 'http://localhost:3010';
const OUT = process.argv[3] || path.resolve(__dirname, '..', 'docs', 'gd2b-shots');
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

  const setViewport = (width, height, mobile) =>
    cmd('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });

  /** Nạp trang + chờ intro tan + tắt smooth-scroll (xem phase2a-shots.js). */
  const loadHome = async () => {
    await cmd('Page.navigate', { url: BASE + '/' });
    let done = false;
    for (let i = 0; i < 40 && !done; i++) {
      await sleep(1000);
      done = await ev(`(() => {
        const s = document.querySelector('.intro-video-screen');
        if (!s) return true;
        return s.classList.contains('is-hidden') || getComputedStyle(s).opacity === '0'
          || getComputedStyle(s).display === 'none' || !s.isConnected;
      })()`);
    }
    if (!done) console.log('  ⚠ intro CHƯA tan — ảnh có thể bị overlay che');
    // ChỜ HẾT HIỆU ỨNG VÀO TRANG.
    //
    // `app/template.tsx` bọc trang trong `.template-enter` chạy blur + fade lúc
    // vào. Nó nằm SAU lớp intro, nên "intro đã tan" KHÔNG đồng nghĩa trang đã
    // hiện: chụp trong lúc còn blur ra một màn trắng trơn (đã mắc phải một lần).
    let entered = false;
    for (let i = 0; i < 30 && !entered; i++) {
      await sleep(400);
      entered = await ev(`(() => {
        const t = document.querySelector('.template-enter');
        if (!t) return true;
        const cs = getComputedStyle(t);
        // GSAP để lại filter: blur(0px) sau khi tween xong (không xoá thuộc
        // tính), nên phải coi blur(0) là "đã vào xong" — chờ filter === 'none'
        // thì không bao giờ xảy ra.
        const blurGone = cs.filter === 'none' || cs.filter === 'blur(0px)';
        return blurGone && cs.transform === 'none' && cs.opacity === '1';
      })()`);
    }
    if (!entered) console.log('  ⚠ hiệu ứng vào trang CHƯA xong — ảnh có thể bị mờ/trắng');
    await ev("document.documentElement.style.scrollBehavior='auto'; 'ok'");
    await sleep(1800);
    return done;
  };

  /**
   * Chờ mọi phần tử `data-reveal` / `data-reveal-group` đang trong khung nhìn
   * chạy xong hiệu ứng (opacity ≈ 1).
   *
   * Vì sao cần: `scrollIntoView` kích hoạt hiệu ứng GSAP, và chụp sau 1.5s
   * là bắt được giữa chừng ⇒ ảnh có nội dung mờ mờ, dễ bị tưởng là CSS hỏng
   * (đã mắc phải một lần, ảnh ra trống trơn).
   */
  const settleReveals = async () => {
    for (let i = 0; i < 24; i++) {
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
      if (pending === 0) return true;
    }
    console.log('  ⚠ còn hiệu ứng reveal chưa xong khi chụp');
    return false;
  };

  const shot = async (name, scrollExpr, label, clipSelector) => {
    if (scrollExpr) { await ev(scrollExpr); await sleep(600); await settleReveals(); await sleep(400); }
    let params = { format: 'png' };
    if (clipSelector) {
      const box = JSON.parse((await ev(`(() => {
        const el = document.querySelector(${JSON.stringify(clipSelector)});
        if (!el) return 'null';
        const b = el.getBoundingClientRect();
        if (!b.width) return 'null';
        return JSON.stringify({ x: Math.max(0, b.x - 12), y: Math.max(0, b.y - 12), width: b.width + 24, height: b.height + 24, scale: 2 });
      })()`)) || 'null');
      if (box) params = { format: 'png', clip: box };
      else console.log('  ⚠ không tìm thấy', clipSelector, '— chụp toàn màn hình');
    }
    const r = await cmd('Page.captureScreenshot', params);
    fs.writeFileSync(path.join(OUT, `${name}.png`), Buffer.from(r.data, 'base64'));
    console.log('  ✓', label);
  };

  // ─────────────────────────── Desktop 1440 ───────────────────────────
  await setViewport(1440, 900, false);
  console.log('desktop 1440 — intro đã tan:', await loadHome());

  await shot('01-dock', null, '25.1 — Quick Action Dock dưới hero',
    'section.min-h-screen nav[aria-label]');
  await shot('02-journey', "document.getElementById('journey-title').scrollIntoView({block:'start',behavior:'auto'}); 'ok'",
    '25.2 — Quy trình 4 bước (desktop 4 cột + đường nối)');
  // Đường nối nửa vời: đặt lưới ở giữa khoảng hoạt động để thấy scaleX ≈ 0.4
  await shot('03-journey-half', `(() => {
    const ol = document.querySelector('section[aria-labelledby="journey-title"] ol');
    window.scrollTo({ top: ol.getBoundingClientRect().top + window.scrollY - 470, behavior: 'auto' });
    return 'ok';
  })()`, '25.2 — đường nối đang vẽ dở (scaleX giữa chừng)');
  await shot('04-reminder', "document.getElementById('remind-title').scrollIntoView({block:'start',behavior:'auto'}); 'ok'",
    '25.7 — Nhắc lịch (ô đồng ý KHÔNG tick sẵn)');
  await shot('05-closing', "document.getElementById('closing-cta-title').scrollIntoView({block:'center',behavior:'auto'}); 'ok'",
    '25.8 — Closing CTA');
  await shot('06-faq-hidden', `(() => {
    // Đứng ngay trước Closing CTA: nếu FAQ bị render sai (placeholder lộ ra)
    // thì khoảng trống này sẽ có nội dung — ảnh sẽ phản bộ.
    document.getElementById('closing-cta-title').scrollIntoView({ block: 'start', behavior: 'auto' });
    return 'ok';
  })()`, '25.6 — chỗ FAQ lẽ ra phải TRỐNG (phải không có gì cả)');

  // ─────────────────────────── Mobile 390 ────────────────────────────
  await setViewport(390, 844, true);
  console.log('mobile 390 — intro đã tan:', await loadHome());
  await shot('07-journey-mobile', "document.getElementById('journey-title').scrollIntoView({block:'start',behavior:'auto'}); 'ok'",
    '25.2 — Quy trình trên mobile (1 cột, đường nối ngang phải ẩn)');
  await shot('08-mobile-bar', `(() => {
    document.getElementById('remind-title').scrollIntoView({ block: 'center', behavior: 'auto' });
    return 'ok';
  })()`, '27 — thanh hành động dưới màn hình + nút liên hệ nổi được đẩy lên');

  // ─────────────────────────── Mobile 360 ────────────────────────────
  await setViewport(360, 780, true);
  await sleep(1200);
  await shot('09-mobile-bar-360', `(() => {
    document.getElementById('remind-title').scrollIntoView({ block: 'center', behavior: 'auto' });
    return 'ok';
  })()`, '27 — thanh hành động ở 360px (màn nhỏ nhất trong danh sách)');

  try { child.kill(); } catch {}
})();
