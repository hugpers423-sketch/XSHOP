// src/ui/Skeleton.js — Shimmer basado en transform (sin repaint)
import { shimmer as waapiShimmer } from '../animations/waapi.js';

export class Skeleton extends HTMLElement {
  static get observedAttributes() { return ['variant', 'width', 'height', 'radius']; }

  constructor() { super(); this.attachShadow({ mode: 'open' }); this._shimmer = null; }
  connectedCallback() { this.render(); this.startShimmer(); }
  disconnectedCallback() { this.stopShimmer(); }
  attributeChangedCallback() { this.render(); this.startShimmer(); }

  get variant() { return this.getAttribute('variant') || 'text'; }
  get width() { return this.getAttribute('width') || '100%'; }
  get height() { return this.getAttribute('height') || '1rem'; }
  get radius() { return this.getAttribute('radius') || 'var(--radius-sm)'; }

  startShimmer() { this.stopShimmer(); this._shimmer = waapiShimmer(this.shadowRoot.querySelector('.skeleton')); }
  stopShimmer() { if (this._shimmer) { this._shimmer(); this._shimmer = null; } }

  render() {
    const variants = {
      text: { height: this.height, width: this.width, borderRadius: this.radius },
      title: { height: '1.5rem', width: '60%', borderRadius: this.radius },
      avatar: { width: '40px', height: '40px', borderRadius: 'var(--radius-full)' },
      button: { height: '48px', width: '100%', borderRadius: 'var(--radius-md)' },
      card: { width: '100%', height: '200px', borderRadius: 'var(--radius-lg)' },
      image: { width: '100%', height: '200px', borderRadius: 'var(--radius-md)' },
      circular: { width: '40px', height: '40px', borderRadius: '50%' }
    };
    const v = variants[this.variant] || variants.text;

    this.shadowRoot.innerHTML = `
      <style>
        .skeleton { position: relative; overflow: hidden; background: var(--color-surface-elevated); width: ${v.width}; height: ${v.height}; border-radius: ${v.borderRadius}; }
        .skeleton::after { content: ''; position: absolute; inset: 0; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent); transform: translateX(-100%); }
      </style>
      <div class="skeleton"></div>
    `;
  }
}

customElements.define('x-skeleton', Skeleton);

export function createSkeleton(variant = 'text', props = {}) {
  const sk = document.createElement('x-skeleton');
  sk.setAttribute('variant', variant);
  Object.entries(props).forEach(([k, v]) => sk.setAttribute(k, v));
  return sk;
}

// Layouts de skeleton predefinidos
export const SkeletonLayouts = {
  card: () => {
    const wrap = document.createElement('div');
    wrap.className = 'card skeleton-card';
    wrap.append(
      createSkeleton('image', { style: 'margin-bottom: var(--spacing-md);' }),
      createSkeleton('title', { style: 'margin-bottom: var(--spacing-sm);' }),
      createSkeleton('text', { style: 'margin-bottom: var(--spacing-xs);' }),
      createSkeleton('text', { width: '80%' })
    );
    return wrap;
  },
  post: () => {
    const wrap = document.createElement('article');
    wrap.className = 'post-card card';
    wrap.innerHTML = `
      <div class="post-header">
        <x-skeleton variant="avatar"></x-skeleton>
        <div><x-skeleton variant="text" width="120px"></x-skeleton><x-skeleton variant="text" width="80px" style="margin-top:4px;"></x-skeleton></div>
      </div>
      <x-skeleton variant="text" style="margin-bottom:var(--spacing-md);"></x-skeleton>
      <x-skeleton variant="image"></x-skeleton>
      <div class="post-stats" style="margin-top:var(--spacing-md);">
        <x-skeleton variant="text" width="80px"></x-skeleton>
        <x-skeleton variant="text" width="80px"></x-skeleton>
        <x-skeleton variant="text" width="80px"></x-skeleton>
      </div>
    `;
    return wrap;
  },
  metric: () => {
    const wrap = document.createElement('div');
    wrap.className = 'card';
    wrap.style.textAlign = 'center';
    wrap.append(
      createSkeleton('text', { width: '40px', height: '40px', style: 'margin:0 auto var(--spacing-sm);border-radius:var(--radius-full);' }),
      createSkeleton('title', { width: '100px', style: 'margin-bottom:var(--spacing-xs);' }),
      createSkeleton('text', { width: '80px' })
    );
    return wrap;
  }
};