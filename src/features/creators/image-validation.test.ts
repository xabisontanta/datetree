import { deflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { validateImagePixels, validatePng } from './image-validation';
function chunk(type: string, data: Uint8Array) {
  const out = new Uint8Array(data.length + 12);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(new TextEncoder().encode(type), 4);
  out.set(data, 8);
  let crc = 0xffffffff;
  for (const byte of out.subarray(4, out.length - 4)) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  view.setUint32(out.length - 4, (crc ^ 0xffffffff) >>> 0);
  return out;
}
function png(extra?: Uint8Array, pixels = new Uint8Array([0, 255, 0, 0, 255])) {
  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, 1);
  view.setUint32(4, 1);
  header[8] = 8;
  header[9] = 6;
  return new Uint8Array(
    Buffer.concat([
      new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk('IHDR', header),
      ...(extra ? [extra] : []),
      chunk('IDAT', deflateSync(pixels)),
      chunk('IEND', new Uint8Array()),
    ]),
  );
}
describe('uploaded image safety', () => {
  it('accepts a valid bounded raster', async () => {
    expect(validatePng(png()).width).toBe(1);
    await expect(validateImagePixels(png())).resolves.toBeUndefined();
  });
  it('rejects SVG, spoofed MIME payloads and corrupted pixels', async () => {
    expect(() =>
      validatePng(new TextEncoder().encode('<svg onload="alert(1)"/>')),
    ).toThrow();
    const bad = png();
    bad[20] = 1;
    expect(() => validatePng(bad)).toThrow();
    await expect(
      validateImagePixels(png(undefined, new Uint8Array([9, 0, 0, 0, 0]))),
    ).rejects.toThrow();
  });
  it('rejects EXIF, comments and appended payloads', () => {
    expect(() => validatePng(png(chunk('eXIf', new Uint8Array([1, 2]))))).toThrow();
    expect(() => validatePng(new Uint8Array([...png(), 1]))).toThrow();
  });
  it('bounds decompression to declared dimensions', async () => {
    await expect(
      validateImagePixels(png(undefined, new Uint8Array(1000))),
    ).rejects.toThrow();
  });
});
