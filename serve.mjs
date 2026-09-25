// serve.mjs — Frontend estático de X-SHOP en http://127.0.0.1:3000 (Node puro, sin dependencias)
// Uso: node serve.mjs   |   El backend corre aparte en http://127.0.0.1:3001 (npm run dev en ./backend)
//
// Seguridad: sirve todas las respuestas con CSP + anti-clickjacking +
// Permissions-Policy. Los hashes de los <script> inline de index.html se
// calculan AL ARRANCAR desde el propio archivo — si editas ese bloque,
// reinicia serve.mjs para recalcularlos (tools/api-e2e.js verifica la
// coherencia hash↔CSP servida y truena si hay deriva).
import http from 'node:http';
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const ROOT_PREFIX = ROOT.endsWith(sep) ? ROOT : ROOT + sep;
const PORT = Number(process.env.PORT || 3200);
const HOST = process.env.HOST || '127.0.0.1';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8'
};

// ── Cabeceras de seguridad ─────────────────────────────────────────────
// Extrae los <script> inline (sin atributo src) y calcula su SHA-256 en
// base64: script-src permite ejecutar SOLO ese script de arranque conocido,
// sin 'unsafe-inline' (mitiga XSS que inyecte <script> en el HTML).
function hashesScriptsInline(html) {
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  const hashes = [];
  let m;
  while ((m = re.exec(html)) !== null) {
    hashes.push(createHash('sha256').update(m[1], 'utf8').digest('base64'));
  }
  return hashes;
}

let hashesArranque = [];
try {
  hashesArranque = hashesScriptsInline(await readFile(join(ROOT, 'index.html'), 'utf8'));
} catch {
  // Si index.html no se pudo leer, la CSP quedará sin hashes y el navegador
  // bloqueará el inline: preferible fallar visiblemente a servir sin CSP
  console.warn('⚠ No se pudo leer index.html para calcular los hashes CSP');
}

const CSP = [
  "default-src 'self'",
  `script-src 'self' ${hashesArranque.map(h => `'sha256-${h}'`).join(' ')}`,
  // style-src con unsafe-inline: index.html usa atributos style="" (delays
  // de animación). El riesgo real (inyección de JS) lo cubre script-src.
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://picsum.photos https://commondatastorage.googleapis.com",
  "media-src 'self' blob: https://commondatastorage.googleapis.com",
  "connect-src 'self' http://127.0.0.1:3001 http://localhost:3001",
  "font-src 'self' data:",
  "worker-src 'self' blob:",
  "frame-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'" // anti-clickjacking real (una meta-tag NO lo soporta)
].join('; ');

const SEGURIDAD = {
  'Content-Security-Policy': CSP,
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN', // legado, refuerza frame-ancestors en IE/viejos
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin'
  // Sin HSTS: desarrollo en http; en producción lo aporta el proxy TLS.
  // Sin COEP: rompería las imágenes/vídeos cross-origin (picsum/gstatic).
};

function aplicarSeguridad(res) {
  for (const [k, v] of Object.entries(SEGURIDAD)) res.setHeader(k, v);
}

// ── Allowlist de archivos públicos (F1) ────────────────────────────────
// El frontend solo publica sus directorios de assets y estos archivos
// raíz. Todo lo demás (.env, backend/, tools/, node_modules/, package.json,
// extensiones no contempladas) se DENIEGA — fail-closed: ante la duda,
// no se sirve. Así un servidor con HOST=0.0.0.0 jamás filtra secretos
// ni la base de datos de credenciales.
const DIRS_PERMITIDOS = new Set(['styles', 'src', 'icons', 'assets', 'fonts', 'media']);
const RAIZ_PERMITIDA = new Set(['/index.html', '/manifest.json', '/sw.js', '/og-image.png', '/robots.txt', '/favicon.ico']);

const server = http.createServer(async (req, res) => {
  // Cabeceras de seguridad en TODA respuesta, incluidos 403/404
  aplicarSeguridad(res);
  try {
    const url = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname.endsWith('/')) pathname += 'index.html';

    const filePath = normalize(join(ROOT, pathname));
    if (!filePath.startsWith(ROOT_PREFIX) && filePath !== normalize(ROOT)) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('403 Forbidden');
      return;
    }

    const segmentos = pathname.split('/');
    const oculto = segmentos.some(s => s.startsWith('.') && s !== '' && s !== '.');
    const extension = extname(pathname).toLowerCase();

    // Puerta 1 (fail-closed): archivos ocultos (.env…), árbol del backend
    // o extensión fuera del mapa MIME → 403 sin llegar a tocar el disco
    if (oculto || /^\/backend(\/|$)/i.test(pathname) || (extension && !MIME[extension])) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('403 Forbidden');
      return;
    }

    let target;
    if (!extension) {
      // Ruta sin extensión → SPA fallback (hash router) sirve index.html
      target = join(ROOT, 'index.html');
    } else {
      // Puerta 2: solo directorios públicos del frontend o raíz conocida
      const dirPermitido = DIRS_PERMITIDOS.has(segmentos[1] || '');
      if (!dirPermitido && !RAIZ_PERMITIDA.has(pathname)) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('403 Forbidden');
        return;
      }
      target = filePath;
      try {
        const info = await stat(target);
        if (info.isDirectory()) target = join(target, 'index.html');
      } catch {
        // Inexistente: el readFile de abajo responde 404
      }
    }

    const data = await readFile(target);
    // El manifiesto PWA debe servirse como application/manifest+json (no
    // application/json): algunos navegadores lo exigen para instalar la app
    const type = target.endsWith('manifest.json')
      ? MIME['.webmanifest']
      : (MIME[extname(target).toLowerCase()] || 'application/octet-stream');
    res.writeHead(200, {
      'Content-Type': type,
      'Cache-Control': 'no-cache'
      // X-Content-Type-Options ya la fija aplicarSeguridad()
    });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found');
  }
});

server.listen(PORT, HOST, () => {
  console.log(`🟢 X-SHOP frontend → http://${HOST}:${PORT}`);
  console.log(`   Backend API esperado en http://127.0.0.1:3001 (cd backend && npm run dev)`);
  console.log(`   🔒 CSP con ${hashesArranque.length} hash(s) de script inline`);
});
