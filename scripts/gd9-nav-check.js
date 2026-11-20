/* Kiểm (a): thanh điều hướng hiện đủ 7 mục khi rộng, 3 mục khi hẹp.
 *
 * Kiểm bằng SỐ MỤC THẬT ĐANG HIỆN, không kiểm class. Vì nếu chỉ kiểm
 * `navIsCompact` thì đo sai bề rộng vẫn ra "xanh" trong khi người dùng thấy
 * thanh tràn hoặc thiếu mục.
 */
'use strict';
const { spawn } = require('child_process');
const fs = require('fs'); const os = require('os'); const path = require('path');
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = process.argv[2] || 'http://localhost:3010';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const WIDTHS = [1920, 1600, 1440, 1280, 1152, 1024, 960, 900, 820, 768, 390, 360];

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-nv-'));
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
    return r.result.value;
  };

  await cmd('Page.enable'); await cmd('Runtime.enable');
  await cmd('Page.navigate', { url: BASE + '/gioi-thieu' });
  for (let i = 0; i < 50; i++) {
    if ((await ev(`!!document.querySelector('.site-global-nav')`)) === true) break;
    await sleep(500);
  }
  await sleep(3000);

  const failures = [];
  console.log('\nmàn'.padEnd(8) + 'hiện'.padStart(6) + 'ẩn'.padStart(6) +
    'tràn?'.padStart(8) + '  mục đang hiện');
  console.log('─'.repeat(96));

  for (const w of WIDTHS) {
    await cmd('Emulation.setDeviceMetricsOverride', { width: w, height: 900, deviceScaleFactor: 1, mobile: w < 700 });
    // ResizeObserver cần một nhịp để bắn; chờ đủ rồi mới đo.
    await sleep(1100);

    const r = await ev(`(() => {
      const links = [...document.querySelectorAll('.site-global-link')];
      const shown = links.filter(a => getComputedStyle(a).display !== 'none');
      const nav = document.querySelector('.site-global-nav');
      const logo = nav.querySelector('.site-global-logo');
      const actions = nav.querySelector('.site-global-actions');
      const linksBox = nav.querySelector('.site-global-links');
      const cs = linksBox ? getComputedStyle(linksBox) : null;
      const boxHidden = !linksBox || cs.display === 'none';

      // TRÀN: khối links có chồng lên cụm nút phải, hoặc tràn khỏi thanh?
      let tran = false;
      if (!boxHidden && shown.length) {
        const first = shown[0].getBoundingClientRect();
        const last = shown[shown.length - 1].getBoundingClientRect();
        const ab = actions.getBoundingClientRect();
        const nb = nav.getBoundingClientRect();
        const lb = logo.getBoundingClientRect();
        tran = last.right > ab.left + 0.5 || first.left < lb.right - 0.5
            || last.right > nb.right + 0.5 || first.left < nb.left - 0.5;
      }
      return {
        soHien: shown.length,
        soAn: links.length - shown.length,
        tran,
        boxHidden,
        danhSach: shown.map(a => a.textContent.trim()),
      };
    })()`);

    console.log(
      String(w).padEnd(8) + String(r.soHien).padStart(6) + String(r.soAn).padStart(6) +
      ((r.tran ? '  TRÀN' : '  không').padStart(8)) + '  ' +
      (r.boxHidden ? '[cả cụm mục đã ẩn — dùng menu ba gạch] ' : '') + r.danhSach.join(' · ')
    );

    // Kỳ vọng: ≥1024 → đủ 7 mục và cụm mục không bị ẩn; 768–1023 → 3 mục;
    // <768 → cả cụm mục ẩn hẳn, chỉ còn menu ba gạch.
    //
    // LƯU Ý: lần đầu script chỉ đếm link và báo "3 mục" ở 390px, tưởng là
    // đúng — nhưng thật ra `.site-global-links` đã bị `display:none` từ 768px,
    // chỉ là các link bên trong vẫn giữ `display` của riêng chúng nên đếm vẫn ra
    // 3. Phải kiểm container (`boxHidden`), không chỉ kiểm link.
    if (r.tran) failures.push(`${w}px: thanh TRÀN — mục chồn lên nút hoặc tràn khỏi thanh`);
    if (w >= 1024) {
      if (r.boxHidden) failures.push(`${w}px: cả cụm mục bị ẩn dù màn đủ rộng`);
      if (r.soHien !== 7) failures.push(`${w}px: phải hiện đủ 7 mục, đang hiện ${r.soHien}`);
    } else if (w >= 768) {
      if (r.boxHidden) failures.push(`${w}px: cụm mục bị ẩn ở màn vẫn vừa 3 mục`);
      if (r.soHien !== 3) failures.push(`${w}px: phải hiện 3 mục, đang hiện ${r.soHien}`);
    } else if (!r.boxHidden) {
      failures.push(`${w}px: phải ẨN hẳn cụm mục (chỉ còn menu ba gạch), nhưng nó đang hiện`);
    }
  }

  console.log('\n=== KẾT QUẢ ===');
  if (failures.length) {
    console.log(`❌ ${failures.length} vấn đề:`);
    failures.forEach((f) => console.log('  - ' + f));
  } else {
    console.log('✅ Thanh điều hướng đạt: rộng → 7 mục, hẹp → 3 mục, không tràn');
  }
  try { child.kill(); } catch {}
  process.exitCode = failures.length ? 1 : 0;
})().catch((e) => { console.error('❌ lỗi:', e.message); process.exitCode = 1; });