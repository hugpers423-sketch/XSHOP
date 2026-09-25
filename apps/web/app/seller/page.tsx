"use client";

// Portal del Vendedor — métricas, productos y gestión de pedidos

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { api, searchProducts, type AuthUser, type ProductSummary } from "@/lib/api";
import { formatPrice, formatCount } from "@/lib/format";
import { LiveTips } from "@/components/seller/LiveTips";

interface SellerStats {
  revenue: number;
  orders: number;
  products: number;
  rating: number;
}

export default function SellerPortalPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [stats, setStats] = useState<SellerStats>({ revenue: 0, orders: 0, products: 0, rating: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const me = await api.get<{ user: AuthUser | null }>("/api/auth/me");
        if (!alive) return;
        setUser(me.user);

        const [prods, ordersRes] = await Promise.all([
          searchProducts({}),
          me.user
            ? api.get<{ data: Array<{ total: number }> }>(`/api/orders?sellerId=${me.user.id}&perPage=50`)
            : Promise.resolve({ data: [] as Array<{ total: number }> }),
        ]);

        if (!alive) return;
        setProducts(prods);
        const orders = ordersRes.data ?? [];
        setStats({
          revenue: orders.reduce((a, o) => a + Number(o.total ?? 0), 0),
          orders: orders.length,
          products: prods.length,
          rating: 4.8,
        });
      } catch {
        // BD caída o API no disponible: el portal muestra estados vacíos
        // sin romper la página ni dejar rechazos sin capturar en consola
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl animate-pulse px-4 py-8">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-white/5" />
          ))}
        </div>
      </main>
    );
  }

  const cards = [
    { label: "Ingresos", value: formatPrice(stats.revenue), emoji: "💰" },
    { label: "Pedidos", value: formatCount(stats.orders), emoji: "📦" },
    { label: "Productos", value: formatCount(stats.products), emoji: "🏷️" },
    { label: "Rating", value: stats.rating.toFixed(1), emoji: "⭐" },
  ];

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-white">🏪 Portal del vendedor</h1>
          {user && <p className="text-sm text-white/45">{user.email}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/seller/live/studio"
            className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-bold text-white transition hover:border-[#FF2D75]/50 hover:bg-white/10"
          >
            📡 Abrir estudio de live
          </Link>
          <Link
            href="/seller/products/new"
            className="rounded-xl bg-gradient-to-r from-[#FF2D75] to-[#7B5CFF] px-5 py-2.5 text-sm font-bold text-white"
          >
            + Nuevo producto
          </Link>
        </div>
      </div>

      {/* KPIs */}
      <section className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((c, i) => (
          <motion.div
            key={c.label}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="rounded-2xl border border-white/10 bg-white/5 p-5"
          >
            <span className="text-2xl">{c.emoji}</span>
            <p className="mt-2 text-2xl font-black text-white">{c.value}</p>
            <p className="text-xs text-white/45">{c.label}</p>
          </motion.div>
        ))}
      </section>

      {/* Tips para hacer live — resumen ejecutivo con CTA a la guía completa */}
      <LiveTips variant="compact" />

      {/* Productos */}
      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-white">Mis productos</h2>
          <span className="text-xs text-white/40">{products.length} activos</span>
        </div>

        {products.length === 0 ? (
          <div className="mt-4 rounded-3xl border border-dashed border-white/15 p-10 text-center">
            <p className="text-3xl">📦</p>
            <p className="mt-2 text-sm text-white/50">Publica tu primer producto para empezar a vender.</p>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {products.map((p) => (
              <Link
                key={p.id}
                href={`/products/${p.id}`}
                className="group overflow-hidden rounded-2xl border border-white/10 bg-white/5 transition hover:border-[#FF2D75]/40"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.image}
                  alt={p.title}
                  loading="lazy"
                  className="aspect-square w-full object-cover transition group-hover:scale-105"
                />
                <div className="p-3">
                  <p className="line-clamp-2 text-sm text-white/85">{p.title}</p>
                  <p className="mt-1 font-black text-white">{formatPrice(p.price)}</p>
                  <p className="mt-1 text-[11px] text-white/40">
                    ⭐ {p.rating.toFixed(1)} · {p.reviews} reseñas
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
