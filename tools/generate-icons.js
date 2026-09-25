#!/usr/bin/env node
// tools/generate-icons.js — Genera los PNG de iconos de la PWA/SO sin
// dependencias externas (solo módulos nativos: fs + zlib), para que la
// instalación en Android (manifest) e iOS (apple-touch-icon) tenga iconos
// reales: Chrome rechaza los data-URI en manifests y iOS ignora los SVG.
// Uso:  node tools/generate-icons.js
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT_DIR = path.join(__dirname, '..', 'icons');
const TEAL = [0, 212, 170]; // #00d4aa — color de marca
const INK = [10, 10, 10];   // #0a0a0a — tinta de la X

// ── CRC32 estándar para los chunks del PNG ──
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

// Distancia punto↔segmento (capuchones redondos para la X)
function distSeg(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

// Dibuja un lienzo RGBA: fondo teal + X de dos trazos diagonales.
// cornerRadius > 0 → esquinas redondeadas con antialias (transparencia).
function render(size, cornerRadius) {
  const px = Buffer.alloc(size * size * 4);
  const m = size * 0.30;    // margen interior de la X
  const th = size * 0.115;  // grosor del trazo
  const r = cornerRadius;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let a = 255;
      if (r > 0) {
        // Punto más cercano al rectángulo interior (zona de esquina)
        const nx = Math.max(r - 0.5, Math.min(size - r - 0.5, x));
        const ny = Math.max(r - 0.5, Math.min(size - r - 0.5, y));
        const d = Math.hypot(x - nx, y - ny);
        if (d > r + 0.5) continue; // fuera del icono → alpha 0
        if (d > r - 0.5) a = Math.round(255 * Math.max(0, Math.min(1, r + 0.5 - d)));
      }
      const onX =
        distSeg(x, y, m, m, size - m, size - m) <= th ||
        distSeg(x, y, size - m, m, m, size - m) <= th;
      const col = onX ? INK : TEAL;
      const i = (y * size + x) * 4;
      px[i] = col[0]; px[i + 1] = col[1]; px[i + 2] = col[2]; px[i + 3] = a;
    }
  }
  return px;
}

// Codifica RGBA → PNG (8 bit, RGBA, filtro 0, deflate nivel 9)
function encodePNG(size, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);   // ancho
  ihdr.writeUInt32BE(size, 4);   // alto
  ihdr[8] = 8;                   // bit depth
  ihdr[9] = 6;                   // color type RGBA
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0; // filtro None
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// ── Salidas: 180 (iOS), 192 (lanzador, esquinas redondeadas),
//    512 (maskable: a sangre completa, el SO recorta) ──
const TARGETS = [
  { file: 'icon-180.png', size: 180, radius: 40 },  // apple-touch-icon
  { file: 'icon-192.png', size: 192, radius: 42 },  // manifest "any"
  { file: 'icon-512.png', size: 512, radius: 0 },   // manifest "maskable"
];

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const t of TARGETS) {
  const png = encodePNG(t.size, render(t.size, t.radius));
  const out = path.join(OUT_DIR, t.file);
  fs.writeFileSync(out, png);
  console.log(`✔ ${t.file} — ${t.size}x${t.size}, ${png.length} bytes`);
}
console.log('Iconos generados en:', OUT_DIR);
