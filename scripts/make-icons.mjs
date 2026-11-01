// Lager app-ikonene (PNG) uten eksterne verktøy: indigo bakgrunn med tre stigende søyler.
// Kjør: node scripts/make-icons.mjs
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const BG = [79, 70, 229];
const FG = [255, 255, 255];
const ACCENT = [251, 191, 36];

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function png(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const S = 4; // kantutjevning
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) {
        const c = pixel((x + (sx + 0.5) / S) / size, (y + (sy + 0.5) / S) / size);
        if (c) { r += c[0]; g += c[1]; b += c[2]; a += 255; }
      }
      const n = S * S, o = y * (size * 4 + 1) + 1 + x * 4;
      const cov = a / 255;
      raw[o] = cov ? r / cov : 0; raw[o + 1] = cov ? g / cov : 0; raw[o + 2] = cov ? b / cov : 0; raw[o + 3] = a / n;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

function inRoundRect(u, v, x0, y0, x1, y1, r) {
  if (u < x0 || u > x1 || v < y0 || v > y1) return false;
  const cx = Math.min(Math.max(u, x0 + r), x1 - r), cy = Math.min(Math.max(v, y0 + r), y1 - r);
  return (u - cx) ** 2 + (v - cy) ** 2 <= r * r;
}

// scale < 1 gir luft rundt motivet (for «maskable»-ikonet).
function design(rounded, scale) {
  return (u, v) => {
    if (rounded && !inRoundRect(u, v, 0, 0, 1, 1, 0.22)) return null;
    const p = (t) => 0.5 + (t - 0.5) / scale;
    const x = p(u), y = p(v);
    const bars = [[0.2, 0.58], [0.42, 0.42], [0.64, 0.24]];
    for (const [bx, top] of bars) if (inRoundRect(x, y, bx, top, bx + 0.16, 0.8, 0.035)) return FG;
    if ((x - 0.8) ** 2 + (y - 0.2) ** 2 <= 0.06 ** 2) return ACCENT;
    return BG;
  };
}

writeFileSync('public/icon-192.png', png(192, design(false, 1)));
writeFileSync('public/icon-512.png', png(512, design(false, 1)));
writeFileSync('public/icon-maskable-512.png', png(512, design(false, 0.75)));
writeFileSync('public/apple-touch-icon.png', png(180, design(false, 0.9)));
writeFileSync(
  'public/favicon.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="22" fill="#4f46e5"/><rect x="20" y="58" width="16" height="22" rx="3.5" fill="#fff"/><rect x="42" y="42" width="16" height="38" rx="3.5" fill="#fff"/><rect x="64" y="24" width="16" height="56" rx="3.5" fill="#fff"/><circle cx="80" cy="20" r="6" fill="#fbbf24"/></svg>\n`,
);
console.log('Ikoner skrevet til public/');
