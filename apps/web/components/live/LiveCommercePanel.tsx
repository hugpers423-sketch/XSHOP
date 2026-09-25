// apps/web/components/live/LiveCommercePanel.tsx
'use client';

// Panel derecho de Live Commerce.
// Solo lectura sobre datos ya existentes + follow local. No inventa escrow ni pagos.

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from '@/components/ui/Toast';
import { formatCount } from '@/lib/format';
import { useAuth } from '@/lib/auth-context';

const FOLLOW_KEY = 'xshop-following-sellers-v1';

export interface LiveCommerceStream {
  id: string;
  title: string;
  hostName: string;
  viewers: number;
  category: string;
  productName?: string | null;
  productPrice?: number | null;
}

export function LiveCommercePanel({ stream }: { stream: LiveCommerceStream }) {
  const { requireAuth } = useAuth();
  const [isFollowing, setIsFollowing] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(FOLLOW_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) setIsFollowing(parsed.includes(stream.id));
    } catch {
      // Follow sin persistencia: la acción sigue funcionando en la sesión.
    }
  }, [stream.id]);

  function toggleFollow() {
    if (!requireAuth('follow')) return;
    const next = !isFollowing;
    setIsFollowing(next);
    try {
      const raw = window.localStorage.getItem(FOLLOW_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      const list = Array.isArray(parsed) ? parsed : [];
      const updated = next ? [...new Set([...list, stream.id])] : list.filter((id) => id !== stream.id);
      window.localStorage.setItem(FOLLOW_KEY, JSON.stringify(updated));
    } catch {
      // Sin persistencia disponible.
    }
    toast.success(next ? `Sigues a ${stream.hostName}` : `Dejaste de seguir a ${stream.hostName}`);
  }

  function share() {
    const url = `${window.location.origin}/live?id=${encodeURIComponent(stream.id)}`;
    if (navigator.share) {
      navigator.share({ title: stream.title, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url).then(
        () => toast.success('Enlace del live copiado'),
        () => toast.error('No se pudo copiar el enlace')
      );
    }
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-3xl border-2 border-violet-400/40 bg-gradient-to-b from-violet-950/60 to-zinc-950/90 p-4 shadow-[0_0_32px_rgba(139,92,246,0.18)]"
      aria-label="Panel del vendedor en live"
    >
      {/* Aura lila: identidad visual del vendedor transmitiendo */}
      <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-violet-500/20 blur-3xl" />

      <div className="relative flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-violet-300/30 bg-violet-400/15 text-lg">
          📡
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-violet-200">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" /> En vivo ahora
          </p>
          <p className="truncate text-sm font-black text-white">{stream.hostName}</p>
          <p className="truncate text-[11px] text-white/45">{stream.category} · {formatCount(stream.viewers)} viendo</p>
        </div>
      </div>

      <p className="relative mt-3 text-xs leading-relaxed text-white/65">{stream.title}</p>

      {stream.productName && (
        <div className="relative mt-3 rounded-2xl border border-cyan-400/25 bg-cyan-400/10 p-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-cyan-200">Producto en oferta</p>
          <p className="mt-0.5 truncate text-sm font-bold text-white">{stream.productName}</p>
          {typeof stream.productPrice === 'number' && (
            <p className="mt-0.5 text-sm font-black text-emerald-300">S/ {stream.productPrice.toFixed(2)}</p>
          )}
        </div>
      )}

      <div className="relative mt-3 flex gap-2">
        <button
          type="button"
          onClick={toggleFollow}
          aria-pressed={isFollowing}
          className={`flex-1 rounded-xl px-3 py-2.5 text-xs font-black transition ${
            isFollowing
              ? 'border border-violet-300/60 bg-violet-400/20 text-violet-100'
              : 'bg-gradient-to-r from-violet-500 to-fuchsia-600 text-white shadow-lg shadow-violet-900/40 hover:brightness-110'
          }`}
        >
          {isFollowing ? '✓ Siguiendo' : '+ Seguir vendedor'}
        </button>
        <button
          type="button"
          onClick={share}
          className="rounded-xl border border-white/15 px-3 py-2.5 text-xs font-bold text-white/70 transition hover:bg-white/10"
          aria-label="Compartir este live"
        >
          ↗
        </button>
      </div>

      <p className="relative mt-3 text-[10px] leading-relaxed text-white/35">
        Pagos Yape/Plin coordinados por WhatsApp con el vendedor. X-STORE no custodia fondos.
      </p>
    </motion.section>
  );
}
