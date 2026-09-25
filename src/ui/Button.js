// src/ui/Button.js — Botón WAAPI con ripple, press y estado loading
import { ripple, press } from '../animations/waapi.js';

// Nota de arquitectura: <x-button> es un custom element AUTÓNOMO
// (extends HTMLElement). Un built-in personalizado (<button is="x-button">)
// NO puede usar attachShadow — la spec lanza NotSupportedError porque
// <button> no está en la lista de hosts válidos — así que el host debe ser
// un elemento con guion para alojar el shadow DOM del componente.
export class Button extends HTMLElement {
  static get observedAttributes() { return ['loading', 'disabled', 'variant', 'size']; }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._loading = false;
    this._bound = false;
  }

  connectedCallback() {
    this.render();
    // Guard anti-doble-bind: connectedCallback puede volver a ejecutarse
    // si el nodo se mueve en el DOM
    if (!this._bound) {
      this._bound = true;
      this.bindEvents();
    }
  }

  attributeChangedCallback() { this.render(); }

  /* ------- API compatible con <button> (autonomous no la hereda) ------- */

  get loading() { return this._loading; }
  set loading(v) {
    this._loading = !!v;
    // setAttribute('loading', null) escribiría el literal "null" y dejaría
    // el atributo presente (el botón quedaba "cargando" para siempre):
    // hay que remover el atributo cuando el valor es falso
    if (this._loading) this.setAttribute('loading', '');
    else this.removeAttribute('loading');
    this.render();
  }

  get disabled() { return this.hasAttribute('disabled'); }
  set disabled(v) {
    if (v) this.setAttribute('disabled', '');
    else this.removeAttribute('disabled');
  }

  get variant() { return this.getAttribute('variant') || 'primary'; }
  set variant(v) { this.setAttribute('variant', v); }

  get size() { return this.getAttribute('size') || 'md'; }
  set size(v) { this.setAttribute('size', v); }

  // Paridad con HTMLButtonElement: por defecto "submit" (igual que el nativo)
  get type() { return (this.getAttribute('type') || 'submit').toLowerCase(); }
  set type(v) { this.setAttribute('type', v); }

  // Paridad con HTMLButtonElement: dueño del formulario contenedor
  get form() { return this.closest('form'); }

  bindEvents() {
    this.addEventListener('click', (e) => {
      if (this.loading || this.disabled) {
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }
      ripple(this, e);
      // <x-button> no es un <button> nativo: nunca dispara el envío
      // implícito de formularios. Si actúa como submit dentro de un form,
      // forzamos el envío aquí (el <button> interno del shadow es
      // type="button" y sin form owner, así que no lo intercepta nunca).
      if (this.type === 'submit' && this.form) {
        e.preventDefault();
        this.form.requestSubmit();
      }
    });
    this.addEventListener('mousedown', () => press(this, true));
    this.addEventListener('mouseup', () => press(this, false));
    this.addEventListener('mouseleave', () => press(this, false));
    this.addEventListener('touchstart', () => press(this, true), { passive: true });
    this.addEventListener('touchend', () => press(this, false));
  }

  render() {
    // Defensa: nunca renderizar sin shadow (p. ej. constructor abortado)
    if (!this.shadowRoot) return;
    const { variant, size, loading, disabled } = this;
    const variants = {
      primary: { background: 'var(--color-primary)', color: 'var(--color-bg)', borderColor: 'var(--color-primary)' },
      ghost: { background: 'transparent', color: 'var(--color-primary)', borderColor: 'var(--color-primary)' },
      secondary: { background: 'var(--color-surface-elevated)', color: 'var(--color-text)', borderColor: 'var(--color-border)' },
      danger: { background: 'var(--color-danger)', color: '#fff', borderColor: 'var(--color-danger)' }
    };
    const sizes = {
      sm: { padding: 'var(--spacing-xs) var(--spacing-md)', fontSize: 'var(--text-sm)' },
      md: { padding: 'var(--spacing-sm) var(--spacing-lg)', fontSize: 'var(--text-base)' },
      lg: { padding: 'var(--spacing-md) var(--spacing-xl)', fontSize: 'var(--text-lg)' },
      xl: { padding: 'var(--spacing-lg) var(--spacing-2xl)', fontSize: 'var(--text-xl)', borderRadius: 'var(--radius-lg)' }
    };
    const v = variants[variant] || variants.primary;
    const s = sizes[size] || sizes.md;

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: inline-flex; align-items: center; justify-content: center; gap: var(--spacing-sm); font-weight: var(--font-semibold); border-radius: ${s.borderRadius || 'var(--radius-md)'}; cursor: pointer; touch-action: manipulation; white-space: nowrap; position: relative; overflow: hidden; font-family: inherit; border: 2px solid ${v.borderColor}; background: ${v.background}; color: ${v.color}; padding: ${s.padding}; font-size: ${s.fontSize}; transition: background var(--transition-fast), border-color var(--transition-fast), transform var(--transition-fast); }
        :host([disabled]), :host([loading]) { opacity: 0.5; cursor: not-allowed; pointer-events: none; }
        :host(:not([disabled]):not([loading]):active) { transform: scale(0.98); }
        :host(:focus-visible) { outline: 2px solid var(--color-primary); outline-offset: 2px; }
        .btn-content { display: flex; align-items: center; justify-content: center; gap: var(--spacing-sm); width: 100%; background: none; border: none; color: inherit; font: inherit; cursor: inherit; padding: 0; }
        .spinner { width: 1em; height: 1em; border: 2px solid transparent; border-top-color: currentColor; border-radius: 50%; animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      </style>
      <button class="btn-content" type="button" part="button" ${disabled || loading ? 'disabled' : ''} aria-busy="${loading}">
        ${loading ? '<span class="spinner" aria-hidden="true"></span>' : ''}
        <slot></slot>
      </button>
    `;
  }
}

// Guard anti-doble-define (recarga en caliente / evaluación duplicada)
if (!customElements.get('x-button')) {
  customElements.define('x-button', Button);
}

export function createButton(props = {}) {
  const btn = document.createElement('x-button');
  Object.entries(props).forEach(([k, v]) => {
    if (k === 'onClick') btn.addEventListener('click', v);
    else if (k === 'children') btn.textContent = v;
    else btn.setAttribute(k, v);
  });
  return btn;
}
