"use client";

// Lista de pedidos del usuario autenticado

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { api, type AuthUser } from "@/lib/api";
import { formatPrice } from "@/lib/format";

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  createdAt: string;
  items: Array<{ title: string; quantity: number }>;
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "Pago pendiente", cls: "bg-yellow-500/15 text-yellow-300" },
  CONFIRMED: { label: "Pago confirmado", cls: "bg-blue-500/15 text-blue-300" },
  PROCESSING: { label: "En preparación", cls: "bg-cyan-500/15 text-cyan-300" },
  SHIPPED: { label: "Enviado", cls: "bg-violet-500/15 text-violet-300" },
  DELIVERED: { label: "Entregado", cls: "bg-[#00E7A5]/15 text-[#00E7A5]" },
  CANCELLED: { label: "Cancelado", cls: "bg-red-500/15 text-red-300" },
  DISPUTED: { label: "En disputa", cls: "bg-orange-500/15 text-orange-300" },
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const me = await api.get<{ user: AuthUser | null }>("/api/auth/me");
        if (!me.user || !alive) return;
        const res = await api.get<{ data: Order[] }>(`/api/orders?buyerId=${me.user.id}`);
        if (alive) setOrders(res.data ?? []);
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
      <main className="mx-auto max-w-3xl animate-pulse px-4 py-8">
        {[0, 1, 2].map((i) => (
          <div key={i} className="mb-3 h-24 rounded-2xl bg-white/5" />
        ))}
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 pb-24">
      <h1 className="text-2xl font-black text-white">📦 Mis pedidos</h1>

      {orders.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-dashed border-white/15 p-12 text-center">
          <p className="text-4xl">🧾</p>
          <p className="mt-3 font-semibold text-white">Sin pedidos aún</p>
          <Link
            href="/products"
            className="mt-4 inline-block rounded-xl bg-gradient-to-r from-[#FF2D75] to-[#7B5CFF] px-5 py-2.5 text-sm font-bold text-white"
          >
            Explorar productos
          </Link>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {orders.map((o, i) => {
            const st = STATUS_LABEL[o.status] ?? { label: o.status, cls: "bg-white/10 text-white/70" };
            return (
              <motion.li
                key={o.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.04, 0.3) }}
              >
                <Link
                  href={`/orders/${o.id}`}
                  className="block rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-white/25"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-bold text-white">{o.orderNumber}</span>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${st.cls}`}>
                      {st.label}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-1 text-sm text-white/50">
                    {o.items.map((it) => `${it.title} x${it.quantity}`).join(" · ")}
                  </p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs text-white/35">
                      {new Date(o.createdAt).toLocaleDateString("es-PE", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                    <span className="font-black text-white">{formatPrice(o.total)}</span>
                  </div>
                </Link>
              </motion.li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
