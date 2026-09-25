// src/core/state.js — Store reactivo con Proxy | ~1KB | Cero dependencias
export function createStore(initialState = {}) {
  const state = new Proxy(initialState, {
    set(target, prop, value) {
      const oldValue = target[prop];
      if (oldValue === value) return true;
      target[prop] = value;
      state._emit(prop, value, oldValue);
      return true;
    },
    get(target, prop) {
      if (prop === '_emit' || prop === 'on' || prop === 'off') return target[prop];
      const value = target[prop];
      if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
        return new Proxy(value, {
          set(t, p, v) {
            const old = t[p];
            if (old === v) return true;
            t[p] = v;
            state._emit(`${prop}.${p}`, v, old);
            state._emit(prop, target[prop], oldValue);
            return true;
          }
        });
      }
      return value;
    }
  });

  const listeners = new Map();
  state._emit = (key, value, oldValue) => {
    const keyListeners = listeners.get(key) || [];
    const allListeners = listeners.get('*') || [];
    [...keyListeners, ...allListeners].forEach(fn => fn(value, oldValue, key));
  };
  state.on = (key, fn) => {
    if (!listeners.has(key)) listeners.set(key, []);
    listeners.get(key).push(fn);
    return () => state.off(key, fn);
  };
  state.off = (key, fn) => {
    const arr = listeners.get(key);
    if (arr) {
      const idx = arr.indexOf(fn);
      if (idx > -1) arr.splice(idx, 1);
    }
  };
  state.get = (key) => key.split('.').reduce((o, k) => o?.[k], state);
  state.set = (key, value) => {
    const keys = key.split('.');
    const last = keys.pop();
    const target = keys.reduce((o, k) => o[k], state);
    if (target) target[last] = value;
  };
  return state;
}

export const store = createStore({
  user: null,
  session: null,
  activeModule: 'payments',
  modules: { payments: {}, feed: {}, reputation: {} },
  ui: { loading: false, toasts: [], modals: [] }
});

export function select(selector) {
  return store.get(selector);
}

export function subscribe(selector, fn) {
  return store.on(selector, fn);
}