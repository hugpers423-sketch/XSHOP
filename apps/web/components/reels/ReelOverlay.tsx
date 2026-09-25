// apps/web/components/reels/ReelOverlay.tsx
'use client';

import { motion, AnimatePresence } from 'framer-motion';
import type { Reel } from './types';

interface ReelOverlayProps {
  reel: Reel;
  isLiked: boolean;
  onToggleLike: () => void;
  onOpenComments: () => void;
  onShare: () => void;
  onQuickBuy: () => void;
}

const formatCount = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M`
  : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K`
  : String(n);

export function ReelOverlay({
  reel, isLiked, onToggleLike, onOpenComments, onShare, onQuickBuy,
}: ReelOverlayProps) {
  return (
    <>
      {/* Barra lateral derecha */}
      <div className="absolute right-3 bottom-32 z-20 flex flex-col items-center gap-5">
        <ActionButton
          label={formatCount(reel.stats.likes + (isLiked ? 1 : 0))}
          aria-label="Me gusta"
          onClick={onToggleLike}
        >
          <motion.span
            key={String(isLiked)}
            initial={{ scale: 0.6 }}
            animate={{ scale: [0.6, 1.25, 1] }}
            transition={{ duration: 0.35 }}
            className={isLiked ? 'text-rose-500 drop-shadow-[0_0_8px_rgba(244,63,94,0.8)]' : 'text-white'}
          >
            {isLiked ? '♥' : '♡'}
          </motion.span>
        </ActionButton>

        <ActionButton
          label={formatCount(reel.stats.comments)}
          aria-label="Comentarios"
          onClick={onOpenComments}
        >
          <span className="text-white">💬</span>
        </ActionButton>

        <ActionButton label={formatCount(reel.stats.shares)} aria-label="Compartir" onClick={onShare}>
          <span className="text-white">↗</span>
        </ActionButton>
      </div>

      {/* Zona inferior */}
      <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-4 pb-24 pt-16">
        <p className="mb-2 max-w-[85%] text-sm font-semibold text-white">
          {reel.caption}
          <span className="ml-2 font-normal text-sky-300">
            {reel.hashtags.map((t) => `#${t}`).join(' ')}
          </span>
        </p>

        <AnimatePresence>
          <motion.button
            type="button"
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            whileTap={{ scale: 0.97 }}
            onClick={onQuickBuy}
            aria-label={`Comprar ${reel.product.title}`}
            className="flex w-full max-w-md items-center gap-3 rounded-2xl border border-white/15 bg-white/10 p-2.5 backdrop-blur-xl transition hover:border-cyan-400/50"
          >
            <img
              src={reel.product.thumbnail}
              alt=""
              className="h-14 w-14 shrink-0 rounded-xl object-cover"
              loading="lazy"
            />
            <div className="min-w-0 flex-1 text-left">
              <p className="truncate text-sm font-medium text-white">{reel.product.title}</p>
              <p className="text-xs text-emerald-400">🚚 {reel.product.shippingEstimate}</p>
            </div>
            <span className="rounded-xl bg-gradient-to-r from-cyan-500 to-violet-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-cyan-500/30">
              Comprar 1-Clic
            </span>
          </motion.button>
        </AnimatePresence>
      </div>
    </>
  );
}

function ActionButton({
  label, children, onClick, 'aria-label': ariaLabel,
}: {
  label?: string; children: React.ReactNode; onClick: () => void; 'aria-label': string;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      className="flex flex-col items-center gap-1 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
    >
      <span className="grid h-11 w-11 place-items-center rounded-full bg-black/40 text-xl backdrop-blur-md">
        {children}
      </span>
      {label && <span className="text-[11px] font-medium text-white/90">{label}</span>}
    </button>
  );
}
