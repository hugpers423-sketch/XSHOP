"use client";

// Panel de Administración — métricas globales y moderación

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api, type AuthUser } from "@/lib/api";
import { formatCount, formatPrice } from "@/lib/format";

interface AdminMetrics {
  users: number;
  products: number;
  orders: number;
  gmv: number;
}

interface RecentOrder {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  createdAt: string;
  payment?: { status: string; method: string } | null;
}

export default function AdminDashboardPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [metrics, setMetrics] = useState<AdminMetrics>({ users: 0, products: 0, orders: 0, gmv: 0 });
  const [recent, setRecent] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  async function confirmPayment(id: string) {
    const response = await api.patch<{ data: RecentOrder }>("/api/orders", {
      id,
      paymentStatus: "COMPLETED",
      status: "CONFIRMED",
    });
    setRecent((current) => current.map((order) => order.id === id ? response.data : order));
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const me = await api.get<{ user: AuthUser | null }>("/api/auth/me");
        if (!alive) return;
        setUser(me.user);

        // Gate de rol en cliente (el middleware/route valida también en servidor)
        if (me.user?.role !== "ADMIN") {
          setDenied(true);
          return;
        }

        const [prods, ordersRes] = await Promise.all([
          api.get<{ meta: { total: number } }>("/api/products?perPage=1"),
          api.get<{ data: RecentOrder[]; meta: { total: number } }>("/api/orders?perPage=10"),
        ]);

        if (!alive) return;
        const orders = ordersRes.data ?? [];
        setRecent(orders);
        setMetrics({
          users: 0, // endpoint /api/admin/stats pendiente — evita query costoso en cliente
          products: prods.meta?.total ?? 0,
          orders: ordersRes.meta?.total ?? 0,
          gmv: orders.reduce((a, o) => a + Number(o.total ?? 0), 0),
        });
      } catch {
        if (alive) setDenied(true);
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
        <div className="h-10 w-64 rounded-xl bg-white/5" />
        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-white/5" />
          ))}
        </div>
      </main>
    );
  }

  if (denied) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-5xl">🛡️</p>
        <h1 className="mt-4 text-2xl font-black text-white">Acceso restringido</h1>
        <p className="mt-2 text-white/50">Esta sección es solo para administradores.</p>
      </main>
    );
  }

  const cards = [
    { label: "Usuarios", value: formatCount(metrics.users), emoji: "👥" },
    { label: "Productos", value: formatCount(metrics.products), emoji: "🏷️" },
    { label: "Pedidos", value: formatCount(metrics.orders), emoji: "📦" },
    { label: "GMV", value: formatPrice(metrics.gmv), emoji: "💰" },
  ];

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-white">📊 Panel de administración</h1>
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white/60">
          {user?.name}
        </span>
      </div>

      {/* KPIs globales */}
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

      {/* Últimos pedidos */}
      <section className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6">
        <h2 className="font-bold text-white">Últimos pedidos</h2>
        {recent.length === 0 ? (
          <p className="mt-4 text-sm text-white/45">Sin pedidos registrados.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs text-white/40">
                  <th className="pb-2 pr-4 font-semibold">Orden</th>
                  <th className="pb-2 pr-4 font-semibold">Estado</th>
                  <th className="pb-2 pr-4 font-semibold">Fecha</th>
                  <th className="pb-2 text-right font-semibold">Total</th>
                  <th className="pb-2 text-right font-semibold">Acción</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((o) => (
                  <tr key={o.id} className="border-b border-white/5 text-white/75">
                    <td className="py-3 pr-4 font-mono text-xs">{o.orderNumber}</td>
                    <td className="py-3 pr-4">
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-bold">
                        {o.status}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-xs text-white/45">
                      {new Date(o.createdAt).toLocaleDateString("es-PE")}
                    </td>
                    <td className="py-3 text-right font-bold text-white">{formatPrice(o.total)}</td>
                    <td className="py-3 text-right">
                      {o.payment?.status === 'PENDING' ? (
                        <button
                          type="button"
                          onClick={() => void confirmPayment(o.id)}
                          className="rounded-lg bg-emerald-400/15 px-2 py-1 text-[11px] font-bold text-emerald-300 hover:bg-emerald-400/25"
                        >
                          Confirmar Yape
                        </button>
                      ) : (
                        <span className="text-xs text-white/35">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
