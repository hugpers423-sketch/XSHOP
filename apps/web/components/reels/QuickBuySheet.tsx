// apps/web/components/reels/QuickBuySheet.tsx
'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import type { Reel } from './types';

interface QuickBuySheetProps {
  reel: Reel | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (variantId: string, qty: number) => void;
}

export function QuickBuySheet({ reel, isOpen, onClose, onConfirm }: QuickBuySheetProps) {
  const [variantId, setVariantId] = useState<string>('');
  const [qty, setQty] = useState(1);

  const selectedVariant =
    reel?.product.variants.find((v) => v.id === variantId) ?? reel?.product.variants[0];
  const unitPrice = selectedVariant?.price ?? reel?.product.price ?? 0;
  const total = unitPrice * qty;

  return (
    <AnimatePresence>
      {isOpen && reel && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose} className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" aria-hidden
          />
          <motion.div
            role="dialog"
            aria-label="Compra rápida"
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
            className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-lg rounded-t-3xl border-t border-white/15 bg-[#0b0f1a]/95 p-5 backdrop-blur-2xl"
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/25" aria-hidden />

            <div className="mb-4 flex gap-4">
              <img src={reel.product.images[0]} alt="" className="h-24 w-24 rounded-2xl object-cover" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-white">{reel.product.title}</p>
                <p className="mt-1 text-2xl font-extrabold text-emerald-400">
                  S/ {total.toFixed(2)}
                  {reel.product.compareAtPrice && (
                    <span className="ml-2 text-sm font-normal text-white/40 line-through">
                      S/ {(reel.product.compareAtPrice * qty).toFixed(2)}
                    </span>
                  )}
                </p>
                <p className="text-xs text-white/60">🚚 {reel.product.shippingEstimate}</p>
              </div>
            </div>

            {reel.product.variants.length > 0 && (
              <fieldset className="mb-4">
                <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/50">
                  Elige una opción
                </legend>
                <div className="flex flex-wrap gap-2">
                  {reel.product.variants.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setVariantId(v.id)}
                      aria-pressed={v.id === selectedVariant?.id}
                      className={`rounded-xl border px-4 py-2 text-xs font-medium transition ${
                        v.id === selectedVariant?.id
                          ? 'border-cyan-400 bg-cyan-400/15 text-cyan-300'
                          : 'border-white/15 text-white/70 hover:border-white/40'
                      } ${v.stock === 0 ? 'cursor-not-allowed opacity-40' : ''}`}
                      disabled={v.stock === 0}
                    >
                      {v.name} {v.stock === 0 && '(agotado)'}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}

            <div className="mb-6 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-white/50">Cantidad</span>
              <div className="flex items-center gap-3 rounded-xl border border-white/15 px-3 py-1.5">
                <button onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Restar" className="text-white/70 hover:text-white">−</button>
                <span className="w-6 text-center text-sm font-bold text-white" aria-live="polite">{qty}</span>
                <button onClick={() => setQty((q) => Math.min(reel.product.stock, q + 1))} aria-label="Sumar" className="text-white/70 hover:text-white">+</button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => { onConfirm(selectedVariant?.id ?? '', qty); onClose(); }}
              className="w-full rounded-2xl bg-gradient-to-r from-cyan-500 via-violet-500 to-fuchsia-500 py-4 text-sm font-bold text-white shadow-lg shadow-violet-500/30 transition active:scale-[0.98]"
            >
              Comprar ahora · S/ {total.toFixed(2)}
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
