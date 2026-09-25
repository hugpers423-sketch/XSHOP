// src/ui/Modal.js — Trampa de foco, ESC, portal, WAAPI
import { animate, fadeIn, fadeOut, scaleIn } from '../animations/waapi.js';

export class Modal extends HTMLElement {
  static get observedAttributes() { return ['open', 'title', 'size']; }

  constructor() { super(); this.attachShadow({ mode: 'open' }); this._focusTrap = null; this._lastFocused = null; }
  connectedCallback() { this.render(); }
  attributeChangedCallback(name, old, val) {
    // _internalAttr: los cambios hechos por el propio modal (openModal/
    // closeModal) no deben re-entrar en toggle() → evita close() x2
    if (name === 'open' && old !== val && !this._internalAttr) this.toggle(val !== null);
  }

  // Cambio de atributo silencioso (sin re-entrar por attributeChangedCallback)
  _setOpen(v) {
    this._internalAttr = true;
    try { v ? this.setAttribute('open', '') : this.removeAttribute('open'); }
    finally { this._internalAttr = false; }
  }

  get open() { return this.hasAttribute('open'); }
  get title() { return this.getAttribute('title') || ''; }
  get size() { return this.getAttribute('size') || 'md'; }

  toggle(force) {
    const willOpen = force ?? !this.open;
    if (willOpen) this.openModal(); else this.closeModal();
  }

  async openModal() {
    this._lastFocused = document.activeElement;
    this._setOpen(true);
    this.render();
    document.body.style.overflow = 'hidden';
    // Carrilera de seguridad: si la timeline está pausada (pestaña oculta),
    // las animaciones nunca asientan — el estado no debe quedar bloqueado
    await Promise.race([
      Promise.all([
        fadeIn(this.shadowRoot.querySelector('.overlay')),
        scaleIn(this.shadowRoot.querySelector('.modal'))
      ]).catch(() => {}),
      new Promise(resolve => { setTimeout(resolve, 500); })
    ]);
    this.trapFocus();
  }

  async closeModal() {
    if (this._closing) return; // guard de re-entrancia (ESC + clic simultáneos)
    this._closing = true;
    try {
      // Carrilera de seguridad: el cierre funcional (estado + scroll + foco)
      // no puede depender de que la animación complete — con la timeline
      // pausada (pestaña oculta) .finished queda pendiente para siempre
      await Promise.race([
        Promise.all([
          fadeOut(this.shadowRoot.querySelector('.overlay')),
          animate(this.shadowRoot.querySelector('.modal'), { transform: ['scale(1)', 'scale(0.95)'], opacity: [1, 0] }, { duration: 200 })
        ]).catch(() => {}),
        new Promise(resolve => { setTimeout(resolve, 400); })
      ]);
      this._setOpen(false);
      // Re-render del estado cerrado: restaura :host { display:none } —
      // sin esto el overlay quedaba invisible (opacity 0) pero seguía
      // capturando los clics del puntero sobre TODA la página
      this.render();
      document.body.style.overflow = '';
      this.releaseFocus();
      this._lastFocused?.focus();
      this.dispatchEvent(new CustomEvent('close'));
    } finally {
      this._closing = false;
    }
  }

  trapFocus() {
    const focusable = this.shadowRoot.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    this._focusTrap = (e) => {
      if (e.key !== 'Tab') return;
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', this._focusTrap);
    this.shadowRoot.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.closeModal(); });
    first?.focus();
  }

  releaseFocus() { if (this._focusTrap) document.removeEventListener('keydown', this._focusTrap); }

  render() {
    const sizes = { sm: 'max-w-[360px]', md: 'max-w-[480px]', lg: 'max-w-[640px]', xl: 'max-w-[800px]', full: 'max-w-[90vw]' };
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: ${this.open ? 'flex' : 'none'}; }
        .overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px); z-index: var(--z-modal); display: flex; align-items: center; justify-content: center; padding: var(--spacing-md); opacity: 0; }
        .modal { width: 100%; ${sizes[this.size]}; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-xl); box-shadow: var(--shadow-xl); overflow: hidden; transform: scale(0.95); opacity: 0; }
        .modal-header { display: flex; align-items: center; justify-content: space-between; padding: var(--spacing-lg); border-bottom: 1px solid var(--color-border); }
        .modal-title { font-size: var(--text-xl); font-weight: var(--font-bold); }
        .modal-close { width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; border-radius: var(--radius-md); color: var(--color-text-muted); cursor: pointer; transition: all var(--transition-fast); }
        .modal-close:hover { background: var(--color-surface-elevated); color: var(--color-text); }
        .modal-body { padding: var(--spacing-lg); max-height: 60vh; overflow-y: auto; }
        .modal-footer { display: flex; justify-content: flex-end; gap: var(--spacing-sm); padding: var(--spacing-lg); border-top: 1px solid var(--color-border); }
      </style>
      <div class="overlay">
        <div class="modal">
          <header class="modal-header">
            <h2 class="modal-title">${this.title}</h2>
            <button class="modal-close" aria-label="Cerrar">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </header>
          <div class="modal-body"><slot></slot></div>
          <footer class="modal-footer"><slot name="footer"></slot></footer>
        </div>
      </div>
    `;

    // Vincular eventos (vanilla JS, no Alpine @click)
    const overlay = this.shadowRoot.querySelector('.overlay');
    const modalEl = this.shadowRoot.querySelector('.modal');
    const closeBtn = this.shadowRoot.querySelector('.modal-close');
    overlay.addEventListener('click', () => this.closeModal());
    modalEl.addEventListener('click', (e) => e.stopPropagation());
    closeBtn.addEventListener('click', () => this.closeModal());
  }
}

customElements.define('x-modal', Modal);

export function createModal(props = {}) {
  const modal = document.createElement('x-modal');
  Object.entries(props).forEach(([k, v]) => modal.setAttribute(k, v));
  return modal;
}

export async function openModal(content, options = {}) {
  const modal = createModal({ title: options.title || '', size: options.size || 'md' });
  modal.append(content);
  document.body.appendChild(modal);
  modal.openModal();
  return new Promise(resolve => modal.addEventListener('close', () => { modal.remove(); resolve(); }, { once: true }));
}