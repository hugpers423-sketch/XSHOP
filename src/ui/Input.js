// src/ui/Input.js — Label flotante, validación, iconos
export class Input extends HTMLElement {
  static get observedAttributes() { return ['label', 'type', 'placeholder', 'error', 'disabled', 'required', 'value', 'floating']; }

  constructor() { super(); this.attachShadow({ mode: 'open' }); this._value = ''; }
  connectedCallback() { this.render(); this.bindEvents(); }
  attributeChangedCallback() { this.render(); }

  get value() { return this._value; }
  set value(v) { this._value = v; this.render(); }
  get label() { return this.getAttribute('label') || ''; }
  get type() { return this.getAttribute('type') || 'text'; }
  get placeholder() { return this.getAttribute('placeholder') || ''; }
  get error() { return this.getAttribute('error') || null; }
  get floating() { return this.hasAttribute('floating'); }

  bindEvents() {
    const input = this.shadowRoot.querySelector('input');
    input?.addEventListener('input', (e) => { this._value = e.target.value; this.dispatchEvent(new CustomEvent('change', { detail: { value: this._value } })); });
    input?.addEventListener('blur', () => this.dispatchEvent(new CustomEvent('blur', { detail: { value: this._value } })));
    input?.addEventListener('focus', () => this.dispatchEvent(new CustomEvent('focus')));
  }

  validate() {
    if (this.required && !this._value) { this.setAttribute('error', 'Campo requerido'); return false; }
    if (this.type === 'email' && this._value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this._value)) { this.setAttribute('error', 'Email inválido'); return false; }
    this.removeAttribute('error');
    return true;
  }

  render() {
    const hasValue = !!this._value;
    const floatingActive = this.floating && (hasValue || this.shadowRoot?.querySelector('input')?.matches(':focus'));
    const errorMsg = this.error;

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; width: 100%; }
        .input-wrapper { position: relative; }
        label { display: block; font-size: var(--text-sm); font-weight: var(--font-medium); color: var(--color-text-muted); margin-bottom: var(--spacing-xs); transition: all var(--transition-fast); }
        .floating-label { position: absolute; top: 50%; left: var(--spacing-md); transform: translateY(-50%); pointer-events: none; color: var(--color-text-subtle); font-size: var(--text-base); transition: all var(--transition-fast); z-index: 1; }
        input { width: 100%; padding: var(--spacing-sm) var(--spacing-md); font-size: var(--text-base); background: var(--color-surface); border: 2px solid var(--color-border); border-radius: var(--radius-md); color: var(--color-text); transition: border-color var(--transition-fast), box-shadow var(--transition-fast); }
        input::placeholder { color: var(--color-text-subtle); opacity: 0; transition: opacity var(--transition-fast); }
        .floating input { padding-top: var(--spacing-lg); padding-bottom: var(--spacing-xs); }
        .floating input::placeholder { opacity: 1; }
        .floating .floating-label { top: var(--spacing-xs); font-size: var(--text-xs); color: var(--color-primary); transform: translateY(0); }
        input:hover { border-color: var(--color-border-light); }
        input:focus { outline: none; border-color: var(--color-primary); box-shadow: 0 0 0 3px var(--color-primary-dim); }
        input[aria-invalid="true"] { border-color: var(--color-danger); }
        input[aria-invalid="true"]:focus { box-shadow: 0 0 0 3px rgba(255,71,87,0.15); }
        .error-msg { display: none; font-size: var(--text-xs); color: var(--color-danger); margin-top: var(--spacing-xs); }
        input[aria-invalid="true"] + .error-msg { display: block; }
        .input-icon { position: absolute; right: var(--spacing-md); top: 50%; transform: translateY(-50%); color: var(--color-text-subtle); width: 20px; height: 20px; pointer-events: none; }
      </style>
      <div class="input-wrapper ${this.floating ? 'floating' : ''}">
        ${this.label && !this.floating ? `<label>${this.label}</label>` : ''}
        ${this.floating ? `<span class="floating-label" aria-hidden="true">${this.label}</span>` : ''}
        <input type="${this.type}" placeholder="${this.placeholder}" value="${this._value}" ${this.disabled ? 'disabled' : ''} ${this.required ? 'required' : ''} aria-invalid="${!!errorMsg}" aria-describedby="${errorMsg ? 'error-' + this.id : ''}">
        ${errorMsg ? `<span class="error-msg" id="error-${this.id}" role="alert">${errorMsg}</span>` : ''}
      </div>
    `;
  }
}

customElements.define('x-input', Input);

export function createInput(props = {}) {
  const input = document.createElement('x-input');
  Object.entries(props).forEach(([k, v]) => {
    if (k === 'onChange') input.addEventListener('change', v);
    else if (k === 'onBlur') input.addEventListener('blur', v);
    else input.setAttribute(k, v);
  });
  return input;
}