/**
 * Kiểm chứng bản đồ Leaflet thật trên trang Liên hệ.
 *
 * Cố tình kiểm tra ở MỨC DOM, không chỉ "trang trả 200": bản đồ trước đây là
 * SVG tự vẽ và cũng trả 200, nên kiểm tra HTTP không phân biệt được. Cách kiểm
 * đúng là xem Leaflet có thực sự tạo tile, có marker, và bản đồ có chiều cao
 * khác 0 (Leaflet vẽ vào div cao 0px thì ra một mảng trắng).
 *
 * Lưu ý khi chạy trong môi trường KHÔNG có mạng ra ngoài (ví dụ sandbox):
 * tile không tải được là đúng, và đó là lý do cần kiểm tra thêm hộp thoại
 * dự phòng. Ở máy có mạng, `loadedTiles > 0`.
 */
import { chromium } from "playwright-core";

const BASE = process.env.BASE_URL ?? `http://localhost:${process.env.PORT ?? 3001}`;

async function main() {
  await fetch(`${BASE}/lien-he`).catch(() => null);

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`${BASE}/lien-he`, { waitUntil: "domcontentloaded", timeout: 60000 });

  await page.waitForSelector(".leaflet-container", { timeout: 45000 }).catch(() => null);
  // Chờ đủ lâu cho cả tải tile lẫn nhánh dự phòng theo thời gian (8s).
  await page.waitForTimeout(12000);

  const result = await page.evaluate(() => {
    const el = document.querySelector(".leaflet-container") as HTMLElement | null;
    const rect = el?.getBoundingClientRect();
    return {
      hasLeafletContainer: !!el,
      height: rect ? Math.round(rect.height) : 0,
      width: rect ? Math.round(rect.width) : 0,
      tiles: document.querySelectorAll(".leaflet-tile").length,
      loadedTiles: document.querySelectorAll(".leaflet-tile-loaded").length,
      markers: document.querySelectorAll(".leaflet-marker-icon").length,
      attribution: !!document.querySelector(".leaflet-control-attribution"),
      zoomControl: !!document.querySelector(".leaflet-control-zoom"),
      // Hộp thoại dự phòng: phải xuất hiện khi KHÔNG tải được ô nào.
      fallbackShown: document.body.innerText.includes("Không tải được ảnh bản đồ"),
      // Địa chỉ + đường chỉ phải luôn dùng được, kể cả khi bản đồ hỏng.
      addressShown: document.body.innerText.includes("ĐỊA CHỈ") || document.body.innerText.includes("Lê Đức Thọ"),
    };
  });

  await browser.close();

  console.log("\n=== KIEM CHUNG BAN DO LIEN HE ===\n");
  console.log(JSON.stringify(result, null, 2));

  const offline = result.loadedTiles === 0;

  const checks: [string, boolean, string][] = [
    ["Leaflet da khoi tao", result.hasLeafletContainer, "khong thay .leaflet-container"],
    ["Ban do co chieu cao > 0", result.height > 200, `chieu cao = ${result.height}px`],
    ["Co marker cho 4 chi nhanh", result.markers >= 4, `so marker = ${result.markers} (can >= 4)`],
    ["Co attribution OSM", result.attribution, "thieu attribution"],
    ["Co nut zoom", result.zoomControl, "thieu zoom control"],
    [
      offline ? "Offline: hien hop thoai du phong" : "Online: co tile da tai",
      offline ? result.fallbackShown : result.loadedTiles > 0,
      offline ? "tile khong tai duoc nhung khong bao loi" : `so tile = ${result.loadedTiles}`,
    ],
    ["Dia chi chi nhanh van dung duoc", result.addressShown, "thieu dia chi khi ban do hong"],
  ];

  let failures = 0;
  for (const [name, ok, detail] of checks) {
    if (ok) console.log(`  PASS  ${name}`);
    else {
      failures += 1;
      console.log(`  FAIL  ${name} — ${detail}`);
    }
  }

  console.log(
    `\n${offline ? "[che do offline]" : ""} ${failures === 0 ? "TAT CA PASS" : `${failures} KIEM TRA FAIL`}`
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});