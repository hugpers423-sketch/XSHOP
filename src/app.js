// src/app.js — Bootstrap principal | ~80 líneas
import { store } from './core/state.js';
import { router } from './core/router.js';
import { events, AppEvents } from './core/events.js';
import { api } from './core/api.js';
import { PaymentsModule } from './modules/payments/index.js';
import { FeedModule } from './modules/feed/index.js';
import { ReputationModule } from './modules/reputation/index.js';
import { initScrollAnimations, initParallax } from './animations/scroll.js';
import { counter } from './animations/waapi.js';
import { setupViewTransitions } from './animations/transitions.js';
import { toast } from './ui/Toast.js';
import { initAuthUI } from './ui/AuthModal.js';

// ── Activación CSP-safe (F14): cero handlers inline ────────────────────
// 1) El CSS secundario viene como media="print" (no bloquea el render).
//    El swap print→all se hacía con onload=…, pero la CSP (script-src con
//    hash) prohíbe los handlers inline: aquí queda cubierto por 'self'.
document.querySelectorAll('link[data-media-swap]').forEach((link) => {
  const activar = () => { link.media = 'all'; };
  // Si el stylesheet ya terminó de descargar antes de que corra este
  // módulo (deferred), se activa ya; si no, al evento load del propio link
  if (link.sheet) activar();
  else link.addEventListener('load', activar, { once: true });
});

// 2) Ocultar imágenes rotas. Los eventos 'error' de <img> NO burbujean,
//    por eso se capturan en fase de captura desde window. Sustituye a los
//    onerror="…" inline del feed que la CSP bloqueaba.
window.addEventListener('error', (e) => {
  const el = e.target;
  if (el instanceof HTMLImageElement && el.dataset.hideOnError !== undefined) {
    el.style.visibility = 'hidden';
  }
}, true);

// Instancias de módulos
let paymentsModule = null;
let feedModule = null;
let reputationModule = null;
let modulesInitialized = { payments: false, feed: false, reputation: false };

// Inicializar app
async function initApp() {
  // Configurar animaciones
  initScrollAnimations();
  initParallax();
  setupViewTransitions();
  initLandingCounters();

  // Configurar URL base de la API
  api.setBaseUrl('http://127.0.0.1:3001');

  // Verificar estado de autenticación
  await checkAuth();

  // Registrar rutas
  router
    .add('/landing', () => showPage('landing'))
    .add('/app', (params) => showApp(params.module || 'payments'))
    .add('/app/:module', (params) => showApp(params.module))
    .add('/', () => showPage('landing'));

  // Navegación inicial
  router.navigate(location.hash || '#landing');

  // Inicializar UI de auth (botones login/registro, menú de usuario)
  initAuthUI();

  // Navegación por pestañas del dashboard
  document.querySelectorAll('.tab[data-module]').forEach(tab => {
    tab.addEventListener('click', () => {
      const module = tab.dataset.module;
      router.navigate(`#app?module=${module}`);
    });
  });

  // Listeners globales de eventos
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href^="#"]');
    if (link && !link.dataset.action) {
      e.preventDefault();
      router.navigate(link.getAttribute('href'));
    }
  });

  // Atajos de teclado
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      events.emit(AppEvents.MODAL_CLOSE);
    }
  });

  // Reporte de Web Vitals (solo dev)
  if (import.meta.env?.DEV) reportWebVitals();
}

async function checkAuth() {
  try {
    // Buscar sesión existente
    const token = localStorage.getItem('xshop_token');
    if (token) {
      // Validar con el backend
      const res = await api.get('/api/users/me').catch(() => null);
      if (res?.user) {
        store.set('user', res.user);
        store.set('session', { token });
        return;
      }
    }
    // Sin sesión válida
    store.set('user', null);
    store.set('session', null);
  } catch {
    store.set('user', null);
    store.set('session', null);
  }
}

function showPage(pageId) {
  // Ocultar todas las páginas
  document.querySelectorAll('.page').forEach(p => p.hidden = true);
  // Mostrar la página destino
  const page = document.getElementById(pageId);
  if (page) page.hidden = false;
  window.scrollTo(0, 0);
}

async function showApp(module = 'payments') {
  // Guard de auth: redirigir al landing si no hay sesión
  const token = localStorage.getItem('xshop_token');
  const user = store.get('user');
  if (!token || !user) {
    toast.info('Inicia sesión para acceder al dashboard');
    router.navigate('#landing');
    return;
  }

  showPage('app');

  // Actualizar módulo activo en el estado
  store.set('activeModule', module);

  // Actualizar pestañas
  document.querySelectorAll('.tab').forEach(t => {
    const active = t.dataset.module === module;
    t.classList.toggle('tab--active', active);
    t.setAttribute('aria-selected', active);
  });
  document.querySelectorAll('.app-panel').forEach(p => {
    p.classList.toggle('app-panel--active', p.dataset.module === module);
  });

  // Inicializar módulo si hace falta
  await initModule(module);
}

async function initModule(module) {
  if (modulesInitialized[module]) return;

  const container = document.getElementById(`${module}-app`);
  if (!container) return;

  try {
    switch (module) {
      case 'payments':
        paymentsModule = new PaymentsModule(container);
        break;
      case 'feed':
        feedModule = new FeedModule(container);
        break;
      case 'reputation':
        reputationModule = new ReputationModule(container);
        break;
    }
    modulesInitialized[module] = true;
    events.emit(AppEvents.MODULE_CHANGE, { module });
  } catch (e) {
    console.error(`Failed to init ${module}:`, e);
    toast.danger(`Error cargando ${module}`);
  }
}

// Helpers de autenticación
export async function login(email, password) {
  const res = await api.post('/api/users/login', { email, password });
  if (res.token) {
    localStorage.setItem('xshop_token', res.token);
    store.set('user', res.user);
    store.set('session', { token: res.token });
    events.emit(AppEvents.USER_LOGIN, res.user);
    return res.user;
  }
  throw new Error(res.error || 'Login failed');
}

export async function register(data) {
  const res = await api.post('/api/users/register', data);
  if (res.token) {
    localStorage.setItem('xshop_token', res.token);
    store.set('user', res.user);
    store.set('session', { token: res.token });
    events.emit(AppEvents.USER_LOGIN, res.user);
    return res.user;
  }
  throw new Error(res.error || 'Registration failed');
}

export function logout() {
  // Revocar la sesión en el servidor ANTES de borrar el token local
  // (api.request lo lee de localStorage al montar los headers).
  // Fire-and-forget: el cierre local no debe esperar la red
  if (localStorage.getItem('xshop_token')) {
    api.post('/api/users/logout', {}).catch(() => {});
  }
  localStorage.removeItem('xshop_token');
  store.set('user', null);
  store.set('session', null);
  events.emit(AppEvents.USER_LOGOUT);
  router.navigate('#landing');
}

// Animar los contadores del bloque de confianza (.trust-number[data-counter])
// cuando entran en pantalla; sin IntersectionObserver disponible → valor final directo
function initLandingCounters() {
  const nodes = document.querySelectorAll('.trust-number[data-counter]');
  if (!nodes.length) return;

  const animateTo = (el) => {
    const target = Number(el.dataset.counter) || 0;
    counter(el, 0, target, 1600, n => n.toLocaleString('es-PE'));
  };

  if (!('IntersectionObserver' in window)) {
    nodes.forEach(animateTo);
    return;
  }

  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      io.unobserve(entry.target);
      animateTo(entry.target);
    });
  }, { threshold: 0.4 });

  nodes.forEach(n => io.observe(n));
}

// Web Vitals (métricas de rendimiento)
function reportWebVitals() {
  if (!('PerformanceObserver' in window)) return;
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        console.log(`[Web Vitals] ${entry.name}: ${entry.value.toFixed(2)}ms`);
      }
    }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'first-input') {
          console.log(`[Web Vitals] FID: ${entry.processingStart - entry.startTime}ms`);
        }
      }
    }).observe({ type: 'first-input', buffered: true });
    new PerformanceObserver((list) => {
      let cls = 0;
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) cls += entry.value;
      }
      console.log(`[Web Vitals] CLS: ${cls.toFixed(4)}`);
    }).observe({ type: 'layout-shift', buffered: true });
  } catch {}
}

// Exportar para depuración
window.XShop = {
  store,
  router,
  api,
  events,
  modules: { paymentsModule, feedModule, reputationModule },
  login,
  register,
  logout
};

// Arranque
document.addEventListener('DOMContentLoaded', initApp);