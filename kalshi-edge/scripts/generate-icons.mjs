// Generates placeholder PNG icons (solid Kalshi-green squares) so the repo
// doesn't carry binary assets. Run automatically before dev/build.
// Replace public/icons/*.png with real branded artwork before publishing.
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
mkdirSync(outDir, { recursive: true });

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1));
  }
  return ~c >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}
function png(size, [r,g,b]) {
  const sig = Buffer.from([137,80,78,71,13,10,26,10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size,0); ihdr.writeUInt32BE(size,4);
  ihdr[8]=8; ihdr[9]=2; // 8-bit, truecolor RGB
  // raw image: each row prefixed by filter byte 0
  const row = Buffer.alloc(1 + size*3);
  for (let x=0;x<size;x++){ row[1+x*3]=r; row[1+x*3+1]=g; row[1+x*3+2]=b; }
  const raw = Buffer.concat(Array.from({length:size},()=>row));
  const idat = deflateSync(raw);
  return Buffer.concat([sig, chunk('IHDR',ihdr), chunk('IDAT',idat), chunk('IEND',Buffer.alloc(0))]);
}
const green = [34, 197, 94];
for (const s of [16, 48, 128]) {
  writeFileSync(join(outDir, `icon${s}.png`), png(s, green));
}
console.log('icons written to', outDir);
