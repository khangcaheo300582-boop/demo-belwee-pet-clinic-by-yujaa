/* Cổng kiểm chứng GĐ3 (Chrome headless CDP, 0 dependency).
 *
 * Kiểm:
 *   C2 — thanh chỉ còn 3 mục · nút "Thêm" có nhãn · thẻ danh mục VẪN đủ 7 mục
 *        · không chồng lấn ở mọi bề rộng · mở/đóng thẻ bằng bàn phím
 *   D   — thẻ "Belwee luôn quan tâm bạn" đúng route: có ở trang nội dung,
 *        KHÔNG ở trang chủ / đặt lịch / đăng nhập / staff
 *   chung — tràn ngang, console, hydration
 *
 * Dùng: node scripts/phase3-check.js [baseUrl]
 */
'use strict';
const { spawn } = require('child_process');
const fs = require('fs'); const os = require('os'); const path = require('path');

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = process.argv[2] || 'http://localhost:3010';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const WIDTHS = [1920, 1440, 1280, 1024, 960, 768, 390, 360];

/** Trang PHẢI có thẻ D / trang KHÔNG được có. */
const SHOULD_HAVE_CARD = ['/gioi-thieu', '/dich-vu', '/tuyen-dung', '/doi-ngu', '/kien-thuc-thu-y', '/lien-he', '/tien-ich'];
const SHOULD_NOT_HAVE_CARD = ['/', '/dang-nhap', '/tao-tai-khoan'];

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-p3-'));
  const child = spawn(CHROME, ['--headless=new', '--remote-debugging-pipe', '--no-first-run',
    '--no-default-browser-check', '--disable-gpu', '--autoplay-policy=no-user-gesture-required',
    '--force-device-scale-factor=1', `--user-data-dir=${dir}`, 'about:blank'],
    { stdio: ['pipe', 'pipe', 'pipe', 'pipe', 'pipe'] });

  let buf = ''; const pending = new Map(); let id = 0; const logs = [];
  child.stdio[4].setEncoding('utf8');
  child.stdio[4].on('data', (chunk) => {
    buf += chunk; let i;
    while ((i = buf.indexOf('\0')) !== -1) {
      const p = buf.slice(0, i); buf = buf.slice(i + 1);
      if (!p) continue;
      let m; try { m = JSON.parse(p); } catch { continue; }
      if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'error' || m.params.type === 'warning')) {
        logs.push(`[${m.params.type}] ` + m.params.args.map((a) => String(a.value ?? a.description ?? '')).join(' ').slice(0, 200));
      }
      if (m.method === 'Runtime.exceptionThrown') logs.push('[exception] ' + String(m.params.exceptionDetails?.text ?? '').slice(0, 200));
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
    if (r.exceptionDetails) throw new Error('eval: ' + JSON.stringify(r.exceptionDetails).slice(0, 300));
    const v = r.result.value;
    if (typeof v !== 'string') return v;
    try { return JSON.parse(v); } catch { return v; }
  };

  const failures = [];

  const waitReady = async () => {
    let ok = false;
    for (let i = 0; i < 45 && !ok; i++) {
      await sleep(1000);
      ok = await ev(`(() => {
        const t = document.querySelector('.template-enter');
        const s = document.querySelector('.intro-video-screen');
        return (!s || s.classList.contains('is-hidden') || getComputedStyle(s).display === 'none')
          && (!t || getComputedStyle(t).filter === 'none' || getComputedStyle(t).filter === 'blur(0px)');
      })()`);
    }
    return ok;
  };

  /** Chờ một selector xuất hiện — không đoán bằng số giây. */
  const waitFor = async (selector, timeoutMs = 40000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
      if (await ev(`!!document.querySelector(${JSON.stringify(selector)})`)) return true;
      await sleep(500);
    }
    return false;
  };

  /**
   * Chờ trang "dính" — hết skeleton, hết intro, navbar đã có, và thẻ D đã quyết
   * định xong (gate bật trong useEffect nên phải chờ sau hydrate).
   *
   * Lần đầu chạy, probe đầu ra 0 mục / thẻ D báo THIẾU trên 3 route vì đo
   * trước lúc React hydrate xong. Đo cái chưa hydrate là đo rác.
   *
   * `settle` đọc CÙNG MỘT phép đo cho tới khi nó lặp lại 3 lần cách nhau 1.2s.
   * Máy này chạy build nặng, hydrate có lúc mất 15–20s; một lần chờ cố định
   * vẫn bị sót. Số ổn định mới là số đã hydrate.
   */
  const settle = async (expr, tries = 10) => {
    let prev = null, stable = 0;
    for (let i = 0; i < tries; i++) {
      const v = await ev(expr);
      const s = JSON.stringify(v);
      stable = s === prev ? stable + 1 : 0;
      prev = s;
      if (stable >= 2) return v;
      await sleep(1200);
    }
    return prev ? JSON.parse(prev) : null;
  };

  const settlePage = async (route, expectCard) => {
    await cmd('Page.navigate', { url: BASE + route });
    if (route === '/') await waitReady();
    const navOk = await waitFor('.site-global-links', route === '/' ? 45000 : 30000);
    // Trang NÀY dự kiến có thẻ D ⇒ chờ thẻ xuất hiện thật, chờ lâu hơn nhiều.
    // Hydrate `/dich-vu` trên máy này có lúc mất 20–30s; đo sau 2s là đo rác.
    if (expectCard) await waitFor('.abovefooter-bright', 45000);
    await sleep(1500);
    await settle(`({ nav: document.querySelectorAll('a.site-global-link').length, card: document.querySelectorAll('.abovefooter-bright').length })`);
    return navOk;
  };

  try {
    await cmd('Page.enable'); await cmd('Runtime.enable');
    await cmd('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    // THIẾU DÒNG NÀY thì trang vẫn là about:blank và mọi phép đo ra 0.
    // (Đã mắc phải một lần: sửa khối chờ bên dưới làm rơi luôn dòng navigate.)
    await cmd('Page.navigate', { url: BASE + '/' });
    console.log('trang chủ sẵn sàng:', await waitReady());
    console.log('navbar đã dựng:', await waitFor('.site-global-links', 45000));
    await ev("document.documentElement.style.scrollBehavior='auto'; 'ok'");
    await sleep(1500);

    // ───────────────────────────────────────────── C2 — thanh 3 mục + "Thêm"
    console.log('\n=== C2 — thanh 3 mục + nút "Thêm" ===');
    const c2 = await ev(`(() => {
      const bar = document.querySelector('.site-global-links');
      const btn = document.querySelector('.site-global-hamburger');
      const label = btn ? btn.querySelector('.site-global-hamburger-label') : null;
      const labelCs = label ? getComputedStyle(label) : null;
      const barItems = bar ? [...bar.querySelectorAll('a.site-global-link')].map(a => a.textContent.trim()) : [];
      const cardItems = [...document.querySelectorAll('#site-global-hamburger-card .site-global-hamburger-item')]
        .map(b => b.textContent.replace(/→$/, '').trim());
      return {
        barCount: barItems.length,
        barItems,
        cardCount: cardItems.length,
        cardItems,
        btnLabel: label ? label.textContent.trim() : null,
        labelVisible: labelCs ? labelCs.display !== 'none' : false,
        btnHasAria: btn ? !!btn.getAttribute('aria-label') : false,
        btnHasExpanded: btn ? btn.getAttribute('aria-expanded') === 'false' : false,
        barInMenu: cardItems.filter((t) => barItems.includes(t)).length,
      };
    })()`);
    console.log('  ', JSON.stringify(c2, null, 1));
    if (c2.barCount !== 3) failures.push(`C2: thanh có ${c2.barCount} mục (mong đợi 3)`);
    if (!c2.labelVisible) failures.push('C2: nhãn "Thêm" không hiện ở 1440px');
    if (!c2.btnHasAria) failures.push('C2: nút "Thêm" thiếu aria-label');
    if (!c2.btnHasExpanded) failures.push('C2: nút "Thêm" thiếu aria-expanded=false');
    // Thẻ danh mục = 7 mục điều hướng + 1 mục tài khoản (đăng nhập) = 8.
    // Lúc đầu ghi 7 và báo sai suốt mấy lượt — số đúng là 8.
    if (c2.cardCount !== 8) failures.push(`C2: thẻ danh mục có ${c2.cardCount} mục (mong đợi 8 = 7 nav + 1 tài khoản — không được mất route nào)`);
    // 3 mục trên thanh phải nằm trong thẻ danh mục
    if (c2.barInMenu !== 3) failures.push(`C2: ${c2.barInMenu}/3 mục trên thanh có trong thẻ danh mục`);

    // ── không chồng lấn: cụm link vs cụm nút bên phải, ở mọi bề rộng
    console.log('\n=== C2 — chồng lấn trái/phải ở 8 bề rộng ===');
    for (const w of WIDTHS) {
      await cmd('Emulation.setDeviceMetricsOverride', { width: w, height: 900, deviceScaleFactor: 1, mobile: w < 1024 });
      await sleep(700);
      const g = await ev(`(() => {
        const links = document.querySelector('.site-global-links');
        const actions = document.querySelector('.site-global-actions');
        const logo = document.querySelector('.site-global-logo');
        if (!links || !actions || !logo) return { err: 'thiếu phần tử' };
        // Ẩn bằng display:none ⇒ getBoundingClientRect trả 0,0,0,0 ⇒ mọi phép
        // so sánh bề rộng đều ra số âm và bị báo chồng lấn giả.
        // (Đã mắc phải: "logo↔link -151px" ở ≤1024px chỉ vì links bị ẩn.)
        if (getComputedStyle(links).display === 'none') {
          return { hidden: true, items: links.querySelectorAll('a.site-global-link').length };
        }
        const l = links.getBoundingClientRect(), a = actions.getBoundingClientRect(), g = logo.getBoundingClientRect();
        return {
          gapLinksActions: Math.round(a.left - l.right),
          gapLogoLinks: Math.round(l.left - g.right),
          items: links.querySelectorAll('a.site-global-link').length,
        };
      })()`);
      if (g.hidden) {
        console.log(`   ${String(w).padStart(4)}px → links ẩn (đúng, dùng nút "Thêm") · ${g.items} mục trong DOM`);
        continue;
      }
      const ok = g.err ? false : (g.gapLinksActions >= 0 && g.gapLogoLinks >= 0);
      console.log(`   ${String(w).padStart(4)}px → ${g.err ? g.err : `link↔nút ${g.gapLinksActions}px, logo↔link ${g.gapLogoLinks}px, ${g.items} mục`} ${ok ? 'ok' : '❌'}`);
      if (!ok) failures.push(`@${w}px: thanh chồng lấn (${JSON.stringify(g)})`);
    }

    // ── bàn phím: focus được, bấm thật mở thẻ, Escape đóng
    console.log('\n=== C2 — bàn phím ===');
    await cmd('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await sleep(1200);

    // Thử tới 3 lần: đo tọa độ nút rồi bấm chuột thật là hai việc ở hai thời
    // điểm khác nhau, giữa chúng trang có thể vừa kịp dựng lại (đã thấy bấm
    // trượt và bấm không mở ở lượt trước). Thử lại là cách đúng; đo một lần
    // rồi kết luận thì chỉ là đoán.
    let afterOpen = null, focused = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      const hit = await ev(`(() => {
        const b = document.querySelector('.site-global-hamburger');
        if (!b) return null;
        b.focus();
        const r = b.getBoundingClientRect();
        const x = Math.round(r.left + r.width / 2), y = Math.round(r.top + r.height / 2);
        const top = document.elementFromPoint(x, y);
        return {
          x, y,
          focused: document.activeElement === b,
          // phần tử đúng nhất bị bấm trúng có phải nút không (nếu không, tọa độ sai)
          hitSelf: top === b || b.contains(top),
          hitTag: top ? top.tagName + '.' + String(top.className).slice(0, 40) : null,
        };
      })()`);
      if (!hit) { await sleep(1500); continue; }
      focused = hit.focused;
      if (!hit.hitSelf) {
        console.log(`   lần ${attempt + 1}: tọa độ (${hit.x},${hit.y}) trúng ${hit.hitTag} chứ không phải nút — bỏ qua`);
        await sleep(1200);
        continue;
      }
      for (const type of ['mousePressed', 'mouseReleased']) {
        await cmd('Input.dispatchMouseEvent', { type, x: hit.x, y: hit.y, button: 'left', clickCount: 1 });
      }
      await sleep(1400);
      afterOpen = await ev(`(() => {
        const card = document.getElementById('site-global-hamburger-card');
        const btn = document.querySelector('.site-global-hamburger');
        return {
          open: card ? card.classList.contains('is-open') : null,
          expanded: btn ? btn.getAttribute('aria-expanded') : null,
          visibleItems: card ? [...card.querySelectorAll('.site-global-hamburger-item')].filter((b) => b.getBoundingClientRect().height > 0).length : 0,
          focusInCard: card ? card.contains(document.activeElement) : false,
          focusWhere: document.activeElement ? document.activeElement.tagName + '.' + String(document.activeElement.className).slice(0, 34) : null,
          dialog: card ? card.getAttribute('role') : null,
          hidden: card ? card.getAttribute('aria-hidden') : null,
        };
      })()`);
      if (afterOpen.open) break;
      console.log(`   lần ${attempt + 1}: bấm trúng nút nhưng thẻ chưa mở — thử lại`);
      await sleep(1200);
    }
    console.log('   focus được:', focused, '· sau khi bấm:', JSON.stringify(afterOpen));
    if (!focused) failures.push('C2: nút "Thêm" không nhận được focus');
    if (!afterOpen || afterOpen.open !== true) failures.push('C2: nút "Thêm" bấm không mở được thẻ danh mục');
    if (afterOpen.expanded !== 'true') failures.push('C2: aria-expanded không đổi sang true khi mở');
    if (afterOpen.hidden !== 'false') failures.push(`C2: thẻ danh mục mở nhưng aria-hidden vẫn là "${afterOpen.hidden}"`);
    // Thẻ danh mục liệt kê 7 mục điều hướng + 1 mục tài khoản = 8.
    // Lúc đầu ghi 7 và báo sai — số đúng là 8.
    if (afterOpen.visibleItems !== 8) failures.push(`C2: thẻ danh mục mở ra nhưng chỉ ${afterOpen.visibleItems} mục hiện (mong đợi 8 = 7 nav + 1 tài khoản)`);
    if (!afterOpen.focusInCard) failures.push(`C2: focus không vào thẻ danh mục sau khi mở (đang ở ${afterOpen.focusWhere})`);

    await ev(`(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      return 'ok';
    })()`);
    await sleep(900);
    const afterEsc = await ev(`(() => {
      const card = document.getElementById('site-global-hamburger-card');
      const btn = document.querySelector('.site-global-hamburger');
      return { open: card ? card.classList.contains('is-open') : null, expanded: btn ? btn.getAttribute('aria-expanded') : null };
    })()`);
    console.log('   sau Escape:', JSON.stringify(afterEsc));
    if (afterEsc.open !== false) failures.push('C2: Escape không đóng được thẻ danh mục');

    // ───────────────────────────────────────────────── D — thẻ trên mọi route
    console.log('\n=== D — thẻ "Belwee luôn quan tâm bạn" theo route ===');
    for (const route of SHOULD_HAVE_CARD) {
      await settlePage(route, true);
      // đọc MỘT lần: trước đây gọi hai eval liên tiếp nên bị lệch số
      // (báo "THIẾU" nhưng đếm được 1) vì gate bật giữa hai lần đo.
      const r = await ev(`({ has: !!document.querySelector('.abovefooter-bright'), n: document.querySelectorAll('.abovefooter-bright').length })`);
      console.log(`   ${route.padEnd(20)} → ${r.has ? 'có' : 'THIẾU'} (số bản: ${r.n})`);
      if (!r.has) failures.push(`D: ${route} phải có thẻ nhưng không thấy`);
      if (r.n > 1) failures.push(`D: ${route} render ${r.n} bản thẻ (phải đúng 1)`);
    }
    for (const route of SHOULD_NOT_HAVE_CARD) {
      await settlePage(route, false);
      const r = await ev(`({ has: !!document.querySelector('.abovefooter-bright'), n: document.querySelectorAll('.abovefooter-bright').length })`);
      console.log(`   ${route.padEnd(20)} → ${r.has ? '❌ CÓ (không được)' : 'đúng: không có'} (${r.n} bản)`);
      if (r.has) failures.push(`D: ${route} KHÔNG được có thẻ nhưng lại có`);
    }

    // ─────────────────────────────────────────────── tràn ngang + console
    console.log('\n=== Tràn ngang ===');
    for (const w of WIDTHS) {
      await cmd('Emulation.setDeviceMetricsOverride', { width: w, height: 900, deviceScaleFactor: 1, mobile: w < 1024 });
      await settlePage('/dich-vu', true);
      const o = await ev(`({ over: document.documentElement.scrollWidth - document.documentElement.clientWidth })`);
      console.log(`   ${String(w).padStart(4)}px → ${o.over} ${o.over <= 1 ? 'ok' : '❌'}`);
      if (o.over > 1) failures.push(`@${w}px (/dich-vu): tràn ngang ${o.over}px`);
    }

    const hyd = logs.filter((m) => /hydrat|did not match|Minified React error #(418|423|425)/i.test(m));
    console.log(`\n=== Console: ${logs.length} cảnh báo/lỗi, ${hyd.length} hydration ===`);
    logs.slice(0, 10).forEach((m) => console.log('   -', m));
    if (hyd.length) failures.push(`${hyd.length} cảnh báo hydration`);

    console.log('\n=== KẾT QUẢ ===');
    if (failures.length === 0) console.log('✅ GĐ3 đạt các tiêu chí đã kiểm');
    else { console.log(`❌ ${failures.length} vấn đề:`); [...new Set(failures)].forEach((f) => console.log('   -', f)); process.exitCode = 1; }
  } catch (e) {
    console.error('❌ phase3 check failed:', e.message);
    process.exitCode = 1;
  } finally {
    try { child.kill(); } catch {}
  }
})();
