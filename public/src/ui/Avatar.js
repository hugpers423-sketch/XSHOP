// src/ui/Avatar.js — Iniciales de respaldo, color por hash, imagen lazy
const COLOR_CACHE = new Map();

// Texto blanco o negro con MEJOR contraste WCAG 2.1 sobre un fondo
// hsl(hue, 65%, l): los tonos claros (amarillos/teal) exigen texto oscuro
// y los oscuros (azul/morado/rojo) texto blanco — var(--color-bg) fijo
// fallaba en ~la mitad de los tonos del disco cromático
export function hslTextColor(hue, l = 45) {
  const s = 0.65, lp = l / 100;
  const c = (1 - Math.abs(2 * lp - 1)) * s;
  const hp = (((hue % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r1 = 0, g1 = 0, b1 = 0;
  if (hp < 1) { r1 = c; g1 = x; }
  else if (hp < 2) { r1 = x; g1 = c; }
  else if (hp < 3) { g1 = c; b1 = x; }
  else if (hp < 4) { g1 = x; b1 = c; }
  else if (hp < 5) { r1 = x; b1 = c; }
  else { r1 = c; b1 = x; }
  const m = lp - c / 2;
  const lin = v => { v += m; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const L = 0.2126 * lin(r1) + 0.7152 * lin(g1) + 0.0722 * lin(b1);
  const contrasteBlanco = 1.05 / (L + 0.05);   // #ffffff
  const contrasteNegro = (L + 0.05) / 0.05561;  // #111111 (L ≈ 0.00561)
  return contrasteBlanco >= contrasteNegro ? '#ffffff' : '#111111';
}

function hashColor(str) {
  if (COLOR_CACHE.has(str)) return COLOR_CACHE.get(str);
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  const entry = { color: `hsl(${hue}, 65%, 45%)`, hue };
  COLOR_CACHE.set(str, entry);
  return entry;
}

function getInitials(name) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

export class Avatar extends HTMLElement {
  static get observedAttributes() { return ['src', 'alt', 'name', 'size', 'verified']; }

  constructor() { super(); this.attachShadow({ mode: 'open' }); }
  connectedCallback() { this.render(); }
  attributeChangedCallback() { this.render(); }

  get src() { return this.getAttribute('src'); }
  get alt() { return this.getAttribute('alt') || ''; }
  get name() { return this.getAttribute('name') || 'Usuario'; }
  get size() { return this.getAttribute('size') || 'md'; }
  get verified() { return this.hasAttribute('verified'); }

  render() {
    const sizes = { xs: '24px', sm: '32px', md: '40px', lg: '56px', xl: '80px', xxl: '120px' };
    const fonts = { xs: '0.625rem', sm: '0.75rem', md: '0.875rem', lg: '1.125rem', xl: '1.5rem', xxl: '2rem' };
    const size = sizes[this.size] || sizes.md;
    const fontSize = fonts[this.size] || fonts.md;
    const tint = this.src ? null : hashColor(this.name);
    const color = tint ? tint.color : null;
    // Texto según luminancia del color de fondo (contraste WCAG)
    const textColor = tint ? hslTextColor(tint.hue) : 'var(--color-bg)';
    const initials = this.src ? null : getInitials(this.name);

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: inline-flex; align-items: center; justify-content: center; width: ${size}; height: ${size}; border-radius: var(--radius-full); overflow: hidden; background: ${color || 'var(--color-primary)'}; color: ${textColor}; font-weight: var(--font-bold); font-size: ${fontSize}; position: relative; flex-shrink: 0; }
        img { width: 100%; height: 100%; object-fit: cover; display: ${this.src ? 'block' : 'none'}; }
        .initials { display: ${this.src ? 'none' : 'flex'}; align-items: center; justify-content: center; width: 100%; height: 100%; }
        .verified-badge { position: absolute; bottom: 0; right: 0; width: calc(${size} * 0.3); height: calc(${size} * 0.3); min-width: 14px; min-height: 14px; background: var(--color-primary); border: 2px solid var(--color-bg); border-radius: 50%; display: ${this.verified ? 'flex' : 'none'}; align-items: center; justify-content: center; color: var(--color-bg); font-size: calc(${fontSize} * 0.7); }
        .verified-badge svg { width: 100%; height: 100%; }
      </style>
      ${this.src ? `<img src="${this.src}" alt="${this.alt || this.name}" loading="lazy">` : ''}
      <span class="initials">${initials || ''}</span>
      ${this.verified ? `<span class="verified-badge" aria-label="Verificado"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg></span>` : ''}
    `;
  }
}

customElements.define('x-avatar', Avatar);

export function createAvatar(props = {}) {
  const avatar = document.createElement('x-avatar');
  Object.entries(props).forEach(([k, v]) => {
    if (k === 'verified') avatar.setAttribute(k, '');
    else avatar.setAttribute(k, v);
  });
  return avatar;
}