// src/core/api.js — Wrapper de fetch + caché + reintentos + abort
const CACHE = new Map();
const INFLIGHT = new Map();
const DEFAULT_TIMEOUT = 10000;
const RETRY_DELAYS = [300, 1000, 3000];

function generateKey(url, options) {
  return `${options?.method || 'GET'}:${url}:${JSON.stringify(options?.body || {})}`;
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeout || DEFAULT_TIMEOUT);
  try {
    // Separar opciones propias de la app de las válidas de RequestInit:
    // fetch exige un enum válido en `cache` ('no-store', …) y rechaza `false`.
    const { timeout: _t, cacheTTL: _ttl, cache, ...rest } = options;
    const init = { ...rest, signal: controller.signal };
    if (cache !== undefined) {
      init.cache = cache === false ? 'no-store' : cache === true ? 'force-cache' : cache;
    }
    const res = await fetch(url, init);
    clearTimeout(timeout);
    return res;
  } catch (e) {
    clearTimeout(timeout);
    throw e;
  }
}

async function request(endpoint, options = {}) {
  // Prefijar baseUrl si el endpoint es relativo
  const url = endpoint.startsWith('http') ? endpoint : `${api.baseUrl}${endpoint}`;
  const key = generateKey(url, options);
  const method = (options.method || 'GET').toUpperCase();
  const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

  // Caché para GET
  if (!isMutation && options.cache !== false) {
    const cached = CACHE.get(key);
    if (cached && Date.now() - cached.ts < (options.cacheTTL || 30000)) {
      return cached.data;
    }
  }

  // Deduplicar peticiones en vuelo
  if (INFLIGHT.has(key)) return INFLIGHT.get(key);

  let attempt = 0;
  while (true) {
    try {
      // Adjuntar token Bearer desde localStorage automáticamente
      const token = localStorage.getItem('xshop_token');
      const authHeaders = token ? { 'Authorization': `Bearer ${token}` } : {};

      const promise = fetchWithTimeout(url, {
        ...options,
        headers: { 'Content-Type': 'application/json', ...authHeaders, ...options.headers },
        credentials: 'include'
      });
      INFLIGHT.set(key, promise);
      const res = await promise;
      INFLIGHT.delete(key);

      if (!res.ok) {
        const error = new Error(`HTTP ${res.status}`);
        error.status = res.status;
        error.response = res;
        throw error;
      }

      const data = res.status === 204 ? null : await res.json();

      if (!isMutation && options.cache !== false) {
        CACHE.set(key, { data, ts: Date.now() });
      }
      return data;
    } catch (e) {
      INFLIGHT.delete(key);
      const isRetryable = !e.status || e.status >= 500 || e.name === 'AbortError';
      if (isRetryable && attempt < RETRY_DELAYS.length) {
        await new Promise(r => setTimeout(r, RETRY_DELAYS[attempt++]));
        continue;
      }
      throw e;
    }
  }
}

export const api = {
  get: (url, opts) => request(url, { ...opts, method: 'GET' }),
  post: (url, body, opts) => request(url, { ...opts, method: 'POST', body: JSON.stringify(body) }),
  put: (url, body, opts) => request(url, { ...opts, method: 'PUT', body: JSON.stringify(body) }),
  patch: (url, body, opts) => request(url, { ...opts, method: 'PATCH', body: JSON.stringify(body) }),
  del: (url, opts) => request(url, { ...opts, method: 'DELETE' }),
  invalidate: (pattern) => {
    for (const key of CACHE.keys()) {
      if (pattern instanceof RegExp ? pattern.test(key) : key.includes(pattern)) CACHE.delete(key);
    }
  },
  clearCache: () => CACHE.clear(),
  setBaseUrl: (base) => { api.baseUrl = base; }
};

api.baseUrl = '';

export async function apiCall(endpoint, options = {}) {
  return request(endpoint, options);
}