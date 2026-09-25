// src/ui/Badge.js — Variantes, tamaños, indicador dot
export class Badge extends HTMLElement {
  static get observedAttributes() { return ['variant', 'size', 'dot', 'pill']; }

  constructor() { super(); this.attachShadow({ mode: 'open' }); }
  connectedCallback() { this.render(); }
  attributeChangedCallback() { this.render(); }

  get variant() { return this.getAttribute('variant') || 'neutral'; }
  get size() { return this.getAttribute('size') || 'md'; }
  get dot() { return this.hasAttribute('dot'); }
  get pill() { return this.hasAttribute('pill'); }

  render() {
    const variants = {
      success: { background: 'var(--color-primary-dim)', color: 'var(--color-primary)', border: 'none' },
      danger: { background: 'rgba(255,71,87,0.15)', color: 'var(--color-danger)', border: 'none' },
      warning: { background: 'rgba(255,165,2,0.15)', color: 'var(--color-warning)', border: 'none' },
      info: { background: 'rgba(55,66,250,0.15)', color: 'var(--color-info)', border: 'none' },
      neutral: { background: 'var(--color-surface-elevated)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' },
      primary: { background: 'var(--color-primary)', color: 'var(--color-bg)', border: 'none' },
      outline: { background: 'transparent', color: 'var(--color-primary)', border: '1px solid var(--color-primary)' }
    };
    const sizes = {
      xs: { padding: '1px var(--spacing-xs)', fontSize: 'var(--text-xs)' },
      sm: { padding: '2px var(--spacing-sm)', fontSize: 'var(--text-xs)' },
      md: { padding: '2px var(--spacing-md)', fontSize: 'var(--text-sm)' },
      lg: { padding: 'var(--spacing-xs) var(--spacing-lg)', fontSize: 'var(--text-base)' }
    };
    const v = variants[this.variant] || variants.neutral;
    const s = sizes[this.size] || sizes.md;

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: inline-flex; align-items: center; gap: var(--spacing-xs); font-weight: var(--font-semibold); border-radius: ${this.pill ? 'var(--radius-full)' : 'var(--radius-sm)'}; white-space: nowrap; background: ${v.background}; color: ${v.color}; border: ${v.border}; padding: ${s.padding}; font-size: ${s.fontSize}; }
        .dot-indicator { width: 6px; height: 6px; border-radius: 50%; background: currentColor; flex-shrink: 0; }
        slot { display: inline; }
      </style>
      ${this.dot ? '<span class="dot-indicator" aria-hidden="true"></span>' : ''}
      <slot></slot>
    `;
  }
}

customElements.define('x-badge', Badge);

export function createBadge(text, variant = 'neutral', props = {}) {
  const badge = document.createElement('x-badge');
  badge.textContent = text;
  badge.setAttribute('variant', variant);
  Object.entries(props).forEach(([k, v]) => badge.setAttribute(k, v));
  return badge;
}