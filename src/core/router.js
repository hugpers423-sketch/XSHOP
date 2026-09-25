// src/core/router.js — Router por hash + View Transitions API
import { store } from './state.js';

const routes = new Map();
let currentRoute = null;
let transitioning = false;
// Navegación encolada durante una transición activa (coalescer "última gana")
let pendingNav = null;

function normalizePath(path) {
  return path.startsWith('/') ? path : '/' + path;
}

function parseHash() {
  const hash = location.hash.slice(1);
  const [path, search] = hash.split('?');
  const searchParams = new URLSearchParams(search);
  const params = {};
  searchParams.forEach((value, key) => { params[key] = value; });
  return { path: normalizePath(path || '/'), params };
}

function matchRoute(path) {
  const normalizedPath = normalizePath(path);
  for (const [pattern, handler] of routes) {
    const regexPattern = pattern instanceof RegExp ? pattern.source : pattern;
    const regex = new RegExp(`^${regexPattern.replace(/:[^/]+/g, '([^/]+)')}$`);
    const match = normalizedPath.match(regex);
    if (match) {
      const keys = (regexPattern.match(/:([^/]+)/g) || []).map(k => k.slice(1));
      const params = {};
      keys.forEach((key, i) => { params[key] = match[i + 1]; });
      return { handler, params };
    }
  }
  return null;
}

async function navigate(to, options = {}) {
  if (transitioning) {
    // Coalescer "última gana": en lugar de descartar la petición (p. ej. clics
    // rápidos mientras una View Transition lenta aún no asienta), la encolamos
    // y se ejecuta al liberarse el candado — ningún clic se pierde.
    pendingNav = { to, options };
    return true;
  }
  const { path, params } = typeof to === 'string' ? parseHashFromString(to) : to;
  const matched = matchRoute(path);
  if (!matched) {
    console.warn('[Router] No route matched for:', path);
    return false;
  }

  transitioning = true;
  const { handler, params: routeParams } = matched;
  const mergedParams = { ...params, ...routeParams };

  const supportsVT = document.startViewTransition && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const doTransition = async () => {
    currentRoute = { path, params: mergedParams };
    store.set('router.current', currentRoute);
    await handler(mergedParams);
    updateActiveTab(path);
    // Sincronizar la URL con la ruta activa vía replaceState:
    // no dispara hashchange y así no se re-entra en navigate() (evita bucle)
    const targetHash = typeof to === 'string' && to.startsWith('#')
      ? to
      : `#${path === '/' ? '' : path.replace(/^\//, '')}${(() => {
          const s = new URLSearchParams(mergedParams).toString();
          return s ? `?${s}` : '';
        })()}`;
    // Si el hash está vacío (carga inicial) lo dejamos limpio en la URL
    if (location.hash && location.hash !== targetHash) history.replaceState(null, '', targetHash);
  };

  try {
    if (supportsVT && !options.skipTransition) {
      let transition = null;
      try {
        transition = document.startViewTransition(() => doTransition());
      } catch {
        // Safari/Chrome lanzan InvalidStateError si ya hay otra transición en curso:
        // en ese caso ejecutamos la navegación sin animación
        await doTransition();
      }
      if (transition) {
        // Observar las TRES promesas del ciclo de vida: ningún rechazo debe
        // quedar como "unhandled rejection" si el navegador aborta la transición
        transition.ready?.catch(() => {});
        transition.updateCallbackDone?.catch(() => {});
        // Carrilera de seguridad: en páginas sin foco el rAF está reducido y
        // finished puede tardar (o no asentar); a los 2 s liberamos igualmente
        await Promise.race([
          transition.finished.catch(() => {}),
          new Promise(resolve => { setTimeout(resolve, 2000); })
        ]);
      }
    } else {
      await doTransition();
    }
    return true;
  } catch (err) {
    console.error('[Router] Navegación fallida:', err);
    return false;
  } finally {
    // Liberar SIEMPRE el candado y ejecutar la navegación encolada (si la hay)
    transitioning = false;
    if (pendingNav) {
      const next = pendingNav;
      pendingNav = null;
      navigate(next.to, next.options).catch(() => {});
    }
  }
}

function parseHashFromString(hash) {
  const clean = hash.startsWith('#') ? hash.slice(1) : hash;
  const [path, search] = clean.split('?');
  const searchParams = new URLSearchParams(search);
  // Convertir URLSearchParams a objeto plano para acceso fácil
  const params = {};
  searchParams.forEach((value, key) => { params[key] = value; });
  return { path: normalizePath(path || '/'), params };
}

function updateActiveTab(path) {
  const normalized = normalizePath(path);
  // En rutas /app el estado de pestañas lo gestiona showApp() — no interferir
  if (normalized === '/app' || normalized.startsWith('/app/')) return;
  // En el resto de rutas (landing, etc.), desactivar todas las pestañas
  document.querySelectorAll('.tab').forEach(t => {
    t.classList.remove('tab--active');
    t.setAttribute('aria-selected', 'false');
  });
  document.querySelectorAll('.app-panel').forEach(p => {
    p.classList.remove('app-panel--active');
  });
}

export const router = {
  add(pattern, handler) { routes.set(pattern, handler); return this; },
  navigate(to, opts) { return navigate(to, opts); },
  getCurrent() { return currentRoute; },
  onHashChange() { navigate(location.hash); }
};

window.addEventListener('hashchange', router.onHashChange);
window.addEventListener('load', () => router.navigate(location.hash || '/landing'));

export function link(href, text, className = '') {
  const a = document.createElement('a');
  a.href = href;
  a.textContent = text;
  if (className) a.className = className;
  a.addEventListener('click', (e) => {
    if (href.startsWith('#')) {
      e.preventDefault();
      router.navigate(href);
    }
  });
  return a;
}