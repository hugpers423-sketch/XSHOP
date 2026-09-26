// apps/web/components/layout/Header.tsx
'use client';

// Header de escritorio (oculto en móvil donde navega BottomNav).
// Orden de sesión:
//  - ANTES de iniciar sesión: botones "Ingresar" y "Crear cuenta";
//    solo se muestran secciones públicas (Reels, Live, Cerca, Catálogo, Vender).
//  - DESPUÉS de iniciar sesión: saldo de X-Coins + menú de cuenta
//    (perfil, pedidos, tienda si es vendedor, admin si corresponde, salir).
//  - El acceso a /seller, /admin y /orders lo valida el middleware.

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { useCartStore } from '@/lib/cart';
import { authLogout, type AuthUser } from '@/lib/api';
import { NotificationBell } from './NotificationBell';

const LINKS = [
  { href: '/reels', label: 'Reels', icon: '🎬' },
  { href: '/live', label: 'Live', icon: '📡', live: true },
  { href: '/marketplace', label: 'Cerca', icon: '📍' },
  { href: '/catalogo', label: 'Catálogo', icon: '🏷️' },
  { href: '/seller', label: 'Vender', icon: '🏪' },
];

interface HeaderProps {
  /** Usuario de la sesión (server) o null si es invitado */
  user: AuthUser | null;
}

export function Header({ user }: HeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const cartCount = useCartStore((s) => s.items.reduce((acc, i) => acc + i.quantity, 0));

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'MODERATOR';
  const firstName = user?.name.split(' ')[0] ?? '';
  const xCoins = (user?.xCoins ?? 0).toLocaleString('es-PE');

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    const query = q.trim();
    if (!query) return;
    router.push(`/products?q=${encodeURIComponent(query)}`);
  }

  async function onLogout() {
    setLoggingOut(true);
    try {
      await authLogout();
    } catch {
      // Aunque falle la red, el servidor limpia la cookie en /api/auth/logout
    }
    setMenuOpen(false);
    setLoggingOut(false);
    router.push('/');
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 hidden border-b border-white/10 bg-zinc-950/85 backdrop-blur-2xl lg:block">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2" aria-label="X-STORE inicio">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-[#FF2D75] to-[#7B5CFF] font-black text-white">
            X
          </span>
          <span className="text-lg font-black tracking-tight text-white">
            STORE
            <span className="text-[#FF2D75]">.</span>
          </span>
        </Link>

        {/* Búsqueda */}
        <form onSubmit={onSearch} className="relative flex-1 max-w-md" role="search">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Busca productos, tiendas, reels…"
            aria-label="Buscar productos"
            maxLength={120}
            className="w-full rounded-full border border-white/10 bg-white/5 py-2.5 pl-10 pr-4 text-sm text-white placeholder-white/35 outline-none transition focus:border-[#FF2D75]/60 focus:bg-white/10"
          />
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40">
            🔍
          </span>
        </form>

        {/* Enlaces públicos (+ Admin solo para roles autorizados) */}
        <nav aria-label="Navegación de escritorio">
          <ul className="flex items-center gap-1">
            {LINKS.map((l) => {
              const active = pathname === l.href;
              return (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    aria-current={active ? 'page' : undefined}
                    className={`relative flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                      active ? 'bg-white/10 text-white' : 'text-white/55 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <span aria-hidden>{l.icon}</span>
                    {l.label}
                    {l.live && (
                      <span className="absolute right-1 top-1.5 h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
                    )}
                  </Link>
                </li>
              );
            })}
            {isAdmin && (
              <li>
                <Link
                  href="/admin"
                  aria-current={pathname === '/admin' ? 'page' : undefined}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                    pathname === '/admin'
                      ? 'bg-white/10 text-white'
                      : 'text-white/55 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <span aria-hidden>🛡️</span>
                  Admin
                </Link>
              </li>
            )}
          </ul>
        </nav>

        {/* Carrito con badge */}
        <Link
          href="/cart"
          aria-label={`Carrito, ${cartCount} productos`}
          className="relative grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5 text-lg transition hover:border-white/25"
        >
          🛒
          {cartCount > 0 && (
            <motion.span
              key={cartCount}
              initial={{ scale: 0.5 }}
              animate={{ scale: 1 }}
              className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-[#FF2D75] px-1 text-[10px] font-black text-white"
            >
              {cartCount}
            </motion.span>
          )}
        </Link>

        {/* ===== Estado de sesión ===== */}
        {user ? (
          /* DESPUÉS del login: notificaciones + X-Coins + menú de cuenta */
          <div className="relative flex items-center gap-2">
            <NotificationBell user={user} />

            <span className="hidden rounded-full border border-[#FFD166]/25 bg-[#FFD166]/10 px-3 py-1.5 text-xs font-black text-[#FFD166] xl:inline-block">
              🪙 {xCoins}
            </span>

            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="Menú de cuenta"
              className="flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/5 pl-1.5 pr-2.5 transition hover:border-white/25"
            >
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-[#FF2D75] to-[#7B5CFF] text-sm font-black text-white">
                {firstName.charAt(0).toUpperCase() || 'U'}
              </span>
              <span className="hidden max-w-24 truncate text-sm font-semibold text-white/85 xl:block">
                {firstName}
              </span>
              <span
                aria-hidden
                className={`text-[10px] text-white/40 transition ${menuOpen ? 'rotate-180' : ''}`}
              >
                ▼
              </span>
            </button>

            {menuOpen && (
              <>
                {/* Clic fuera = cerrar menú */}
                <button
                  type="button"
                  aria-hidden
                  tabIndex={-1}
                  onClick={() => setMenuOpen(false)}
                  className="fixed inset-0 z-40 cursor-default"
                />
                <div
                  role="menu"
                  aria-label="Cuenta"
                  className="absolute right-0 top-12 z-50 w-64 rounded-2xl border border-white/10 bg-zinc-900/95 p-2 shadow-2xl backdrop-blur-xl"
                >
                  {/* Identidad + saldo */}
                  <div className="rounded-xl bg-white/5 px-3 py-2.5">
                    <p className="truncate text-sm font-bold text-white">{user.name}</p>
                    <p className="truncate text-xs text-white/45">{user.email}</p>
                    <p className="mt-1.5 flex items-center justify-between text-xs">
                      <span className="text-[#FFD166]">🪙 X-Coins</span>
                      <span className="font-black text-[#FFD166]">{xCoins}</span>
                    </p>
                  </div>

                  {/* Destinos post-login */}
                  <ul className="mt-1.5 space-y-0.5">
                    {[
                      { href: '/profile', label: '👤 Mi perfil' },
                      { href: '/favoritos', label: '🔖 Mis guardados' },
                      { href: '/orders', label: '📦 Mis pedidos' },
                      ...(user.role === 'SELLER' || isAdmin
                        ? [{ href: '/seller', label: '🏪 Mi tienda' }]
                        : []),
                      ...(isAdmin ? [{ href: '/admin', label: '🛡️ Panel admin' }] : []),
                    ].map((item) => (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          role="menuitem"
                          onClick={() => setMenuOpen(false)}
                          className="block rounded-xl px-3 py-2.5 text-sm font-semibold text-white/80 transition hover:bg-white/10 hover:text-white"
                        >
                          {item.label}
                        </Link>
                      </li>
                    ))}
                  </ul>

                  {/* Salir */}
                  <div className="mt-1.5 border-t border-white/10 pt-1.5">
                    <button
                      type="button"
                      onClick={onLogout}
                      disabled={loggingOut}
                      className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-red-300 transition hover:bg-red-500/10 disabled:opacity-50"
                    >
                      {loggingOut ? 'Cerrando sesión…' : '🚪 Cerrar sesión'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          /* ANTES del login: puerta de entrada clara */
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-bold text-white/80 transition hover:border-white/30 hover:text-white"
            >
              Ingresar
            </Link>
            <Link
              href="/register"
              className="rounded-xl bg-gradient-to-r from-[#FF2D75] to-[#7B5CFF] px-4 py-2.5 text-sm font-bold text-white transition hover:opacity-90 active:scale-95"
            >
              Crear cuenta
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
