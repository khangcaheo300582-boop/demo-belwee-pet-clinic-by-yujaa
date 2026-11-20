/* Performance trace cho hạng mục C1 (GĐ3) — "dải xanh trễ phía sau navbar".
 *
 * VÌ SAO PHẢI CÓ FILE NÀY: đề bài yêu cầu GĐ3 xác minh nguyên nhân bằng
 * Performance trace TRƯỚC khi sửa. Ba giả thuyết audit GĐ0 đã nêu:
 *   1. --scroll-progress nhảy nấc ~50px còn transform chạy 500ms
 *   2. ::before (inset:-2px, z-index:-1) lệch nhịp với nav
 *   3. ripple-reverse remount mỗi lần về đỉnh trang
 *
 * BÀI HỌC TỪ LẦN TRACE ĐẦU (đã làm hỏng số liệu, ghi lại để không lặp):
 *   • rAF trong Chrome headless bị throttle ~1.4fps khi không có hoạt động
 *     compositor ⇒ 56 frame / 40 giây, không phân giải được animation 500ms.
 *     Sửa: bật `Page.startScreencast` để ép trình duyệt sản frame liên tục.
 *   • Đo `::before` bằng công thức scaleX cho ra "tràn 13.39px" nhưng
 *     `opacity` lúc đó là 0 ⇒ vệt KHÔNG HIỆN, con số vô nghĩa.
 *     Sửa: chỉ tính tràn ở frame mà lớp thật sự có opacity > 0.02.
 *   • Tắt rAF rồi bật lại bằng cờ thì không có vòng lặp nào chạy ⇒ 0 mẫu.
 *     Sửa: giữ MỘT vòng lặp chạy suốt, chỉ xoá mảng mẫu.
 *
 * Đo 4 lớp có thể tràn ra ngoài viền nav:
 *   • .site-global-nav-glow  — phần tử thật ⇒ đo rect trực tiếp (đáng tin nhất)
 *   • .site-global-nav::before — pseudo, đo qua scaleX + opacity
 *   • .site-global-ripple-reverse — phần tử thật
 *   • chính .site-global-nav (transform co)
 *
 * Dùng: node scripts/phase3-trace.js [baseUrl]
 */
'use strict';
const { spawn } = require('child_process');
const fs = require('fs'); const os = require('os'); const path = require('path');

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = process.argv[2] || 'http://localhost:3010';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* Bộ đo chạy trong trang — KHÔNG dùng rAF.
 *
 * BÀI HỌC TỪ HAI LẦN TRACE ĐẦU (đã làm hỏng số liệu hai lần, ghi lại để
 * không lặp):
 *   • rAF trong Chrome headless ở máy này chạy ~2fps DÙ đã bật
 *     `Page.startScreencast` ⇒ 58 frame / 40 giây, không phân giải được
 *     animation 500ms của navbar. Đo bằng rAF ở đây là vô nghĩa.
 *   • Tắt rAF rồi bật lại bằng cờ ⇒ 0 mẫu (không còn vòng lặp nào chạy).
 *
 * ⇒ Lấy mẫu bằng cách POLL TỪ NODE, xen kẽ với sự kiện cuộn thật. Mỗi lần
 * cuộn đều ép trình duyệt vẽ frame, nên dòng thời gian vẫn tiến; chỉ có cách
 * lấy mẫu là hỏi trực tiếp thay vì chờ rAF. */
const SAMPLE_ONE = `(() => {
  const nav = document.querySelector('.site-global-nav');
  if (!nav) return null;
  const header = document.querySelector('.site-global-header');
  const glow = nav.querySelector('.site-global-nav-glow');
  const scaleXOf = (t) => {
    const m = t.match(/matrix\\(([^)]+)\\)/);
    return m ? parseFloat(m[1].split(',')[0]) : 1;
  };
  const navR = nav.getBoundingClientRect();
  const cs = getComputedStyle(nav);
  const before = getComputedStyle(nav, '::before');
  const beforeOpacity = parseFloat(before.opacity) || 0;
  const glowCs = glow ? getComputedStyle(glow) : null;
  const glowOpacity = glowCs ? (parseFloat(glowCs.opacity) || 0) : 0;
  const glowR = glow ? glow.getBoundingClientRect() : null;
  const beforeOverhang = ((navR.width + 4) * scaleXOf(before.transform) - navR.width) / 2;
  return {
    t: Math.round(performance.now()),
    y: Math.round(window.scrollY),
    navW: Math.round(navR.width * 10) / 10,
    navScaleX: Math.round(scaleXOf(cs.transform) * 10000) / 10000,
    glowOpacity: Math.round(glowOpacity * 100) / 100,
    glowOverhang: glowR && glowR.width > 0 ? Math.round(((glowR.width - navR.width) / 2) * 10) / 10 : 0,
    glowOverhangVisible: glowOpacity > 0.02 && glowR && glowR.width > 0
      ? Math.round(((glowR.width - navR.width) / 2) * 10) / 10 : 0,
    beforeOpacity: Math.round(beforeOpacity * 100) / 100,
    beforeOverhang: Math.round(beforeOverhang * 10) / 10,
    beforeOverhangVisible: beforeOpacity > 0.02 ? Math.round(beforeOverhang * 10) / 10 : 0,
    ripple: nav.querySelector('.site-global-ripple-reverse') ? 1 : 0,
    progress: header ? header.style.getPropertyValue('--scroll-progress') : '',
    blur: cs.getPropertyValue('--lg-blur').trim(),
    morph: nav.classList.contains('is-morph'),
  };
})()`;

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-tr-'));
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
  const wheel = async (dy, ms = 70) => {
    await cmd('Input.dispatchMouseEvent', {
      type: 'mouseWheel', x: 720, y: 450, deltaX: 0, deltaY: dy, pointerType: 'mouse',
    });
    await sleep(ms);
  };

  await cmd('Page.enable'); await cmd('Runtime.enable');
  await cmd('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

  // KHÔNG bật Page.startScreencast ở đây.
  // Lần trace trước bật nó và mỗi lần lấy mẫu mất ~1.9s: Chrome dừng screencast
  // sau vài frame chưa được Page.screencastFrameAck, mà script này không ack.
  // Nó cũng không giúp ích vì rAF vẫn ~2fps.
  await cmd('Page.navigate', { url: BASE + '/' });

  console.log('đợi intro + hiệu ứng vào trang tan…');
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

  console.log('kiểm tra bộ đo:', (await ev(SAMPLE_ONE)) ? 'ok' : 'không lấy được mẫu');

  // Chi phí một vòng Runtime.evaluate — quyết định mật độ lấy mẫu.
  const t0 = Date.now();
  for (let i = 0; i < 10; i++) await ev(SAMPLE_ONE);
  const perSample = (Date.now() - t0) / 10;
  console.log(`một lần lấy mẫu: ~${Math.round(perSample)}ms (không cuộn)`);

  // Đo tần số rAF thực tế — để ghi lại giới hạn của môi trường, không phải để
  // dựa vào nó.
  const fps = await ev(`new Promise(res => {
    let n = 0; const t0 = performance.now();
    (function c(){ n++; if (performance.now() - t0 < 1000) requestAnimationFrame(c); else res(Math.round(n * 1000 / (performance.now() - t0))); })();
  })`);
  console.log(`rAF thực tế: ~${fps} fps  → KHÔNG dùng rAF để lấy mẫu, poll từ Node`);

  /** Một lượt đo: xen kẽ sự kiện cuộn thật và lấy một mẫu. */
  const record = async (label, steps, settleMs) => {
    const s = [];
    for (const dy of steps) {
      await cmd('Input.dispatchMouseEvent', {
        type: 'mouseWheel', x: 720, y: 450, deltaX: 0, deltaY: dy, pointerType: 'mouse',
      });
      const m = await ev(SAMPLE_ONE);
      if (m) s.push(m);
    }
    // chờ animation kết thúc rồi lấy thêm mẫu cuối
    for (let i = 0; i < Math.ceil(settleMs / 120); i++) {
      await sleep(120);
      const m = await ev(SAMPLE_ONE);
      if (m) s.push(m);
    }
    console.log(`\n──── ${label} · ${s.length} mẫu · khoảng ${s.length ? s[s.length - 1].t - s[0].t : 0}ms ────`);
    return s;
  };

  const down = await record('CUỘN XUỐNG', Array(26).fill(55), 1200);
  const up = await record('CUỘN LÊN', Array(30).fill(-110), 1400);

  const report = (title, s) => {
    if (!s.length) { console.log(`  ${title}: KHÔNG lấy được mẫu`); return {}; }
    const vis = (k) => s.filter((x) => x[k] > 0.02);
    const maxOf = (k) => s.reduce((m, x) => Math.max(m, x[k]), 0);
    const firstT = s[0].t, lastT = s[s.length - 1].t;

    console.log(`  ${title}`);
    console.log(`    frame            : ${s.length} trong ${lastT - firstT}ms → ~${Math.round(s.length * 1000 / Math.max(1, lastT - firstT))} fps`);
    console.log(`    nav scaleX       : ${s[0].navScaleX} → ${s[s.length - 1].navScaleX} (đạt cuối từ t=${(s.find((x) => x.navScaleX === s[s.length - 1].navScaleX) || s[0]).t - firstT}ms)`);
    console.log(`    --scroll-progress: ${[...new Set(s.map((x) => x.progress))].filter(Boolean).join(' → ')}`);
    console.log(`    LỚP A .nav-glow  : ${vis('glowOverhangVisible').length} frame có tràn khi NHÌN THẤY` +
      ` · tràn tối đa ${maxOf('glowOverhangVisible')}px · opacity tối đa ${maxOf('glowOpacity')}`);
    console.log(`    LỚP B ::before   : ${vis('beforeOverhangVisible').length} frame có tràn khi NHÌN THẤY` +
      ` · tràn tối đa ${maxOf('beforeOverhangVisible')}px · opacity tối đa ${maxOf('beforeOpacity')}`);
    console.log(`    ripple-reverse   : ${s.filter((x) => x.rippleVisible).length} frame có hiện`);
    const worst = s.reduce((m, x) => (x.glowOverhangVisible > m.glowOverhangVisible ? x : m), s[0]);
    console.log(`    frame tệ nhất    : t=${worst.t - firstT}ms y=${worst.y} is-morph=${worst.morph}`);
    console.log(`      navW=${worst.navW} glowTràn=${worst.glowOverhangVisible}px (opa ${worst.glowOpacity})` +
      ` ::beforeTràn=${worst.beforeOverhangVisible}px (opa ${worst.beforeOpacity})`);
    return {
      glowVisibleFrames: vis('glowOverhangVisible').length,
      glowMax: maxOf('glowOverhangVisible'),
      beforeVisibleFrames: vis('beforeOverhangVisible').length,
      beforeMax: maxOf('beforeOverhangVisible'),
    };
  };

  const rD = report('CUỘN XUỐNG', down);
  const rU = report('CUỘN LÊN', up);

  console.log('\n──── Giả thuyết 3: ripple-reverse remount mỗi lần về đỉnh ────');
  const counts = [];
  for (let round = 0; round < 3; round++) {
    for (let i = 0; i < 12; i++) await wheel(90, 45);
    await sleep(500);
    for (let i = 0; i < 14; i++) await wheel(-120, 45);
    await sleep(700);
    counts.push(await ev(`document.querySelectorAll('.site-global-ripple-reverse').length`));
  }
  console.log(`  số phần tử .site-global-ripple-reverse sau mỗi vòng: ${counts.join(' → ')}`);
  console.log(`  key điều khiển remount: rr-\${atTopCount} — số phần tử luôn 1 KHÔNG chứng minh không remount,`);
  console.log(`  cần xem animation-name/đối tượng animation mà có chạy lại không.`);

  console.log('\n──── KẾT LUẬN C1 (chỉ dựa trên số đo) ────');
  if (rD.glowMax > 2) console.log(`  Lớp .site-global-nav-glow tràn ${rD.glowMax}px ra ngoài viền nav khi NHÌN THẤY (${rD.glowVisibleFrames} frame) → nghi phạm chính.`);
  if (rD.beforeMax > 2) console.log(`  ::before tràn ${rD.beforeMax}px (${rD.beforeVisibleFrames} frame) → nghi phạm phụ.`);
  if (rD.glowMax <= 2 && rD.beforeMax <= 2) console.log('  KHÔNG lớp nào tràn đáng kể ở điều kiện này — cần đo ở bề rộng/điều kiện khác.');

  const out = path.resolve(__dirname, '..', 'docs', 'phase3-trace.json');
  fs.writeFileSync(out, JSON.stringify({ fps, down, up }, null, 1));
  console.log(`\n  mẫu thô → ${out}`);
  try { child.kill(); } catch {}
})().catch((e) => { console.error('❌ trace lỗi:', e.message); process.exitCode = 1; });
