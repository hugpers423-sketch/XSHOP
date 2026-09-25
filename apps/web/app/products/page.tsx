"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { searchProducts } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import { track } from "@/lib/analytics";
import Skeleton from "@/components/ui/Skeleton";

type Sort = "relevancia" | "precio_asc" | "precio_desc" | "nuevo";

const CATEGORIES = ["Todos", "Tecnología", "Moda", "Hogar", "Belleza", "Deportes", "Auto"];

export default function ProductsPage() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("Todos");
  const [sort, setSort] = useState<Sort>("relevancia");
  const [maxPrice, setMaxPrice] = useState(5000);
  const [onlyFree, setOnlyFree] = useState(false);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Awaited<ReturnType<typeof searchProducts>>>([]);

  useEffect(() => {
    let alive = true;
    const t = setTimeout(async () => {
      // setState solo dentro del callback (regla react-hooks/set-state-in-effect)
      setLoading(true);
      const res = await searchProducts({ q, category: cat === "Todos" ? undefined : cat });
      if (!alive) return;
      setItems(res);
      setLoading(false);
      track("search", { query: q, category: cat, results: res.length });
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q, cat]);

  const visible = useMemo(() => {
    let list = items.filter((p) => p.price <= maxPrice);
    if (onlyFree) list = list.filter((p) => p.shipping === "Gratis");
    switch (sort) {
      case "precio_asc":
        return [...list].sort((a, b) => a.price - b.price);
      case "precio_desc":
        return [...list].sort((a, b) => b.price - a.price);
      case "nuevo":
        return [...list].sort((a, b) => Number(b.id > a.id) - Number(a.id > b.id));
      default:
        return list;
    }
  }, [items, sort, maxPrice, onlyFree]);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-24 pt-24 sm:px-6">
      <header className="mb-6">
        <h1 className="text-3xl font-black tracking-tight text-white">Catálogo</h1>
        <p className="mt-1 text-sm text-white/50">
          Millones de productos con envío a todo el Perú.
        </p>
      </header>

      {/* Barra de búsqueda */}
      <div className="sticky top-16 z-30 -mx-4 mb-5 bg-[#08080c]/80 px-4 py-3 backdrop-blur-xl">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar productos, marcas y vendedores…"
          aria-label="Buscar productos"
          className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[#FF2D75]/60 focus:bg-white/10"
        />

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Categorías">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              role="tab"
              aria-selected={cat === c}
              onClick={() => setCat(c)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                cat === c
                  ? "bg-gradient-to-r from-[#FF2D75] to-[#7C3AED] text-white"
                  : "border border-white/10 bg-white/5 text-white/60 hover:bg-white/10"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Filtros */}
      <div className="mb-6 flex flex-wrap items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-4">
        <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-xs text-white/50">
          Precio máximo: <span className="font-bold text-white">{formatPrice(maxPrice)}</span>
          <input
            type="range"
            min={10}
            max={5000}
            step={10}
            value={maxPrice}
            onChange={(e) => setMaxPrice(Number(e.target.value))}
            aria-label="Precio máximo"
            className="accent-[#FF2D75]"
          />
        </label>

        <label className="flex cursor-pointer items-center gap-2 text-xs text-white/60">
          <input
            type="checkbox"
            checked={onlyFree}
            onChange={(e) => setOnlyFree(e.target.checked)}
            className="accent-[#00E7A5]"
          />
          Envío gratis
        </label>

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          aria-label="Ordenar por"
          className="rounded-xl border border-white/10 bg-[#0d0d14] px-3 py-2 text-xs text-white/70 outline-none focus:border-[#FF2D75]/50"
        >
          <option value="relevancia">Más relevantes</option>
          <option value="nuevo">Más nuevos</option>
          <option value="precio_asc">Menor precio</option>
          <option value="precio_desc">Mayor precio</option>
        </select>
      </div>

      {/* Resultados */}
      {loading ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-2xl" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/15 p-12 text-center">
          <p className="text-4xl">🔍</p>
          <p className="mt-3 font-semibold text-white">Sin resultados</p>
          <p className="text-sm text-white/50">Prueba con otros filtros o palabras clave.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {visible.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.3) }}
            >
              <Link
                href={`/products/${p.id}`}
                className="group block overflow-hidden rounded-2xl border border-white/10 bg-white/5 transition hover:border-[#FF2D75]/40 hover:bg-white/10"
              >
                <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-[#12121a] to-[#1a1a26]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.image}
                    alt={p.title}
                    loading="lazy"
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                  {p.shipping === "Gratis" && (
                    <span className="absolute left-2 top-2 rounded-full bg-[#00E7A5]/90 px-2 py-0.5 text-[10px] font-bold text-black">
                      Envío gratis
                    </span>
                  )}
                </div>
                <div className="p-3">
                  <h2 className="line-clamp-2 text-sm font-medium text-white/90">{p.title}</h2>
                  <p className="mt-1 text-lg font-black text-white">{formatPrice(p.price)}</p>
                  <div className="mt-1 flex items-center justify-between text-[11px] text-white/45">
                    <span className="flex items-center gap-1">
                      ⭐ {p.rating.toFixed(1)} · {p.reviews}
                    </span>
                    <span>{p.seller}</span>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </main>
  );
}
