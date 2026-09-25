#!/usr/bin/env node
// tools/verify-assets.js — Verificación estática de los assets de app nativa:
// manifest JSON válido, iconos con firma PNG real y IHDR == sizes declarado,
// apple-touch-icon coherente, theme_color unificado, screenshots poblados
// y metas nativas presentes. Sale con código 1 si algo falla (listo para CI).
// Uso:  node tools/verify-assets.js
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PNG_SIG = '89504e470d0a1a0a';
const fallos = [];
const ok = [];

// ── 1) manifest.json debe parsear ──
let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
  ok.push('manifest.json: JSON válido');
} catch (e) {
  console.error('✖ manifest.json no parsea:', e.message);
  process.exit(1);
}

// ── 2) Iconos: ruta existe + firma PNG + IHDR == sizes declarado ──
for (const ic of manifest.icons || []) {
  const p = path.join(ROOT, ic.src.replace(/^\//, ''));
  if (!fs.existsSync(p)) { fallos.push(`icono inexistente: ${ic.src}`); continue; }
  const buf = fs.readFileSync(p);
  if (buf.subarray(0, 8).toString('hex') !== PNG_SIG) {
    fallos.push(`no es PNG (firma inválida): ${ic.src}`);
    continue;
  }
  const w = buf.readUInt32BE(16);
  const h = buf.readUInt32BE(20);
  const parts = (ic.sizes || '0x0').split('x');
  const dw = parseInt(parts[0], 10);
  const dh = parseInt(parts[1], 10);
  if (w !== dw || h !== dh) fallos.push(`IHDR ${w}x${h} ≠ declarado ${ic.sizes}: ${ic.src}`);
  else ok.push(`icono ok: ${ic.src} (${w}x${h}, ${buf.length} B, purpose=${ic.purpose})`);
}

// ── 3) apple-touch-icon coherente con index.html ──
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const at = (html.match(/apple-touch-icon" href="([^"]+)"/) || [])[1];
if (!at) {
  fallos.push('falta <link rel="apple-touch-icon">');
} else {
  const p = path.join(ROOT, at.replace(/^\//, ''));
  if (!fs.existsSync(p)) {
    fallos.push(`apple-touch-icon inexistente: ${at}`);
  } else {
    const buf = fs.readFileSync(p);
    if (buf.subarray(0, 8).toString('hex') !== PNG_SIG) fallos.push(`apple-touch-icon no es PNG: ${at}`);
    else ok.push(`apple-touch-icon ok: ${at} (${buf.readUInt32BE(16)}x${buf.readUInt32BE(20)})`);
  }
}

// ── 4) Marca unificada + capturas + rutas de screenshots ──
if (manifest.theme_color !== '#0a0a0a') fallos.push(`theme_color inesperado: ${manifest.theme_color}`);
else ok.push('theme_color unificado: #0a0a0a (== color de fondo del app)');
if (!Array.isArray(manifest.screenshots) || manifest.screenshots.length === 0) {
  fallos.push('screenshots vacío');
} else {
  ok.push(`screenshots poblados: ${manifest.screenshots.length}`);
  for (const s of manifest.screenshots) {
    const p = path.join(ROOT, s.src.replace(/^\//, ''));
    if (!fs.existsSync(p)) fallos.push(`screenshot inexistente: ${s.src}`);
  }
}

// ── 5) Metas nativas en el <head> ──
const metas = ['apple-mobile-web-app-capable', 'mobile-web-app-capable', 'format-detection', 'theme-color'];
const faltan = metas.filter(m => !new RegExp('name="' + m + '"').test(html));
if (faltan.length) faltan.forEach(m => fallos.push(`falta meta: ${m}`));
else ok.push(`metas nativas presentes: ${metas.length}/${metas.length}`);

// ── Resultado ──
for (const l of ok) console.log('✔', l);
for (const l of fallos) console.error('✖', l);
console.log(fallos.length ? `\nFALLOS: ${fallos.length}` : '\nTODO VERDE — assets de app nativa consistentes');
process.exit(fallos.length ? 1 : 0);
