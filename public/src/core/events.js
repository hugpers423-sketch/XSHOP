// src/core/events.js — Bus de eventos | ~500 bytes
const listeners = new Map();

export const events = {
  on(event, fn) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(fn);
    return () => this.off(event, fn);
  },
  off(event, fn) {
    const set = listeners.get(event);
    if (set) set.delete(fn);
  },
  emit(event, data) {
    const set = listeners.get(event);
    if (set) set.forEach(fn => { try { fn(data); } catch (e) { console.error(`Event ${event} error:`, e); } });
    const all = listeners.get('*');
    if (all) all.forEach(fn => { try { fn(event, data); } catch (e) { console.error(`Event * error:`, e); } });
  },
  once(event, fn) {
    const off = this.on(event, (...args) => { off(); fn(...args); });
    return off;
  },
  clear(event) {
    if (event) listeners.delete(event);
    else listeners.clear();
  }
};

// Eventos comunes de la app
export const AppEvents = {
  USER_LOGIN: 'auth:login',
  USER_LOGOUT: 'auth:logout',
  USER_UPDATE: 'auth:update',
  MODULE_CHANGE: 'module:change',
  TOAST_SHOW: 'ui:toast',
  MODAL_OPEN: 'ui:modal:open',
  MODAL_CLOSE: 'ui:modal:close',
  PAYMENT_SUCCESS: 'payment:success',
  PAYMENT_ERROR: 'payment:error',
  FEED_REFRESH: 'feed:refresh',
  FEED_LOAD_MORE: 'feed:loadmore',
  REPUTATION_UPDATE: 'reputation:update'
};