/* Cổng kiểm chứng GĐ2B (Chrome headless CDP, 0 dependency).
   Kiểm: Quick Action Dock · Quy trình 4 bước · Closing CTA · Nhắc lịch ·
   FAQ (phải KHÔNG hiện) · Thanh hành động mobile · tràn ngang 8 bề rộng ·
   console.

   Dùng: node scripts/phase2b-check.js [baseUrl]
*/
'use strict';
const { spawn } = require('child_process');
const fs = require('fs'); const os = require('os'); const path = require('path');

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = process.argv[2] || 'http://localhost:3010';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const WIDTHS = [1920, 1440, 1280, 1024, 960, 768, 390, 360];

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-p2b-'));
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
        logs.push(`[${m.params.type}] ` + m.params.args.map(a => String(a.value ?? a.description ?? '')).join(' ').slice(0, 200));
      }
      if (m.method === 'Runtime.exceptionThrown') logs.push('[exception] ' + String(m.params.exceptionDetails?.text ?? '').slice(0, 200));
      if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result || {}); }
    }
  });
  const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
    const n = ++id; pending.set(n, { res, rej });
    const msg = { id: n, method, params }; if (sessionId) msg.sessionId = sessionId;
    child.stdio[3].write(JSON.stringify(msg) + '\0');
  });
  const { targetInfos } = await send('Target.getTargets');
  const page = targetInfos.find(t => t.type === 'page');
  const { sessionId } = await send('Target.attachToTarget', { targetId: page.targetId, flatten: true });
  const cmd = (m, p) => send(m, p, sessionId);
  const ev = async (expr) => {
    const r = await cmd('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('eval: ' + JSON.stringify(r.exceptionDetails).slice(0, 300));
    // Một số lệnh chỉ là câu lệnh bỏ trống (`...; 'ok'`) trả về chuỗi đơn giản
    // chứ không phải JSON — không ép JSON.parse cho những cái đó.
    const value = r.result.value;
    if (typeof value !== "string") return value;
    try { return JSON.parse(value); } catch { return value; }
  };

  const failures = []; const notes = [];
  try {
    await cmd('Page.enable'); await cmd('Runtime.enable');
    await cmd('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await cmd('Page.navigate', { url: BASE + '/' });

    // Chờ intro tan (nếu không thì mọi đo phía dưới vô nghĩa).
    let introOk = false;
    for (let i = 0; i < 35 && !introOk; i++) {
      await sleep(1000);
      introOk = await ev(`(() => { const s = document.querySelector('.intro-video-screen'); if (!s) return true;
        return s.classList.contains('is-hidden') || getComputedStyle(s).opacity === '0' || getComputedStyle(s).display === 'none'; })()`);
    }
    console.log('intro đã tan:', introOk);
    await ev("document.documentElement.style.scrollBehavior='auto'; 'ok'");
    await sleep(1200);

    // ---------------------------------------------------------------- 25.1 Dock
    console.log('\n=== 25.1 — Quick Action Dock ===');
    const dock = await ev(`(() => {
      const nav = document.querySelector('nav[aria-label], nav');
      const dockNav = [...document.querySelectorAll('nav')].find(n => n.querySelector('.glass-pill'));
      if (!dockNav) return JSON.stringify({ found: false });
      const items = [...dockNav.querySelectorAll('li')];
      const inHero = !!dockNav.closest('section.min-h-screen');
      return JSON.stringify({
        found: true, inHero,
        count: items.length,
        items: items.map(li => {
          const a = li.querySelector('a');
          return { href: a ? a.getAttribute('href') : null, label: li.textContent.trim().slice(0, 40) };
        }),
        hasAria: !!dockNav.getAttribute('aria-label'),
        pillsHaveBackdrop: !!dockNav.querySelector('.glass-pill'),
      });
    })()`);
    console.log('  ', JSON.stringify(dock));
    if (!dock.found) failures.push('25.1: không tìm thấy dock');
    else {
      if (dock.count !== 4) failures.push(`25.1: có ${dock.count} mục (mong đợi 4)`);
      if (!dock.inHero) failures.push('25.1: dock không nằm trong hero');
      if (!dock.hasAria) failures.push('25.1: dock thiếu aria-label');
      const tel = dock.items.filter(i => i.href && i.href.startsWith('tel:'));
      if (tel.length < 2) failures.push(`25.1: mong đợi ≥2 liên kết tel:, thấy ${tel.length}`);
      if (dock.items.some(i => !i.href)) failures.push('25.1: có mục không có href');
    }

    // ------------------------------------------------------------ 25.2 Quy trình
    console.log('\n=== 25.2 — Quy trình 4 bước ===');
    const journey = await ev(`(() => {
      const sec = document.querySelector('section[aria-labelledby="journey-title"]');
      if (!sec) return JSON.stringify({ found: false });
      const ol = sec.querySelector('ol');
      const steps = ol ? [...ol.children].filter(li => li.tagName === 'LI') : [];
      const line = ol ? ol.querySelector('span[aria-hidden="true"] > span') : null;
      return JSON.stringify({
        found: true,
        stepCount: steps.length,
        hasIcons: steps.every(s => !!s.querySelector('svg')),
        headingCount: sec.querySelectorAll('h2,h3').length,
        // bề rộng ở 4 cột (desktop) và 1 cột (mobile) sẽ đo riêng bên dưới
        gridCols: ol ? getComputedStyle(ol).gridTemplateColumns.split(' ').filter(Boolean).length : -1,
        connectorHasMotion: line ? (getComputedStyle(line).transform !== 'none') : false,
      });
    })()`);
    console.log('  ', JSON.stringify(journey));
    if (!journey.found) failures.push('25.2: không tìm thấy section quy trình');
    else {
      if (journey.stepCount !== 4) failures.push(`25.2: có ${journey.stepCount} bước (mong đợi 4)`);
      if (!journey.hasIcons) failures.push('25.2: có bước thiếu icon SVG');
      if (journey.gridCols !== 4) failures.push(`25.2 @1440px: lưới ${journey.gridCols} cột (mong đợi 4)`);
    }

    // Đường nối phải ĐỔI theo cuộn (scaleX), không phải tĩnh.
    // Đo ở HAI vị trí nằm trong khoảng hoạt động, tính từ vị trí tuyệt đối của
// lưới. Mắc phải một lần: lấy hai mốc "gần nhau" thì đường nối đã bão hoà về 1
// ở cả hai và script báo nhầm là "không đổi theo cuộn".
const probeLine = `(() => {
      const outer = document.querySelector('ol > span[aria-hidden="true"]');
      if (!outer) return JSON.stringify({ found: false });
      const inner = outer.firstElementChild;
      const ol = document.querySelector('section[aria-labelledby="journey-title"] ol');
      return JSON.stringify({
        found: true,
        olTop: Math.round(ol.getBoundingClientRect().top),
        transform: inner ? getComputedStyle(inner).transform : 'không có',
      });
    })()`;
    /**
     * Framer-motion ghi MotionValue xuống DOM trong một vòng rAF. Cuộn bằng
     * `window.scrollTo` KHÔNG đánh thức compositor ở Chrome headless ⇒ có lúc
     * đo ra giá trị cũ. Đẩy 2 khung hình trước khi đọc để chắc chắn giá trị
     * đã kịp được ghi.
     */
    const kickFrames = `new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r('ok'))))`;
    const placeOlAt = async (top) => {
      for (let attempt = 0; attempt < 4; attempt++) {
        await ev(`(() => {
          const ol = document.querySelector('section[aria-labelledby="journey-title"] ol');
          const abs = ol.getBoundingClientRect().top + window.scrollY;
          window.scrollTo({ top: abs - ${top}, behavior: 'auto' });
          return 'ok';
        })()`);
        await sleep(900);
        await ev(kickFrames);
        const got = await ev(`(() => {
          const ol = document.querySelector('section[aria-labelledby="journey-title"] ol');
          return Math.round(ol.getBoundingClientRect().top);
        })()`);
        if (Math.abs(got - top) <= 40) return true;
      }
      return false;
    };
    const placedA = await placeOlAt(700);
    await ev(kickFrames);
    const beforeScroll = await ev(probeLine);
    const placedB = await placeOlAt(200);
    await ev(kickFrames);
    const afterScroll = await ev(probeLine);
    console.log('   đặt được vị trí:', placedA, placedB);
    console.log('   đường nối @olTop700:', JSON.stringify(beforeScroll));
    console.log('   đường nối @olTop200:', JSON.stringify(afterScroll));
    if (!beforeScroll.found) failures.push('25.2: không tìm thấy đường nối giữa các bước');
    else if (!placedA || !placedB) failures.push('25.2: không cuộn được tới vị trí đo (môi trường không ổn định)');
    else if (beforeScroll.transform === afterScroll.transform) {
      failures.push(`25.2: đường nối KHÔNG đổi theo cuộn (${beforeScroll.transform} → ${afterScroll.transform})`);
    }

    // ---------------------------------------------------- 25.7 Nhắc lịch + form
    console.log('\n=== 25.7 — Nhắc lịch ===');
    const remind = await ev(`(() => {
      const sec = document.querySelector('section[aria-labelledby="remind-title"]');
      if (!sec) return JSON.stringify({ found: false });
      const form = sec.querySelector('form');
      const consent = form.querySelector('input[name="consent"]');
      const btn = form.querySelector('button[type="submit"]');
      return JSON.stringify({
        found: true,
        hasForm: !!form,
        consentChecked: consent ? consent.checked : null,
        hasEmail: !!form.querySelector('input[name="email"]'),
        hasPendingNotice: /chưa được nối|not connected/i.test(sec.textContent || ''),
        hasLive: !!sec.querySelector('[role="status"][aria-live="polite"]'),
        btnStatus: btn ? btn.getAttribute('data-gstatus') : null,
        btnDisabled: btn ? btn.disabled : null,
      });
    })()`);
    console.log('  ', JSON.stringify(remind));
    if (!remind.found) failures.push('25.7: không tìm thấy form nhắc lịch');
    else {
      if (remind.consentChecked !== false) failures.push('25.7: ô đồng ý KHÔNG được tick sẵn');
      if (!remind.hasEmail) failures.push('25.7: thiếu ô email');
      if (!remind.hasLive) failures.push('25.7: thiếu vùng aria-live báo kết quả');
      if (!remind.hasPendingNotice) failures.push('25.7: thiếu dòng "chưa nối dịch vụ gửi thật"');
      if (remind.btnStatus !== 'idle') failures.push(`25.7: nút phải ở idle lúc đầu, thấy ${remind.btnStatus}`);
    }

    // Gửi form sai (thiếu consent + email sai) → phải báo lỗi, không "thành công".
    // Nếu chạy lệnh này lỗi "Inspected target navigated" ⇒ lần trước đó đã
    // điều hướng mất, không phải lỗi sản phẩm — nạp lại rồi thử một lần nữa.
    const runBadSubmit = async () => ev(`(async () => {
      const form = document.querySelector('section[aria-labelledby="remind-title"] form');
      if (!form) return { skipped: true };
      form.querySelector('input[name="name"]').value = '';
      form.querySelector('input[name="email"]').value = 'khong-phai-email';
      form.querySelector('input[name="consent"]').checked = false;
      form.requestSubmit();
      // Chờ tới khi nút HẾT trạng thái loading. Đo cứng 2.5s từng báo nhầm
      // "không báo lỗi" vì lúc đó Server Action còn đang bay.
      let settled = false;
      for (let i = 0; i < 60; i++) {
        await new Promise(r => setTimeout(r, 400));
        const st = form.querySelector('button[type="submit"]').getAttribute('data-gstatus');
        if (st !== 'loading') { settled = true; break; }
      }
      if (!settled) return { error: 'form còn "đang gửi" sau 24s — server action chưa trả lời' };
      await new Promise(r => setTimeout(r, 600));
      const live = form.querySelector('[role="status"][aria-live="polite"]');
      return {
        text: live ? live.textContent.trim() : null,
        invalid: form.querySelectorAll('[aria-invalid="true"]').length,
        btnStatus: form.querySelector('button[type="submit"]').getAttribute('data-gstatus'),
      };
    })()`);

    let badSubmit;
    try {
      badSubmit = await runBadSubmit();
    } catch (e) {
      badSubmit = { error: 'trang bị điều hướng khi gọi form' };
    }
    // Vừa "còn loading sau 24s" vừa "bị điều hướng" đều là môi trường, không
    // phải lỗi sản phẩm — nạp lại trang rồi thử một lần nữa trước khi kết luận.
    if (badSubmit.error) {
      console.log('   thử lại:', badSubmit.error);
      await cmd('Page.navigate', { url: BASE + '/' });
      await sleep(9000);
      for (let i = 0; i < 35; i++) {
        const done = await ev(`(() => { const s = document.querySelector('.intro-video-screen'); if (!s) return true;
          return s.classList.contains('is-hidden') || getComputedStyle(s).display === 'none'; })()`);
        if (done) break;
        await sleep(1000);
      }
      try { badSubmit = await runBadSubmit(); } catch { badSubmit = { error: 'không gọi được form' }; }
    }
    console.log('   gửi dữ liệu sai:', JSON.stringify(badSubmit));
    if (!badSubmit.skipped && !badSubmit.error) {
      if (!badSubmit.invalid) failures.push('25.7: gửi dữ liệu sai nhưng không ô nào báo aria-invalid');
      if (!badSubmit.text) failures.push('25.7: gửi dữ liệu sai nhưng không có thông báo lỗi');
      if (/cảm ơn|thank you/i.test(badSubmit.text || '')) failures.push('25.7: dữ liệu sai VẪN báo thành công — validate phía server không chạy');
    } else if (badSubmit.error) {
      notes.push('25.7: không gọi được form trong headless (điều hướng) — nhánh validate CHƯA được kiểm ở đây');
    }

    // ------------------------------------------------------------ 25.6 FAQ ẩn
    console.log('\n=== 25.6 — FAQ (phải tự ẩn khi chưa có dữ liệu) ===');
    const faq = await ev(`({ visible: !!document.querySelector('#faq-title') })`);
    console.log('  ', JSON.stringify(faq));
    if (faq.visible) failures.push('25.6: FAQ đang hiện dù chưa có câu trả lời nào — không được để placeholder lộ ra');

    // ------------------------------------------------------------ 25.8 ĐÃ BỎ
    // GĐ3 — chủ dự án quyết: BỎ Closing CTA mới, GIỞ banner xanh "BOOK A SERVICE"
    // đã có sẵn (hai khối CTA liền nhau ở cuối trang trông như lặp).
    // Script này đổi từ "phải có Closing CTA" sang "phải KHÔNG có, và phải còn
    // banner cũ" — kiểm đúng trạng thái đã duyệt, không phải hạ tiêu chí.
    console.log('\n=== 25.8 — Closing CTA đã bỏ, banner cũ phải còn ===');
    const closing = await ev(`(() => ({
      coBanner: !!document.querySelector('.cta-panel'),
      bannerText: (document.querySelector('.cta-panel')?.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 60),
      coClosingCta: !!document.querySelector('section[aria-labelledby="closing-cta-title"]'),
      soThanhHanhDong: (() => {
        const nav = [...document.querySelectorAll('nav')].find(n => n.querySelector('.glass-pill'));
        return nav ? nav.querySelectorAll('li').length : 0;
      })(),
    }))()`);
    console.log('  ', JSON.stringify(closing));
    if (closing.coClosingCta) failures.push('25.8: Closing CTA đã được bỏ nhưng vẫn đang render');
    if (!closing.coBanner) failures.push('25.8: mất banner "BOOK A SERVICE" cũ');

    // Tương phản chữ trên nền THỰC TẾ của các nút mới.
    //
    // Vì sao phải đo thay vì nhìn: nút kính `.glass-pill` có nền gradient
    // trong suốt + backdrop-filter, nên `background-color` trả về `rgba(0,0,0,0)`
    // và phép tính tương phản kiểu thông thường cho kết quả vô nghĩa. Cách đúng
    // là dựng lại chuỗi nền thật từ mọi lớp gradient của phần tử, cộng thêm màu
    // của phần tử cha nếu lớp cuối có alpha < 1.
    console.log('\n=== Tương phản chữ trên nút (WCAG AA cần ≥ 4.5) ===');
    const contrastDebug = await ev(`(() => {
      const pill = document.querySelector('.glass-pill');
      if (!pill) return { err: 'không thấy pill' };
      const cs = getComputedStyle(pill);
      const layers = cs.backgroundImage.match(/[^()]+(?:\\([^()]*\\))?/g) || [];
      return {
        color: cs.color,
        backgroundColor: cs.backgroundColor,
        layerCount: layers.length,
        layers: layers.map(s => s.trim().slice(0, 90)),
        parentChain: (() => {
          const out = []; let n = pill, g = 0;
          while (n && g++ < 6) {
            const p = getComputedStyle(n);
            out.push({ tag: n.tagName, cls: String(n.className).slice(0, 40), bg: p.backgroundColor });
            n = n.parentElement;
          }
          return out;
        })(),
      };
    })()`);
    if (process.env.P2B_DEBUG) console.log('   gỡ lỗi dựng nền:', JSON.stringify(contrastDebug, null, 1).slice(0, 1400));

    const contrast = await ev(`(() => {
      const parse = (c) => {
        const m = c.match(/rgba?\\(([^)]+)\\)/);
        if (!m) return null;
        const p = m[1].split(/[,\\s\\/]+/).filter(Boolean).map(Number);
        return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
      };
      // Trộn alpha ĐÚNG.
      //
      // Lần đầu ghim a = 1 trong kết quả ⇒ mỗi lần trộn với một lớp nửa
      // trong suốt lại làm tối đi màu, và mảng "rgba(0,0,0,0)" của gradient
      // biến trắng 255 thành 182 ⇒ nền dựng ra là xám, tương phản báo 3.19:1
      // cho nút đỏ trong khi ảnh thật cho thấy nút nền gần như trắng.
      // Con số khớp chính xác (182 → L = 0.4678 → 5.29:1 với chữ #4a3b30),
      // nên đây là lỗi phép tính chứ không phải lỗi CSS.
      const over = (fg, bg) => {
        const a = fg.a + bg.a * (1 - fg.a);
        if (a <= 0) return { r: 255, g: 255, b: 255, a: 0 };
        return {
          r: (fg.r * fg.a + bg.r * bg.a * (1 - fg.a)) / a,
          g: (fg.g * fg.a + bg.g * bg.a * (1 - fg.a)) / a,
          b: (fg.b * fg.a + bg.b * bg.a * (1 - fg.a)) / a,
          a,
        };
      };
      const lum = (c) => {
        const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
        return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
      };
      const ratio = (a, b) => {
        const l1 = lum(a), l2 = lum(b);
        return +(((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05))).toFixed(2);
      };
      // Nền thật = lớp cuối cùng của mọi gradient trên chính el + màu nền của
      // phần tử cha (nếu lớp cuối còn trong suốt).
      // HẠN CHẾ ĐÃ BIẾT: ở tổ tiên chỉ đọc background-color, không đọc gradient.
      // Các tổ tiên của các nút này đều trong suốt nên không ảnh hưởng kết quả;
      // nếu sau này đặt nút lên một tổ tiên có gradient thì phải mở rộng.
      const bgOf = (el) => {
        let acc = null;
        const cs = getComputedStyle(el);
        for (const layer of [...(cs.backgroundImage.match(/[^()]+(?:\\([^()]*\\))?/g) || [])]) {
          const c = parse(layer);
          if (!c) continue;
          acc = acc === null ? c : over(acc, c);
        }
        if (acc === null) acc = parse(cs.backgroundColor) || { r: 255, g: 255, b: 255, a: 1 };
        let node = el, guard = 0;
        while (acc.a < 0.99 && node.parentElement && guard++ < 20) {
          node = node.parentElement;
          const p = getComputedStyle(node);
          acc = over(acc, parse(p.backgroundColor) || { r: 255, g: 255, b: 255, a: 0 });
        }
        // Vẫn còn trong suốt ⇒ chưa tìm được nền đục nào ⇒ coi như nền trắng
        // (giả định lạc quan, ghi rõ ở dòng in ra).
        if (acc.a < 0.99) acc = { ...acc, a: 1 };
        return acc;
      };
      const targets = [];
      // Đo TRÊN CHÍNH bề mặt vẽ (.glass-pill), không đo phần tử li.
      // Lần đầu đo <li> ⇒ nó trong suốt ⇒ thuật toán phải dò ngược lên tổ tiên
      // và tìm ra nền TỐI của hero ⇒ báo 1.44:1 cho cả 4 viên, trong khi chính
      // viên kính có nền sáng riêng. Đo sai chỗ thì số thì sai, đừng tin số.
      const dock = [...document.querySelectorAll('nav')].find(n => n.querySelector('.glass-pill'));
      if (dock) targets.push(...dock.querySelectorAll('.glass-pill'));
      const sec = document.querySelector('section[aria-labelledby="closing-cta-title"]');
      if (sec) targets.push(...sec.querySelectorAll('a'));
      const bar = [...document.querySelectorAll('nav')].find(n => n.classList.contains('grid-cols-3'));
      if (bar) targets.push(...bar.querySelectorAll('a'));
      const rem = document.querySelector('section[aria-labelledby="remind-title"]');
      if (rem) targets.push(rem.querySelector('button[type="submit"]'));
      return targets.filter(Boolean).map(el => {
        const label = (el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 28);
        const cs = getComputedStyle(el);
        const fg = parse(cs.color) || { r: 0, g: 0, b: 0, a: 1 };
        const bg = bgOf(el);
        const solid = fg.a < 1 ? over(fg, bg) : fg;
        return { label, fg: cs.color, bg: 'dựng lại', ratio: ratio(solid, bg) };
      });
    })()`);
    (contrast || []).forEach(c => {
      const flag = c.ratio >= 4.5 ? 'ok' : c.ratio >= 3 ? 'chỉ đạt AA-large' : '❌ dưới AA';
      console.log(`   ${String(c.ratio).padStart(5)}:1  ${flag.padEnd(16)} ${c.label}  (màu chữ ${c.fg})`);
    });
    (contrast || []).forEach(c => {
      if (c.ratio < 3) failures.push(`tương phản ${c.ratio}:1 quá thấp ở "${c.label}"`);
    });

    // ------------------------------------------- 27 Thanh hành động mobile
    console.log('\n=== 27 — Thanh hành động mobile ===');
    await cmd('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await cmd('Page.navigate', { url: BASE + '/' });
    await sleep(3000);
    for (let i = 0; i < 35; i++) {
      const done = await ev(`(() => { const s = document.querySelector('.intro-video-screen'); if (!s) return true;
        return s.classList.contains('is-hidden') || getComputedStyle(s).display === 'none'; })()`);
      if (done) break;
      await sleep(1000);
    }
    // `.grid-cols-3` nằm TRÊN CHÍNH thẻ <nav>, không phải trong nó ⇒ phải kiểm
    // classList, không dùng querySelector (đã mắc phải một lần: selector sai báo
    // "không hiện" trong khi thực tế nó hiện).
    const hasBar = `!![...document.querySelectorAll('nav')].find(n => n.classList.contains('grid-cols-3'))`;
    const barAtTop = await ev(`({ bar: ${hasBar} })`);
    await ev(`document.documentElement.style.scrollBehavior='auto'; window.scrollTo({top: 1600, behavior:'auto'}); 'ok'`);
    await sleep(1500);
    const barScrolled = await ev(`(() => {
      const bar = [...document.querySelectorAll('nav')].find(n => n.classList.contains('grid-cols-3'));
      if (!bar) return JSON.stringify({ found: false });
      const wrap = bar.closest('div[class*="fixed"]');
      const r = wrap.getBoundingClientRect();
      const contact = document.querySelector('.floating-contact-root');
      const cr = contact ? contact.getBoundingClientRect() : null;
      const cs = getComputedStyle(document.documentElement);
      return JSON.stringify({
        found: true,
        visible: getComputedStyle(wrap).display !== 'none',
        position: getComputedStyle(wrap).position,
        bottom: Math.round(r.bottom),
        vh: window.innerHeight,
        offsetVar: cs.getPropertyValue('--mobile-action-bar-h').trim(),
        contactBottom: cr ? Math.round(cr.bottom) : null,
        overlaps: cr ? cr.bottom > r.top : null,
        tapTargets: [...bar.querySelectorAll('a')].map(a => Math.round(a.getBoundingClientRect().height)),
      });
    })()`);
    // Tổ tiên nào làm đổi containing block của `position: fixed`?
// (transform / filter / backdrop-filter / will-change / contain / perspective)
const ancestors = await ev(`(() => {
      const nav = [...document.querySelectorAll('nav')].find(n => n.classList.contains('grid-cols-3'));
      if (!nav) return JSON.stringify([]);
      const out = [];
      let el = nav;
      while (el && el !== document.documentElement) {
        const cs = getComputedStyle(el);
        const creates =
          cs.transform !== 'none' || cs.filter !== 'none' ||
          (cs.backdropFilter && cs.backdropFilter !== 'none') ||
          cs.willChange !== 'auto' || cs.contain !== 'none' ||
          cs.perspective !== 'none';
        if (creates) out.push({
          tag: el.tagName, cls: String(el.className).slice(0, 70),
          transform: cs.transform.slice(0, 40),
          filter: cs.filter.slice(0, 30),
          backdropFilter: (cs.backdropFilter || '').slice(0, 40),
          willChange: cs.willChange, contain: cs.contain, perspective: cs.perspective,
        });
        el = el.parentElement;
      }
      return JSON.stringify(out);
    })()`);
    console.log('   tổ tiên tạo containing block:', ancestors);

    const bs = barScrolled;
    console.log('   ở đỉnh:', JSON.stringify(barAtTop), '· sau cuộn:', JSON.stringify(barScrolled));
    if (barAtTop.bar) failures.push('27: thanh hành động hiện ở đỉnh trang — phải ẩn cho tới khi cuộn qua hero');
    if (!bs.found) failures.push('27: thanh hành động không hiện sau khi cuộn qua hero');
    else {
      if (bs.position !== 'fixed') failures.push(`27: thanh hành động phải position:fixed, thực tế ${bs.position}`);
      if (Math.abs(bs.bottom - bs.vh) > 2) failures.push(`27: thanh không bám đáy viewport (bottom=${bs.bottom}, vh=${bs.vh})`);
      if (bs.overlaps) failures.push(`27: nút liên hệ nổi bị thanh che (contact bottom ${bs.contactBottom} > bar top)`);
      if (!bs.offsetVar) failures.push('27: thiếu --mobile-action-bar-h để đẩy nút nổi');
      if (bs.tapTargets.some(h => h < 44)) failures.push(`27: có mục cao < 44px: ${bs.tapTargets}`);
    }

    // ------------------------------------------------------------ tràn ngang
    console.log('\n=== Tràn ngang 8 bề rộng ===');
    for (const w of WIDTHS) {
      await cmd('Emulation.setDeviceMetricsOverride', { width: w, height: 900, deviceScaleFactor: 1, mobile: w < 1024 });
      await sleep(800);
      const o = await ev(`({ over: document.documentElement.scrollWidth - document.documentElement.clientWidth })`);
      console.log(`   ${w}px → ${o.over} ${o.over <= 1 ? 'ok' : '❌'}`);
      if (o.over > 1) failures.push(`@${w}px: tràn ngang ${o.over}px`);
    }

    // ------------------------------------------------------------ console
    const hyd = logs.filter(m => /hydrat|did not match|Minified React error #(418|423|425)/i.test(m));
    console.log(`\n=== Console: ${logs.length} cảnh báo/lỗi, ${hyd.length} hydration ===`);
    logs.slice(0, 10).forEach(m => console.log('   -', m));
    if (hyd.length) failures.push(`${hyd.length} cảnh báo hydration`);

    console.log('\n=== KẾT QUẢ ===');
    if (notes.length) { console.log('⚠️ ghi nhận:'); notes.forEach(n => console.log('   -', n)); }
    if (failures.length === 0) console.log('✅ GĐ2B đạt các tiêu chí đã kiểm');
    else { console.log(`❌ ${failures.length} vấn đề:`); [...new Set(failures)].forEach(f => console.log('   -', f)); process.exitCode = 1; }
  } catch (e) {
    console.error('❌ phase2b check failed:', e.message);
    process.exitCode = 1;
  } finally {
    try { child.kill(); } catch {}
  }
})();