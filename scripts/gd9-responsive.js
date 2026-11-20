/* Kiểm BỐ CỤC responsive cho các phần mới ở GĐ9.
 *
 * VÌ SAO CẦN: bộ ki��m gd9-check.js chạy ở MỌI màn 1440px và kiểm CHỨC NĂNG.
 * Chức năng đúng không bảo đảm bố cục đúng — thẻ tràn ngang, chữ bị bóp còn một
 * dòng, nút chạm mép màn hình là những lỗi mà kiểm chức năng không thấy.
 *
 * Danh sách màn hình là những cỡ khách dự án yêu cầu rà soát.
 *
 * Dùng: node scripts/gd9-responsive.js http://localhost:3010
 */
'use strict';
const { spawn } = require('child_process');
const fs = require('fs'); const os = require('os'); const path = require('path');
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = process.argv[2] || 'http://localhost:3010';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const WIDTHS = [1920, 1440, 1280, 1024, 960, 768, 390, 360];
const PAGES = [
  ['/', 'trang chủ'],
  ['/lien-he', 'liên hệ'],
  ['/kien-thuc-thu-y', 'kiến thức'],
  ['/doi-ngu', 'đội ngũ'],
  ['/doi-ngu/phan-thi-tu', 'chi tiết nhân viên'],
  ['/dich-vu', 'dịch vụ'],
  ['/booking/kham-benh', 'đặt lịch'],
  ['/dang-nhap', 'đăng nhập'],
];

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-rs-'));
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
    const msg = { id: n, method, params };
    if (sessionId) msg.sessionId = sessionId;
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
  await cmd('Page.enable'); await cmd('Runtime.enable');

  const fails = [];
  const rows = [];

  for (const [route, label] of PAGES) {
    for (const w of WIDTHS) {
      await cmd('Emulation.setDeviceMetricsOverride', {
        width: w, height: 900, deviceScaleFactor: 1, mobile: w < 700,
      });
      await cmd('Page.navigate', { url: BASE + route });
      await sleep(2600);
      // Overlay giới thiệu che kín trang 15 giây trong headless (xem gd9-check).
      // Nó không ảnh hưởng phép đo bố cục, nhưng làm chậm; bỏ qua.
      const r = await ev(`(() => {
        const de = document.documentElement;
        const W = window.innerWidth;

        // 1. TRÀN NGANG: trang rộng hơn khung nhìn ⇒ xuất hiện thanh cuộn ngang.
        const tran = de.scrollWidth - W;

        /*
         * 2. PHẦN TỬ TRÀN KHỎI KHUNG.
         *
         * Bản đầu gọi getComputedStyle() cho MỌI phần tử trong body. Trang chủ
         * có vài nghìn phần tử, mỗi lần gọi ép trình duyệt tính lại style ⇒
         * một lần quét mất hàng chục giây, 64 tổ hợp chạy hơn 20 phút không xong.
         *
         * Nay CHỈ đọc getBoundingClientRect (rẻ hơn nhiều), lọc ra phần tử có
         * toạ độ vượt mép phải, RỒI MỚI gọi getComputedStyle cho đúng mấy phần tử
         * đó để loại "position: fixed" (navbar, overlay cố ý phủ kín).
         */
        const vuot = [];
        const all = document.body.querySelectorAll('*');
        for (let i = 0; i < all.length; i++) {
          const el = all[i];
          const b = el.getBoundingClientRect();
          if (b.width === 0 || b.height === 0) continue;
          if (b.right <= W + 1) continue;
          const cs = getComputedStyle(el);
          if (cs.position === 'fixed' || cs.display === 'none') continue;
          vuot.push({
            tag: el.tagName,
            cls: (el.className || '').toString().slice(0, 40),
            right: Math.round(b.right),
          });
          if (vuot.length >= 5) break;
        }

        /*
         * 3. CHỮ BÓP: chữ bị cắt bớt dòng.
         *
         * Dùng scrollHeight > clientHeight — không cần đọc lineHeight. Chỉ kiểm
         * phần tử chứa CHỮ TRỰC TIẾP (không có con) để tránh báo trùng lên thẻ cha.
         * Bỏ qua phần tử có "overflow: visible": khi đó nội dung vẫn hiện đủ, chỉ
         * là tràn ra ngoài hộp chứ không bị cắt.
         */
        const bop = [];
        const texts = document.body.querySelectorAll('h1, h2, h3, p, a, button, span');
        for (let i = 0; i < texts.length; i++) {
          const el = texts[i];
          if (el.children.length > 0) continue;
          const txt = (el.textContent || '').trim();
          if (txt.length < 12) continue;
          if (el.scrollHeight <= el.clientHeight + 2) continue;
          const cs = getComputedStyle(el);
          if (cs.overflow === 'visible' || cs.display === 'none') continue;
          if (cs.webkitLineClamp && cs.webkitLineClamp !== 'none') continue;
          bop.push({ tag: el.tagName, cls: (el.className || '').toString().slice(0, 30), txt: txt.slice(0, 30) });
          if (bop.length >= 4) break;
        }
        return { tran, vuot, soVuot: vuot.length, bop, soBop: bop.length };
      })()`);

      process.stdout.write(`  ${label} ${w}px\r`);

      rows.push({ route, label, w, tran: r.tran, soVuot: r.soVuot || 0, soBop: r.soBop || 0 });

      if (r && r.__exc) {
        // Bản đầu không in lỗi này, chỉ crash thành "Cannot read properties of
        // undefined (reading 'map')" — mất luôn thông tin gốc là lỗi gì.
        fails.push(`${label} ${w}px: KHÔNG ĐỌC ĐƯỢC DOM — ${r.__exc}`);
        rows.push({ route, label, w, tran: -1, soVuot: 0, soBop: 0 });
        continue;
      }
      if (r.tran > 1) fails.push(`${label} ${w}px: tràn ngang ${r.tran}px`);
      if (r.soVuot) {
        const s = r.vuet.map((v) => `${v.tag}.${v.cls}(→${v.right}px)`).join(' ');
        fails.push(`${label} ${w}px: ${r.soVuot} phần tử vượt mép phải — ${s}`);
      }
      if (r.soBop) {
        const s = r.bop.map((b) => `${b.tag} "${b.txt}"`).join(' | ');
        fails.push(`${label} ${w}px: ${r.soBop} chữ bị bóp cắt — ${s}`);
      }
    }
  }

  console.log('\n');
  console.log('=== TRÀN NGANG (scrollWidth - innerWidth), px ===');
  console.log('trang'.padEnd(22) + WIDTHS.map((w) => String(w).padStart(7)).join(''));
  for (const [route, label] of PAGES) {
    const line = rows.filter((r) => r.label === label)
      .sort((a, b) => WIDTHS.indexOf(a.w) - WIDTHS.indexOf(b.w))
      .map((r) => String(r.tran).padStart(7)).join('');
    console.log(label.padEnd(22) + line);
  }

  console.log('\n=== KẾT QUẢ ===');
  if (fails.length) {
    console.log(`${fails.length} vấn đề bố cục:`);
    fails.forEach((f) => console.log('  - ' + f));
  } else {
    console.log(`✅ ${PAGES.length * WIDTHS.length} tổ hợp trang × màn hình: không tràn, không chữ bị bóp`);
  }
  try { child.kill(); } catch { }
  process.exitCode = fails.length ? 1 : 0;
})().catch((e) => { console.error('loi:', e.message); process.exitCode = 1; });