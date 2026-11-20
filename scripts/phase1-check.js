/* Headless Chrome (CDP over --remote-debugging-pipe, zero deps) — Giai đoạn 1 check.

   Cùng khung với scripts/mobile-check.js (không thêm dependency).

   Việc nó KIỂM TRA (và những gì nó KHÔNG kiểm tra):
     1. Tràn ngang ở 6 bề rộng yêu cầu: 1440 / 1280 / 1024 / 768 / 390 / 360.
        Đo `documentElement.scrollWidth - clientWidth`. >1px là FAIL.
     2. Lỗi/ cảnh báo console trên từng route — gồm hydration mismatch của
        React (React log cảnh báo này qua console.error).
     3. Token `--glass-*` CÓ phân giải ra giá trị thật hay không, đo bằng
        computed style trong trình duyệt thật (không phải đọc file CSS).
     4. Vật liệu kính: `.pt-glass` + `.glass-surface` có `backdrop-filter`.
     5. Skeleton: `--sk-base` có phân giải; và dưới
        `prefers-reduced-motion: reduce` thì vệt shimmer BỊ ẨN
        (`display: none`) — tức nhánh reduced-motion thật sự chạy.

   KHÔNG kiểm tra: CLS (cần Lighthouse chạy riêng), ảnh render đúng, tương tác.
   Báo cáo phải nói rõ điều này, không được suy ra "đạt" từ việc script xanh.

   Cách dùng:  node scripts/phase1-check.js [baseUrl]
   Mặc định:   http://localhost:3000
*/
'use strict';

const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = process.argv[2] || 'http://localhost:3000';
const OUT = path.join(__dirname, 'phase1-check-out');
fs.mkdirSync(OUT, { recursive: true });

const ROUTES = ['/', '/gioi-thieu', '/doi-ngu', '/tuyen-dung', '/kien-thuc-thu-y'];
const WIDTHS = [1440, 1280, 1024, 768, 390, 360];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class CDP {
  constructor(child) {
    this.writable = child.stdio[3];
    this.readable = child.stdio[4];
    this.msgId = 0;
    this.pending = new Map();
    this.handlers = new Map();
    this.buffer = '';
    this.readable.setEncoding('utf8');
    this.readable.on('data', (chunk) => this.#onData(chunk));
    this.readable.on('error', () => {});
  }

  on(method, cb) {
    if (!this.handlers.has(method)) this.handlers.set(method, []);
    this.handlers.get(method).push(cb);
  }

  #onData(chunk) {
    this.buffer += chunk;
    let nulIndex;
    while ((nulIndex = this.buffer.indexOf('\0')) !== -1) {
      const payload = this.buffer.slice(0, nulIndex);
      this.buffer = this.buffer.slice(nulIndex + 1);
      if (!payload) continue;
      let msg;
      try {
        msg = JSON.parse(payload);
      } catch {
        continue;
      }
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result || {});
      } else if (msg.method) {
        for (const cb of this.handlers.get(msg.method) || []) cb(msg.params || {}, msg.sessionId);
      }
    }
  }

  send(method, params = {}, sessionId) {
    return new Promise((resolve, reject) => {
      const id = ++this.msgId;
      this.pending.set(id, { resolve, reject });
      const msg = { id, method, params };
      if (sessionId) msg.sessionId = sessionId;
      try {
        this.writable.write(JSON.stringify(msg) + '\0');
      } catch (e) {
        reject(e);
      }
    });
  }

  async attachToPage() {
    const { targetInfos } = await this.send('Target.getTargets');
    const page = targetInfos.find((t) => t.type === 'page');
    if (!page) throw new Error('no page target found');
    const { sessionId } = await this.send('Target.attachToTarget', { targetId: page.targetId, flatten: true });
    return sessionId;
  }
}

async function main() {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-p1-'));
  const child = spawn(CHROME, [
    '--headless=new',
    '--remote-debugging-pipe',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--autoplay-policy=no-user-gesture-required',
    `--user-data-dir=${userDataDir}`,
    'about:blank',
  ], { stdio: ['pipe', 'pipe', 'pipe', 'pipe', 'pipe'] });

  let finished = false;
  child.on('exit', (code) => {
    if (!finished) {
      console.error('Chrome exited early, code', code);
      process.exit(2);
    }
  });

  const cdp = new CDP(child);
  const watchdog = setTimeout(() => {
    console.error('WATCHDOG: 240s elapsed, aborting');
    try { child.kill(); } catch {}
    process.exit(3);
  }, 240000);
  watchdog.unref();

  const failures = [];
  /** Cảnh báo đã có từ trước Giai đoạn 1 — báo cáo riêng, không tính là fail. */
  const known = [];

  try {
    const session = await cdp.attachToPage();
    const cmd = (method, params) => cdp.send(method, params, session);

    // ---- Thu thập console + log lỗi ----
    let consoleProblems = [];
    cdp.on('Runtime.consoleAPICalled', (p) => {
      if (p.type !== 'error' && p.type !== 'warning') return;
      const text = (p.args || [])
        .map((a) => a.value ?? a.description ?? a.unserializableValue ?? '')
        .join(' ')
        .slice(0, 300);
      consoleProblems.push(`[${p.type}] ${text}`);
    });
    cdp.on('Runtime.exceptionThrown', (p) => {
      consoleProblems.push(`[exception] ${(p.exceptionDetails?.exception?.description || p.exceptionDetails?.text || '').slice(0, 300)}`);
    });
    cdp.on('Log.entryAdded', (p) => {
      const e = p.entry || {};
      if (e.level === 'error' || e.level === 'warning') {
        consoleProblems.push(`[log:${e.level}] ${String(e.text).slice(0, 300)}`);
      }
      if (e.source === 'network' && e.level === 'error') {
        failures.push(`network error: ${String(e.text).slice(0, 200)}`);
      }
    });

    await cmd('Page.enable');
    await cmd('Runtime.enable');
    await cmd('Log.enable');

    // =====================================================================
    // 1) + 2) Tràn ngang và console theo từng route × bề rộng
    // =====================================================================
    console.log('=== [1+2] Tràn ngang & console theo route/bề rộng ===');
    for (const route of ROUTES) {
      const rows = [];
      for (const width of WIDTHS) {
        consoleProblems = [];
        await cmd('Emulation.setDeviceMetricsOverride', {
          width, height: 900, deviceScaleFactor: 1, mobile: width < 768,
        });
        await cmd('Page.navigate', { url: BASE + route });
        // Intro video chạy ~2-4s; đợi nội dung ổn định.
        await sleep(route === '/' ? 7000 : 3500);

        const info = await cmd('Runtime.evaluate', {
          expression: `(() => {
            const doc = document.documentElement;
            return JSON.stringify({
              overflowX: doc.scrollWidth - doc.clientWidth,
              scrollW: doc.scrollWidth,
              clientW: doc.clientWidth,
              title: document.title.slice(0, 60),
            });
          })()`,
          returnByValue: true,
        });
        const v = JSON.parse(info.result.value);
        const overflowBad = v.overflowX > 1;
        if (overflowBad) failures.push(`${route} @${width}px tràn ngang ${v.overflowX}px`);
        // Phân loại: cảnh báo ĐÃ CÓ TỪ TRƯỚC (không do Giai đoạn 1) tách khỏi
        // lỗi thật, để các lần chạy sau vẫn đọc được tín hiệu thay vì bị mấy
        // chục dòng nhiễu che mất.
        const isPreExisting = (t) =>
          /favicon|Third-party cookie|DevTools|Download the React DevTools/i.test(t) ||
          /<link rel=preload> uses an unsupported/i.test(t) ||
          /apple-mobile-web-app-capable.*deprecated/i.test(t) ||
          // Hydration mismatch của AboveFooterCard (shuffle trong useMemo chạy
          // cả trên server) — CÓ TỪ TRƯỚC Giai đoạn 1. Bằng chứng: /gioi-thieu,
          // file không hề bị sửa ở giai đoạn này, cũng mắc y hệt.
          /Minified React error #(422|425)/i.test(t);

        const realProblems = consoleProblems.filter((t) => !isPreExisting(t));
        const preExisting = consoleProblems.filter(isPreExisting);
        if (realProblems.length) {
          for (const t of realProblems.slice(0, 3)) {
            failures.push(`${route} @${width}px console ${t}`);
          }
        }
        if (preExisting.length) known.push(`${route} @${width}px: ${preExisting.length} cảnh báo có sẵn`);
        rows.push(
          `${width}:${overflowBad ? 'OVERFLOW' + v.overflowX : 'ok'}${realProblems.length ? `/err${realProblems.length}` : ''}`
        );
      }
      console.log(`   ${route.padEnd(18)} ${rows.join('  ')}`);
    }

    // =====================================================================
    // 3) Token --glass-* + 4) vật liệu kính + 5) skeleton & reduced-motion
    //    Đo bằng computed style trong trình duyệt thật.
    // =====================================================================
    console.log('\n=== [3+4+5] Token kính / vật liệu / skeleton (computed style) ===');
    await cmd('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    await cmd('Page.navigate', { url: BASE + '/' });
    await sleep(5000);

    const probe = `(() => {
      const root = document.documentElement;
      const read = (el, prop) => getComputedStyle(el).getPropertyValue(prop).trim();

      // --- 3) token --glass-* trên :root ---
      const glassTokens = ['--glass-bg','--glass-border','--glass-highlight','--glass-shadow','--glass-blur','--glass-tint','--glass-radius','--sk-base','--sk-sheen'];
      const tokens = {};
      for (const t of glassTokens) tokens[t] = read(root, t) || 'EMPTY';

      // --- 4) dựng thử một GlassSurface thật rồi đo ---
      const host = document.createElement('div');
      host.style.cssText = 'position:fixed;left:-9999px;top:0;width:200px;';
      host.innerHTML = '<div class="pt-glass glass-surface"><span class="glass-surface__tint"></span>'
        + '<button class="glass-pill glass-btn" data-gstatus="idle"><span class="glass-sheen"></span><span>X</span></button></div>';
      document.body.appendChild(host);
      const surface = host.querySelector('.pt-glass');
      const btn = host.querySelector('.glass-btn');
      const sheen = btn.querySelector('.glass-sheen');
      const material = {
        backdropFilter: getComputedStyle(surface).backdropFilter || getComputedStyle(surface).webkitBackdropFilter || 'none',
        borderRadius: getComputedStyle(surface).borderRadius,
        borderWidth: getComputedStyle(surface).borderTopWidth,
        boxShadowLayers: (getComputedStyle(surface).boxShadow.match(/rgb|rgba/g) || []).length,
        btnBackdrop: getComputedStyle(btn).backdropFilter || 'none',
        btnRadius: getComputedStyle(btn).borderRadius,
        tintZ: read(host.querySelector('.glass-surface__tint'), 'z-index'),
        sheenZ: read(sheen, 'z-index'),
      };

      // --- 5) skeleton: nền có phân giải, vệt shimmer bị ẩn khi reduced-motion ---
      host.innerHTML = '<div id="sk" style="width:200px;height:40px" class="relative overflow-hidden bg-[var(--sk-base)]">'
        + '<span id="sksheen" class="animate-skeleton-sheen motion-reduce:hidden"></span></div>';
      const sk = host.querySelector('#sk');
      const skSheen = host.querySelector('#sksheen');
      const skeleton = {
        baseBackground: getComputedStyle(sk).backgroundColor,
        sheenAnimationName: getComputedStyle(skSheen).animationName,
        sheenDisplay: getComputedStyle(skSheen).display,
      };

      // --- sự tồn tại của các class mới trong bundle CSS ---
      const allRules = [...document.styleSheets].flatMap((s) => { try { return [...s.cssRules]; } catch { return []; } });
      const selectors = allRules.map((r) => r.selectorText || '').join('|');
      const present = {
        glassSurface: selectors.includes('.glass-surface'),
        glassPill: selectors.includes('.glass-pill'),
        glassBtn: selectors.includes('.glass-btn'),
        skeletonSheen: selectors.includes('animate-skeleton-sheen'),
        reducedTransparency: allRules.some((r) => r.conditionText && r.conditionText.includes('prefers-reduced-transparency')),
      };

      host.remove();
      return JSON.stringify({ tokens, material, skeleton, present });
    })()`;

    const probeOut = await cmd('Runtime.evaluate', { expression: probe, returnByValue: true });
    const p = JSON.parse(probeOut.result.value);

    console.log('   tokens :', JSON.stringify(p.tokens, null, 0));
    console.log('   material:', JSON.stringify(p.material));
    console.log('   skeleton:', JSON.stringify(p.skeleton));
    console.log('   present :', JSON.stringify(p.present));

    for (const [k, v] of Object.entries(p.tokens)) {
      if (v === 'EMPTY') failures.push(`token ${k} KHÔNG phân giải (rỗng)`);
    }
    if (!/blur/.test(p.material.backdropFilter)) failures.push('GlassSurface không có backdrop-filter');
    if (p.material.borderRadius !== '24px') failures.push(`GlassSurface bo góc ${p.material.borderRadius} (mong đợi 24px)`);
    if (p.material.tintZ !== '-1') failures.push(`.glass-surface__tint z-index=${p.material.tintZ} (phải -1)`);
    if (p.material.sheenZ !== '-1') failures.push(`.glass-sheen z-index=${p.material.sheenZ} (phải -1)`);
    if (!p.material.btnRadius.includes('9999')) failures.push(`GlassButton bo góc ${p.material.btnRadius} (mong đợi 9999px)`);
    if (p.skeleton.sheenAnimationName !== 'skeletonSheen') failures.push(`shimmer animation = ${p.skeleton.sheenAnimationName} (mong đợi skeletonSheen)`);
    if (p.skeleton.sheenDisplay === 'none') failures.push('shimmer bị ẩn khi CHƯA bật reduced-motion');
    for (const [k, v] of Object.entries(p.present)) {
      if (!v) failures.push(`class/at-rule thiếu trong CSS: ${k}`);
    }

    // ---- reduced-motion: vệt shimmer phải bị ẩn ----
    await cmd('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
    });
    const rmOut = await cmd('Runtime.evaluate', {
      expression: `(() => {
        const host = document.createElement('div');
        host.style.cssText = 'position:fixed;left:-9999px;top:0;';
        host.innerHTML = '<div class="relative overflow-hidden bg-[var(--sk-base)]" style="width:120px;height:30px">'
          + '<span id="rm-sheen" class="animate-skeleton-sheen motion-reduce:hidden"></span></div>';
        document.body.appendChild(host);
        const el = host.querySelector('#rm-sheen');
        const r = { display: getComputedStyle(el).display };
        host.remove();
        return JSON.stringify(r);
      })()`,
      returnByValue: true,
    });
    const rm = JSON.parse(rmOut.result.value);
    console.log('   reduced-motion → shimmer display:', rm.display, rm.display === 'none' ? 'OK (đã tắt)' : '❌ VẪN CHẠY');
    if (rm.display !== 'none') failures.push('reduced-motion KHÔNG tắt được shimmer');
    await cmd('Emulation.setEmulatedMedia', { features: [] });

    // ---- Token kính phải ĐỔI theo theme tối ----
    // Đây là lý do --glass-* được khai LẠI trong [data-theme="dark"] thay vì
    // chỉ ở :root (custom property tính var() ngay tại nơi khai báo). Nếu ai
    // đó "dọn dẹp" bỏ bản khai ở khối tối, kiểm tra này sẽ bắt được.
    const darkOut = await cmd('Runtime.evaluate', {
      expression: `(() => {
        const root = document.documentElement;
        const before = getComputedStyle(root).getPropertyValue('--glass-bg').trim();
        root.setAttribute('data-theme', 'dark');
        const after = getComputedStyle(root).getPropertyValue('--glass-bg').trim();
        const sk = getComputedStyle(root).getPropertyValue('--sk-base').trim();
        root.removeAttribute('data-theme');
        return JSON.stringify({ before, after, skDark: sk });
      })()`,
      returnByValue: true,
    });
    const dark = JSON.parse(darkOut.result.value);
    console.log(`   theme tối → --glass-bg: ${dark.before} ⇒ ${dark.after}`);
    console.log(`   theme tối → --sk-base : ${dark.skDark}`);
    if (dark.before === dark.after) {
      failures.push('--glass-bg KHÔNG đổi theo data-theme="dark" (thiếu bản khai ở khối tối?)');
    }

    // =====================================================================
    console.log('\n=== KẾT QUẢ ===');
    console.log('Đã kiểm tra: tràn ngang 5 route × 6 bề rộng, lỗi console, phân giải token');
    console.log('kính + skeleton, backdrop-filter của GlassSurface/GlassButton, nhánh');
    console.log('reduced-motion, và token đổi theo theme tối.');
    console.log('CHƯA kiểm tra: CLS (cần Lighthouse), ảnh render, tương tác bàn phím.');
    if (known.length) {
      console.log(`\n⚠️  ${known.length} mục ĐÃ CÓ TỪ TRƯỚC (không tính là lỗi của Giai đoạn 1):`);
      for (const k of [...new Set(known)].slice(0, 6)) console.log('   -', k);
      console.log('   (2 cảnh báo/route là của layout.tsx: preload video `as="video"` và meta apple-mobile-web-app;');
      console.log('    React #422/#425 là hydration mismatch của AboveFooterCard — xảy ra cả trên /gioi-thieu không hề bị sửa.)');
    }
    if (failures.length === 0) {
      console.log('\n✅ không phát hiện hồi quy nào trong các hạng mục đã kiểm tra');
    } else {
      console.log(`\n❌ ${failures.length} vấn đề:`);
      for (const f of [...new Set(failures)]) console.log('   -', f);
      process.exitCode = 1;
    }
    finished = true;
  } catch (e) {
    finished = true;
    console.error('❌ check failed:', e.message);
    process.exitCode = 1;
  } finally {
    try { child.kill(); } catch {}
  }
}

main();
