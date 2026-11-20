/* GĐ5 · 25.4 — kiểm tra "Tìm chi nhánh gần tôi" bằng vị trí MÔ PHỎNG.
 *
 * ── VÌ SAO KHÔNG DÙNG VỊ TRÍ THẬT ───────────────────────────────────────────
 * Máy này không có tín hiệu GPS, và tôi không biết chủ dự án đang ở đâu. Nhưng
 * tính năng này toàn bộ là TOÁN HỌC thuần: nhận lat/lng → so với 4 toạ độ cố
 * định. Cho phép đưa vào đúng toạ độ thì kiểm được từng nhánh một cách xác
 * định, tốt hơn nhiều so với "đứng ở đâu đó và hy vọng".
 *
 * CDP có `Emulation.setGeolocationOverride` + `Browser.grantPermissions`, nên
 * mô phỏng được cả vị trí lẫn quyền bị từ chối.
 *
 * ── KỲ VỌNG ĐƯỢC TÍNH SẴN, KHÔNG HARD-CODE THEO KẾT QUẢ ───────────────────────
 * `expected` ghi rõ toạ độ nào phải ra chi nhánh nào, rồi mới so. Nếu đổi số
 * trong `lib/clinics.ts` thì script báo sai NGAY thay vì âm thầm xanh.
 *
 * Dùng: node scripts/gd5-nearest-check.js [baseUrl] [outDir]
 */
'use strict';
const { spawn } = require('child_process');
const fs = require('fs'); const os = require('os'); const path = require('path');
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = process.argv[2] || 'http://localhost:3010';
const OUT = process.argv[3] || path.resolve(__dirname, '..', 'docs', 'gd5-shots');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/*
 * Toạ độ tham chiếu (lấy từ Google Maps, như chủ dự án đã đưa ở GĐ3):
 *   b1  1E Trần Não, An Khánh, Thủ Đức      10.79860, 106.73337
 *   b2  695 Nguyễn Kiệm, Hạnh Thông          10.81511, 106.67870
 *   b3  160 Xô Viết Nghệ Tĩnh, Thạnh Mỹ Tây 10.79712, 106.71098
 *   b4  552 Lê Đức Thọ, Gò Vấp             10.84367, 106.67427
 * Mỗi phép thử đặt ngay TRÊN một chi nhánh (lệch ~0.002°) hoặc ở xa.
 */
const CASES = [
  {
    name: 'ngay tren CN1 (Thủ Đức)',
    pos: { latitude: 10.800, longitude: 106.735 },
    expectBranch: '01',
    expectMsg: 'found',
  },
  {
    name: 'ngay tren CN2 (Nguyễn Kiệm)',
    pos: { latitude: 10.815, longitude: 106.679 },
    expectBranch: '02',
    expectMsg: 'found',
  },
  {
    name: 'ngay tren CN3 (Xô Viết Nghệ Tĩnh)',
    pos: { latitude: 10.797, longitude: 106.711 },
    expectBranch: '03',
    expectMsg: 'found',
  },
  {
    name: 'ngay tren CN4 (Lê Đức Thọ)',
    pos: { latitude: 10.844, longitude: 106.674 },
    expectBranch: '04',
    expectMsg: 'found',
  },
  {
    name: 'giua TP.HCM — canh bang nhau, chi ra chi nhat',
    pos: { latitude: 10.77, longitude: 106.70 },
    expectBranch: null, // không khẳng định chi nhánh nào, chỉ kiểm tra có tìm được
    expectMsg: 'found',
  },
  {
    name: 'Ha Noi (~1400km) — phai bao "far", khong bao gan',
    pos: { latitude: 21.0278, longitude: 105.8342 },
    expectBranch: null,
    expectMsg: 'far',
  },
  {
    name: 'quyen bi tu choi',
    pos: { latitude: 10.8, longitude: 106.7 },
    expectBranch: null,
    expectMsg: 'denied',
    deny: true,
  },
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-nb-'));
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
    const msg = { id: n, method, params }; if (sessionId) msg.sessionId = sessionId;
    child.stdio[3].write(JSON.stringify(msg) + '\0');
  });
  const { targetInfos } = await send('Target.getTargets');
  const page = targetInfos.find((t) => t.type === 'page');
  const { sessionId } = await send('Target.attachToTarget', { targetId: page.targetId, flatten: true });
  const cmd = (m, p) => send(m, p, sessionId);
  const ev = async (e) => {
    const r = await cmd('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) return { __exc: String(r.exceptionDetails.exception?.description || '').slice(0, 200) };
    const v = r.result.value;
    if (typeof v !== 'string') return v;
    try { return JSON.parse(v); } catch { return v; }
  };
  const shot = async (name) => {
    const r = await cmd('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(OUT, `${name}.png`), Buffer.from(r.data, 'base64'));
  };

  await cmd('Page.enable'); await cmd('Runtime.enable');
  await cmd('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });

  const failures = [];
  console.log('\ntên'.padEnd(42) + 'kỳ vọng'.padEnd(12) + 'thực tế'.padEnd(12) + 'khoảng cách');
  console.log('─'.repeat(92));

  for (const c of CASES) {
    /*
     * THỨ TỰ QUAN TRỌNG: nạp trang TRƯỚC, cấp quyền SAU.
     * `Browser.grantPermissions` gắn quyền vào ORIGIN của trang đang mở. Gọi nó
     * lúc còn ở `about:blank` thì không có origin để gắn — lần chạy đầu cho ra
     * "denied" ở cả 6 case ĐÃ cấp quyền, đúng bẫy này.
     */
    await cmd('Page.navigate', { url: BASE + '/lien-he' });
    for (let i = 0; i < 40; i++) {
      if (await ev(`!!document.querySelector('.clinic-branch-card')`)) break;
      await sleep(500);
    }

    await send('Browser.grantPermissions', {
      origin: BASE,
      permissions: c.deny ? [] : ['geolocation'],
    });
    await cmd('Emulation.setGeolocationOverride', {
      latitude: c.pos.latitude, longitude: c.pos.longitude, accuracy: 10,
    });

    // Xác nhận quyền thật sự đã cấp, trước khi kết luận gì về component.
    const perm = await ev(`navigator.permissions.query({ name: 'geolocation' })
      .then(p => p.state).catch(e => 'ERR:' + e.message)`);
    console.log(`  [${c.name}] quyền geolocation = ${perm}`);

    // Chờ khối tìm chi nhánh dựng xong.
    const mounted = await ev(`(() => {
      const b = [...document.querySelectorAll('button')].find(x => /location|vị trí/i.test(x.textContent || ''));
      return !!b;
    })()`);
    if (!mounted) { failures.push(`${c.name}: không thấy nút "Dùng vị trí của tôi"`); continue; }

    await ev(`(() => {
      const b = [...document.querySelectorAll('button')].find(x => /location|vị trí/i.test(x.textContent || ''));
      b.click(); return 1;
    })()`);

    // Chờ kết quả (aria-live có nội dung).
    //
    // 24 giây, không phải 16: case ĐẦU TIÊN trong mỗi lần chạy lâu hơn hẳn —
    // đó là lần đầu tiên trình duyệt định vị trong phiên đó, các case sau thì
    // nhanh. Timeout của component là 10s nhưng cộng thêm độ trễ khởi tạo dịch
    // vụ thì vượt 16s.
    let out = null;
    for (let i = 0; i < 60; i++) {
      await sleep(400);
      out = await ev(`(() => {
        const live = document.querySelector('[aria-live="polite"]');
        const marked = [...document.querySelectorAll('[data-nearest]')];
        return {
          msg: live ? (live.textContent || '').replace(/\\s+/g,' ').trim() : '',
          markedNum: marked.length ? (marked[0].querySelector('.clinic-branch-num')||{}).textContent : null,
          soTheDanh: marked.length,
          badge: marked.length && marked[0].querySelector('span.rounded-full.bg-blue-600')
            ? marked[0].querySelector('span.rounded-full.bg-blue-600').textContent.trim() : null,
        };
      })()`);
      if (out && out.msg) break;
    }

    const isFar = /^(You seem|.*cách bạn khoảng)/.test(out.msg) && !/is about|cách bạn khoảng .* gần bạn nhất/.test(out.msg);
    const kmMatch = out.msg.match(/([\d]+[.,][\d])\s*km/);
    const gotKind = c.expectMsg === 'denied'
      ? (/Location access is off|Quyền truy cập vị trí/.test(out.msg) ? 'denied' : 'khac')
      : c.expectMsg === 'far'
        ? (/You seem to be around|có vẻ đang ở cách/.test(out.msg) ? 'far' : 'khac')
        : (/is about|cách bạn khoảng/.test(out.msg) && !/You seem|có vẻ/.test(out.msg) ? 'found' : 'khac');

    let ok = gotKind === c.expectMsg;
    if (c.expectBranch) ok = ok && out.markedNum === c.expectBranch;
    if (c.expectMsg !== 'denied' && c.expectMsg !== 'far') ok = ok && out.soTheDanh === 1;

    console.log(
      ('  ' + c.name).padEnd(44) +
      (c.expectMsg + (c.expectBranch ? '/' + c.expectBranch : '')).padEnd(12) +
      (gotKind + (out.markedNum ? '/' + out.markedNum : '')).padEnd(12) +
      (kmMatch ? kmMatch[1] + ' km' : '—') +
      (ok ? '  ✓' : '  ✗')
    );
    if (!ok) {
      failures.push(`${c.name}\n      câu chữ: "${out.msg}"\n      thẻ đánh dấu: ${out.soTheDanh}, số "${out.markedNum}", badge "${out.badge}"`);
      await shot('fail-' + c.name.replace(/[^a-z0-9]+/gi, '-'));
    }
  }

  // Kiểm tra riêng: KHÔNG tự hỏi quyền khi vào trang (đòi hỏi riêng của GĐ5).
  console.log('\n── kiểm tra riêng: không tự hỏi quyền khi vào trang ──');
  await send('Browser.grantPermissions', { origin: BASE, permissions: ['geolocation'] });
  await cmd('Emulation.setGeolocationOverride', { latitude: 10.8, longitude: 106.7, accuracy: 10 });
  await cmd('Page.navigate', { url: BASE + '/lien-he' });
  for (let i = 0; i < 40; i++) {
    if (await ev(`!!document.querySelector('.clinic-branch-card')`)) break;
    await sleep(500);
  }
  await sleep(2500);
  const idle = await ev(`(() => ({
    marked: document.querySelectorAll('[data-nearest]').length,
    live: (document.querySelector('[aria-live="polite"]')?.textContent || '').trim(),
    // Trước khi bấm, câu chữ phải RỖNG — tức chưa có kết quả nào bịa ra.
    statusIdle: (document.querySelector('[aria-live="polite"]')?.textContent || '').trim().length === 0,
  }))()`);
  console.log('  trước khi bấm → thẻ đánh dấu:', idle.marked, '| nội dung aria-live rỗng:', idle.statusIdle);
  if (idle.marked !== 0) failures.push('không bấm mà đã có thẻ chi nhánh được đánh dấu');
  if (!idle.statusIdle) failures.push('không bấm mà đã hiện kết quả: "' + idle.live + '"');
  if (idle.marked === 0 && idle.statusIdle) console.log('  ✓ không tự hỏi, không tự hiện kết quả');
  await shot('idle');

  // Kiểm tra riêng: trang chủ KHÔNG có tiện ích này.
  console.log('\n── kiểm tra riêng: trang chủ không bật tiện ích ──');
  await cmd('Page.navigate', { url: BASE + '/' });
  for (let i = 0; i < 50; i++) {
    if (await ev(`!!document.querySelector('.clinic-branch-card')`)) break;
    await sleep(500);
  }
  await sleep(2000);
  const home = await ev(`(() => {
    const b = [...document.querySelectorAll('button')].find(x => /location|vị trí/i.test(x.textContent || ''));
    return { coNut: !!b };
  })()`);
  console.log('  trang chủ có nút định vị:', home.coNut);
  if (home.coNut) failures.push('trang chủ đang bật "Tìm chi nhánh gần tôi" — chỉ nên bật ở /lien-he');

  console.log('\n=== KẾT QUẢ ===');
  if (failures.length) {
    console.log(`❌ ${failures.length} vấn đề:`);
    failures.forEach((f) => console.log('  - ' + f));
  } else {
    console.log('✅ "Tìm chi nhánh gần tôi" đạt các tiêu chí đã kiểm');
  }
  console.log(`\n  ảnh → ${OUT}`);
  try { child.kill(); } catch {}
  process.exitCode = failures.length ? 1 : 0;
})().catch((e) => { console.error('❌ lỗi:', e.message); process.exitCode = 1; });