/* Headless Chrome (CDP over --remote-debugging-pipe, zero deps) mobile check @375x812:
   1) Homepage: intro ends, no horizontal overflow, marquee wrappers keep hover headroom,
      hover a card -> track pauses, card lifts inside wrapper bounds, shimmer sweeps once.
   2) /dang-nhap: dismiss terms modal -> "Đăng nhập cho nhân viên" -> confirm modal
      -> "Không phải" closes; confirm again -> "Tôi là nhân viên Belwee" -> lands on /staff/login. */
'use strict';

const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = process.argv[2] || 'http://localhost:3001';
const OUT = path.join(__dirname, 'mobile-check-out');
fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------- CDP over stdio pipe ----------------
// Chrome --remote-debugging-pipe convention (same as puppeteer PipeTransport):
//   Node WRITES commands to child.stdio[3], READS events/responses from child.stdio[4].
//   Messages are NUL ('\0') delimited JSON.
class CDP {
  constructor(child) {
    this.child = child;
    this.writable = child.stdio[3]; // Node -> Chrome
    this.readable = child.stdio[4]; // Chrome -> Node
    this.msgId = 0;
    this.pending = new Map();
    this.buffer = '';
    this.readable.setEncoding('utf8');
    this.readable.on('data', (chunk) => this.#onData(chunk));
    this.readable.on('error', () => {});
  }

  #onData(chunk) {
    this.buffer += chunk;
    let nulIndex;
    while ((nulIndex = this.buffer.indexOf('\0')) !== -1) {
      const payload = this.buffer.slice(0, nulIndex);
      this.buffer = this.buffer.slice(nulIndex + 1);
      if (!payload) continue;
      try {
        const msg = JSON.parse(payload);
        if (msg.id && this.pending.has(msg.id)) {
          const { resolve, reject } = this.pending.get(msg.id);
          this.pending.delete(msg.id);
          msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result || {});
        }
      } catch { /* ignore malformed */ }
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

  // Attach to the first page target and return its sessionId.
  async attachToPage() {
    const { targetInfos } = await this.send('Target.getTargets');
    const page = targetInfos.find((t) => t.type === 'page');
    if (!page) throw new Error('no page target found');
    const { sessionId } = await this.send('Target.attachToTarget', { targetId: page.targetId, flatten: true });
    return sessionId;
  }
}

async function evalJS(send, expression, awaitPromise = false) {
  const res = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise,
  });
  if (res.exceptionDetails) throw new Error('Eval failed: ' + JSON.stringify(res.exceptionDetails).slice(0, 500));
  return res.result ? res.result.value : undefined;
}

async function screenshot(send, name) {
  const res = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(OUT, name), Buffer.from(res.data, 'base64'));
  console.log('   📸 saved', name);
}

async function main() {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-mob-'));
  const child = spawn(CHROME, [
    '--headless=new',
    '--remote-debugging-pipe',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    `--user-data-dir=${userDataDir}`,
    '--window-size=375,812',
    'about:blank',
  ], { stdio: ['pipe', 'pipe', 'pipe', 'pipe', 'pipe'] });

  child.on('exit', (code) => {
    if (!finished) { console.error('Chrome exited early, code', code); process.exit(2); }
  });

  const cdp = new CDP(child);
  let finished = false;

  // Watchdog: never hang silently — abort with diagnostics after 100s
  const watchdog = setTimeout(() => {
    console.error('WATCHDOG: 100s elapsed, aborting (pending CDP ids:', [...cdp.pending.keys()].join(',') || 'none', ')');
    try { child.kill(); } catch {}
    process.exit(3);
  }, 100000);
  watchdog.unref();

  try {
    const session = await cdp.attachToPage();
    const cmd = (method, params) => cdp.send(method, params, session);
    await cmd('Page.enable');
    await cmd('Runtime.enable');
    // Mobile emulation: 375x812, mobile viewport
    await cmd('Emulation.setDeviceMetricsOverride', {
      width: 375, height: 812, deviceScaleFactor: 1, mobile: true,
    });
    await cmd('Emulation.setTouchEmulationEnabled', { enabled: true });

    // ============ 1) HOMEPAGE ============
    console.log('\n[1] Homepage @375px');
    await cmd('Page.navigate', { url: BASE + '/' });
    await sleep(6000); // intro video ~ plays/fails; wait generously

    // dismiss intro if a play button is showing (autoplay blocked in headless)
    await evalJS(cmd, `(() => {
      const btn = document.querySelector('.intro-overlay button[aria-label]');
      if (btn) { btn.click(); return 'clicked-intro-play'; }
      return 'no-intro-button';
    })()`);
    await sleep(3500); // fade out + content reveal

    const homeInfo = await evalJS(cmd, `(() => {
      const doc = document.documentElement;
      const overflowX = doc.scrollWidth - doc.clientWidth;
      const servicesWrap = document.querySelector('.marquee-fade');
      const vetWrap = document.querySelector('.vet-marquee-fade');
      const info = { overflowX, services: null, vet: null, hoverables: 0 };
      for (const [key, wrap] of [['services', servicesWrap], ['vet', vetWrap]]) {
        if (!wrap) { info[key] = { missing: true }; continue; }
        const cs = getComputedStyle(wrap);
        const wrapRect = wrap.getBoundingClientRect();
        const track = wrap.querySelector('.marquee-track');
        let firstCard = null;
        for (const child of (track ? track.children : [])) {
          const r = child.getBoundingClientRect();
          if (r.width > 50 && r.right > 0 && r.left < innerWidth) { firstCard = child; break; }
        }
        info[key] = {
          overflowY: cs.overflowY,
          contain: cs.contain,
          paddingTop: cs.paddingTop,
          paddingBottom: cs.paddingBottom,
          wrapTop: Math.round(wrapRect.top),
          wrapBottom: Math.round(wrapRect.bottom),
        };
        if (firstCard) {
          const cr = firstCard.getBoundingClientRect();
          info[key].cardTopGap = Math.round(cr.top - wrapRect.top);   // headroom above card
          info[key].cardBottomGap = Math.round(wrapRect.bottom - cr.bottom); // headroom below card
          info[key].hoverable = true;
        }
      }
      return JSON.stringify(info);
    })()`);
    const home = JSON.parse(homeInfo);
    console.log('   horizontal overflow:', home.overflowX, home.overflowX <= 0 ? 'OK' : '❌ OVERFLOW!');
    for (const key of ['services', 'vet']) {
      const s = home[key];
      if (s.missing) { console.log(`   ${key}: ❌ wrapper missing`); continue; }
      console.log(`   ${key}: contain=${s.contain} overflowY=${s.overflowY} padY=${s.paddingTop}/${s.paddingBottom} cardGaps T/B=${s.cardTopGap}/${s.cardBottomGap}px ${s.contain.includes('paint') || s.contain === 'strict' || s.contain === 'content' ? '❌ paint containment!' : 'OK'}`);
    }

    await screenshot(cmd, 'home-375-services.png');

    // hover vet card: move mouse over a visible vet card
    console.log('\n[2] Hover vet card @375px');
    const hoverPoint = await evalJS(cmd, `(() => {
      const track = document.querySelector('.vet-marquee-fade .marquee-track');
      if (!track) return null;
      for (const child of track.children) {
        const r = child.getBoundingClientRect();
        if (r.width > 50 && r.right > 10 && r.left < innerWidth - 10 && r.top > 0 && r.bottom < innerHeight) {
          return JSON.stringify({ x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) });
        }
      }
      return null;
    })()`);
    if (hoverPoint) {
      const p = JSON.parse(hoverPoint);
      await cmd('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.x, y: p.y });
      await sleep(350); // GSAP pause + lift start
      const hoverState = await evalJS(cmd, `(async () => {
        const card = document.querySelector('.vet-expert-card:hover');
        const track = document.querySelector('.vet-marquee-fade .marquee-track');
        const shimmer = card ? card.querySelector('.vet-shimmer') : null;
        const wrap = document.querySelector('.vet-marquee-fade');
        const tr = track ? getComputedStyle(track).transform : null;
        const cRect = card ? card.getBoundingClientRect() : null;
        const wRect = wrap ? wrap.getBoundingClientRect() : null;
        // wait up to 1.2s for shimmer animation to start
        let shimmerSeen = false;
        if (shimmer) {
          const start = performance.now();
          while (performance.now() - start < 1200) {
            const anim = getComputedStyle(shimmer).animationName;
            const op = getComputedStyle(shimmer).opacity;
            if (anim === 'vetShimmerSweep' && parseFloat(op) > 0.05) { shimmerSeen = true; break; }
            await new Promise(r => setTimeout(r, 40));
          }
        }
        return JSON.stringify({
          hovered: !!card,
          trackTransform: tr,
          trackPaused: tr === 'none' || tr === 'matrix(1, 0, 0, 1, 0, 0)',
          cardLift: cRect && wRect ? Math.round(wRect.top - cRect.top) : null,
          cardInsideWrapY: cRect && wRect ? (cRect.top >= wRect.top - 1 && cRect.bottom <= wRect.bottom + 1) : null,
          shimmerSeen,
        });
      })()`, true);
      const hv = JSON.parse(hoverState);
      console.log(`   hovered=${hv.hovered} trackPaused=${hv.trackPaused} cardInsideWrapY=${hv.cardInsideWrapY} shimmerSeen=${hv.shimmerSeen}`);
      await screenshot(cmd, 'home-375-vet-hover.png');
      // move mouse away to let the marquee resume
      await cmd('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 8, y: 8 });
      await sleep(300);
    } else {
      console.log('   ⚠️ no fully visible vet card found to hover (marquee mid-scroll) — retrying once');
      await sleep(1500);
    }

    // scroll near CTA for the third screenshot
    await evalJS(cmd, `window.scrollTo({ top: document.body.scrollHeight - innerHeight - 40, behavior: 'instant' })`);
    await sleep(1200);
    await screenshot(cmd, 'home-375-cta.png');

    // ============ 3) LOGIN PAGE — staff modal flow ============
    console.log('\n[3] /dang-nhap staff modal flow');
    await cmd('Page.navigate', { url: BASE + '/dang-nhap' });
    await sleep(3000);

    const loginFlow = await evalJS(cmd, `(async () => {
      const steps = {};
      const q = (s) => document.querySelector(s);
      const findBtn = (txt) => [...document.querySelectorAll('button, a')].find(el => el.textContent.trim().includes(txt));

      // Terms modal (if present) — confirm all cards until it closes
      for (let i = 0; i < 6; i++) {
        const confirm = findBtn('Xác Nhận');
        if (confirm && q('.terms-modal-backdrop')) { confirm.click(); await new Promise(r => setTimeout(r, 450)); }
        else break;
      }
      steps.termsClosed = !q('.terms-modal-backdrop');

      const staffLink = findBtn('Đăng nhập cho nhân viên');
      steps.staffLinkExists = !!staffLink;
      steps.oldLinkGone = !findBtn('Tạo tài khoản riêng');
      if (staffLink) { staffLink.click(); await new Promise(r => setTimeout(r, 450)); }

      steps.modalAppeared = !!q('.staff-modal-backdrop');
      const noBtn = findBtn('Không phải, quay lại trang đăng nhập');
      steps.noBtnColored = noBtn ? getComputedStyle(noBtn).backgroundImage.includes('gradient') : null;
      if (noBtn) { noBtn.click(); await new Promise(r => setTimeout(r, 350)); }
      steps.modalClosedByNo = !q('.staff-modal-backdrop');

      // reopen and take the accept path (navigates away — can't wait long)
      const staffLink2 = findBtn('Đăng nhập cho nhân viên');
      if (staffLink2) {
        staffLink2.click(); await new Promise(r => setTimeout(r, 450));
        const yesBtn = findBtn('Tôi là nhân viên Belwee');
        steps.yesBtnExists = !!yesBtn;
        if (yesBtn) yesBtn.click();
      }
      return JSON.stringify(steps);
    })()`, true);
    const lf = JSON.parse(loginFlow);
    console.log(`   termsClosed=${lf.termsClosed} oldLinkGone=${lf.oldLinkGone} staffLink=${lf.staffLinkExists}`);
    console.log(`   modalAppeared=${lf.modalAppeared} coloredNoBtn=${lf.noBtnColored} closedByNo=${lf.modalClosedByNo} yesBtn=${lf.yesBtnExists}`);
    await sleep(2500); // allow navigation to /staff/login
    const finalUrl = await evalJS(cmd, `location.pathname`);
    console.log('   after accept, landed on:', finalUrl, finalUrl === '/staff/login' ? '✅' : '❌');

    await screenshot(cmd, 'login-final.png');
    finished = true;
    console.log('\n✅ mobile check complete — screenshots in scripts/mobile-check-out/');
  } catch (e) {
    finished = true;
    console.error('❌ check failed:', e.message);
    process.exitCode = 1;
  } finally {
    try { child.kill(); } catch {}
  }
}

main();
