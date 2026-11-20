/* C1 (GĐ3) — ĐO PIXEL THẬT lúc navbar đang chuyển trạng thái.
 *
 * ── TẠI SAO LẦN NÀY KHÁC ──────────────────────────────────────────────────────
 * Các lần trước chỉ đo HÌNH HỌC (bounding box tràn, alpha, gradient) và không
 * kết luận được, vì gradient tắt trước khi tới 3% ngoài cùng thì vệt "tràn
 * 34.6px" nhìn ra vẫn là 0.
 *
 * Lần này đo thứ mà mắt thấy: chụp ảnh rồi ĐỌC PIXEL, hỏi trực tiếp "ngay
 * NGOÀI viền thanh có khác gì so với nền trang không".
 *
 * ── NHÂN TỐC CHẬM ────────────────────────────────────────────────────────────
 * Máy này chạy Chrome headless ~1–2fps nên lúc navbar đang co/phình (500ms) ta
 * không lấy được nổi một khung giữa chừng. Vì vậy bơm CSS nhân thời lượng mọi
 * animation/transition của navbar lên ~15×. Hiệu ứng GIỮ NGUYÊN về hình dạng
 * và thứ tự, chỉ chậm hơn — đúng thứ ta muốn soi.
 *
 * ── CÁCH ĐO ──────────────────────────────────────────────────────────────────
 * Chụp một dải ngang ngang qua navbar, rồi với mỗi bên (trái/phải):
 *   • trong  = mẫu màu lấy ngay BÊN TRONG viền thanh (nền kính)
 *   • ngoài1 = mẫu màu ở khoảng 6–18px NGOÀI viền ⇒ đây là chỗ lỗi sẽ lộ
 *   • ngoài2 = mẫu màu ở ~90px ngoài ⇒ nền trang thật, để tham chiếu
 * Nếu `ngoài1` khác `ngoài2` rõ rệt ⇒ có vệt lọt ra ngoài. Nếu tương đương ⇒
 * không có gì lọt ra, dù hình học có tràn.
 *
 * Dùng: node scripts/phase3-c1-slowmo.js [baseUrl] [outDir]
 */
'use strict';
const { spawn } = require('child_process');
const fs = require('fs'); const os = require('os'); const path = require('path');
const png = require('./png');

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = process.argv[2] || 'http://localhost:3010';
const OUT = process.argv[3] || path.resolve(__dirname, '..', 'docs', 'gd3-shots');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Nhân thời lượng mọi hiệu ứng navbar. */
const SLOWMO_CSS = `
.site-global-nav,
.site-global-nav-glow,
.site-global-nav-sheen,
.site-global-hover-pill { transition-duration: 7s !important; }
.site-global-nav.is-morph::before { animation-duration: 14s !important; }
.site-global-ripple-init { animation-duration: 26s !important; }
.site-global-ripple-reverse { animation-duration: 18s !important; }
.site-global-hamburger > span { transition-duration: 4s !important; }
`;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-sm-'));
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
    if (r.exceptionDetails) return { __exc: String(r.exceptionDetails.exception?.description || '').slice(0, 180) };
    const v = r.result.value;
    if (typeof v !== 'string') return v;
    try { return JSON.parse(v); } catch { return v; }
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
    if (ok && (await ev(`!!document.querySelector('.site-global-links')`))) break;
  }
  await ev("document.documentElement.style.scrollBehavior='auto'; 'ok'");
  await sleep(1500);

  const injected = await ev(`(() => {
    const st = document.createElement('style');
    st.id = 'slowmo';
    st.textContent = ${JSON.stringify(SLOWMO_CSS)};
    document.head.appendChild(st);
    const nav = document.querySelector('.site-global-nav');
    const glow = nav.querySelector('.site-global-nav-glow');
    return {
      ok: true,
      navTransition: getComputedStyle(nav).transitionDuration,
      glowTransition: glow ? getComputedStyle(glow).transitionDuration : null,
      beforeAnim: getComputedStyle(nav, '::before').animationDuration,
    };
  })()`);
  console.log('bơm slow-motion →', JSON.stringify(injected));
  if (!injected || injected.__exc || !injected.ok) {
    console.error('❌ không gắn được CSS slow-motion — dừng, vì kết quả sẽ vô nghĩa.');
    try { child.kill(); } catch {}
    process.exitCode = 1;
    return;
  }

  /**
   * Chụp dải ngang qua navbar và đo 3 vùng màu mỗi bên.
   * Clip dùng toạ độ TRANG (cộng scrollY) vì navbar là position: fixed.
   */
  const measure = async (label) => {
    const box = await ev(`(() => {
      const nav = document.querySelector('.site-global-nav');
      const r = nav.getBoundingClientRect();
      const sy = window.scrollY, sx = window.scrollX;
      const m = 140;                      // lấy rộng, bao trọn vùng tràn
      const h = Math.round(r.height);
      return {
        // Tên thuộc tính PHẢI đúng chữ mà CDP chờ: x/y/width/height/scale.
        // (Lần trước đặt nhầm clipX/clipY/… ⇒ "-32602 Invalid parameters".)
        x: Math.max(0, Math.round(r.left + sx - m)),
        y: Math.max(0, Math.round(r.top + sy - 20)),
        width: Math.min(1440 - Math.max(0, Math.round(r.left + sx - m)), Math.round(r.width + m * 2)),
        height: h + 40,
        scale: 1,
        navLeftInClip: m,
        navRightInClip: Math.round(r.width + m),
        navH: h,
      };
    })()`);
    if (!box || box.__exc) { console.log('  lỗi clip', box); return null; }
    if (box.width < 260) { console.log('  clip quá hẹp', box); return null; }

    const res = await cmd('Page.captureScreenshot', { format: 'png', clip: box });
    const img = png.decode(Buffer.from(res.data, 'base64'));

    const midY = Math.round(img.height / 2);

    const L = box.navLeftInClip;   // mép TRÁI của nav trong ảnh
    const R = box.navRightInClip;  // mép PHẢI của nav trong ảnh
    /*
     * ── SỬA LỖI LẤY MẪU ──────────────────────────────────────────────────────
     * Lần chạy đầu, `outside1` và `outside2` đều lấy ở x < L ⇒ tức BÊN TRONG
     * thanh, đúng bằng `inside`. Ba "vùng" hoá ra là một, nên Δ luôn ra nhỏ
     * và kết luận sai. Nay đả chiều: mọi mẫu "ngoài" đều lấy ở x > L (trái)
     * hoặc x < R (phải).
     */
    const band = (x0, w) => png.avgRect(img, x0, midY - 12, w, 24);

    const leftIn    = band(L - 26, 22);   // trong thanh, cách mép 4–26px
    const leftOut1  = band(L + 6, 16);    // NGOÀI 6–22px  ← chỗ lỗi lộ
    const leftOut2  = band(L + 46, 74);   // NGOÀI 46–120px ← nền xa
    const rightIn   = band(R + 4, 22);
    const rightOut1 = band(R - 22, 16);   // NGOÀI 6–22px
    const rightOut2 = band(R - 120, 74);  // NGOÀI 46–120px

    const state = await ev(`(() => {
      const nav = document.querySelector('.site-global-nav');
      const glow = nav.querySelector('.site-global-nav-glow');
      const b = getComputedStyle(nav, '::before');
      const g = glow ? getComputedStyle(glow) : null;
      return {
        cls: nav.className.replace(/site-global-nav |lg-material/g, '').trim(),
        navW: Math.round(nav.getBoundingClientRect().width),
        glowOpacity: g ? Math.round(parseFloat(g.opacity) * 100) / 100 : null,
        glowW: glow ? Math.round(glow.getBoundingClientRect().width) : null,
        beforeOpacity: Math.round(parseFloat(b.opacity) * 100) / 100,
        beforeTransform: b.transform,
      };
    })()`);

    const dL = png.colorDelta(leftOut1, leftOut2);
    const dR = png.colorDelta(rightOut1, rightOut2);
    const dLIn = png.colorDelta(leftOut1, leftIn);
    const dRIn = png.colorDelta(rightOut1, rightIn);

    /*
     * ── ĐỐI CHỨNG: ẩN NAVBAR RỒI CHỤP LẠI, LẤY HIỆU ──────────────────────────
     * Nền sau navbar là video/ảnh hero — màu nó tự đổi theo chiều ngang và
     * chiều dọc, nên "ngoài khác nền xa" KHÔNG chứng minh được gì. Cách chắc:
     * đặt `visibility:hidden` (giữ nguyên layout và backdrop) chụp lại đúng
     * khung đó, rồi lấy hiệu từng cột. Mọi pixel khác biệt = do navbar vẽ,
     * không còn lẫn nhiễu nền.
     */
    await ev(`(() => { document.querySelector('.site-global-nav').style.visibility = 'hidden'; return 1; })()`);
    await sleep(120);
    const resHidden = await cmd('Page.captureScreenshot', { format: 'png', clip: box });
    const imgHidden = png.decode(Buffer.from(resHidden.data, 'base64'));
    await ev(`(() => { document.querySelector('.site-global-nav').style.visibility = ''; return 1; })()`);

    /** |màu CÓ navbar − màu KHÔNG navbar| trung bình theo dải ngang. */
    const leak = (x0, w) => {
      let d = 0, n = 0;
      const y0 = midY - 12, y1 = midY + 12;
      const xa = Math.max(0, Math.round(x0)), xb = Math.min(img.width - 1, Math.round(x0 + w));
      for (let y = y0; y <= y1; y++) {
        for (let x = xa; x <= xb; x++) {
          d += png.colorDelta(png.pixelAt(img, x, y), png.pixelAt(imgHidden, x, y));
          n++;
        }
      }
      return n ? d / n : 0;
    };

    // Trong thanh (chắc chắn khác — kiểm chứng phép trừ có hoạt động không)
    const leakIn = leak(L - 26, 22);
    // Ngoài viền, chia 4 dải 14px liên tiếp: 0–14, 14–28, 28–42, 42–70
    const leakOutL = [0, 14, 28, 42].map((o, i) => leak(L + 2 + o, i < 3 ? 12 : 26));
    const leakOutR = [0, 14, 28, 42].map((o, i) => leak(R - 2 - o - (i < 3 ? 12 : 26), i < 3 ? 12 : 26));

    const out = {
      label, state,
      trai: { trong: png.fmt(leftIn), ngoai1: png.fmt(leftOut1), ngoai2: png.fmt(leftOut2),
              dNgoai1_vs_nen: Math.round(dL), dNgoai1_vs_trong: Math.round(dLIn) },
      phai: { trong: png.fmt(rightIn), ngoai1: png.fmt(rightOut1), ngoai2: png.fmt(rightOut2),
              dNgoai1_vs_nen: Math.round(dR), dNgoai1_vs_trong: Math.round(dRIn) },
      // Vết do navbar vẽ ra, đã trừ nền
      vet: {
        trong: Math.round(leakIn * 10) / 10,
        traiNgoai: leakOutL.map((v) => Math.round(v * 10) / 10),
        phaiNgoai: leakOutR.map((v) => Math.round(v * 10) / 10),
      },
    };
    // Lưu ảnh để mắt kiểm cùng số đo.
    fs.writeFileSync(path.join(OUT, `slowmo-${label}.png`), Buffer.from(res.data, 'base64'));
    return out;
  };

  console.log('\n[A] TRẠNG THÁI TįNH — đỉnh trang (is-at-top). CHƯA đóng băng nền ⇒');
  console.log('    chỉ đọc được màu, Δ của phần này vô nghĩa, xem [B] mới là số thật.');
  const a = await measure('A-dung');
  if (a) console.log('   cls:', a.state.cls, '\n   trái:', JSON.stringify(a.trai), '\n   phải:', JSON.stringify(a.phai));

  /* ── BƯỚC 1: ĐÓNG BĂNG NỀN. Không làm bước này thì mọi phép trừ ảnh vô
        nghĩa. Lần chạy trước cho Δ phẳng ~150–280 ở MỌI khoảng cách và nhảy loạn
        giữa các khung, trong khi navbar đã đứng yên (::before = 0) — đó là
        video nền đang chạy, không phải navbar vẽ ra.

        Cách đóng băng: dừng mọi <video>, rồi CUỘN tới một vùng nền phẳng và
        đứng yên — không cuộn trong lúc đo, nên nền không đổi. Bật `is-morph` bằng
        cách gán class trực tiếp, y hệt cách component bật nó khi cuộn, nhưng
        không kèm theo cuộn.                                              */
  console.log('\n[0] ĐÓNG BĂNG NỀN');
  await ev(`(() => {
    let n = 0;
    document.querySelectorAll('video').forEach((v) => { try { v.pause(); n++; } catch {} });
    const vids = [...document.querySelectorAll('video')];
    vids.forEach((v) => { v.removeAttribute('autoplay'); });
    return n;
  })()`).then((n) => console.log('   video đã dừng:', n));

  // Cuộn tới chỗ có nền phẳng: dò dọc, mỗi bước chụp 2 ảnh cách nhau 300ms và
  // đo độ biến thiên của vùng NGAY DƯỚI navbar. Chỗ nào biến thiên < 3 thì nền
  // đứng yên, dùng làm chỗ đo.
  console.log('   đang tìm vùng nền phẳng…');

  /** Chụp nhanh toàn bộ dải 200px dưới navbar, dùng để thử độ ổn định. */
  const bgStability = async () => {
    const b1 = await cmd('Page.captureScreenshot', { format: 'png', clip: { x: 300, y: 400, width: 600, height: 200, scale: 1 } });
    await sleep(320);
    const b2 = await cmd('Page.captureScreenshot', { format: 'png', clip: { x: 300, y: 400, width: 600, height: 200, scale: 1 } });
    const i1 = png.decode(Buffer.from(b1.data, 'base64'));
    const i2 = png.decode(Buffer.from(b2.data, 'base64'));
    let d = 0, n = 0;
    for (let y = 0; y < i1.height; y += 2) for (let x = 0; x < i1.width; x += 2) {
      d += png.colorDelta(png.pixelAt(i1, x, y), png.pixelAt(i2, x, y)); n++;
    }
    return n ? d / n : 999;
  };

  let chosen = null;
  for (let k = 0; k < 40; k++) {
    await cmd('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 720, y: 450, deltaX: 0, deltaY: 900, pointerType: 'mouse' });
    await sleep(260);
    const s = await bgStability();
    if (s < 3) { chosen = k; console.log(`   ✓ chỗ phẳng sau ${k} cú cuộn, biến thiên nền = ${s.toFixed(2)}`); break; }
    if (k % 8 === 7) console.log(`   … ${k + 1} lần cuộn, nền vẫn động (${s.toFixed(1)})`);
  }
  if (chosen === null) {
    console.error('❌ không tìm được vùng nền phẳng nào — dừng. Đo trên nền động là đo nhiễu.');
    try { child.kill(); } catch {}
    process.exitCode = 1;
    return;
  }

  // Bật `is-morph` bằng cách gán class, KHÔNG cuộn thêm.
  await ev(`(() => {
    const nav = document.querySelector('.site-global-nav');
    nav.classList.add('is-active', 'is-glass');
    nav.classList.remove('is-clear');
    nav.classList.add('is-morph');
    return nav.className;
  })()`);
  console.log('   đã bật is-morph (gán class, không cuộn thêm)');

  // ── Kích hoạt chuyển trạng thái: quay nhiều khung ──────────────────────────
  console.log('\n[B] LÚC CHUYỂN TRẠNG THÁI — quay nhiều khung (nền đã đứng yên)');
  const frames = [];
  for (let i = 0; i < 16; i++) {
    await sleep(700);
    const m = await measure(`B-${String(i).padStart(2, '0')}`);
    if (m) frames.push(m);
  }

  console.log('\n   │ VẾT NAVBAR VẼ RA (đã trừ nền) — Δ trung bình mỗi dải ngang        │');
  console.log('   │      trong │  trái 0–14 │14–28 │28–42 │42–70 │ phải 0–14 │14–28 │28–42 │42–70 │');
  frames.forEach((f) => {
    const s = f.state;
    const v = f.vet;
    const p = (n) => String(n).padStart(6);
    console.log(
      `   ${f.label.padEnd(7)}│${p(v.trong)} │` +
      v.traiNgoai.map(p).join(' ') + '│' + v.phaiNgoai.map(p).join(' ') +
      `  │ glow ${s.glowOpacity} ${s.glowW}px · ::before ${s.beforeOpacity}`
    );
  });

  const peak = frames.reduce((best, f) => {
    const m = Math.max(...f.vet.traiNgoai.slice(0, 3), ...f.vet.phaiNgoai.slice(0, 3));
    return m > best.m ? { m, f } : best;
  }, { m: -1, f: null });

  console.log('\n──── KẾT LUẬN C1 (đo pixel thật + slow-motion + trừ nền) ────');
  console.log('  "Vết" = |màu khi có navbar − màu khi ẩn navbar|, cùng toạ độ.');
  console.log('  Nền đã được trừ sạch nên con số này là ĐỘ THAY ĐỔI THẬT do navbar.');
  console.log('  Ngưỡng: Δ < 3 = không nhìn thấy · 3–10 = mờ · >10 = rõ · >25 = lỗi thị giác');
  if (peak.f) {
    console.log(`  Đỉnh: ${peak.f.label} · vết ngoài viền = ${peak.m.toFixed(1)} · vết trong viền = ${peak.f.vet.trong}`);
    console.log(`         cls="${peak.f.state.cls}"`);
    console.log(`         glow: opacity ${peak.f.state.glowOpacity}, rộng ${peak.f.state.glowW}px (nav ${peak.f.state.navW}px)`);
    console.log(`         ::before gooeyStretch: opacity ${peak.f.state.beforeOpacity}`);
    console.log(`         ::before transform: ${peak.f.state.beforeTransform}`);
    console.log(`         trái  ${JSON.stringify(peak.f.vet.traiNgoai)}`);
    console.log(`         phải  ${JSON.stringify(peak.f.vet.phaiNgoai)}`);
  }
  console.log(`\n  ảnh từng khung → ${OUT}/slowmo-*.png`);

  try { child.kill(); } catch {}
})().catch((e) => { console.error('❌ lỗi:', e.message); process.exitCode = 1; });
