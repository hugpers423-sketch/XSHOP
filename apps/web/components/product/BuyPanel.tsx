// apps/web/components/product/BuyPanel.tsx
'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from '@/components/ui/Toast';
import { useAuth } from '@/lib/auth-context';

interface BuyPanelProps {
  price: number;
  compareAtPrice?: number;
  stock: number;
  onBuyNow: () => void;
  onAddToCart: () => void;
  onWhatsApp: () => void;
}

/**
 * Panel de compra sticky:
 * - Móvil: barra fija inferior (safe-area aware)
 * - Desktop: card lateral sticky
 * - Micro-interacciones con Framer Motion
 */
export function BuyPanel({
  price, compareAtPrice, stock, onBuyNow, onAddToCart, onWhatsApp,
}: BuyPanelProps) {
  const [added, setAdded] = useState(false);
  const { requireAuth } = useAuth();

  const handleAdd = () => {
    if (!requireAuth()) return;
    onAddToCart();
    setAdded(true);
    toast.success('Producto añadido al carrito 🛒');
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-zinc-950/90 px-4 py-3 backdrop-blur-2xl lg:static lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none"
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
    >
      <div className="mx-auto flex max-w-6xl items-center gap-3">
        {/* Precio (solo visible en móvil aquí, en desktop ya arriba) */}
        <div className="shrink-0 lg:hidden">
          <p className="text-lg font-black text-emerald-400">S/ {price.toFixed(2)}</p>
          {compareAtPrice && (
            <p className="text-xs text-white/35 line-through">S/ {compareAtPrice.toFixed(2)}</p>
          )}
        </div>

        <div className="flex flex-1 gap-2">
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={handleAdd}
            className="flex-1 rounded-xl border border-white/20 bg-white/5 py-3 text-sm font-bold text-white transition hover:bg-white/10"
          >
            {added ? '✓ Añadido' : '🛒 Añadir al carrito'}
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={() => { if (requireAuth()) onBuyNow(); }}
            disabled={stock === 0}
            className="flex-1 rounded-xl bg-gradient-to-r from-cyan-500 via-violet-500 to-fuchsia-500 py-3 text-sm font-bold text-white shadow-lg shadow-violet-500/30 disabled:opacity-40"
          >
            ⚡ Comprar ahora
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={() => { if (requireAuth()) onWhatsApp(); }}
            aria-label="Consultar por WhatsApp"
            className="grid w-12 shrink-0 place-items-center rounded-xl bg-[#25D366] text-xl text-white shadow-lg shadow-green-500/25"
          >
            💬
          </motion.button>
        </div>
      </div>

      {stock > 0 && stock <= 10 && (
        <p className="mx-auto mt-1.5 max-w-6xl text-center text-[11px] text-amber-400 lg:text-left">
          ⏳ Solo quedan {stock} unidades — coordina el pago con soporte por WhatsApp (+51 904 918 121)
        </p>
      )}
    </div>
  );
}
