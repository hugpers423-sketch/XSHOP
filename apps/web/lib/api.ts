// apps/web/lib/api.ts
// Cliente API tipado con manejo de errores y reintentos

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

interface ApiOptions extends RequestInit {
  retries?: number;
}

async function request<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { retries = 2, headers, ...rest } = options;

  const doFetch = async (): Promise<Response> => {
    return fetch(`${BASE_URL}${path}`, {
      ...rest,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      credentials: 'include',
    });
  };

  let lastError: Error = new Error('Error de red');

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await doFetch();

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }

      return (await res.json()) as T;
    } catch (err) {
      lastError = err as Error;
      // No reintentar en errores 4xx (excepto 429)
      if (err instanceof Error && /HTTP 4\d\d/.test(err.message) && !/HTTP 429/.test(err.message)) {
        break;
      }
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 300 * 2 ** attempt)); // backoff exponencial
      }
    }
  }

  throw lastError;
}

export const api = {
  get: <T>(path: string, opts?: ApiOptions) => request<T>(path, { ...opts, method: 'GET' }),
  post: <T>(path: string, body: unknown, opts?: ApiOptions) =>
    request<T>(path, { ...opts, method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown, opts?: ApiOptions) =>
    request<T>(path, { ...opts, method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown, opts?: ApiOptions) =>
    request<T>(path, { ...opts, method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string, opts?: ApiOptions) => request<T>(path, { ...opts, method: 'DELETE' }),
};

// ===== Tipos de dominio =====
export interface ProductSummary {
  id: string;
  title: string;
  price: number;
  image: string;
  shipping: string;
  rating: number;
  reviews: number;
  seller: string;
}

// Shape crudo que devuelve Prisma en /api/products (tipado estricto, sin any)
interface RawProduct {
  id: string;
  title?: string;
  price?: number | string;
  freeShipping?: boolean;
  rating?: number;
  reviewCount?: number;
  images?: Array<{ url: string }>;
  seller?: { name?: string } | null;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'BUYER' | 'SELLER' | 'ADMIN' | 'MODERATOR';
  /** Saldo de gamificación (presente en /api/auth/me y en la sesión del servidor) */
  xCoins?: number;
}

export interface AuthResponse {
  ok: boolean;
  user?: AuthUser;
  error?: string;
}

// ===== Helpers de catálogo =====
interface SearchParams {
  q?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  page?: number;
}

// Normaliza la respuesta de /api/products al shape que consumen las páginas
export async function searchProducts(params: SearchParams = {}): Promise<ProductSummary[]> {
  const query = new URLSearchParams();
  if (params.q) query.set('q', params.q);
  if (params.category) query.set('category', params.category);
  if (params.minPrice != null) query.set('minPrice', String(params.minPrice));
  if (params.maxPrice != null) query.set('maxPrice', String(params.maxPrice));
  if (params.page) query.set('page', String(params.page));

  const qs = query.toString();
  const res = await api.get<{ data: RawProduct[] }>(`/api/products${qs ? `?${qs}` : ''}`);

  return (res.data ?? []).map((p) => ({
    id: p.id,
    title: p.title ?? '',
    price: Number(p.price ?? 0),
    image: p.images?.[0]?.url ?? '/placeholder.png',
    shipping: p.freeShipping ? 'Gratis' : '',
    rating: Number(p.rating ?? 0),
    reviews: Number(p.reviewCount ?? 0),
    seller: p.seller?.name ?? 'Vendedor',
  }));
}

// ===== Helpers de autenticación =====
export function authLogin(body: { email: string; password: string }): Promise<AuthResponse> {
  return api.post<AuthResponse>('/api/auth/login', body);
}

export function authRegister(body: {
  name: string;
  email: string;
  password: string;
  role: 'BUYER' | 'SELLER';
}): Promise<AuthResponse> {
  return api.post<AuthResponse>('/api/auth/register', body);
}

export function authLogout(): Promise<{ ok: boolean }> {
  return api.post<{ ok: boolean }>('/api/auth/logout', {});
}
