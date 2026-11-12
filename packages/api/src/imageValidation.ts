// Structural end-to-end JPEG / PNG / WebP container validation shared between
// admin MCP uploads (recipes.set_image) and community kitchen-test report photos.
export const MAX_IMAGE_BASE64 = 4_200_000; // ~3.1 MB decoded
export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const MAX_IMAGE_DIM = 4096;
const MAX_IMAGE_PIXELS = 16_777_216; // bounds any decoder to ~64 MB RGBA

export type ImageInfo = { mime: string; ext: string; width: number; height: number };

export function decodeBase64(b64: string): Uint8Array | null {
  const clean = b64.replace(/\s+/g, '');
  if (clean.length === 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(clean) || clean.length % 4 !== 0) return null;
  try {
    const bin = atob(clean);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

function dimsOk(width: number, height: number): boolean {
  return (
    Number.isInteger(width) &&
    Number.isInteger(height) &&
    width > 0 &&
    height > 0 &&
    width <= MAX_IMAGE_DIM &&
    height <= MAX_IMAGE_DIM &&
    width * height <= MAX_IMAGE_PIXELS
  );
}

// PNG CRC-32 (ISO-HDLC), table-driven.
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? (0xedb88320 ^ (c >>> 1)) >>> 0 : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(b: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = (CRC_TABLE[(c ^ b[i]!) & 0xff]! ^ (c >>> 8)) >>> 0;
  return (c ^ 0xffffffff) >>> 0;
}

// Inflate a zlib stream fully, answering null on any stream error or the
// moment the decoded size passes cap - a bomb never gets to expand fully.
async function inflateMax(deflated: Uint8Array, cap: number): Promise<Uint8Array | null> {
  try {
    const ds = new DecompressionStream('deflate');
    const stream = new Blob([deflated as BlobPart]).stream().pipeThrough(ds);
    const reader = stream.getReader();
    const parts: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const v = value as Uint8Array;
      total += v.byteLength;
      if (total > cap) {
        await reader.cancel('decompressed size cap exceeded');
        return null;
      }
      parts.push(v);
    }
    const out = new Uint8Array(total);
    let off = 0;
    for (const p of parts) {
      out.set(p, off);
      off += p.length;
    }
    return out;
  } catch {
    return null;
  }
}

const ADAM7: readonly (readonly [number, number, number, number])[] = [
  [0, 0, 8, 8],
  [4, 0, 8, 8],
  [0, 4, 4, 8],
  [2, 0, 4, 4],
  [0, 2, 2, 4],
  [1, 0, 2, 2],
  [0, 1, 1, 2],
];

function pngExpectedScanlineBytes(width: number, height: number, bppBits: number, interlace: number): number {
  let total = 0;
  const pass = (pw: number, ph: number) => {
    total += ph * (1 + Math.ceil((pw * bppBits) / 8));
  };
  if (interlace === 0) {
    pass(width, height);
  } else {
    for (const [x0, y0, dx, dy] of ADAM7) {
      const pw = width > x0 ? Math.ceil((width - x0) / dx) : 0;
      const ph = height > y0 ? Math.ceil((height - y0) / dy) : 0;
      if (pw > 0 && ph > 0) pass(pw, ph);
    }
  }
  return total;
}

function pngScanlinesOk(raw: Uint8Array, width: number, height: number, bppBits: number, interlace: number): boolean {
  const rows: [number, number][] = [];
  if (interlace === 0) {
    rows.push([width, height]);
  } else {
    for (const [x0, y0, dx, dy] of ADAM7) {
      const pw = width > x0 ? Math.ceil((width - x0) / dx) : 0;
      const ph = height > y0 ? Math.ceil((height - y0) / dy) : 0;
      if (pw > 0 && ph > 0) rows.push([pw, ph]);
    }
  }
  let off = 0;
  for (const [pw, ph] of rows) {
    const rowBytes = Math.ceil((pw * bppBits) / 8);
    for (let r = 0; r < ph; r++) {
      if (off + 1 + rowBytes > raw.length) return false;
      if (raw[off]! > 4) return false;
      off += 1 + rowBytes;
    }
  }
  return off === raw.length;
}

function validateJpeg(b: Uint8Array): ImageInfo | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  let i = 2;
  let info: ImageInfo | null = null;
  let markers = 0;
  while (i < b.length) {
    if (++markers > 10000) return null;
    if (b[i] !== 0xff) return null;
    while (i < b.length && b[i] === 0xff) i++;
    if (i >= b.length) return null;
    const marker = b[i]!;
    i++;
    if (marker === 0x00) return null;
    if (marker === 0xd9) return i === b.length ? info : null;
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (i + 2 > b.length) return null;
    const len = (b[i]! << 8) | b[i + 1]!;
    if (len < 2 || i + len > b.length) return null;
    if (marker === 0xda) {
      i += len;
      for (;;) {
        if (i >= b.length) return null;
        if (b[i] !== 0xff) {
          i++;
          continue;
        }
        let j = i + 1;
        while (j < b.length && b[j] === 0xff) j++;
        if (j >= b.length) return null;
        const m = b[j]!;
        if (m === 0x00 || (m >= 0xd0 && m <= 0xd7)) {
          i = j + 1;
          continue;
        }
        i = j - 1;
        break;
      }
      continue;
    }
    const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) {
      if (info) return null;
      if (len < 8) return null;
      const height = (b[i + 3]! << 8) | b[i + 4]!;
      const width = (b[i + 5]! << 8) | b[i + 6]!;
      if (!dimsOk(width, height)) return null;
      info = { mime: 'image/jpeg', ext: 'jpg', width, height };
    }
    i += len;
  }
  return null;
}

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const PNG_CHANNELS: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
const PNG_DEPTHS: Record<number, number[]> = { 0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16] };

async function validatePng(b: Uint8Array): Promise<ImageInfo | null> {
  if (b.length < 8 || !PNG_SIG.every((v, k) => b[k] === v)) return null;
  let pos = 8;
  let info: ImageInfo | null = null;
  let idatCap = 0;
  let bppBits = 0;
  let interlace = 0;
  let sawIdat = false;
  const idatParts: Uint8Array[] = [];
  let chunks = 0;
  for (;;) {
    if (++chunks > 10000) return null;
    if (pos + 12 > b.length) return null;
    const len = ((b[pos]! << 24) | (b[pos + 1]! << 16) | (b[pos + 2]! << 8) | b[pos + 3]!) >>> 0;
    if (len > b.length - pos - 12) return null;
    const type = String.fromCharCode(b[pos + 4]!, b[pos + 5]!, b[pos + 6]!, b[pos + 7]!);
    if (!/^[A-Za-z]{4}$/.test(type)) return null;
    const crc = ((b[pos + 8 + len]! << 24) | (b[pos + 9 + len]! << 16) | (b[pos + 10 + len]! << 8) | b[pos + 11 + len]!) >>> 0;
    if (crc32(b.subarray(pos + 4, pos + 8 + len)) !== crc) return null;
    if (type === 'IHDR') {
      if (info !== null || pos !== 8 || len !== 13) return null;
      const width = ((b[pos + 8]! << 24) | (b[pos + 9]! << 16) | (b[pos + 10]! << 8) | b[pos + 11]!) >>> 0;
      const height = ((b[pos + 12]! << 24) | (b[pos + 13]! << 16) | (b[pos + 14]! << 8) | b[pos + 15]!) >>> 0;
      const depth = b[pos + 16]!;
      const color = b[pos + 17]!;
      if (b[pos + 18]! !== 0 || b[pos + 19]! !== 0 || b[pos + 20]! > 1) return null;
      const channels = PNG_CHANNELS[color];
      const depths = PNG_DEPTHS[color];
      if (!channels || !depths?.includes(depth)) return null;
      if (!dimsOk(width, height)) return null;
      bppBits = channels * depth;
      interlace = b[pos + 20]!;
      idatCap = pngExpectedScanlineBytes(width, height, bppBits, interlace);
      info = { mime: 'image/png', ext: 'png', width, height };
    } else if (type === 'IDAT') {
      if (!info) return null;
      sawIdat = true;
      idatParts.push(b.subarray(pos + 8, pos + 8 + len));
    } else if (type === 'IEND') {
      if (!info || !sawIdat || len !== 0) return null;
      if (pos + 12 !== b.length) return null;
      let total = 0;
      for (const p of idatParts) total += p.length;
      const idat = new Uint8Array(total);
      let off = 0;
      for (const p of idatParts) {
        idat.set(p, off);
        off += p.length;
      }
      const raw = await inflateMax(idat, idatCap);
      return raw !== null && pngScanlinesOk(raw, info.width, info.height, bppBits, interlace) ? info : null;
    }
    pos += 12 + len;
  }
}

function validateWebp(b: Uint8Array): ImageInfo | null {
  if (b.length < 20 || b[0] !== 0x52 || b[1] !== 0x49 || b[2] !== 0x46 || b[3] !== 0x46) return null;
  const riffLen = (b[4]! | (b[5]! << 8) | (b[6]! << 16) | (b[7]! << 24)) >>> 0;
  if (riffLen !== b.length - 8) return null;
  if (b[8] !== 0x57 || b[9] !== 0x45 || b[10] !== 0x42 || b[11] !== 0x50) return null;
  let pos = 12;
  let info: ImageInfo | null = null;
  let chunks = 0;
  while (pos < b.length) {
    if (++chunks > 1000) return null;
    if (pos + 8 > b.length) return null;
    const fourcc = String.fromCharCode(b[pos]!, b[pos + 1]!, b[pos + 2]!, b[pos + 3]!);
    const size = (b[pos + 4]! | (b[pos + 5]! << 8) | (b[pos + 6]! << 16) | (b[pos + 7]! << 24)) >>> 0;
    if (pos + 8 + size > b.length) return null;
    const d = pos + 8;
    if (fourcc === 'VP8 ') {
      if (info || size < 10) return null;
      if (b[d + 3] !== 0x9d || b[d + 4] !== 0x01 || b[d + 5] !== 0x2a) return null;
      const width = (b[d + 6]! | (b[d + 7]! << 8)) & 0x3fff;
      const height = (b[d + 8]! | (b[d + 9]! << 8)) & 0x3fff;
      if (!dimsOk(width, height)) return null;
      info = { mime: 'image/webp', ext: 'webp', width, height };
    } else if (fourcc === 'VP8L') {
      if (info || size < 5 || b[d] !== 0x2f) return null;
      const bits = (b[d + 1]! | (b[d + 2]! << 8) | (b[d + 3]! << 16) | (b[d + 4]! << 24)) >>> 0;
      const width = (bits & 0x3fff) + 1;
      const height = ((bits >>> 14) & 0x3fff) + 1;
      if (!dimsOk(width, height)) return null;
      info = { mime: 'image/webp', ext: 'webp', width, height };
    } else if (fourcc === 'VP8X') {
      if (info || size < 10) return null;
      const width = (b[d + 4]! | (b[d + 5]! << 8) | (b[d + 6]! << 16)) + 1;
      const height = (b[d + 7]! | (b[d + 8]! << 8) | (b[d + 9]! << 16)) + 1;
      if (!dimsOk(width, height)) return null;
      info = { mime: 'image/webp', ext: 'webp', width, height };
    } else if (fourcc === 'ANIM' || fourcc === 'ANMF') {
      return null;
    }
    pos = d + size + (size % 2);
  }
  return info;
}

export async function validateImage(b: Uint8Array): Promise<ImageInfo | null> {
  if (b.length > 2 && b[0] === 0xff && b[1] === 0xd8) return validateJpeg(b);
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50) return validatePng(b);
  if (b.length > 12 && b[0] === 0x52 && b[1] === 0x49) return validateWebp(b);
  return null;
}
