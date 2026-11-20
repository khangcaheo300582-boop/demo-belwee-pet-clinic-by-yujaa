/**
 * lib/liquidGlassNav.ts
 *
 * Khúc xạ "liquid glass" THẬT cho thanh điều hướng cuộn — chỉ chạy trên
 * Chromium và chỉ sau khi khối SVG filter đã dựng xong.
 *
 * CƠ CHẾ
 * ------
 * `backdrop-filter: url(#lg-nav)` gọi một <filter> chứa feImage (bản đồ
 * chuyển vị displacement map) → feDisplacementMap. Map được sinh RUNTIME bằng
 * canvas theo kích thước + bo góc THẬT của thanh, mô phỏng mép kính lồi:
 * chỉ vùng bezel (--lg-bezel px từ mép vào) bị bẻ, phần giữa gần như trung tính.
 *
 * VÌ SAO KHÔNG DÙNG MIX/GRADIENT GIẢ
 * Blur / gradient / box-shadow không làm méo được nội dung phía sau — chỉ có
 * displacement map mới dịch chuyển được từng pixel nền, tạo đường kẻ cong ở
 * vùng bezel.
 *
 * HỢP ĐỖNG VỚI CSS
 *  - CSS mặc định (mọi trình duyệt): blur() + saturate() + brightness(),
 *    TUYỆT ĐỐI không có url().
 *  - Chỉ khi <html class="lg-refract"> VÀ trạng thái đã cuộn:
 *    backdrop-filter = blur(var(--lg-blur)) url(#lg-nav) saturate(var(--lg-sat))…
 *  - Class `lg-refract` được gắn ở ĐÂY khi là Chromium và map đầu tiên đã
 *    sinh xong; gỡ khi unmount. Không dùng @supports (Safari/Firefox nhận
 *    url() rồi vẽ ra khoảng trắng).
 *  - JS đọc --lg-bezel / --lg-disp / --lg-k từ computed style của nav.
 *
 * GIỚI HẠN
 *  - Vùng filter + feImage = thanh + đệm trung tính 48px mỗi phía (không bị
 *    hở cạnh khi đang transition width).
 *  - Tính lại khi: khởi tạo, resize, đổi class/data-state của nav,
 *    transitionend (debounce ~80ms). Không tính lại nếu tham số không đổi.
 *  - Tạo map < 10ms; không thêm thư viện ngoài.
 */

const NS = "http://www.w3.org/2000/svg";
const ID = "lg-nav";
const SVG_DEFS_ID = "lg-defs";
const PAD = 48;
const IS_CHROMIUM =
  typeof navigator !== "undefined" &&
  // Không dùng \b: UA "HeadlessChrome/…" chứa "Chrome/" nhưng trước nó là "s"
  // (ký tự từ) nên \b không match — coi như không phải Chromium sai.
  // Safari (Version/.. Safari/), Firefox, CriOS, EdgiOS không chứa các token này.
  /(Chrome|Chromium|Edg|OPR)\//.test(navigator.userAgent);

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Dựng displacement map bằng canvas. */
function makeMap(W: number, H: number, radius: number, bezel: number, k: number, n = 1.5): string {
  const r = Math.min(radius, W / 2, H / 2);
  bezel = clamp(bezel, 1, r);
  const S = 256;
  const amp = new Float32Array(S + 1);
  for (let i = 0; i <= S; i++) {
    const u = 1 - Math.max(i / S, 1e-4); // u = 1 - t
    const slope = (k * u ** 3) / (1 - u ** 4) ** 0.75; // độ dốc mặt kính lồi
    const ti = Math.atan(slope); // góc tới
    amp[i] = Math.tan(ti - Math.asin(Math.sin(ti) / n)); // Snell → độ lệch tia
  }
  const peak = Math.max(...amp);
  for (let i = 0; i <= S; i++) amp[i] /= peak; // chuẩn hoá: max = 1

  const CW = W + 2 * PAD;
  const CH = H + 2 * PAD;
  const cv = document.createElement("canvas");
  cv.width = CW;
  cv.height = CH;
  const ctx = cv.getContext("2d");
  if (!ctx) return "";
  const img = ctx.createImageData(CW, CH);
  const px = img.data;
  const hw = W / 2 - r; // nửa kích thước "lõi" không bo
  const hh = H / 2 - r;
  // Tối ưu: chỉ phần tử trong "lõi" (|dx|≤hw ∧ |dy|≤hh) được xử lý nhanh nhất.
  // Góc/viền đi qua toàn bộ pipeline Snell. hypot → sqrt thủ công.
  const bezel_i = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
  for (let y = 0; y < CH; y++) {
    const dy = y - PAD + 0.5 - H / 2;
    for (let x = 0; x < CW; x++) {
      const i = (y * CW + x) * 4;
      const dx = x - PAD + 0.5 - W / 2;
      // Lõi: không dịch chuyển (128, 128)
      if (dx >= -hw && dx <= hw && dy >= -hh && dy <= hh) {
        px[i] = 128;
        px[i + 1] = 128;
        px[i + 2] = 128;
        px[i + 3] = 255;
        continue;
      }
      // véc-tơ hướng VÀO lõi (hướng lấy mẫu từ phía trong ra mép)
      const vx = bezel_i(dx, -hw, hw) - dx;
      const vy = bezel_i(dy, -hh, hh) - dy;
      const len = Math.sqrt(vx * vx + vy * vy);
      const edge = r - len; // khoảng cách tính từ mép bo (px)
      let ox = 0;
      let oy = 0;
      if (len > 0 && edge > 0 && edge < bezel) {
        const a = amp[Math.round((edge / bezel) * S)];
        const inv = a / len;
        ox = vx * inv;
        oy = vy * inv; // lấy mẫu từ phía trong
      }
      px[i] = 128 + ox * 127;
      px[i + 1] = 128 + oy * 127;
      px[i + 2] = 128;
      px[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return cv.toDataURL("image/png");
}

/** Lấy (hoặc tạo) <svg> chứa <filter id="lg-nav">. KHÔNG display:none. */
function getFilter(): SVGFilterElement | null {
  let svg = document.getElementById(SVG_DEFS_ID) as unknown as SVGSVGElement | null;
  if (!svg) {
    svg = document.createElementNS(NS, "svg") as unknown as SVGSVGElement;
    svg.id = SVG_DEFS_ID;
    svg.setAttribute("width", "0");
    svg.setAttribute("height", "0");
    svg.setAttribute("aria-hidden", "true");
    svg.style.cssText = "position:absolute;pointer-events:none";
    svg.innerHTML =
      `<filter id="${ID}" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">` +
      `<feImage result="map" preserveAspectRatio="none"/>` +
      `<feDisplacementMap in="SourceGraphic" in2="map" xChannelSelector="R" yChannelSelector="G"/>` +
      `</filter>`;
    document.body.prepend(svg as unknown as HTMLElement);
  }
  return svg.querySelector("filter");
}

/** Đọc --lg-* từ computed style của nav (đơn vị px; k không có đơn vị). */
function readNum(cs: CSSStyleDeclaration, name: string, fallback: number): number {
  const v = parseFloat(cs.getPropertyValue(name));
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

function refresh(nav: HTMLElement): void {
  const W = Math.ceil(nav.offsetWidth);
  const H = Math.ceil(nav.offsetHeight);
  if (!W || !H) return;
  const cs = getComputedStyle(nav);
  const radiusVar = cs.borderTopLeftRadius;
  const radius = radiusVar.endsWith("%") ? H / 2 : parseFloat(radiusVar) || H / 2;
  const bezel = readNum(cs, "--lg-bezel", 16);
  const disp = readNum(cs, "--lg-disp", 14);
  const k = readNum(cs, "--lg-k", 1);
  const key = [W, H, radius, bezel, disp, k].join("|");
  if ((nav as unknown as { _lgKey?: string })._lgKey === key) return;
  (nav as unknown as { _lgKey?: string })._lgKey = key;

  const filter = getFilter();
  if (!filter) return;
  const feImage = filter.querySelector("feImage");
  const feDisp = filter.querySelector("feDisplacementMap");
  if (!feImage || !feDisp) return;

  const box = { x: String(-PAD), y: String(-PAD), width: String(W + 2 * PAD), height: String(H + 2 * PAD) };
  const setAttrs = (el: Element, attrs: Record<string, string>) => {
    for (const a in attrs) el.setAttribute(a, attrs[a]);
  };
  setAttrs(filter, box);
  setAttrs(feImage, { ...box, href: makeMap(W, H, radius, bezel, k) });
  // Map ±0.5 → scale = 2 × độ lệch tối đa
  feDisp.setAttribute("scale", String(2 * disp));
  document.documentElement.classList.add("lg-refract");
}

/**
 * Gắn refraction vào nav. Chỉ chạy trên Chromium; mọi trình duyệt khác
 * giữ nguyên frosted mặc định trong CSS. Trả về hàm dọn (unmount).
 */
export function initLiquidGlassNav(nav: HTMLElement | null): () => void {
  if (!IS_CHROMIUM || !nav) return () => {};
  let t: number | undefined;
  const run = () => {
    window.clearTimeout(t);
    t = window.setTimeout(() => refresh(nav), 80);
  };
  const ro = new ResizeObserver(run);
  ro.observe(nav);
  const mo = new MutationObserver(run); // đổi attribute kiểu như code đang dùng
  mo.observe(nav, { attributes: true, attributeFilter: ["class", "data-state"] });
  nav.addEventListener("transitionend", run);
  refresh(nav);
  return () => {
    window.clearTimeout(t);
    ro.disconnect();
    mo.disconnect();
    nav.removeEventListener("transitionend", run);
    document.documentElement.classList.remove("lg-refract");
  };
}

export default initLiquidGlassNav;
