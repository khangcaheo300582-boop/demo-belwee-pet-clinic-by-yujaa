/* Giải mã PNG tối giản — chỉ đủ cho ảnh chụp màn hình từ Chrome.
 *
 * ── VÌ SAO CẦN ───────────────────────────────────────────────────────────────
 * C1 (GĐ3) chưa kết luận được vì mọi thứ tôi đo trước đó chỉ là HÌNH HỌC:
 * bounding box tràn ra ngoài, alpha, gradient — không phải cái mắt thấy.
 * Còn muốn biết "vệt xanh có thật sự hiện ra ngoài thanh không" thì phải đọc
 * PIXEL THẬT sau khi trình duyệt vẽ xong.
 *
 * Chrome DevTools Protocol không có API đọc pixel. Cách duy nhất không cài
 * thêm gói là chụp ảnh rồi tự giải mã: PNG = header + IDAT (zlib) + scanline
 * có bộ lọc. Node có sẵn `zlib`, nên chỉ còn phần bóc pixel.
 *
 * GIỚI HẠN ĐÃ BIẾT (nói thẳng để không tự tin thừa):
 *   • chỉ hỗ trợ bit depth 8, color type 2 (RGB) và 6 (RGBA), không interlace.
 *     `Page.captureScreenshot` của Chrome luôn phát ra đúng dạng này.
 *   • ảnh nhiều khung hình (APNG) không hỗ trợ — không dùng ở đây.
 *
 * Dùng: const png = require('./png'); const img = png.decode(buffer);
 *       img.width, img.height, img.data (RGBA, 4 byte/ký tự)
 */
'use strict';
const zlib = require('zlib');

function decode(buffer) {
  if (buffer.length < 8 || buffer.readUInt32BE(0) !== 0x89504e47) {
    throw new Error('không phải PNG');
  }
  if (buffer.toString('latin1', 12, 16) !== 'IHDR') {
    throw new Error('thiếu IHDR ngay sau PNG signature');
  }

  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  const bitDepth = buffer[24];
  const colorType = buffer[25];
  const interlace = buffer[28];

  if (bitDepth !== 8) throw new Error(`chỉ hỗ trợ bit depth 8, nhận ${bitDepth}`);
  if (interlace !== 0) throw new Error('ảnh interlace không hỗ trợ');
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 0;
  if (!channels) throw new Error(`color type ${colorType} không hỗ trợ`);

  // Gom mọi khối IDAT thành một luồng nén.
  const idat = [];
  let offset = 8;
  while (offset < buffer.length) {
    const len = buffer.readUInt32BE(offset);
    const type = buffer.toString('latin1', offset + 4, offset + 8);
    const dataStart = offset + 8;
    if (type === 'IDAT') idat.push(buffer.subarray(dataStart, dataStart + len));
    if (type === 'IEND') break;
    offset = dataStart + len + 4; // +4: CRC
  }
  if (!idat.length) throw new Error('không có khối IDAT');

  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = channels;              // byte mỗi pixel (8-bit)
  const stride = width * bpp;
  const out = Buffer.alloc(height * stride);

  let pos = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[pos++];
    const line = raw.subarray(pos, pos + stride);
    pos += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;

    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0;         // pixel bên trái
      const b = prev ? prev[x] : 0;                 // pixel ở dòng trên
      const c = prev && x >= bpp ? prev[x - bpp] : 0; // góc trên-trái
      const v = line[x];
      let val;
      switch (filter) {
        case 0: val = v; break;
        case 1: val = v + a; break;
        case 2: val = v + b; break;
        case 3: val = v + ((a + b) >> 1); break;
        case 4: {
          // Paeth
          const p = a + b - c;
          const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
          val = v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
          break;
        }
        default: throw new Error(`bộ lọc PNG không hợp lệ: ${filter}`);
      }
      cur[x] = val & 0xff;
    }
  }

  // Trả về RGBA để mọi nơi dùng cùng một định dạng, kể cả ảnh gốc là RGB.
  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0, j = 0; i < out.length; i += bpp, j += 4) {
    rgba[j] = out[i];
    rgba[j + 1] = out[i + 1];
    rgba[j + 2] = out[i + 2];
    rgba[j + 3] = channels === 4 ? out[i + 3] : 255;
  }

  return { width, height, channels, data: rgba };
}

/** Màu tại (x, y) → { r, g, b, a }. */
function pixelAt(img, x, y) {
  const cx = Math.max(0, Math.min(img.width - 1, Math.round(x)));
  const cy = Math.max(0, Math.min(img.height - 1, Math.round(y)));
  const i = (cy * img.width + cx) * 4;
  return { r: img.data[i], g: img.data[i + 1], b: img.data[i + 2], a: img.data[i + 3] };
}

/**
 * Trung bình nhiều pixel trong hcnh chữ nhật — đo một pixel đơn lẻ dễ bị nhiễu
 * bởi nhiễu ảnh JPEG/PNG và bởi hạt nền đang chạy.
 */
function avgRect(img, x, y, w, h) {
  let r = 0, g = 0, b = 0, n = 0;
  const x0 = Math.max(0, Math.round(x));
  const y0 = Math.max(0, Math.round(y));
  const x1 = Math.min(img.width - 1, Math.round(x + w));
  const y1 = Math.min(img.height - 1, Math.round(y + h));
  for (let yy = y0; yy <= y1; yy++) {
    for (let xx = x0; xx <= x1; xx++) {
      const p = pixelAt(img, xx, yy);
      r += p.r; g += p.g; b += p.b; n++;
    }
  }
  return n ? { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) } : { r: 0, g: 0, b: 0 };
}

/** Độ chênh lệch màu perceptual rút gọn (0–441, trung bình 2 kênh). */
function colorDelta(a, b) {
  const rm = (a.r + b.r) / 2;
  const dr = a.r - b.r, dg = a.g - b.g, db = a.b - b.b;
  return Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db);
}

/** `rgb(r,g,b)` để in ra log cho dễ đọc. */
function fmt(c) {
  return `rgb(${c.r},${c.g},${c.b})`;
}

module.exports = { decode, pixelAt, avgRect, colorDelta, fmt };
