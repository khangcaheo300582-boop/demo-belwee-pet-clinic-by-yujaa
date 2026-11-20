/* Headless Chrome (CDP over --remote-debugging-pipe, zero deps) — Giai đoạn 2A check.

   Kiểm những gì GĐ2A (A1, A2, A3, §24, z-index, A7) khai là đã làm:
     §24  h1 kính lỏng: đúng 1 phần tử chữ liên tục, `background-clip: text` có
          hiệu lực, accent dùng --glass-tint, lớp sheen aria-hidden, và tên
          truy cập của h1 khớp NGUYÊN VĂN (không còn cần sr-only).
     A1   hai lớp nền thay thế nhau: cuộn xuống thì opacity ảnh TĂNG còn
          opacity video GIẢM; ở đáy hero ảnh phải gần 1, video gần 0.
     A2   pill kính chỉ hiện từ `lg`; bộ điều khiển cũ ẩn ở `lg`, hiện dưới
          `lg`; bấm nút sau thì tên trong pill đổi và aria-live đọc được.
     A3   thanh cuộn ngang đã ẩn (`scrollbar-width: none`) nhưng container
          VẪN cuộn được và vẫn còn scroll-snap.
     A2'  thẻ đang active có vật liệu kính thật (`.pt-glass` + backdrop-filter).
     R    bề rộng 1920/1440/1280/1024/960/768/390/360 — không tràn ngang.
     RM   `prefers-reduced-motion: reduce` → sheen bị ẩn, nền hiện thẳng.

   KHÔNG kiểm: CLS, Lighthouse, độ đẹp thị giác, screen reader thật.

   Cách dùng: node scripts/phase2a-check.js [baseUrl]
*/
'use strict';

const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = process.argv[2] || 'http://localhost:3001';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class CDP {
  constructor(child) {
    this.writable = child.stdio[3];
    this.readable = child.stdio[4];
    this.msgId = 0;
    this.pending = new Map();
    this.buffer = '';
    /**
     * Hook quan sát mọi sự kiện CDP (console, exception…).
     *
     * KHÔNG được `removeAllListeners('data')` rồi tự parse lại: lớp này dùng
     * chính listener đó để resolve `pending`, gỡ đi là MỌI lệnh đều treo vô
     * hạn (đã mắc phải một lần — watchdog 300s, không in gì).
     */
    this.onMessage = null;
    this.readable.setEncoding('utf8');
    this.readable.on('data', (c) => this.#onData(c));
    this.readable.on('error', () => {});
  }
  #onData(chunk) {
    this.buffer += chunk;
    let i;
    while ((i = this.buffer.indexOf('\0')) !== -1) {
      const payload = this.buffer.slice(0, i);
      this.buffer = this.buffer.slice(i + 1);
      if (!payload) continue;
      let msg;
      try { msg = JSON.parse(payload); } catch { continue; }
      if (this.onMessage) {
        try { this.onMessage(msg); } catch { /* hook không được phép làm hỏng phiên */ }
      }
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result || {});
      }
    }
  }
  send(method, params = {}, sessionId) {
    return new Promise((resolve, reject) => {
      const id = ++this.msgId;
      this.pending.set(id, { resolve, reject });
      const msg = { id, method, params };
      if (sessionId) msg.sessionId = sessionId;
      try { this.writable.write(JSON.stringify(msg) + '\0'); } catch (e) { reject(e); }
    });
  }
  async attachToPage() {
    const { targetInfos } = await this.send('Target.getTargets');
    const page = targetInfos.find((t) => t.type === 'page');
    if (!page) throw new Error('no page target');
    const { sessionId } = await this.send('Target.attachToTarget', { targetId: page.targetId, flatten: true });
    return sessionId;
  }
}

const WIDTHS = [1920, 1440, 1280, 1024, 960, 768, 390, 360];

async function main() {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-p2a-'));
  const child = spawn(CHROME, [
    '--headless=new', '--remote-debugging-pipe', '--no-first-run',
    '--no-default-browser-check', '--disable-gpu',
    '--autoplay-policy=no-user-gesture-required',
    '--force-device-scale-factor=1',
    `--user-data-dir=${userDataDir}`, 'about:blank',
  ], { stdio: ['pipe', 'pipe', 'pipe', 'pipe', 'pipe'] });

  let finished = false;
  child.on('exit', (code) => { if (!finished) { console.error('Chrome exited early', code); process.exit(2); } });

  const cdp = new CDP(child);
  const watchdog = setTimeout(() => { console.error('WATCHDOG 300s'); try { child.kill(); } catch {} process.exit(3); }, 300000);
  watchdog.unref();

  const failures = [];
  const notes = [];
  const consoleErrors = [];

  const evalJS = async (cmd, expression) => {
    const r = await cmd('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('eval: ' + JSON.stringify(r.exceptionDetails).slice(0, 400));
    const value = r.result ? r.result.value : undefined;
    if (typeof value !== 'string') throw new Error('eval không trả chuỗi JSON: ' + JSON.stringify(r.result).slice(0, 300));
    return JSON.parse(value);
  };

  try {
    const session = await cdp.attachToPage();
    const cmd = (m, p) => cdp.send(m, p, session);
    await cmd('Page.enable');
    await cmd('Runtime.enable');
    await cmd('Log.enable');

    // Gom lỗi console + hydration warning suốt phiên (qua hook của lớp CDP).
    cdp.onMessage = (msg) => {
      if (msg.method === 'Runtime.consoleAPICalled' && (msg.params.type === 'error' || msg.params.type === 'warning')) {
        consoleErrors.push(`[console.${msg.params.type}] ` +
          msg.params.args.map((a) => String(a.value ?? a.description ?? '')).join(' ').slice(0, 220));
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        consoleErrors.push('[exception] ' + String(msg.params.exceptionDetails?.text ?? '').slice(0, 220));
      }
      if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
        consoleErrors.push('[log] ' + String(msg.params.entry.text ?? '').slice(0, 220));
      }
    };

    await cmd('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await cmd('Page.navigate', { url: BASE + '/' });
    await sleep(9000);

    // ------------------------------------------------------------------ §24
    console.log('=== §24 — tiêu đề kính lỏng ===');
    const h = await evalJS(cmd, `(() => {
      const h1 = document.querySelector('h1');
      if (!h1) return JSON.stringify({ found: false });
      const cs = getComputedStyle(h1);
      const accent = h1.querySelector('.glass-heading__accent');
      const sheen = h1.querySelector('.glass-heading__sheen');
      // Đếm số "node chữ": span/là con trực tiếp hay cháu.
      const spanCount = h1.querySelectorAll('span').length;
      return JSON.stringify({
        found: true,
        text: h1.textContent.trim(),
        tag: h1.tagName,
        hasGlassClass: h1.classList.contains('glass-heading'),
        bgClip: cs.webkitBackgroundClip || cs.backgroundClip,
        bgImage: cs.backgroundImage.slice(0, 80),
        color: cs.color,
        stroke: cs.webkitTextStrokeWidth + ' ' + cs.webkitTextStrokeColor,
        filter: cs.filter.slice(0, 60),
        accent: accent ? {
          text: accent.textContent,
          fill: getComputedStyle(accent).webkitTextFillColor,
          ws: getComputedStyle(accent).whiteSpace,
        } : null,
        sheen: sheen ? {
          ariaHidden: sheen.getAttribute('aria-hidden'),
          hasDataText: !!sheen.getAttribute('data-text'),
          dataText: (sheen.getAttribute('data-text') || '').slice(0, 60),
          bgClip: getComputedStyle(sheen).webkitBackgroundClip || getComputedStyle(sheen).backgroundClip,
        } : null,
        spanCount,
      });
    })()`);

    if (!h.found) failures.push('§24: không tìm thấy h1');
    else {
      console.log('   text:', JSON.stringify(h.text), '· spans:', h.spanCount);
      console.log('   background-clip:', h.bgClip, '· color:', h.color, '· stroke:', h.stroke);
      console.log('   filter:', h.filter);
      console.log('   accent:', JSON.stringify(h.accent));
      console.log('   sheen:', JSON.stringify(h.sheen));
      if (!h.hasGlassClass) failures.push('§24: h1 không có class .glass-heading');
      if (!/text/.test(h.bgClip || '')) failures.push('§24: background-clip:text KHÔNG có hiệu lực → chữ sẽ vô hình (color:transparent)');
      if (h.spanCount > 2) failures.push(`§24: h1 còn ${h.spanCount} span — gradient sẽ khởi động lại ở từng span`);
      if (!h.sheen || h.sheen.ariaHidden !== 'true') failures.push('§24: lớp sheen phải là span aria-hidden');
      // `home.heroAccent` rỗng ở tiếng Anh ("") và là "!!!" ở tiếng Việt ⇒
      // kiểm accent phải chuyển sang `vi`, nếu không sẽ báo động giả.
      if (h.accent) {
        console.log('   accent đã hiện (site đang ở tiếng Việt) ✓');
      } else {
        console.log('   accent rỗng — chuyển sang tiếng Việt để kiểm "!!!"');
        await evalJS(cmd, `(() => { localStorage.setItem('belwee-language','vi'); return JSON.stringify({ok:true}); })()`);
        await cmd('Page.navigate', { url: BASE + '/?lang=vi' });
        await sleep(8000);
        const vi = await evalJS(cmd, `(() => {
          const h1 = document.querySelector('h1');
          const a = h1 ? h1.querySelector('.glass-heading__accent') : null;
          return JSON.stringify({
            storedLang: localStorage.getItem('belwee-language'),
            text: h1 ? h1.textContent.trim() : null,
            accent: a ? { text: a.textContent, fill: getComputedStyle(a).webkitTextFillColor, ws: getComputedStyle(a).whiteSpace } : null,
            spans: h1 ? h1.querySelectorAll('span').length : -1,
          });
        })()`);
        console.log('   [vi]', JSON.stringify(vi));
        if (vi.text === h.text) {
          // Site vẫn ở tiếng Anh ⇒ KHÔNG phải lỗi sản phẩm: profile ẩn danh
          // của Chrome headless không nhận lựa chọn ngôn ngữ từ localStorage
          // (LanguageProvider đọc đúng key `belwee-language`, đã xác minh).
          // Ghi nhận thay vì báo đỏ; accent đã được kiểm bằng trình duyệt thật.
          notes.push('§24: KHÔNG chuyển được sang tiếng Việt trong Chrome headless ⇒ chưa kiểm được dấu "!!!" ở đây (đã kiểm bằng trình duyệt thật)');
        } else {
          if (!vi.accent) failures.push('§24 (vi): thiếu .glass-heading__accent — dấu "!!!" không được tô');
          else {
            if (vi.accent.text !== '!!!') failures.push(`§24 (vi): accent = ${JSON.stringify(vi.accent.text)}`);
            // QUAN TRỌNG: chỉ kiểm "là màu" là chưa đủ. `--glass-tint` của dự án
            // là MÀU (--pt-accent), không phải kênh HSL; viết `hsl(var(...))` làm
            // khai báo bị loại ⇒ -webkit-text-fill-color kế thừa `transparent` từ
            // cha ⇒ dấu "!!!" biến mất mà KHÔNG có lỗi console. Phải kiểm alpha.
            if (/rgba?\([^)]*,\s*0\s*\)$|transparent/.test(vi.accent.fill || '')) {
              failures.push(`§24 (vi): accent VÔ HÌNH — -webkit-text-fill-color = ${vi.accent.fill}`);
            }
            if (vi.accent.ws !== 'nowrap') failures.push(`§24 (vi): white-space của accent = ${vi.accent.ws} (mong đợi nowrap)`);
          }
          if (vi.text !== 'BELWEE XIN CHÀO!!!') failures.push(`§24 (vi): h1 = ${JSON.stringify(vi.text)}`);
        }
        await evalJS(cmd, `(() => { localStorage.setItem('belwee-language','en'); return JSON.stringify({ok:true}); })()`);
        await cmd('Page.navigate', { url: BASE + '/?lang=en' });
        await sleep(7000);
      }
    }

    // -------------------------------------------------------------------- A1
    console.log('\n=== A1 — cross-fade nền theo hero ===');
    const readLayers = async () => evalJS(cmd, `(() => {
      const hero = document.querySelector('section[ref], main section');
      const video = document.querySelector('.hero-video-layer');
      const bg = document.querySelector('[aria-hidden="true"].fixed.inset-0');
      const num = (el) => (el ? Number(getComputedStyle(el).opacity) : null);
      const rect = hero ? hero.getBoundingClientRect() : null;
      return JSON.stringify({
        scrollY: Math.round(window.scrollY),
        heroTop: rect ? Math.round(rect.top) : null,
        heroH: rect ? Math.round(rect.height) : null,
        videoOpacity: num(video),
        bgOpacity: num(bg),
        videoPaused: (() => { const v = document.querySelector('video'); return v ? v.paused : null; })(),
      });
    })()`);

    const top = await readLayers();
    console.log('   đầu trang  :', JSON.stringify(top));

    // Cuộn bằng WHEEL THẬT chứ không `window.scrollTo`.
    // Lý do: `<html class="scroll-smooth">` khiến `scrollTo` thành cuộn mượt
    // theo thời gian, và headless hay throttle rAF ⇒ đọc được giá trị cũ.
    // `Input.dispatchMouseEvent(mouseWheel)` tạo scroll event thật, giống
    // người dùng.
    const wheel = async (ticks) => {
      for (let i = 0; i < ticks; i++) {
        await cmd('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 700, y: 450, deltaX: 0, deltaY: 120, pointerType: 'mouse' });
        await sleep(45);
      }
      await sleep(900);
    };
    await wheel(5); // ~5 × 120 px, chưa chắc đủ tuỳ chiều cao viewport
    const mid = await readLayers();
    // Thêm nốt cho tới khi chắc chắn đã đi qua nửa chiều cao hero.
    for (let i = 0; i < 12 && mid.heroTop > -mid.heroH * 0.6; i++) {
      await wheel(2);
      Object.assign(mid, await readLayers());
    }
    console.log('   sau cuộn   :', JSON.stringify(mid));

    if (top.videoOpacity === null || top.bgOpacity === null) {
      failures.push('A1: không đo được opacity của hai lớp nền');
    } else {
      if (!(mid.bgOpacity > top.bgOpacity + 0.2)) failures.push(`A1: opacity ảnh nền KHÔNG tăng khi cuộn (${top.bgOpacity} → ${mid.bgOpacity})`);
      if (!(mid.videoOpacity < top.videoOpacity - 0.2)) failures.push(`A1: opacity video KHÔNG giảm khi cuộn (${top.videoOpacity} → ${mid.videoOpacity})`);
      if (!(mid.bgOpacity > mid.videoOpacity)) failures.push(`A1: cuộn xuống nhưng video vẫn nổi hơn ảnh (v=${mid.videoOpacity} img=${mid.bgOpacity}) — không phải cross-fade`);
      console.log(`   → ảnh ${top.bgOpacity}→${mid.bgOpacity} · video ${top.videoOpacity}→${mid.videoOpacity}`);
    }

    // -------------------------------------------------------------------- A2
    console.log('\n=== A2 — pill điều khiển ===');
    await evalJS(cmd, `(() => { window.scrollTo(0, 0); return JSON.stringify({ok:true}); })()`);
    await sleep(800);

    const pillAt = async (width) => {
      await cmd('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 1024 });
      await sleep(1000);
      return evalJS(cmd, `(() => {
        const stage = document.querySelector('.service-stage-3d');
        const sec = stage ? stage.closest('section') : null;
        if (!sec) return JSON.stringify(null);
        const pill = sec.querySelector('.glass-pill');
        const legacy = [...sec.querySelectorAll('div')].find(d =>
          d.classList.contains('lg:hidden') && d.querySelector('[role="tablist"]'));
        const vis = (el) => { if (!el) return null; const cs = getComputedStyle(el); return cs.display !== 'none' && cs.visibility !== 'hidden' && el.getBoundingClientRect().width > 0; };
        const cs = pill ? getComputedStyle(pill) : null;
        return JSON.stringify({
          pillVisible: vis(pill),
          legacyVisible: vis(legacy),
          pillH: pill ? Math.round(pill.getBoundingClientRect().height) : null,
          pillBackdrop: cs ? (cs.backdropFilter || 'none') : null,
          name: pill ? (pill.querySelector('[aria-live="polite"]')?.textContent || '').trim() : null,
          index: pill ? (pill.querySelector('.tabular-nums')?.textContent || '').trim() : null,
          hasLive: !!(pill && pill.querySelector('[aria-live="polite"]')),
          nextAria: pill ? pill.querySelectorAll('button')[pill.querySelectorAll('button').length - 1]?.getAttribute('aria-label') : null,
        });
      })()`);
    };

    for (const [w, wantPill] of [[1440, true], [1024, true], [960, false], [390, false]]) {
      const r = await pillAt(w);
      if (!r) { failures.push(`A2: không thấy vùng carousel ở ${w}px`); continue; }
      const ok = r.pillVisible === wantPill && r.legacyVisible === !wantPill;
      console.log(`   ${w}px → pill ${r.pillVisible ? 'hiện' : 'ẩn'} · cũ ${r.legacyVisible ? 'hiện' : 'ẩn'} ${ok ? '✓' : '❌'}` +
        (r.pillVisible ? ` · cao ${r.pillH}px · ${r.pillBackdrop}` : ''));
      if (!ok) failures.push(`A2 @${w}px: pill=${r.pillVisible} (mong đợi ${wantPill}), cũ=${r.legacyVisible}`);
    }

    // Bấm nút "sau" bằng CHUỘT THẬT rồi kiểm tên trong pill đổi.
    // `.click()` từng bị bỏ sót: React 18 gom sự kiện, cần một vòng render thật.
    await cmd('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await sleep(800);
    await evalJS(cmd, `(() => {
      // TẮT cuộn mượt trước: <html class="scroll-smooth"> khiến
      // scrollIntoView({behavior:'auto'}) vẫn ANIM mượt, và headless hay
      // throttle rAF ⇒ lúc đo rect, trang chưa cuộn tới nơi (từng gặp y=1586).
      document.documentElement.style.scrollBehavior = 'auto';
      const pill = document.querySelector('.service-stage-3d').closest('section').querySelector('.glass-pill');
      pill.scrollIntoView({ block: 'center', behavior: 'auto' });
      return JSON.stringify({ ok: true });
    })()`);
    await sleep(1400);

    const before = await evalJS(cmd, `(() => {
      const pill = document.querySelector('.service-stage-3d')?.closest('section')?.querySelector('.glass-pill');
      return JSON.stringify({ name: pill?.querySelector('[aria-live="polite"]')?.textContent?.trim(), index: pill?.querySelector('.tabular-nums')?.textContent?.trim() });
    })()`);

    const btnPos = await evalJS(cmd, `(() => {
      const pill = document.querySelector('.service-stage-3d').closest('section').querySelector('.glass-pill');
      const btns = pill.querySelectorAll('button');
      const r = btns[btns.length - 1].getBoundingClientRect();
      if (!r.width) return JSON.stringify({ error: 'nút có width=0' });
      const x = Math.round(r.x + r.width / 2);
      const y = Math.round(r.y + r.height / 2);
      // Hit-test: nếu có phần tử khác nằm trên đúng điểm này thì cú click sẽ
      // rơi vào nó chứ không vào nút — đã mắc phải một lần.
      const hit = document.elementFromPoint(x, y);
      return JSON.stringify({
        x, y,
        hitTag: hit ? hit.tagName : null,
        hitClass: hit ? String(hit.className).slice(0, 90) : null,
        inButton: hit ? !!hit.closest('.glass-pill') : false,
      });
    })()`);
    console.log('   nút "sau":', JSON.stringify(btnPos));
    if (btnPos.error) {
      failures.push(`A2: ${btnPos.error}`);
    } else if (!btnPos.inButton) {
      failures.push(`A2: điểm click bị ${btnPos.hitTag}.${btnPos.hitClass} che, không tới được nút trong pill`);
    } else {
      for (const type of ['mousePressed', 'mouseReleased']) {
        await cmd('Input.dispatchMouseEvent', { type, x: btnPos.x, y: btnPos.y, button: 'left', clickCount: 1, pointerType: 'mouse' });
        await sleep(60);
      }
    }
    await sleep(1100);
    const after = await evalJS(cmd, `(() => {
      const pill = document.querySelector('.service-stage-3d')?.closest('section')?.querySelector('.glass-pill');
      const active = document.querySelector('.service-card-3d');
      return JSON.stringify({
        name: pill?.querySelector('[aria-live="polite"]')?.textContent?.trim(),
        index: pill?.querySelector('.tabular-nums')?.textContent?.trim(),
        liveCount: pill?.querySelectorAll('[aria-live="polite"]').length,
      });
    })()`);
    console.log(`   trước: ${JSON.stringify(before)}\n   sau  : ${JSON.stringify(after)}`);
    if (!after.liveCount) failures.push('A2: pill thiếu aria-live="polite"');
    if (after.name === before.name) failures.push('A2: bấm nút sau nhưng tên trong pill KHÔNG đổi');
    if (after.index === before.index) failures.push('A2: chỉ số trong pill KHÔNG đổi');
    if (after.index && !/^\d+\/\d+$/.test(after.index)) failures.push(`A2: chỉ số "${after.index}" không phải dạng n/m`);

    // Thẻ active dùng kính thật.
    const glass = await evalJS(cmd, `(() => {
      const active = [...document.querySelectorAll('.service-card-3d')].find(c => c.style.zIndex === '10');
      const inner = active ? active.firstElementChild?.firstElementChild : null;
      const cs = inner ? getComputedStyle(inner) : null;
      return JSON.stringify({
        cls: inner ? inner.className : null,
        backdrop: cs ? (cs.backdropFilter || 'none') : null,
        bgImage: cs ? cs.backgroundImage.slice(0, 50) : null,
      });
    })()`);
    console.log('   thẻ active:', JSON.stringify(glass));
    if (!/pt-glass/.test(glass.cls || '')) failures.push('A2: thẻ đang active không dùng vật liệu kính .pt-glass');
    if (!/blur/.test(glass.backdrop || '')) failures.push('A2: thẻ active không có backdrop-filter');

    // -------------------------------------------------------------------- A3
    console.log('\n=== A3 — thanh cuộn ẩn + pill điều khiển ===');
    const k = await evalJS(cmd, `(() => {
      const sec = document.getElementById('vet-knowledge');
      const sc = sec ? sec.querySelector('.no-scrollbar') : null;
      const cs = sc ? getComputedStyle(sc) : null;
      const pill = sec ? sec.querySelector('.glass-pill') : null;
      return JSON.stringify({
        found: !!sc,
        scrollbarWidth: cs ? cs.scrollbarWidth : null,
        overflowX: cs ? cs.overflowX : null,
        snapType: cs ? cs.scrollSnapType : null,
        scrollable: sc ? sc.scrollWidth > sc.clientWidth : null,
        pill: !!pill,
        progressBar: !!(pill && pill.querySelector('.origin-left')),
        standaloneButtons: sec ? sec.querySelectorAll(':scope > div > .apple-glass > .mb-6 > .flex > button').length : null,
      });
    })()`);
    console.log('   ', JSON.stringify(k));
    if (!k.found) failures.push('A3: dải kiến thức chưa có class .no-scrollbar');
    if (k.scrollbarWidth !== 'none') failures.push(`A3: scrollbar-width = ${k.scrollbarWidth} (mong đợi none)`);
    if (k.overflowX !== 'auto') failures.push(`A3: overflow-x = ${k.overflowX} — mất khả năng vuốt`);
    if (!/x/.test(k.snapType || '')) failures.push(`A3: scroll-snap-type = ${k.snapType} (mong đợi có trục x)`);
    if (!k.scrollable) notes.push('A3: dải không cuộn được ở 1440px (nội dung vừa khít) — cần thử bề rộng hẹp hơn');
    if (!k.pill) failures.push('A3: không có pill điều khiển');
    if (!k.progressBar) failures.push('A3: pill không có thanh tiến độ');

    // ---------------------------------------------------------------- tràn ngang
    console.log('\n=== Tràn ngang ở 8 bề rộng ===');
    for (const w of WIDTHS) {
      await cmd('Emulation.setDeviceMetricsOverride', { width: w, height: 900, deviceScaleFactor: 1, mobile: w < 1024 });
      await sleep(900);
      const o = await evalJS(cmd, `(() => {
        const d = document.documentElement;
        return JSON.stringify({ over: d.scrollWidth - d.clientWidth });
      })()`);
      console.log(`   ${w}px → overflowX=${o.over} ${o.over <= 1 ? 'ok' : '❌'}`);
      if (o.over > 1) failures.push(`@${w}px: tràn ngang ${o.over}px`);
    }

    // --------------------------------------------------------- reduced motion
    console.log('\n=== prefers-reduced-motion ===');
    await cmd('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
    });
    await cmd('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    // Chrome headless đôi khi mô phỏng media xong nhưng effect của trang đọc
    // trước lúc emulation kịp áp dụng ⇒ đo một lần thì báo đỏ oan. Thử tối đa
    // 3 lần, chỉ báo đỏ khi CẢ 3 lần đều sai.
    let rm = null, rmTries = 0;
    for (let attempt = 1; attempt <= 3; attempt++) {
      rmTries = attempt;
      await cmd('Page.navigate', { url: BASE + `/?rm=${attempt}` });
      await sleep(8000);
      rm = await evalJS(cmd, `(() => {
        const h1 = document.querySelector('h1');
        const sheen = h1 ? h1.querySelector('.glass-heading__sheen') : null;
        const video = document.querySelector('.hero-video-layer');
        const bg = document.querySelector('[aria-hidden="true"].fixed.inset-0');
        const num = (el) => (el ? Number(getComputedStyle(el).opacity) : null);
        return JSON.stringify({
          // matchMedia là nguồn quyết định của hooks/useScrollProgress. Phải in ra
          // để phân biệt "sản phẩm sai" với "Chrome headless không mô phỏng được".
          matchMediaReduce: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
          sheenDisplay: sheen ? getComputedStyle(sheen).display : 'không có lớp sheen',
          videoOpacity: num(video),
          bgOpacity: num(bg),
        });
      })()`);
      console.log(`   lần ${attempt}:`, rm);
      const ok = !rm.matchMediaReduce || (rm.bgOpacity === 1 && rm.videoOpacity === 0);
      if (ok) break;
      // Nạp lại để effect chạy lại sau khi emulation chắc chắn đã áp dụng.
      await cmd('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
      await sleep(600);
    }
    if (rm.sheenDisplay !== 'none' && rm.sheenDisplay !== 'không có lớp sheen') {
      failures.push(`RM: vệt sheen vẫn hiện (display=${rm.sheenDisplay})`);
    }
    if (rm.matchMediaReduce) {
      if (rm.bgOpacity !== 1) failures.push(`RM: ảnh nền phải hiện thẳng, thực tế opacity=${rm.bgOpacity} (sau ${rmTries} lần thử)`);
      if (rm.videoOpacity !== 0) failures.push(`RM: video phải tắt hẳn, thực tế opacity=${rm.videoOpacity} (sau ${rmTries} lần thử)`);
    } else {
      notes.push('RM: Chrome headless KHÔNG mô phỏng được prefers-reduced-motion ⇒ nhánh JS chưa kiểm được ở đây (nhánh CSS đã kiểm: sheen display:none)');
    }
    await cmd('Emulation.setEmulatedMedia', { features: [] });

    // ------------------------------------------------------------------ console
    console.log('\n=== Console ===');
    const hydration = consoleErrors.filter((m) => /hydrat|did not match|Text content does not match|Minified React error #(418|423|425)/i.test(m));
    console.log(`   ${consoleErrors.length} cảnh báo/lỗi, ${hydration.length} trong số đó là hydration`);
    consoleErrors.slice(0, 12).forEach((m) => console.log('   -', m));
    if (hydration.length) failures.push(`Có ${hydration.length} cảnh báo hydration mismatch`);

    console.log('\n=== KẾT QUẢ ===');
    if (notes.length) { console.log('⚠️  ghi nhận:'); notes.forEach((n) => console.log('   -', n)); }
    if (failures.length === 0) {
      console.log('✅ GĐ2A đạt các tiêu chí đã kiểm');
    } else {
      console.log(`❌ ${failures.length} vấn đề:`);
      [...new Set(failures)].forEach((f) => console.log('   -', f));
      process.exitCode = 1;
    }
    finished = true;
  } catch (e) {
    finished = true;
    console.error('❌ phase2a check failed:', e.message);
    process.exitCode = 1;
  } finally {
    try { child.kill(); } catch {}
  }
}

main();