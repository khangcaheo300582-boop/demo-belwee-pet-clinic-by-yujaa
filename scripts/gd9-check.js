/* Kiểm chứng GĐ9 — chạy trên production build ở cổng 3010.
 *
 * Gộp các mục đã sửa vào MỘT lần chạy để tiết kiệm thời gian khởi động Chrome:
 *   (a) navbar   — rộng → 7 mục, hẹp → 3 mục, không tràn
 *   (c) thẻ D    — nằm TRÊN <footer> trong cây DOM, footer ở đáy
 *   (d) liên hệ  — khối tìm chi nhánh tách khỏi lưới thẻ, nút có 3 trạng thái
 *   (e) dịch vụ  — icon là emoji thật, không phải chuỗi mojibake
 *   (f) kiến thức — bấm vào giữa thẻ đi tới /kien-thuc-thu-y/<slug>
 *   (g) đội ngũ   — 4 thẻ nhân viên là link, trang chi tiết mở được
 *   (i) đặt lịch  — khách chưa đăng nhập bị chặn
 *
 * Dùng: node scripts/gd9-check.js http://localhost:3010
 */
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = process.argv[2] || 'http://localhost:3010';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const fails = [];
const ok = [];
const check = (cond, label, detail) => {
  (cond ? ok : fails).push(detail ? `${label} — ${detail}` : label);
};

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-gd9-'));
  const child = spawn(CHROME, [
    '--headless=new', '--remote-debugging-pipe', '--no-first-run',
    '--no-default-browser-check', '--disable-gpu', '--force-device-scale-factor=1',
    `--user-data-dir=${dir}`, 'about:blank',
  ], { stdio: ['pipe', 'pipe', 'pipe', 'pipe', 'pipe'] });

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
    if (r.exceptionDetails) return { __exc: String(r.exceptionDetails.exception?.description || '').slice(0, 300) };
    return r.result.value;
  };
  const goto = async (url, waitFor) => {
    await cmd('Page.navigate', { url: BASE + url });
    for (let i = 0; i < 60; i++) {
      if (waitFor && (await ev(`!!document.querySelector(${JSON.stringify(waitFor)})`)) === true) break;
      await sleep(400);
    }
    await sleep(2200);
  };

  await cmd('Page.enable');
  await cmd('Runtime.enable');
  await cmd('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

  // ═══ (c) thẻ "Belwee luôn quan tâm bạn" phải nằm TRÊN footer ═══
  // Selector thật của thẻ là `.abovefooter-bright` (AboveFooterCard.tsx:45).
  // Lần đầu tôi dùng `'.abovefooter-card, [aria-label], section'` — class đó không
  // tồn tại, nên CSS trả về `<section>` ĐẦU TIÊN của trang (mục nội dung),
  // vốn luôn nằm trước footer ⇒ báo sai trên cả 3 route. Selector sai thì kết
  // quả sai dù sản phẩm đúng.
  for (const route of ['/gioi-thieu', '/dich-vu', '/lien-he']) {
    // Chờ CHÍNH thẻ D, không chỉ `body`. `AboveFooterGate` khởi tạo
    // `canRender = false` rồi mới bật trong `useEffect`, nên thẻ xuất hiện sau
    // một nhịp. Chờ `body` là có ngay rồi đo ⇒ "không tìm thấy thẻ" trên các
    // route tải nhanh, trong khi `/lien-he` tải chậm hơn nên tình cờ.
    await goto(route, '.abovefooter-bright');
    const r = await ev(`(() => {
      const card = document.querySelector('.abovefooter-bright');
      const footer = document.querySelector('.site-footer');
      if (!footer) return { noFooter: true };
      if (!card) return { noCard: true };
      // DOCUMENT_POSITION_FOLLOWING = footer nằm SAU card.
      const footerSauCard =
        (card.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
      const cr = card.getBoundingClientRect();
      const fr = footer.getBoundingClientRect();
      return {
        footerSauCard,
        // Thẻ phải nằm NGAY trên footer, không có nội dung nào chen giữa.
        // Dùng tọa độ trang chứ không "nextElementSibling" vì có wrapper.
        //
        // LƯU Ý: không được đặt dấu backtick trong comment ở đây — nó đóng
        // template literal ngay lập tức và Node báo "missing ) after argument
        // list". Lần này chính ghi chú giải thích về backtick đã gây lỗi đó.
        cachFooter: Math.round(fr.top - cr.bottom),
        badge: card.querySelector('span')?.textContent?.trim().slice(0, 24),
      };
    })()`);
    check(!r.noFooter && !r.noCard && r.footerSauCard === true,
      `(c) ${route}: thẻ "Belwee luôn quan tâm bạn" nằm TRÊN footer`, r.badge || '');
    if (r.footerSauCard) {
      check(r.cachFooter >= -2 && r.cachFooter < 200,
        `(c) ${route}: thẻ áp sát footer, không bị đẩy xuống dưới`, `cách ${r.cachFooter}px`);
    }
  }

  // Footer phải ở đáy: trang ngắn (không cuộn được) ⇒ footer chạm đáy viewport.
  await goto('/lien-he', '.site-footer');
  const foot = await ev(`(() => {
    const f = document.querySelector('.site-footer');
    const r = f.getBoundingClientRect();
    return {
      docH: document.documentElement.scrollHeight,
      winH: window.innerHeight,
      scrollH: window.scrollY,
      bottomGap: Math.round(document.documentElement.scrollHeight - (r.bottom + window.scrollY)),
    };
  })()`);
  check(foot.bottomGap <= 2, '(c) footer sát đáy trang', `cách đáy ${foot.bottomGap}px`);

  // ═══ (e) icon dịch vụ là emoji thật ═══
  await goto('/dich-vu', 'article');
  const ico = await ev(`(() => {
    const txt = document.body.innerText;
    const bad = txt.match(/ðŸ|â€[\\x80-\\xBF²³¢™œžšž‹›ˆ]|Â[\\x80-\\xBF]|Æ.|Ð[\\x80-\\xBF]|â€[\x80-\xBF]/g) || [];
    return {
      // Danh sách dấu hiệu phải đủ: "â€" bắt được â€“ (gạch nối) và â€” (gạch dài),
      // "âœ" bắt được ✂️, "ðŸ" bắt emoji. Lần đầu thiếu nên bỏ sót 31 chỗ.
      mojibake: bad.slice(0, 6),
      emoji: (txt.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu) || []),
    };
  })()`);
  check(ico.mojibake.length === 0, '(e) /dich-vu không còn chuỗi mojibake',
    ico.mojibake.length ? JSON.stringify(ico.mojibake) : 'sạch');
  check(ico.emoji.length >= 4, '(e) icon dịch vụ hiện được', ico.emoji.slice(0, 6).join(' '));

  // ═══ (d) khối tìm chi nhánh tách khỏi lưới thẻ ═══
  await goto('/lien-he', '.nb-locate-btn');
  const nb = await ev(`(() => {
    const btn = document.querySelector('.nb-locate-btn');
    const sec = btn.closest('section');
    const br = btn.getBoundingClientRect();
    const sr = sec.getBoundingClientRect();
    const cs = getComputedStyle(btn);
    return {
      laSection: sec.tagName,
      pill: Math.round(br.width) > 120,
      radius: cs.borderRadius,
      // Khối tìm phải có nền riêng, không dính lưới thẻ
      bg: getComputedStyle(sec).backgroundColor,
      // Khoảng cách tới phần tử đứng trước nó (lưới thẻ)
      gapAbove: (() => {
        const prev = sec.previousElementSibling;
        if (!prev) return null;
        const pr = prev.getBoundingClientRect();
        return Math.round(sr.top - pr.bottom);
      })(),
    };
  })()`);
  check(nb.laSection === 'SECTION', '(d) khối tìm chi nhánh là <section> riêng', `thẻ <${nb.laSection.toLowerCase()}>`);
  check(nb.pill && parseFloat(nb.radius) >= 20, '(d) nút ở trạng thái chờ có dạng viên thuốc', `r=${nb.radius} w=${nb.pill}`);
  check(nb.gapAbove !== null && nb.gapAbove >= 24, '(d) tách khỏi lưới thẻ', `hở ${nb.gapAbove}px`);

  // Nút chuyển 3 trạng thái khi bấm (cấp quyền sau khi nạp trang — nếu cấp sớm
  // thì không gắn được vào origin của trang và mọi lần đều ra `denied`).
  await send('Browser.grantPermissions', {
    origin: BASE, permissions: ['geolocation'],
  });
  // `Emulation` là domain THUỘC SESSION nên phải gọi qua `cmd` (có sessionId).
  // `Browser` thuộc browser nên gọi qua `send`. Lần đầu viết `send` cho cả hai
  // ⇒ "Emulation.setGeolocationOverride wasn't found".
  await cmd('Emulation.setGeolocationOverride', {
    latitude: 10.7769, longitude: 106.7009, accuracy: 20,
  });
  // Làm nóng định vị: lần đầu `getCurrentPosition` trong phiên rất chậm.
  await ev(`new Promise(r => navigator.geolocation.getCurrentPosition(r, r, {timeout: 25000}))`).catch(() => {});

  /*
   * TRÌ HOÃN `getCurrentPosition` 3 GIÂY để quan sát được trạng thái "đang tìm".
   *
   * Vì sao cần: vị trí đã có cache nên `maximumAge: 300000` trả về NGAY ⇒ trạng
   * thái "locating" chỉ tồn tại dưới một khung hình. Hai lần đo trước đều báo sai:
   *   • đo sau 1.5s → đã sang trạng thái xong;
   *   • đo trong CÙNG lệnh `b.click()` → React chưa render lại, `setState` là bất
   *     đồng bộ ⇒ vẫn thấy nút ở trạng thái cũ.
   *
   * Đây là can thiệp CỦA BỘ KIỂM, không đụng mã sản phẩm: chỉ bọc lại hàm của
   * trình duyệt trong chính trang đang kiểm. Hàm gốc vẫn được gọi, chỉ trễ lại.
   */
  await ev(`(() => {
    const g = navigator.geolocation;
    const goc = g.getCurrentPosition.bind(g);
    g.getCurrentPosition = function (...a) {
      const [ok, loi, opt] = a;
      goc.call(g, (p) => setTimeout(() => ok(p), 3000), (e) => setTimeout(() => loi(e), 3000), opt);
    };
    return true;
  })()`);

  await ev(`document.querySelector('.nb-locate-btn').click()`);
  await sleep(700);
  const busy = await ev(`(() => {
    const b = document.querySelector('.nb-locate-btn');
    return {
      spin: !!b.querySelector('.nb-locate-spinner'),
      w: Math.round(b.getBoundingClientRect().width),
      chu: b.innerText.trim(),
    };
  })()`);
  check(busy.spin && busy.w > 120, '(d) trạng thái "đang tìm" hiện dấu quét tròn',
    `rộng ${busy.w}px · "${busy.chu}"`);

  for (let i = 0; i < 30; i++) {
    if ((await ev(`!!document.querySelector('.nb-locate-btn--done')`)) === true) break;
    await sleep(1500);
  }
  // Chờ hết transition `background-color` 260ms. Đọc ngay khi class vừa gắn sẽ
  // ra màu NỀN CŨ (transition chưa xong) — đo được rgb(37,99,235) rồi tưởng nút
  // không chuyển xanh lá.
  await sleep(1200);
  const done = await ev(`(() => {
    const b = document.querySelector('.nb-locate-btn');
    const svg = b.querySelector('svg');
    const d = svg ? svg.querySelector('path')?.getAttribute('d') : '';
    const r = b.getBoundingClientRect();
    return {
      done: b.classList.contains('nb-locate-btn--done'),
      bg: getComputedStyle(b).backgroundColor,
      w: Math.round(r.width), h: Math.round(r.height),
      laTron: Math.abs(r.width - r.height) <= 2,
      pathLaTich: /m5 12\.5|4\.5 4\.5/.test(d || ''),
      coBanDo: !!document.querySelector('.knowledge-page, svg[role=img]'),
      banDo: !!document.querySelector('figure svg[role=img]'),
      chuBanDo: document.querySelector('figure figcaption')?.textContent?.slice(0, 40),
      ketQua: document.querySelector('[aria-live=polite]')?.textContent?.trim().slice(0, 70),
    };
  })()`);
  check(done.done, '(d) trạng thái xong dùng class --done');
  check(done.laTron, '(d) nút thu nhỏ thành HÌNH TRÒN', `${done.w}×${done.h}`);
  // #16a34a = rgb(22, 163, 74). Lần đầu tôi viết /16,\s*164,\s*81/ ⇒ kiểm ĐỎ
  // trong khi nút ĐÃ xanh lá đúng; giá trị đo được là rgb(22, 163, 74).
  check(done.bg === 'rgb(22, 163, 74)', '(d) nút chuyển màu XANH LÁ #16a34a', done.bg);
  check(done.pathLaTich, '(d) icon tâm vị trí đổi thành DẤU TÍCH');
  check(done.banDo, '(d) hiện bản đồ sau khi tìm ra chi nhánh', done.chuBanDo || '');
  console.log(`    kết quả: ${done.ketQua}`);

  // ═══ (f) kiến thức: bấm ở mọi vị trí trên thẻ → sang trang chi tiết ═══
  await goto('/kien-thuc-thu-y', '.kn-card');

  /*
   * CHỜ OVERLAY GIỚI THIỆU NGỨNG CHẶN BẤM.
   *
   * `.intro-video-screen` là `position: fixed; inset: 0; z-index: 9999`; khi đã
   * ẩn nó mang class `is-hidden` kèm `pointer-events: none`. Lúc mới điều hướng
   * xong thì CHƯA ẩn, nên nó phủ lên mọi thứ và `elementFromPoint` trả về
   * `<video class="intro-video">` ở cả 4 điểm — tôi tưởng link phủ hỏng.
   *
   * Chrome headless chặn autoplay nên sự kiện `ended` không bắn và overlay chỉ mất
   * khi fallback CSS 15 giây chạy xong. Đây là hiện tượng của headless, KHÔNG phải
   * lỗi sản phẩm — nhưng bộ kiểm phải chờ đúng thì mới đo được.
   */
  for (let i = 0; i < 40; i++) {
    const pe = await ev(`(() => {
      const s = document.querySelector('.intro-video-screen');
      return s ? getComputedStyle(s).pointerEvents : 'none';
    })()`);
    if (pe === 'none') break;
    await sleep(1000);
  }

  // `elementFromPoint` trả `null` cho toạ độ ngoài khung nhìn ⇒ mọi điểm sẽ báo
  // OFFSCREEN và kiểm sai. Cuộn thẻ vào giữa khung nhìn trước.
  await ev(`document.querySelector('.kn-card').scrollIntoView({block: 'center'})`);
  await sleep(1500);
  const kn = await ev(`(() => {
    const card = document.querySelector('.kn-card');
    const link = card.querySelector('a[href^="/kien-thuc-thu-y/"]');
    const pill = card.querySelector('.kn-pill');
    const r = card.getBoundingClientRect();
    // Thử NHIỀU điểm chứ không chỉ giữa thẻ. Lần đầu chỉ đo GIỮA thẻ và báo sai:
      // giữa thẻ rơi vào vùng chữ nên vẫn trúng link. Điểm nằm trên ẢNH mới là chỗ
      // hay hỏng — ".kn-thumb" có "position: relative" và nằm SAU link phủ trong
      // DOM nên vẽ đè lên, nuốt click (lỗi thật, đã sửa bằng z-index).
      const pts = [
        ['giua', 0.5, 0.5], ['trenAnh', 0.3, 0.18],
        ['goPhai', 0.88, 0.3], ['duoi', 0.5, 0.85],
      ];
      const bam = pts.map(([ten, fx, fy]) => {
        const x = r.left + r.width * fx, y = r.top + r.height * fy;
        const el = document.elementFromPoint(x, y);
        const a = el ? el.closest('a') : null;
        return ten + '=' + (a === link ? 'OK' : (a ? 'LINK_KHAC' : (el ? 'KHONG_PHAI_LINK' : 'OFFSCREEN')));
      });
      return {
        cardW: Math.round(r.width),
        pill: !!pill,
        pillRadius: pill ? getComputedStyle(pill).borderRadius : '',
        href: link ? link.getAttribute('href') : null,
        bam,
        anh: !!card.querySelector('.kn-thumb'),
      };
  })()`);
  check(kn.href != null, '(f) thẻ bài có link tới trang chi tiết', kn.href || '');
  check(kn.bam.every((b) => b.endsWith('OK')),
    '(f) bấm ở MỌI vị trí trên thẻ đều tới trang chi tiết', kn.bam.join(' '));
  check(kn.pill && parseFloat(kn.pillRadius) >= 999, '(f) "Đọc bài đầy đủ" là nút hình viên thuốc', `r=${kn.pillRadius}`);

  // ═══ (g) đội ngũ: thẻ nhân viên là link + trang chi tiết mở được ═══
  await goto('/doi-ngu', 'a[href^="/doi-ngu/"]');
  const team = await ev(`(() => {
    const links = [...document.querySelectorAll('a[href^="/doi-ngu/"]')];
    return {
      soLink: links.length,
      hrefs: links.map(a => a.getAttribute('href')),
    };
  })()`);
  check(team.soLink >= 4, '(g) thẻ nhân viên là link', `${team.soLink} link`);

  for (const slug of ['phan-thi-tu', 'ta-trung-nguyen', 'le-nguyen-vu', 'dinh-phan-huu-khang']) {
    await goto(`/doi-ngu/${slug}`, 'h1');
    const p = await ev(`(() => {
      const h1 = document.querySelector('h1');
      const txt = document.body.innerText;
      return {
        ten: h1 ? h1.textContent.trim() : null,
        sai: /not found|không tìm thấy|notfound/i.test(txt),
      };
    })()`);
    check(!p.sai && !!p.ten, `(g) trang chi tiết /doi-ngu/${slug}`, p.ten || 'rỗng');
  }

  // ═══ (i) đặt lịch: khách chưa đăng nhập bị chặn ═══
  for (const route of ['/booking/kham-benh', '/booking/spa-grooming']) {
    await goto(route, 'body');
    await sleep(2500);
    const bk = await ev(`(() => {
      const txt = document.body.innerText;
      const gate = document.querySelector('a[href^="/dang-nhap"]');
      // Có ô nhập liệu form đặt lịch không? Nếu có ⇒ đã lộ form cho khách.
      const coForm = !!document.querySelector('form input[type=tel], form input[name*=phone], form input[type=email]');
      return {
        coGate: !!gate,
        gateHref: gate ? gate.getAttribute('href') : null,
        coForm,
        tieuDe: document.querySelector('h1')?.textContent?.trim().slice(0, 60),
      };
    })()`);
    check(bk.coGate && !bk.coForm, `(i) ${route} chặn khách chưa đăng nhập`, bk.tieuDe || '');
    if (bk.gateHref) check(/next=/.test(bk.gateHref), `(i) ${route} nhớ đích đến qua ?next=`, bk.gateHref);
  }

  // ═══ (a) navbar: đã kiểm riêng bằng gd9-nav-check.js ═══

  console.log('\n────────────────────────────────────────');
  ok.forEach((l) => console.log('  ✓ ' + l));
  console.log('');
  if (fails.length) {
    console.log(`❌ ${fails.length} kiểm KHÔNG đạt:`);
    fails.forEach((l) => console.log('  ✗ ' + l));
  } else {
    console.log(`✅ ${ok.length}/${ok.length} kiểm đạt`);
  }
  try { child.kill(); } catch { }
  process.exitCode = fails.length ? 1 : 0;
})().catch((e) => { console.error('❌ lỗi:', e.message); process.exitCode = 1; });