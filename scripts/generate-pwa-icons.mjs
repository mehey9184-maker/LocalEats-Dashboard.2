// Build properly sized square PWA icons from existing approved LocalEats artwork.
// Uses Node built-ins only; source logo and PWA identity stay unchanged.
import { readFileSync, writeFileSync } from 'node:fs';
import { inflateSync, deflateSync } from 'node:zlib';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const paeth = (a, b, c) => {
  const p = a + b - c;
  const da = Math.abs(p - a), db = Math.abs(p - b), dc = Math.abs(p - c);
  return da <= db && da <= dc ? a : db <= dc ? b : c;
};

function decodeRgbPng(png) {
  if (!png.subarray(0, 8).equals(signature)) throw new Error('PWA logo must be PNG');
  let width = 0, height = 0, depth = 0, type = 0, interlace = 0;
  const data = [];
  for (let offset = 8; offset + 12 <= png.length;) {
    const length = png.readUInt32BE(offset);
    const kind = png.toString('ascii', offset + 4, offset + 8);
    const start = offset + 8, end = start + length;
    if (end + 4 > png.length) throw new Error('Malformed PNG chunk');
    if (kind === 'IHDR') {
      width = png.readUInt32BE(start); height = png.readUInt32BE(start + 4);
      depth = png[start + 8]; type = png[start + 9]; interlace = png[start + 12];
    } else if (kind === 'IDAT') data.push(png.subarray(start, end));
    offset = end + 4;
    if (kind === 'IEND') break;
  }
  if (!width || !height || depth !== 8 || ![2, 6].includes(type) || interlace !== 0) {
    throw new Error('PWA logo must be non-interlaced 8-bit RGB/RGBA PNG');
  }
  const bytesPerPixel = type === 2 ? 3 : 4, stride = width * bytesPerPixel;
  const compressed = inflateSync(Buffer.concat(data));
  if (compressed.length !== height * (stride + 1)) throw new Error('Malformed PNG pixel data');
  const rgba = Buffer.alloc(width * height * 4);
  let oldRow = Buffer.alloc(stride), offset = 0;
  for (let y = 0; y < height; y++) {
    const filter = compressed[offset++], row = Buffer.alloc(stride);
    if (filter > 4) throw new Error('Unsupported PNG row filter');
    for (let i = 0; i < stride; i++) {
      const left = i >= bytesPerPixel ? row[i - bytesPerPixel] : 0;
      const up = oldRow[i];
      const upLeft = i >= bytesPerPixel ? oldRow[i - bytesPerPixel] : 0;
      let predictor = 0;
      if (filter === 1) predictor = left;
      else if (filter === 2) predictor = up;
      else if (filter === 3) predictor = Math.floor((left + up) / 2);
      else if (filter === 4) predictor = paeth(left, up, upLeft);
      row[i] = (compressed[offset++] + predictor) & 255;
    }
    for (let x = 0; x < width; x++) {
      const src = x * bytesPerPixel, dest = (y * width + x) * 4;
      rgba[dest] = row[src]; rgba[dest + 1] = row[src + 1];
      rgba[dest + 2] = row[src + 2]; rgba[dest + 3] = bytesPerPixel === 4 ? row[src + 3] : 255;
    }
    oldRow = row;
  }
  return { width, height, rgba };
}

const crcTable = Array.from({ length: 256 }, (_, i) => {
  let c = i;
  for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function pngChunk(kind, data) {
  const tag = Buffer.from(kind), chunk = Buffer.alloc(data.length + 12);
  chunk.writeUInt32BE(data.length, 0); tag.copy(chunk, 4); data.copy(chunk, 8);
  let crc = 0xffffffff;
  for (const byte of chunk.subarray(4, data.length + 8)) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  chunk.writeUInt32BE((crc ^ 0xffffffff) >>> 0, data.length + 8);
  return chunk;
}
function encodePng(size, pixels) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  const stride = size * 4, scanlines = Buffer.alloc(size * (stride + 1));
  for (let y = 0; y < size; y++) pixels.copy(scanlines, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  return Buffer.concat([signature, pngChunk('IHDR', ihdr), pngChunk('IDAT', deflateSync(scanlines, { level: 9 })), pngChunk('IEND', Buffer.alloc(0))]);
}
function squareIcon(src, size) {
  const crop = Math.min(src.width, src.height);
  const left = Math.floor((src.width - crop) / 2), top = Math.floor((src.height - crop) / 2);
  const output = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const fx = left + (x + .5) * crop / size - .5;
    const fy = top + (y + .5) * crop / size - .5;
    const x0 = Math.max(0, Math.min(src.width - 1, Math.floor(fx)));
    const y0 = Math.max(0, Math.min(src.height - 1, Math.floor(fy)));
    const x1 = Math.min(src.width - 1, x0 + 1), y1 = Math.min(src.height - 1, y0 + 1);
    const a = Math.max(0, Math.min(1, fx - x0)), b = Math.max(0, Math.min(1, fy - y0));
    const p00 = (y0 * src.width + x0) * 4, p10 = (y0 * src.width + x1) * 4;
    const p01 = (y1 * src.width + x0) * 4, p11 = (y1 * src.width + x1) * 4;
    const dest = (y * size + x) * 4;
    for (let channel = 0; channel < 4; channel++) {
      output[dest + channel] = Math.round(src.rgba[p00 + channel] * (1 - a) * (1 - b)
        + src.rgba[p10 + channel] * a * (1 - b)
        + src.rgba[p01 + channel] * (1 - a) * b
        + src.rgba[p11 + channel] * a * b);
    }
  }
  return encodePng(size, output);
}
const source = decodeRgbPng(readFileSync(join(root, 'public/logo.png')));
for (const size of [192, 512]) writeFileSync(join(root, 'public/pwa-icon-' + size + '.png'), squareIcon(source, size));
