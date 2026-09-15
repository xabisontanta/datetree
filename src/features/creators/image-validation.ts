/** Only bounded, non-interlaced RGB/RGBA PNG pixels and safe colour chunks are accepted. */
export function validatePng(bytes: Uint8Array) {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (bytes.length > 5242880 || !signature.every((v, i) => bytes[i] === v))
    throw new Error('Invalid PNG.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let pos = 8;
  let width = 0;
  let height = 0;
  let channels = 0;
  let data = false;
  let ended = false;
  const compressed: Uint8Array[] = [];
  while (pos + 12 <= bytes.length) {
    const size = view.getUint32(pos);
    const end = pos + 12 + size;
    if (end > bytes.length) throw new Error('Truncated PNG.');
    const type = String.fromCharCode(...bytes.subarray(pos + 4, pos + 8));
    if (
      (type === 'sRGB' && size !== 1) ||
      (type === 'gAMA' && size !== 4) ||
      (type === 'cHRM' && size !== 32)
    )
      throw new Error('Invalid colour metadata.');
    if (!['IHDR', 'IDAT', 'IEND', 'sRGB', 'gAMA', 'cHRM'].includes(type))
      throw new Error('Re-upload this image to remove unsupported metadata.');
    let crc = 0xffffffff;
    for (let i = pos + 4; i < end - 4; i++) {
      crc ^= bytes[i]!;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    if ((crc ^ 0xffffffff) >>> 0 !== view.getUint32(end - 4))
      throw new Error('Damaged PNG.');
    if (type === 'IHDR') {
      if (pos !== 8 || size !== 13) throw new Error('Invalid image header.');
      width = view.getUint32(pos + 8);
      height = view.getUint32(pos + 12);
      channels = bytes[pos + 17] === 6 ? 4 : bytes[pos + 17] === 2 ? 3 : 0;
      if (
        !width ||
        !height ||
        width > 2048 ||
        height > 2048 ||
        !channels ||
        bytes[pos + 16] !== 8 ||
        bytes[pos + 18] !== 0 ||
        bytes[pos + 19] !== 0 ||
        bytes[pos + 20] !== 0
      )
        throw new Error('Unsupported image dimensions or encoding.');
    } else if (!width) throw new Error('Missing image header.');
    if (type === 'IDAT') {
      data = true;
      compressed.push(bytes.slice(pos + 8, end - 4));
    }
    if (type === 'IEND') {
      if (size !== 0 || end !== bytes.length) throw new Error('Invalid image end.');
      ended = true;
    }
    pos = end;
  }
  if (!data || !ended) throw new Error('Incomplete image.');
  return { width, height, channels, compressed };
}
export async function validateImagePixels(bytes: Uint8Array) {
  const image = validatePng(bytes);
  const compressed = new Uint8Array(
    image.compressed.reduce((n, part) => n + part.length, 0),
  );
  let offset = 0;
  for (const part of image.compressed) {
    compressed.set(part, offset);
    offset += part.length;
  }
  const reader = new Blob([compressed])
    .stream()
    .pipeThrough(new DecompressionStream('deflate'))
    .getReader();
  const rowLength = image.width * image.channels + 1;
  const expected = rowLength * image.height;
  let read = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (read + value.length > expected)
        throw new Error('Image expands beyond its dimensions.');
      for (let i = 0; i < value.length; i++)
        if ((read + i) % rowLength === 0 && value[i]! > 4)
          throw new Error('Invalid image pixels.');
      read += value.length;
    }
    if (read !== expected) throw new Error('Incomplete image pixels.');
  } finally {
    await reader.cancel();
  }
}
