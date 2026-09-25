// src/ui/Toast.js — Cola, aria-live, tipos, WAAPI
import { animate, slideIn, fadeOut } from '../animations/waapi.js';

const container = document.getElementById('toast-container') || (() => {
  const c = document.createElement('div');
  c.id = 'toast-container';
  c.className = 'toast-container';
  c.setAttribute('aria-live', 'polite');
  c.setAttribute('aria-atomic', 'true');
  document.body.appendChild(c);
  return c;
})();

const queue = [];
let processing = false;

const icons = {
  success: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
  danger: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
  warning: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  info: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
};

const colors = {
  success: 'border-color: var(--color-primary)',
  danger: 'border-color: var(--color-danger)',
  warning: 'border-color: var(--color-warning)',
  info: 'border-color: var(--color-info)'
};

async function showToast(message, type = 'info', duration = 4000) {
  return new Promise(resolve => {
    queue.push({ message, type, duration, resolve });
    processQueue();
  });
}

async function processQueue() {
  if (processing || queue.length === 0) return;
  processing = true;

  while (queue.length > 0) {
    const { message, type, duration, resolve } = queue.shift();
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
      <style>
        .toast { display: flex; align-items: center; gap: var(--spacing-sm); padding: var(--spacing-md) var(--spacing-lg); background: var(--color-surface-elevated); border: 1px solid var(--color-border); border-radius: var(--radius-md); box-shadow: var(--shadow-xl); opacity: 0; transform: translateX(100%); }
        .toast.show { opacity: 1; transform: translateX(0); }
        .toast-icon { flex-shrink: 0; color: var(--color-${type}); }
        .toast-message { flex: 1; font-size: var(--text-sm); }
        .toast-close { flex-shrink: 0; padding: var(--spacing-xs); color: var(--color-text-muted); cursor: pointer; border-radius: var(--radius-sm); }
        .toast-close:hover { background: var(--color-surface); color: var(--color-text); }
      </style>
      <span class="toast-icon">${icons[type]}</span>
      <span class="toast-message">${message}</span>
      <button class="toast-close" aria-label="Cerrar"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
    `;
    toast.style.cssText = colors[type];

    container.appendChild(toast);
    // Forzar reflow
    toast.offsetHeight;
    // Carrilera de seguridad: con la timeline pausada (pestaña oculta)
    // slideIn no asienta — el toast ya está en el DOM; no bloquear la cola
    await Promise.race([
      slideIn(toast, 'right').catch(() => {}),
      new Promise(resolve => { setTimeout(resolve, 350); })
    ]);

    const closePromise = new Promise(r => {
      let done = false;
      const close = () => {
        // Anti doble-clic + carrilera: la animación de salida no puede
        // dejar el toast huérfano ni atascar la cola si rechaza/no asienta
        if (done) return;
        done = true;
        Promise.race([
          animate(toast, { transform: ['translateX(0)', 'translateX(100%)'], opacity: [1, 0] }, { duration: 200 }),
          new Promise(res => { setTimeout(res, 300); })
        ]).catch(() => {}).finally(() => { toast.remove(); r(); });
      };
      toast.querySelector('.toast-close').addEventListener('click', close);
      setTimeout(close, duration);
    });

    await closePromise;
    resolve();
  }

  processing = false;
}

export const toast = {
  success: (msg, d) => showToast(msg, 'success', d),
  danger: (msg, d) => showToast(msg, 'danger', d),
  warning: (msg, d) => showToast(msg, 'warning', d),
  info: (msg, d) => showToast(msg, 'info', d),
  show: showToast
};

export function createToast(message, type = 'info') {
  return showToast(message, type);
}