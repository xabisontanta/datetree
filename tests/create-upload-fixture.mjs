// Synthetic raster for browser upload QA; contains no personal data or metadata.
// Run: node tests/create-upload-fixture.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
function chunk(type, data) {
  const out = Buffer.alloc(data.length + 12);
  out.writeUInt32BE(data.length);
  out.write(type, 4);
  data.copy(out, 8);
  let crc = 0xffffffff;
  for (const byte of out.subarray(4, -4)) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  out.writeUInt32BE((crc ^ 0xffffffff) >>> 0, out.length - 4);
  return out;
}
const size = 256;
const header = Buffer.alloc(13);
header.writeUInt32BE(size, 0);
header.writeUInt32BE(size, 4);
header[8] = 8;
header[9] = 6;
const pixels = Buffer.alloc(size * (size * 4 + 1));
for (let y = 0; y < size; y++) {
  for (let x = 0; x < size; x++) {
    const i = y * (size * 4 + 1) + 1 + x * 4;
    pixels.set([40 + Math.floor(x / 2), 60 + Math.floor(y / 2), 125, 255], i);
  }
}
mkdirSync('work', { recursive: true });
writeFileSync('work/qa-upload.png', Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', header), chunk('IDAT', deflateSync(pixels)), chunk('IEND', Buffer.alloc(0)),
]));
console.log('Generated work/qa-upload.png (synthetic 256 × 256 PNG).');
