// apps/web/components/live/PinnedProductCard.tsx
'use client';

// Tarjeta de producto fijado por el host durante la transmisión (Live Shopping)

import { motion, AnimatePresence } from 'framer-motion';
import { formatPrice } from '@/lib/format';
import { useCartStore } from '@/lib/cart';
import { track } from '@/lib/analytics';
import { toast } from '@/components/ui/Toast';

export interface PinnedProduct {
  id: string;
  title: string;
  price: number;
  compareAtPrice?: number;
  image: string;
  stockLabel?: string;
}

interface Props {
  product: PinnedProduct | null;
  onClose?: () => void;
  onRequireAuth?: () => boolean;
}

export function PinnedProductCard({ product, onClose, onRequireAuth }: Props) {
  const addItem = useCartStore((s) => s.addItem);

  function quickBuy() {
    if (!product) return;
    if (product.price <= 0) {
      toast.info('El vendedor aún no tiene un precio disponible para este producto.');
      return;
    }
    if (onRequireAuth && !onRequireAuth()) return;
    addItem({
      productId: product.id,
      title: product.title,
      price: product.price,
      seller: 'Live Host',
      image: product.image,
    });
    track('add_to_cart', { productId: product.id, price: product.price, qty: 1, source: 'live' });
    toast.success(`"${product.title}" añadido al carrito 🛒`);
  }

  return (
    <AnimatePresence>
      {product && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', damping: 24, stiffness: 300 }}
          className="pointer-events-auto w-full max-w-xs rounded-2xl border border-[#FF2D75]/40 bg-black/85 p-3 backdrop-blur-xl"
        >
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={product.image}
              alt={product.title}
              className="h-14 w-14 rounded-xl object-cover"
            />
            <div className="min-w-0 flex-1">
              <p className="line-clamp-1 text-sm font-semibold text-white">{product.title}</p>
              <div className="flex items-baseline gap-2">
                <span className="font-black text-[#FF2D75]">{formatPrice(product.price)}</span>
                {product.compareAtPrice && product.compareAtPrice > product.price && (
                  <span className="text-xs text-white/40 line-through">
                    {formatPrice(product.compareAtPrice)}
                  </span>
                )}
              </div>
              {product.stockLabel && (
                <p className="text-[10px] font-bold text-[#FFD166]">{product.stockLabel}</p>
              )}
            </div>
            <button
              onClick={quickBuy}
              className="shrink-0 rounded-xl bg-gradient-to-r from-[#FF2D75] to-[#7B5CFF] px-3.5 py-2.5 text-xs font-black text-white transition hover:opacity-90 active:scale-95"
            >
              Comprar
            </button>
          </div>

          {onClose && (
            <button
              onClick={onClose}
              aria-label="Cerrar"
              className="mt-2 w-full text-[10px] text-white/40 hover:text-white/70"
            >
              cerrar
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
