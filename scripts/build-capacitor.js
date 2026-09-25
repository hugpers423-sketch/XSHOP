const fs = require('fs');
const path = require('path');

const ROOT_DIR = __dirname;
const SRC_DIR = path.join(ROOT_DIR, '..');
const WWW_DIR = path.join(SRC_DIR, 'public');

// Limpiar public/
if (fs.existsSync(WWW_DIR)) {
  fs.rmSync(WWW_DIR, { recursive: true, force: true });
}
fs.mkdirSync(WWW_DIR, { recursive: true });

// Copiar directorios de assets
const dirs = ['src', 'styles', 'icons', 'tools'];
dirs.forEach(dir => {
  const src = path.join(SRC_DIR, dir);
  const dest = path.join(WWW_DIR, dir);
  if (fs.existsSync(src)) {
    fs.cpSync(src, dest, { recursive: true });
  }
});

// Copiar archivos raíz
const rootFiles = ['manifest.json', 'sw.js', 'robots.txt', 'og-image.png'];
rootFiles.forEach(file => {
  const src = path.join(SRC_DIR, file);
  const dest = path.join(WWW_DIR, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
  }
});

// Copiar index.html raíz (diseño original idéntico)
const rootHtml = path.join(SRC_DIR, 'index.html');
const destHtml = path.join(WWW_DIR, 'index.html');
if (fs.existsSync(rootHtml)) {
  fs.copyFileSync(rootHtml, destHtml);
  console.log('📄 index.html raíz copiado a public/');
}

// Crear src/compat.js para theme + SW
const compatJs = `(function() {
  try { var t = localStorage.getItem('theme') || 'dark'; document.documentElement.dataset.theme = t; } catch(e) {}
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('/sw.js').catch(function() {});
  }
})();
`;
const compatDest = path.join(WWW_DIR, 'src', 'compat.js');
fs.writeFileSync(compatDest, compatJs, 'utf8');
console.log('📄 src/compat.js creado');

console.log('✅ Build Capacitor completado: public/ listo');
console.log('   - webDir: public');
console.log('   - index.html: copiado desde raíz (diseño original)');
console.log('   - src/compat.js: Theme + SW compatibility');
