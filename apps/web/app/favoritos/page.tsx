"use client";

// apps/web/app/favoritos/page.tsx
// Lista de deseos real (tabla WishlistItem). Requiere sesión: el middleware no
// protege esta ruta, así que la propia página lo comprueba y ofrece entrar.

import Link from 'next/link';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/auth-context';
import { useWishlist } from '@/lib/wishlist';

function formatPrice(value: number): string {
  return `S/ ${value.toFixed(2)}`;
}

export default function WishlistPage() {
  const { user } = useAuth();
  const { entries, loading, isSaved, toggle, pending } = useWishlist();

  if (!user) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-20 text-center">
        <span className="text-5xl" aria-hidden>🔖</span>
        <h1 className="mt-4 text-2xl font-black text-white">Tu lista de deseos</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-white/45">
          Inicia sesión para guardar productos y encontrarlos después en cualquier
          dispositivo.
        </p>
        <Link
          href="/login?next=/favoritos"
          className="mt-6 inline-block rounded-xl bg-gradient-to-r from-[#FF2D75] to-[#7B5CFF] px-5 py-3 text-sm font-black text-white"
        >
          Iniciar sesión
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 pb-24">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-white">🔖 Tu lista de deseos</h1>
          <p className="mt-1 text-sm text-white/45">
            {loading
              ? 'Cargando…'
              : entries.length === 0
                ? 'Todavía no has guardado nada'
                : `${entries.length} producto${entries.length === 1 ? '' : 's'} guardado${entries.length === 1 ? '' : 's'}`}
          </p>
        </div>
        <Link
          href="/catalogo"
          className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/10"
        >
          Seguir explorando
        </Link>
      </header>

      {entries.length === 0 ? (
        <div className="mt-10 rounded-3xl border border-dashed border-white/12 py-16 text-center">
          <p className="text-4xl" aria-hidden>🛍️</p>
          <p className="mt-3 text-sm font-bold text-white">Nada guardado todavía</p>
          <p className="mx-auto mt-1.5 max-w-sm text-xs text-white/40">
            Pulsa el marcador 🔖 en cualquier reel o producto para guardarlo aquí.
          </p>
        </div>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map((entry, index) => {
            const { product } = entry;
            const saved = isSaved(product.id);
            const busy = pending.has(product.id);
            return (
              <motion.li
                key={entry.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index, 6) * 0.04 }}
                className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5"
              >
                <Link href={`/products/${product.id}`} className="block p-4">
                  <div className="flex items-center gap-3">
                    <span className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-black/30 text-2xl">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={product.image} alt="" className="h-full w-full object-cover" loading="lazy" />
                    </span>
                    <div className="min-w-0">
                      <p className="line-clamp-2 text-sm font-bold text-white">{product.title}</p>
                      <p className="mt-1 text-base font-black text-emerald-400">
                        {product.price > 0 ? formatPrice(product.price) : '—'}
                      </p>
                      {product.compareAtPrice && product.compareAtPrice > product.price && (
                        <p className="text-[11px] text-white/35 line-through">
                          {formatPrice(product.compareAtPrice)}
                        </p>
                      )}
                      {product.seller && (
                        <p className="mt-0.5 truncate text-[11px] text-white/35">{product.seller}</p>
                      )}
                    </div>
                  </div>
                  {product.stock <= 5 && product.stock > 0 && (
                    <p className="mt-3 text-[11px] font-bold text-amber-300">
                      Quedan {product.stock} unidades
                    </p>
                  )}
                  {product.stock === 0 && (
                    <p className="mt-3 text-[11px] font-bold text-rose-300">Agotado</p>
                  )}
                </Link>

                <button
                  type="button"
                  onClick={() => void toggle(product.id, product.title)}
                  disabled={busy}
                  aria-label={saved ? 'Quitar de tu lista' : 'Guardar en tu lista'}
                  className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-zinc-950/70 text-base backdrop-blur transition hover:border-amber-300/50 disabled:opacity-40"
                >
                  {saved ? '🔖' : '📑'}
                </button>
              </motion.li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
