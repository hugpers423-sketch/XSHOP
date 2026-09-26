// apps/web/components/layout/NotificationBell.tsx
'use client';

// Campana de notificaciones para el header (escritorio).
// Solo se monta con sesión: como invitado no hay nada que mostrar.

import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import { useNotifications } from '@/lib/notifications';
import type { AuthUser } from '@/lib/api';

const TYPE_ICON: Record<string, string> = {
  ORDER_SHIPPED: '🚚',
  PRICE_DROP: '🏷️',
  CHAT_MESSAGE: '💬',
  LIVE_STARTED: '📡',
  DEFAULT: '🔔',
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  const hours = Math.round(min / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `hace ${days} d`;
  return new Date(iso).toLocaleDateString('es-PE');
}

export function NotificationBell({ user }: { user: AuthUser }) {
  const { items, unread, open, setOpen, markAllRead, markOneRead } = useNotifications();
  const rootRef = useRef<HTMLDivElement>(null);

  // Clic fuera = cerrar
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, setOpen]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={
          unread > 0 ? `Notificaciones, ${unread} sin leer` : 'Notificaciones'
        }
        className="relative grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5 text-base transition hover:border-white/25 hover:bg-white/10"
      >
        🔔
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[#FF2D75] px-1 text-[10px] font-black text-white ring-2 ring-zinc-950">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.16 }}
            role="dialog"
            aria-label="Notificaciones"
            className="absolute right-0 top-12 z-50 w-80 overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/95 shadow-2xl backdrop-blur-xl"
          >
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <p className="text-sm font-black text-white">Notificaciones</p>
              {unread > 0 && (
                <button
                  type="button"
                  onClick={() => void markAllRead()}
                  className="text-[11px] font-bold text-cyan-300 hover:underline"
                >
                  Marcar leídas
                </button>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto">
              {items.length === 0 ? (
                <p className="px-4 py-8 text-center text-xs text-white/40">
                  No tienes notificaciones todavía.
                </p>
              ) : (
                <ul className="divide-y divide-white/5">
                  {items.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => void markOneRead(item.id)}
                        className={`flex w-full gap-3 px-4 py-3 text-left transition hover:bg-white/5 ${
                          item.isRead ? 'opacity-60' : ''
                        }`}
                      >
                        <span className="mt-0.5 text-base" aria-hidden>
                          {TYPE_ICON[item.type] ?? TYPE_ICON.DEFAULT}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="truncate text-xs font-bold text-white">{item.title}</span>
                            {!item.isRead && (
                              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#FF2D75]" />
                            )}
                          </span>
                          <span className="mt-0.5 block text-[11px] leading-relaxed text-white/50">
                            {item.body}
                          </span>
                          <span className="mt-1 block text-[10px] text-white/30">
                            {relativeTime(item.createdAt)}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="border-t border-white/10 p-2">
              <Link
                href="/profile"
                onClick={() => setOpen(false)}
                className="block rounded-lg px-3 py-2 text-center text-xs font-bold text-white/70 transition hover:bg-white/5"
              >
                Ver todo en mi perfil
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
