// src/animations/transitions.js — Wrapper de la View Transitions API
const prefersReduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export async function viewTransition(fn, fallbackFn) {
  if (!document.startViewTransition || prefersReduced()) {
    return fallbackFn ? fallbackFn() : fn();
  }
  const transition = document.startViewTransition(fn);
  try {
    await transition.finished;
  } catch (e) {
    // Transición cancelada o fallida
  }
  return transition;
}

export function setupViewTransitions() {
  if (!document.startViewTransition || prefersReduced()) return;

  // Estilos para las View Transitions SAME-DOCUMENT del router (hash SPA).
  // IMPORTANTE: NO se usa `@view-transition { navigation: auto }` (cross-document).
  // Si el nuevo documento arranca su router VT mientras la cross-document aún corre,
  // Chromium la salta y ese rechazo NO es atrapable por JS de página (el doc viejo
  // ya se destruyó) → "AbortError: Transition was skipped" en consola, que solo
  // aparece en carreras de recarga y no podía acotarse con listeners. Con hash
  // routing las navegaciones reales son same-document: la cross-document solo
  // añadía ruido en recargas y se eliminó para garantizar consola 100% limpia.
  const style = document.createElement('style');
  style.textContent = `
    ::view-transition-old(root),
    ::view-transition-new(root) {
      animation-duration: 300ms;
      animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    }
    ::view-transition-old(root) { animation-name: fade-out, slide-out; }
    ::view-transition-new(root) { animation-name: fade-in, slide-in; }
    @keyframes fade-out { to { opacity: 0; } }
    @keyframes fade-in { from { opacity: 0; } }
    @keyframes slide-out { to { transform: translateX(-30px); } }
    @keyframes slide-in { from { transform: translateX(30px); } }
  `;
  document.head.appendChild(style);
}

export function skipTransition(fn) {
  const original = document.startViewTransition;
  document.startViewTransition = undefined;
  try { return fn(); } finally { document.startViewTransition = original; }
}

export function morphElements(fromEl, toEl, transition) {
  if (!transition || prefersReduced()) return;
  const fromRect = fromEl.getBoundingClientRect();
  const toRect = toEl.getBoundingClientRect();
  const dx = fromRect.left - toRect.left;
  const dy = fromRect.top - toRect.top;
  const sx = fromRect.width / toRect.width;
  const sy = fromRect.height / toRect.height;

  fromEl.style.viewTransitionName = 'morph-from';
  toEl.style.viewTransitionName = 'morph-to';

  const style = document.createElement('style');
  style.textContent = `
    ::view-transition-group(morph-from),
    ::view-transition-group(morph-to) {
      animation-duration: 400ms;
      animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    }
    ::view-transition-old(morph-from) {
      transform: translate(${dx}px, ${dy}px) scale(${sx}, ${sy});
    }
    ::view-transition-new(morph-to) {
      transform: translate(0, 0) scale(1, 1);
    }
  `;
  document.head.appendChild(style);

  // .finally RE-LANZA el rechazo si finished falla ("Transition was skipped"):
  // capturar antes de limpiar para que no quede como unhandled rejection
  transition.finished.catch(() => {}).finally(() => {
    fromEl.style.viewTransitionName = '';
    toEl.style.viewTransitionName = '';
    style.remove();
  });
}