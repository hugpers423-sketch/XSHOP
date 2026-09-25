// apps/web/app/catalogo/page.tsx
// Catálogo de SIMULACIÓN — datos demo locales (no depende de BD).
// Permite probar el flujo completo: añadir al carrito → Iniciar compra →
// pantalla de proceso para ambas partes (/compra).
'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useCartStore } from '@/lib/cart';
import { formatPrice, emojiTile } from '@/lib/format';
import { track } from '@/lib/analytics';
import { toast } from '@/components/ui/Toast';
import { useAuth } from '@/lib/auth-context';

// ============================================================
// Datos demo del catálogo (fáciles de sustituir por GET /api/products)
// ============================================================

interface DemoProduct {
  id: string;
  title: string;
  price: number;
  compareAt?: number;
  category: 'moda' | 'tech' | 'hogar' | 'belleza' | 'gaming';
  emoji: string;
  gradient: string;
  rating: number;
  reviews: number;
  seller: string;
  sellerRating: number;
  sales: number;
}

const CATALOG: DemoProduct[] = [
  { id: 'c01', title: 'Audífonos Pro ANC', price: 149.9, compareAt: 249.9, category: 'tech', emoji: '🎧', gradient: 'from-indigo-500/40 to-violet-600/40', rating: 4.9, reviews: 1243, seller: 'AudioPerú', sellerRating: 4.9, sales: 1240 },
  { id: 'c02', title: 'Hoodie Oversize Premium', price: 79.9, compareAt: 129.9, category: 'moda', emoji: '🧥', gradient: 'from-rose-500/40 to-orange-500/40', rating: 4.8, reviews: 892, seller: 'ModaLima', sellerRating: 4.8, sales: 3120 },
  { id: 'c03', title: 'Smartwatch AMOLED 1.43"', price: 189.0, compareAt: 259.0, category: 'tech', emoji: '⌚', gradient: 'from-cyan-500/40 to-blue-600/40', rating: 4.7, reviews: 654, seller: 'TechStore Lima', sellerRating: 4.9, sales: 5410 },
  { id: 'c04', title: 'Lámpara LED ambiente', price: 59.9, category: 'hogar', emoji: '💡', gradient: 'from-amber-400/40 to-orange-500/40', rating: 4.6, reviews: 431, seller: 'HogarTotal', sellerRating: 4.7, sales: 980 },
  { id: 'c05', title: 'Mochila antirrobo Urban', price: 99.0, compareAt: 159.0, category: 'moda', emoji: '🎒', gradient: 'from-emerald-500/40 to-teal-600/40', rating: 4.9, reviews: 1102, seller: 'UrbanGear', sellerRating: 4.8, sales: 2210 },
  { id: 'c06', title: 'Perfumé Ambar Noir 100ml', price: 119.9, category: 'belleza', emoji: '🌙', gradient: 'from-fuchsia-500/40 to-pink-600/40', rating: 4.8, reviews: 765, seller: 'BellezaPE', sellerRating: 4.9, sales: 1870 },
  { id: 'c07', title: 'Teclado mecánico RGB', price: 169.0, compareAt: 219.0, category: 'gaming', emoji: '⌨️', gradient: 'from-violet-500/40 to-purple-700/40', rating: 4.8, reviews: 523, seller: 'GameZone', sellerRating: 4.7, sales: 760 },
  { id: 'c08', title: 'Silla gamer ergonómica', price: 599.0, compareAt: 749.0, category: 'gaming', emoji: '🪑', gradient: 'from-red-500/40 to-rose-700/40', rating: 4.7, reviews: 318, seller: 'GameZone', sellerRating: 4.7, sales: 760 },
  { id: 'c09', title: 'Set skincare facial', price: 89.9, category: 'belleza', emoji: '✨', gradient: 'from-pink-400/40 to-rose-500/40', rating: 4.9, reviews: 987, seller: 'GlowPerú', sellerRating: 4.9, sales: 4100 },
  { id: 'c10', title: 'Placa aromatizadora smart', price: 45.9, compareAt: 69.9, category: 'hogar', emoji: '🕯️', gradient: 'from-teal-400/40 to-emerald-600/40', rating: 4.5, reviews: 210, seller: 'HogarTotal', sellerRating: 4.7, sales: 980 },
  { id: 'c11', title: 'Camiseta oversize algodón', price: 39.9, category: 'moda', emoji: '👕', gradient: 'from-sky-400/40 to-blue-600/40', rating: 4.6, reviews: 1540, seller: 'ModaLima', sellerRating: 4.8, sales: 3120 },
  { id: 'c12', title: 'Parlante Bluetooth 360°', price: 129.9, compareAt: 179.9, category: 'tech', emoji: '🔊', gradient: 'from-cyan-400/40 to-violet-600/40', rating: 4.7, reviews: 845, seller: 'AudioPerú', sellerRating: 4.9, sales: 1240 },
];

const FILTERS = [
  { id: 'todos', label: 'Todos', icon: '🗂️' },
  { id: 'moda', label: 'Moda', icon: '👗' },
  { id: 'tech', label: 'Tecnología', icon: '📱' },
  { id: 'hogar', label: 'Hogar', icon: '🏠' },
  { id: 'belleza', label: 'Belleza', icon: '💄' },
  { id: 'gaming', label: 'Gaming', icon: '🎮' },
  { id: 'ofertas', label: 'Ofertas', icon: '⚡' },
] as const;

type FilterId = (typeof FILTERS)[number]['id'];

// ============================================================
// Tarjeta de producto del catálogo
// ============================================================

function CatalogCard({ p, index }: { p: DemoProduct; index: number }) {
  const router = useRouter();
  const items = useCartStore((s) => s.items);
  const addItem = useCartStore((s) => s.addItem);
  const { requireAuth } = useAuth();

  const inCart = items.some((i) => i.productId === p.id);
  const discount = p.compareAt ? Math.round((1 - p.price / p.compareAt) * 100) : 0;

  /** Añadir al carrito con toast de confirmación */
  function addToCart() {
    if (!requireAuth()) return;
    addItem({
      productId: p.id,
      title: p.title,
      price: p.price,
      seller: p.seller,
      image: emojiTile(p.emoji),
    });
    track('add_to_cart', { productId: p.id, price: p.price, qty: 1, source: 'catalogo' });
    toast.success(`"${p.title}" añadido al carrito 🛒`);
  }

  /** Botón principal: Iniciar compra → pantalla de proceso para ambas partes */
  function startPurchase() {
    if (!requireAuth()) return;
    if (!inCart) {
      addItem({
        productId: p.id,
        title: p.title,
        price: p.price,
        seller: p.seller,
        image: emojiTile(p.emoji),
      });
    }
    track('begin_checkout', { productId: p.id, value: p.price, source: 'catalogo' });
    toast.info('Iniciando compra segura… 🛡️');
    router.push('/compra');
  }

  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.05, 0.4), type: 'spring', damping: 22 }}
      className="group overflow-hidden rounded-3xl border border-white/10 bg-white/5 transition hover:border-[#FF2D75]/40"
    >
      {/* Tile visual del producto (sin assets externos) */}
      <div className={`relative grid aspect-square place-items-center bg-gradient-to-br ${p.gradient}`}>
        <span className="text-6xl transition duration-500 group-hover:scale-110 group-hover:-rotate-6">
          {p.emoji}
        </span>
        {discount > 0 && (
          <span className="absolute left-2.5 top-2.5 rounded-full bg-[#FF2D75] px-2 py-0.5 text-[10px] font-black text-white">
            -{discount}%
          </span>
        )}
        {inCart && (
          <span className="absolute right-2.5 top-2.5 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white">
            ✓ en carrito
          </span>
        )}
      </div>

      <div className="p-4">
        <h2 className="line-clamp-2 text-sm font-bold text-white">{p.title}</h2>

        {/* Reputación del vendedor (verificada) */}
        <p className="mt-1 flex items-center gap-1 text-[11px] text-white/55">
          🏪 {p.seller}
          <span className="rounded bg-emerald-500/20 px-1 font-bold text-emerald-300">✓</span>
          <span className="text-white/40">· ⭐ {p.sellerRating.toFixed(1)}</span>
        </p>

        <p className="mt-0.5 text-[11px] text-white/40">
          ⭐ {p.rating.toFixed(1)} · {p.reviews} reseñas · {p.sales} ventas
        </p>

        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-lg font-black text-white">{formatPrice(p.price)}</span>
          {p.compareAt && (
            <span className="text-xs text-white/35 line-through">{formatPrice(p.compareAt)}</span>
          )}
        </div>

        {/* Acciones: carrito + Iniciar compra */}
        <div className="mt-3 flex gap-2">
          <button
            onClick={addToCart}
            aria-label={`Añadir ${p.title} al carrito`}
            className="rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm transition hover:border-white/30 active:scale-95"
          >
            🛒
          </button>
          <button
            onClick={startPurchase}
            aria-label={`Iniciar compra de ${p.title}`}
            className="flex-1 rounded-xl bg-gradient-to-r from-[#FF2D75] to-[#7B5CFF] py-2.5 text-sm font-black text-white transition hover:opacity-90 active:scale-95"
          >
            Iniciar compra
          </button>
        </div>
      </div>
    </motion.article>
  );
}

// ============================================================
// Página del catálogo
// ============================================================

export default function CatalogoPage() {
  const [filter, setFilter] = useState<FilterId>('todos');
  const cartCount = useCartStore((s) => s.items.reduce((acc, i) => acc + i.quantity, 0));

  const products = useMemo(() => {
    if (filter === 'todos') return CATALOG;
    if (filter === 'ofertas') return CATALOG.filter((p) => p.compareAt !== undefined);
    return CATALOG.filter((p) => p.category === filter);
  }, [filter]);

  return (
    <main className="mx-auto max-w-6xl px-4 pb-24 pt-8 text-white">
      {/* Encabezado */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">🏷️ Catálogo X-STORE</h1>
          <p className="text-sm text-white/50">
            {products.length} productos · {cartCount} en tu carrito
          </p>
        </div>
        <span className="glass rounded-full px-3 py-1 text-[11px] font-bold text-amber-300">
          🧪 Entorno de simulación — sin cobros reales
        </span>
      </div>

      {/* Banner del protocolo de pago vigente */}
      <div className="mt-4 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm text-emerald-200">
        <b>🔒 Protocolo de pago vigente:</b> el comprador envía el pago al medio de pago de la
        página y el vendedor <b>solo cobra al culminar la venta</b>. Botón{' '}
        <b>«Iniciar compra»</b> → pantalla de proceso para ambas partes.
      </div>

      {/* Filtros */}
      <div className="scrollbar-none mt-5 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Filtrar categorías">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            role="tab"
            aria-selected={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition active:scale-95 ${
              filter === f.id
                ? 'border-transparent bg-gradient-to-r from-[#FF2D75] to-[#7B5CFF] text-white'
                : 'border-white/15 bg-white/5 text-white/60 hover:border-white/30 hover:text-white'
            }`}
          >
            {f.icon} {f.label}
          </button>
        ))}
      </div>

      {/* Grid de productos */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {products.map((p, i) => (
          <CatalogCard key={p.id} p={p} index={i} />
        ))}
      </div>

      {products.length === 0 && (
        <p className="mt-10 text-center text-sm text-white/45">
          No hay productos en esta categoría.
        </p>
      )}

      {/* CTA inferior */}
      <div className="mt-10 rounded-3xl border border-white/10 bg-white/5 p-6 text-center">
        <p className="text-sm text-white/60">
          ¿Listo para probar el flujo completo de compra protegida?
        </p>
        <a
          href="/compra"
          className="mt-3 inline-block rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-6 py-3 text-sm font-black text-black transition hover:opacity-90 active:scale-95"
        >
          🛡️ Ver proceso de compra seguro
        </a>
      </div>
    </main>
  );
}
