/* Headless Chrome (CDP over --remote-debugging-pipe, zero deps) — Giai đoạn 2 check.

   Kiểm tra những gì Giai đoạn 2 tuyên bố đã làm trên trang chủ:
     A6  section "Nơi chăm sóc thú cưng của bạn tốt nhất" tồn tại; đúng 4 ảnh
         theo đúng thứ tự; mỗi ảnh TẢI THÀNH CÔNG (naturalWidth > 0 — chỉ kiểm
         `src` thì không phát hiện được ảnh 404).
     A4  lưới chi nhánh: 1 cột ở 768px, 2 cột ở 1280px; .clinic-branch-card có
         backdrop-filter thật; nút "Chúng tôi là ai?" trỏ /doi-ngu.
     A3  5 thẻ kiến thức dùng vật liệu kính (backdrop-filter) và thứ tự được
         xáo (báo cáo hai lượt tải liên tiếp).
     A5  .stats-blob có transform ĐỔI THEO CUỘN (chứng minh nó được điều khiển
         bằng scroll chứ không phải tĩnh).
   +0  hydration mismatch của AboveFooterCard đã HẾT (GĐ2a).

   KHÔNG kiểm: CLS, chất lượng thẩm mỹ, screen reader thật.

   Cách dùng: node scripts/phase2-check.js [baseUrl]
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

/** Đúng 4 file có thật trong /public, theo đúng thứ tự card 1→4. */
const EXPECTED_IMAGES = [
  '/hoatdongkhamchuabenh.jpg',
  '/hoatdongsieuam.jpg',
  '/hoatdongkhaitruong.jpg',
  '/hoatdongchamsoc.jpg',
];

/*
 * LƯU Ý VỀ CÁCH ĐỌC `src` CỦA next/image (đã sai một lần ở đây, ghi lại để
 * không lặp):
 *
 *   im.src = "/_next/image?url=%2Fhoatdongkhamchuabenh.jpg&w=384&q=75"
 *
 * pathname LUÔN LUÔN là `/_next/image` cho mọi ảnh. Đọc `pathname` trực tiếp
 * nên bốn ảnh khác nhau đều ra cùng một giá trị ⇒ script báo sai là "dùng trùng
 * ảnh". Muốn biết file thật phải lấy tham số `url` — nên mọi chỗ đọc ảnh trong
 * file này đều dùng một hàm `realPath()` nhỏ đặt trong ngữ cảnh trình duyệt.
 */

/** Text tiếng Việt phải khớp nguyên văn nội dung chủ dự án cung cấp. */
const VI_H2 = 'Nơi chăm sóc thú cưng của bạn tốt nhất';
const VI_C1 = 'Đội ngũ bác sĩ thú y chuyên môn cao';

async function main() {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-p2-'));
  const child = spawn(CHROME, [
    '--headless=new', '--remote-debugging-pipe', '--no-first-run',
    '--no-default-browser-check', '--disable-gpu',
    '--autoplay-policy=no-user-gesture-required',
    `--user-data-dir=${userDataDir}`, 'about:blank',
  ], { stdio: ['pipe', 'pipe', 'pipe', 'pipe', 'pipe'] });

  let finished = false;
  child.on('exit', (code) => { if (!finished) { console.error('Chrome exited early', code); process.exit(2); } });

  const cdp = new CDP(child);
  const watchdog = setTimeout(() => { console.error('WATCHDOG 240s'); try { child.kill(); } catch {} process.exit(3); }, 240000);
  watchdog.unref();

  const failures = [];
  const notes = [];

  /**
   * `awaitPromise: true` là BẮT BUỘC: nhiều biểu thức dưới đây là async IIFE
   * (phải await ảnh tải xong mới đo được naturalWidth). Thiếu cờ này thì
   * Runtime.evaluate trả về chính đối tượng Promise, serialize thành
   * "[object Object]" và JSON.parse nổ.
   */
  const evalJS = async (cmd, expression) => {
    const r = await cmd('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('eval: ' + JSON.stringify(r.exceptionDetails).slice(0, 400));
    const value = r.result ? r.result.value : undefined;
    if (typeof value !== 'string') {
      throw new Error('eval không trả về chuỗi JSON: ' + JSON.stringify(r.result).slice(0, 300));
    }
    return JSON.parse(value);
  };

  try {
    const session = await cdp.attachToPage();
    const cmd = (m, p) => cdp.send(m, p, session);
    await cmd('Page.enable');
    await cmd('Runtime.enable');
    await cmd('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });

    // ---------------------------------------------------------------- A6
    console.log('=== A6 — section "Nơi chăm sóc thú cưng của bạn tốt nhất" ===');
    await cmd('Page.navigate', { url: BASE + '/' });
    await sleep(7000);

    const a6 = await evalJS(cmd, `(async () => {
      const sec = document.getElementById('why-belwee');
      if (!sec) return JSON.stringify({ found: false });
      const h2 = sec.querySelector('h2');
      const imgs = [...sec.querySelectorAll('img')];
      // Đợi mọi ảnh kết thúc tải (tối đa ~6s) rồi mới đo naturalWidth.
      await Promise.all(imgs.map(im => im.complete ? null : new Promise(res => {
        im.addEventListener('load', res, { once: true });
        im.addEventListener('error', res, { once: true });
        setTimeout(res, 6000);
      })));
      const realPath = (im) => {
        if (!im) return null;
        const raw = im.currentSrc || im.src;
        try {
          const u = new URL(raw, location.origin);
          return u.searchParams.get('url') || u.pathname;
        } catch { return raw; }
      };
      const cards = [...sec.querySelectorAll('article')].map(a => {
        const im = a.querySelector('img');
        const h3 = a.querySelector('h3');
        const p = a.querySelector('p');
        return {
          src: realPath(im),
          natW: im ? im.naturalWidth : 0,
          alt: im ? im.alt : null,
          title: h3 ? h3.textContent.trim() : null,
          descLen: p ? p.textContent.trim().length : 0,
        };
      });
      const divider = sec.querySelector('h2 + span');
      const ds = divider ? getComputedStyle(divider) : null;
      return JSON.stringify({
        found: true,
        h2: h2 ? h2.textContent.trim() : null,
        gridCols: getComputedStyle(sec.querySelector('div[data-reveal-group]') || sec).gridTemplateColumns,
        divider: ds ? { h: ds.height, w: ds.width, bg: ds.backgroundColor } : null,
        cards,
      });
    })()`);

    if (!a6.found) {
      failures.push('A6: không tìm thấy section #why-belwee');
    } else {
      console.log('   h2:', JSON.stringify(a6.h2));
      console.log('   divider:', JSON.stringify(a6.divider));
      console.log('   số card:', a6.cards.length);
      a6.cards.forEach((c, i) =>
        console.log(`   card ${i + 1}: ${c.src}  natW=${c.natW}  alt=${JSON.stringify(c.alt)}  desc=${c.descLen} ký tự`)
      );
      if (a6.cards.length !== 4) failures.push(`A6: có ${a6.cards.length} card (mong đợi 4)`);
      a6.cards.forEach((c, i) => {
        if (c.src !== EXPECTED_IMAGES[i]) failures.push(`A6 card ${i + 1}: src=${c.src} (mong đợi ${EXPECTED_IMAGES[i]})`);
        if (!(c.natW > 0)) failures.push(`A6 card ${i + 1}: ảnh KHÔNG tải được (naturalWidth=${c.natW})`);
        if (!c.alt) failures.push(`A6 card ${i + 1}: thiếu alt`);
        if (c.descLen < 40) failures.push(`A6 card ${i + 1}: mô tả quá ngắn`);
      });
      const newSrcs = new Set(a6.cards.map(c => c.src));
      if (newSrcs.size !== 4) failures.push('A6: có ảnh bị dùng trùng');
      if (a6.divider && a6.divider.w !== '130px') failures.push(`A6: đường kẻ rộng ${a6.divider.w} (mong đợi 130px)`);
    }

    // ---- A6 responsive: 4 cột ≥1024, 2 cột 768, 1 cột <420 ----
    const colsAt = async (width) => {
      await cmd('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 });
      await sleep(900);
      return evalJS(cmd, `(() => {
        const sec = document.getElementById('why-belwee');
        if (!sec) return JSON.stringify(null);
        const g = sec.querySelector('div[data-reveal-group]');
        const n = g ? getComputedStyle(g).gridTemplateColumns.split(' ').filter(Boolean).length : -1;
        const doc = document.documentElement;
        return JSON.stringify({ n, overflowX: doc.scrollWidth - doc.clientWidth });
      })()`);
    };
    for (const [width, want] of [[1440, 4], [1280, 4], [1024, 4], [768, 2], [390, 2], [360, 1]]) {
      const r = await colsAt(width);
      if (!r) { failures.push(`A6: mất section ở ${width}px`); continue; }
      const ok = r.n === want;
      if (!ok) failures.push(`A6 @${width}px: ${r.n} cột (mong đợi ${want})`);
      if (r.overflowX > 1) failures.push(`A6 @${width}px: tràn ngang ${r.overflowX}px`);
      console.log(`   ${width}px → ${r.n} cột ${ok ? 'ok' : '❌'} · overflowX=${r.overflowX}`);
    }

    // ---- A6: nội dung tiếng Việt phải khớp NGUYÊN VĂN ----------------
    // Mặc định của site là "en" (xem lib/i18n.ts), nên phải tự chuyển sang
    // "vi" mới kiểm được đúng chuỗi mà chủ dự án yêu cầu.
    await evalJS(cmd, `(() => { localStorage.setItem('belwee-language','vi'); return JSON.stringify({ ok: true }); })()`);
    await cmd('Page.navigate', { url: BASE + '/' });
    await sleep(7000);
    const vi = await evalJS(cmd, `(() => {
      const sec = document.getElementById('why-belwee');
      if (!sec) return JSON.stringify({ found: false });
      const h2 = sec.querySelector('h2');
      const cards = [...sec.querySelectorAll('article')];
      return JSON.stringify({
        found: true,
        h2: h2 ? h2.textContent.trim() : null,
        titles: cards.map(a => (a.querySelector('h3') || {}).textContent ? a.querySelector('h3').textContent.trim() : null),
      });
    })()`);
    console.log('\n   [vi] h2:', JSON.stringify(vi.h2));
    if (vi.h2 !== VI_H2) failures.push(`A6 (vi): h2 = ${JSON.stringify(vi.h2)} (mong đợi ${JSON.stringify(VI_H2)})`);
    if (vi.titles && vi.titles[0] !== VI_C1) failures.push(`A6 (vi): tiêu đề card 1 = ${JSON.stringify(vi.titles[0])} (mong đợi ${JSON.stringify(VI_C1)})`);
    vi.titles && vi.titles.forEach((t2, i) => console.log(`   [vi] card ${i + 1}: ${t2}`));
    // Trả về tiếng Anh cho các phần kiểm tra sau (A3/A4/A5 không phụ thuộc lang).
    await evalJS(cmd, `(() => { localStorage.setItem('belwee-language','en'); return JSON.stringify({ ok: true }); })()`);

    // ---------------------------------------------------------------- A4
    console.log('\n=== A4 — Hệ thống phòng khám: 2 cột + pill Đội ngũ ===');
    await cmd('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    await sleep(800);
    const a4 = await evalJS(cmd, `(() => {
      const card = document.querySelector('.clinic-branch-card');
      const grid = card ? card.parentElement : null;
      const pillLink = document.querySelector('a[href="/doi-ngu"] .glass-pill');
      const cs = card ? getComputedStyle(card) : null;
      return JSON.stringify({
        cols: grid ? getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length : -1,
        colsClass: grid ? grid.className : null,
        cardBackdrop: cs ? (cs.backdropFilter || cs.webkitBackdropFilter || 'none') : null,
        pillFound: !!pillLink,
        pillText: pillLink ? pillLink.textContent.trim() : null,
        pillRadius: pillLink ? getComputedStyle(pillLink).borderRadius : null,
        pillBackdrop: pillLink ? (getComputedStyle(pillLink).backdropFilter || 'none') : null,
      });
    })()`);
    console.log('   ', JSON.stringify(a4, null, 0));
    if (a4.cols !== 2) failures.push(`A4 @1280px: lưới chi nhánh ${a4.cols} cột (mong đợi 2)`);
    if (!/blur/.test(a4.cardBackdrop || '')) failures.push('A4: .clinic-branch-card KHÔNG có backdrop-filter');
    if (!a4.pillFound) failures.push('A4: không tìm thấy pill "Chúng tôi là ai?" trỏ /doi-ngu');
    if (a4.pillFound && !a4.pillText) failures.push('A4: pill Đội ngũ không có chữ');

    // 768px phải vẫn 1 cột
    await cmd('Emulation.setDeviceMetricsOverride', { width: 768, height: 900, deviceScaleFactor: 1, mobile: true });
    await sleep(900);
    const a4tab = await evalJS(cmd, `(() => {
      const card = document.querySelector('.clinic-branch-card');
      const grid = card ? card.parentElement : null;
      return JSON.stringify({ cols: grid ? getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length : -1 });
    })()`);
    console.log(`    @768px → ${a4tab.cols} cột ${a4tab.cols === 1 ? 'ok' : '❌'}`);
    if (a4tab.cols !== 1) failures.push(`A4 @768px: ${a4tab.cols} cột (mong đợi 1 — mobile/tablet giữ nguyên)`);

    // ---------------------------------------------------------------- A3
    console.log('\n=== A3 — thẻ kiến thức: kính + thứ tự ngẫu nhiên ===');
    await cmd('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    const readKnowledge = async () => {
      await sleep(1200);
      return evalJS(cmd, `(() => {
        // LOẠI thẻ "Đọc thêm" (cũng mang class knowledge-card nhưng không phải
        // thẻ kiến thức và không có ảnh) — không loại thì vừa đếm sai số thẻ
        // vừa báo sai "thẻ bị lặp".
        const cards = [...document.querySelectorAll('#vet-knowledge a.knowledge-card')]
          .filter(c => !c.classList.contains('knowledge-readmore'));
        if (!cards.length) return JSON.stringify({ found: false });
        const realPath = (im) => {
          if (!im) return null;
          const raw = im.currentSrc || im.src;
          try {
            const u = new URL(raw, location.origin);
            return u.searchParams.get('url') || u.pathname;
          } catch { return raw; }
        };
        return JSON.stringify({
          found: true,
          count: cards.length,
          order: cards.map(c => realPath(c.querySelector('img')) || '?'),
          backdrop: getComputedStyle(cards[0]).backdropFilter || 'none',
          radius: getComputedStyle(cards[0]).borderRadius,
          textColor: getComputedStyle(cards[0].querySelector('h3')).color,
        });
      })()`);
    };
    await cmd('Page.navigate', { url: BASE + '/#vet-knowledge' });
    await sleep(6500);
    const k1 = await readKnowledge();
    await cmd('Page.navigate', { url: BASE + '/?r=2#vet-knowledge' });
    await sleep(6500);
    const k2 = await readKnowledge();
    if (!k1.found || !k2.found) {
      failures.push('A3: không tìm thấy thẻ kiến thức');
    } else {
      console.log('   lượt 1:', k1.order.join(', '));
      console.log('   lượt 2:', k2.order.join(', '));
      console.log('   backdrop-filter:', k1.backdrop, '· bo góc:', k1.radius, '· màu h3:', k1.textColor);
      if (k1.count !== 5) failures.push(`A3: có ${k1.count} thẻ (mong đợi 5)`);
      if (new Set(k1.order).size !== k1.count) failures.push('A3: có thẻ bị LẶP trong cùng lượt hiển thị');
      if (!/blur/.test(k1.backdrop)) failures.push('A3: thẻ kiến thức KHÔNG có backdrop-filter (chưa thành kính)');
      const same = k1.order.join(',') === k2.order.join(',');
      if (same) notes.push('A3: hai lượt tải cho CÙNG thứ tự — có thể do trùng ngẫu nhiên (1/120), cần xem lại nếu lặp lại');
      else console.log('   → thứ tự ĐÃ đổi giữa hai lượt ✓ (không lặp thẻ nào)');
    }

    // ---------------------------------------------------------------- A5
    console.log('\n=== A5 — giọt nước điều khiển bằng cuộn ===');
    await cmd('Page.navigate', { url: BASE + '/' });
    await sleep(7000);
    const readBlob = async () => evalJS(cmd, `(() => {
      const blob = document.querySelector('.stats-blob');
      const solid = document.querySelector('.stats-card-solid');
      if (!blob) return JSON.stringify({ found: false });
      return JSON.stringify({
        found: true,
        blobTransform: getComputedStyle(blob).transform,
        blobOpacity: getComputedStyle(blob).opacity,
        solidOpacity: solid ? getComputedStyle(solid).opacity : null,
        surfaceBg: getComputedStyle(document.querySelector('.stats-surface') || document.body).backgroundImage.slice(0, 60),
      });
    })()`);
    const before = await readBlob();
    await evalJS(cmd, `(() => {
      const s = document.querySelector('.stats-surface');
      if (s) s.scrollIntoView({ block: 'center', behavior: 'instant' });
      return JSON.stringify({ ok: true });
    })()`);
    await sleep(1600);
    const after = await readBlob();
    if (!before.found) {
      failures.push('A5: không tìm thấy .stats-blob');
    } else {
      console.log('   trước khi cuộn tới:', before.blobTransform, '· opacity', before.blobOpacity, '· lớp trắng', before.solidOpacity);
      console.log('   sau khi cuộn tới  :', after.blobTransform, '· opacity', after.blobOpacity, '· lớp trắng', after.solidOpacity);
      if (before.blobTransform === after.blobTransform && before.blobOpacity === after.blobOpacity) {
        failures.push('A5: .stats-blob KHÔNG đổi theo cuộn (hiệu ứng không chạy)');
      } else {
        console.log('   → giọt nước đổi theo cuộn ✓');
      }
      if (Number(after.solidOpacity) >= Number(before.solidOpacity) && Number(before.solidOpacity) === 0) {
        notes.push('A5: lớp trắng đặc trên thẻ không đổi — kiểm tra lại mốc scrollYProgress');
      }
      console.log('   nền section:', after.surfaceBg);
    }

    // Ghi chú: kiểm tra hydration mismatch của AboveFooterCard (GĐ2a) do
    // scripts/phase1-check.js đảm nhiệm — nó đã bắt được lỗi #422/#425 trước
    // khi sửa, nên chạy lại chính script đó là cách xác nhận đã hết (không
    // lặp lại logic thu thập console ở đây cho khỏi hai nguồn sự thật).

    // ---------------------------------------------------------------- KẾT QUẢ
    console.log('\n=== KẾT QUẢ ===');
    if (notes.length) {
      console.log('⚠️  ghi nhận:');
      for (const n of notes) console.log('   -', n);
    }
    if (failures.length === 0) {
      console.log('✅ A3/A4/A5/A6 đạt các tiêu chí đã kiểm');
    } else {
      console.log(`❌ ${failures.length} vấn đề:`);
      for (const f of [...new Set(failures)]) console.log('   -', f);
      process.exitCode = 1;
    }
    finished = true;
  } catch (e) {
    finished = true;
    console.error('❌ phase2 check failed:', e.message);
    process.exitCode = 1;
  } finally {
    try { child.kill(); } catch {}
  }
}

main();
