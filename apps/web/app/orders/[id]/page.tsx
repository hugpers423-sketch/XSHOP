"use client";

// Detalle de pedido — timeline de estado + pago Yape vía WhatsApp

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import { openWhatsAppSupport } from "@/lib/whatsapp";

interface OrderDetail {
  id: string;
  orderNumber: string;
  status: string;
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
  shippingAddress: string;
  district?: string;
  city?: string;
  notes?: string;
  createdAt: string;
  items: Array<{ id: string; title: string; price: number; quantity: number }>;
  statusHistory?: Array<{ status: string; note?: string; createdAt: string }>;
  paymentUrl?: string;
  payment?: { method: string; status: string; reference?: string | null } | null;
}

const FLOW = ["PENDING", "CONFIRMED", "SHIPPED", "DELIVERED"] as const;

function openOrderPayment(order: OrderDetail): void {
  if (order.paymentUrl) {
    window.open(order.paymentUrl, "_blank", "noopener,noreferrer");
    return;
  }
  openWhatsAppSupport();
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await api.get<{ data: OrderDetail }>(`/api/orders?id=${encodeURIComponent(id || '')}`);
        const found = res.data ?? null;
        if (alive) setOrder(found);
        if (!found && alive) setError("Pedido no encontrado");
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : "Error al cargar");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl animate-pulse px-4 py-8">
        <div className="h-10 w-2/3 rounded-xl bg-white/5" />
        <div className="mt-6 h-40 rounded-3xl bg-white/5" />
      </main>
    );
  }

  if (!order) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-4xl">🔍</p>
        <p className="mt-3 font-semibold text-white">{error || "Pedido no encontrado"}</p>
        <Link href="/orders" className="mt-4 inline-block text-sm text-[#FF2D75] hover:underline">
          Volver a mis pedidos
        </Link>
      </main>
    );
  }

  const currentIdx = FLOW.indexOf(order.status as (typeof FLOW)[number]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="font-mono text-xl font-black text-white">{order.orderNumber}</h1>
        <span className="text-xs text-white/40">
          {new Date(order.createdAt).toLocaleDateString("es-PE")}
        </span>
      </div>

      {/* Timeline de estado */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6"
      >
        <ol className="flex items-center">
          {FLOW.map((step, i) => {
            const done = currentIdx >= i && currentIdx !== -1;
            const labels: Record<string, string> = {
              PENDING: "Creado",
              PAID: "Pagado",
              SHIPPED: "Enviado",
              DELIVERED: "Entregado",
            };
            return (
              <li key={step} className="flex flex-1 items-center last:flex-none">
                <div className="flex flex-col items-center gap-1.5">
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-black transition ${
                      done
                        ? "bg-gradient-to-br from-[#FF2D75] to-[#7B5CFF] text-white"
                        : "border border-white/15 bg-white/5 text-white/40"
                    }`}
                  >
                    {done ? "✓" : i + 1}
                  </span>
                  <span className={`text-[10px] ${done ? "text-white" : "text-white/40"}`}>
                    {labels[step]}
                  </span>
                </div>
                {i < FLOW.length - 1 && (
                  <div
                    className={`mx-1 mb-5 h-0.5 flex-1 rounded ${
                      currentIdx > i ? "bg-[#FF2D75]" : "bg-white/10"
                    }`}
                  />
                )}
              </li>
            );
          })}
        </ol>

        {order.status === "PENDING" && (
          <div className="mt-5 rounded-2xl border border-[#FFD166]/25 bg-[#FFD166]/10 p-4">
            <p className="text-sm font-semibold text-[#FFD166]">
              ⏳ Pendiente de pago — completa el pago por WhatsApp y soporte validará el comprobante.
            </p>
            <button
              onClick={() => openOrderPayment(order)}
              className="mt-3 w-full rounded-xl bg-gradient-to-r from-[#00E7A5] to-[#00B4D8] py-3 text-sm font-black text-black"
            >
              💬 Completar pago con soporte
            </button>
          </div>
        )}
      </motion.section>

      {/* Artículos */}
      <section className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6">
        <h2 className="font-bold text-white">Artículos</h2>
        <ul className="mt-4 divide-y divide-white/10">
          {order.items.map((it) => (
            <li key={it.id} className="flex items-center justify-between py-3">
              <div className="min-w-0">
                <p className="truncate text-sm text-white/85">{it.title}</p>
                <p className="text-xs text-white/40">x{it.quantity}</p>
              </div>
              <span className="font-bold text-white">{formatPrice(it.price * it.quantity)}</span>
            </li>
          ))}
        </ul>

        <dl className="mt-4 space-y-2 border-t border-white/10 pt-4 text-sm">
          <div className="flex justify-between text-white/60">
            <dt>Subtotal</dt>
            <dd>{formatPrice(order.subtotal)}</dd>
          </div>
          {order.discount > 0 && (
            <div className="flex justify-between text-[#00E7A5]">
              <dt>Descuento</dt>
              <dd>-{formatPrice(order.discount)}</dd>
            </div>
          )}
          <div className="flex justify-between text-white/60">
            <dt>Envío</dt>
            <dd>{formatPrice(order.shipping)}</dd>
          </div>
          <div className="flex justify-between border-t border-white/10 pt-2 text-lg font-black text-white">
            <dt>Total</dt>
            <dd>{formatPrice(order.total)}</dd>
          </div>
        </dl>
      </section>

      {/* Dirección */}
      <section className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6 text-sm">
        <h2 className="font-bold text-white">📍 Entrega</h2>
        <p className="mt-2 text-white/60">
          {order.shippingAddress}
          {order.district ? `, ${order.district}` : ""}
          {order.city ? ` — ${order.city}` : ""}
        </p>
        {order.notes && <p className="mt-2 text-white/40">Nota: {order.notes}</p>}
      </section>
    </main>
  );
}
