// apps/web/components/layout/BottomNav.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { useCartStore } from '@/lib/cart';
import type { AuthUser } from '@/lib/api';

interface BottomNavProps {
  /** Usuario de la sesión (server) o null si es invitado */
  user: AuthUser | null;
}

/**
 * Navegación inferior estilo app nativa (vista móvil / APK):
 * - Safe-area aware (notch iPhone)
 * - Badge de cantidad del carrito
 * - Indicador activo animado
 * - ANTES del login: la última pestaña invita a "Ingresar"
 * - DESPUÉS del login: la última pestaña abre el "Perfil"
 * - Oculta en desktop (se usa header horizontal)
 */
export function BottomNav({ user }: BottomNavProps) {
  const pathname = usePathname();
  const cartCount = useCartStore((s) =>
    s.items.reduce((acc, i) => acc + i.quantity, 0)
  );

  const TABS = [
    { href: '/', icon: '🏠', label: 'Inicio' },
    { href: '/reels', icon: '🎬', label: 'Reels' },
    { href: '/live', icon: '📡', label: 'Live', live: true },
    { href: '/marketplace', icon: '📍', label: 'Cerca' },
    { href: '/cart', icon: '🛒', label: 'Carrito' },
    // Puerta de sesión móvil: entrar vs. perfil
    user
      ? { href: '/profile', icon: '👤', label: 'Perfil' }
      : { href: '/login', icon: '🔐', label: 'Ingresar' },
  ];

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-zinc-950/90 backdrop-blur-2xl lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto flex max-w-lg items-center justify-around">
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className="relative flex flex-col items-center gap-0.5 px-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 rounded-xl"
              >
                <span className={`text-xl transition ${active ? 'scale-110' : 'opacity-50 grayscale'}`}>
                  {tab.icon}
                </span>
                <span
                  className={`text-[10px] font-semibold transition ${
                    active ? 'text-cyan-400' : 'text-white/40'
                  }`}
                >
                  {tab.label}
                </span>

                {tab.href === '/cart' && cartCount > 0 && (
                  <span className="absolute -top-0.5 right-1 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
                    {cartCount}
                  </span>
                )}

                {/* Punto rojo indicando transmisiones activas */}
                {'live' in tab && tab.live && (
                  <span className="absolute right-2 top-1.5 h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
                )}

                {active && (
                  <motion.span
                    layoutId="bottomnav-indicator"
                    className="absolute -top-px h-0.5 w-8 rounded-full bg-gradient-to-r from-cyan-400 to-violet-500"
                  />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
