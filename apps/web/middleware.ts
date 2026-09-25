// apps/web/middleware.ts
// Seguridad en el borde: rate limiting básico + headers + protección de rutas

import { NextRequest, NextResponse } from 'next/server';

// Rutas que requieren sesión (el carrito es local/guest y queda público)
const PROTECTED_ROUTES = ['/checkout', '/profile', '/orders', '/seller', '/admin'];

// Rutas de API con rate limit por IP
const RATE_LIMITED = '/api/';

const rateLimit = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000; // 1 minuto
const MAX_REQUESTS = 100;

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown';

  // ---- Rate limiting para APIs ----
  if (pathname.startsWith(RATE_LIMITED)) {
    const now = Date.now();
    const entry = rateLimit.get(ip);

    if (!entry || now > entry.resetAt) {
      rateLimit.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    } else {
      entry.count += 1;
      if (entry.count > MAX_REQUESTS) {
        return NextResponse.json(
          { error: 'Demasiadas solicitudes. Intenta en un minuto.' },
          { status: 429, headers: { 'Retry-After': '60' } }
        );
      }
    }
  }

  // ---- Protección de rutas de sesión (placeholder: validar JWT real) ----
  if (PROTECTED_ROUTES.some((r) => pathname.startsWith(r))) {
    const session = req.cookies.get('session')?.value;
    if (!session) {
      const url = new URL('/login', req.url);
      url.searchParams.set('next', pathname);
      return NextResponse.redirect(url);
    }
  }

  // ---- Headers de seguridad adicionales ----
  const res = NextResponse.next();
  res.headers.set('X-DNS-Prefetch-Control', 'on');
  const forwardedProto = req.headers.get('x-forwarded-proto');
  const isHttps = req.nextUrl.protocol === 'https:' || forwardedProto === 'https';
  if (process.env.NODE_ENV === 'production' && isHttps) {
    res.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  }
  res.headers.set('X-XSS-Protection', '1; mode=block');

  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons/).*)'],
};
