"use client";

// Página de Checkout — Dirección de envío + pago Yape coordinado por WhatsApp

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { useCartStore } from "@/lib/cart";
import { formatPrice } from "@/lib/format";
import { track } from "@/lib/analytics";

const SHIPPING_COST = 15;
const PAYMENT_METHODS = [
  { id: "yape", label: "Yape", emoji: "🟣" },
  { id: "plin", label: "Plin", emoji: "🔵" },
  { id: "transfer", label: "Transferencia", emoji: "🏦" },
  { id: "cash", label: "Contra entrega", emoji: "💵" },
] as const;

type PaymentId = (typeof PAYMENT_METHODS)[number]["id"];

export default function CheckoutPage() {
  const router = useRouter();
  const items = useCartStore((s) => s.items);

  const [address, setAddress] = useState("");
  const [district, setDistrict] = useState("");
  const [city, setCity] = useState("Lima");
  const [notes, setNotes] = useState("");
  const [payment, setPayment] = useState<PaymentId>("yape");
  const [coupon, setCoupon] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const subtotal = useMemo(() => items.reduce((acc, i) => acc + i.price * i.quantity, 0), [items]);
  const discount = appliedCoupon === "XSTORE10" ? subtotal * 0.1 : 0;
  const total = subtotal - discount + SHIPPING_COST;

  function applyCoupon() {
    // Cupón demo — en producción validar contra API
    setAppliedCoupon(coupon.trim().toUpperCase() === "XSTORE10" ? "XSTORE10" : null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    // Validación cliente (el servidor re-valida todo)
    if (address.trim().length < 5 || district.trim().length < 2) {
      setError("Completa la dirección y el distrito.");
      return;
    }
    if (items.length === 0) {
      setError("Tu carrito está vacío.");
      return;
    }

    setSubmitting(true);
    try {
      track("begin_checkout", { total, items: items.length, payment });
      const storageKey = "xstore-checkout-idempotency";
      let idempotencyKey = "";
      try {
        idempotencyKey = sessionStorage.getItem(storageKey) || crypto.randomUUID();
        sessionStorage.setItem(storageKey, idempotencyKey);
      } catch {
        idempotencyKey = crypto.randomUUID();
      }

      const response = await api.post<{ data: { id: string; orderNumber: string; paymentUrl?: string } }>("/api/orders", {
        shippingAddress: address.trim(),
        district: district.trim(),
        city: city.trim(),
        notes: notes.trim(),
        paymentMethod: payment,
        idempotencyKey,
        items: items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
      });

      try {
        sessionStorage.setItem("xstore-order", JSON.stringify(response.data));
        sessionStorage.setItem("xstore-delivery", JSON.stringify({
          address: address.trim(),
          district: district.trim(),
          city: city.trim(),
        }));
        sessionStorage.removeItem(storageKey);
      } catch {
        // La orden ya está persistida; si sessionStorage falla, el usuario
        // puede recuperarla desde /orders.
      }
      router.push(`/compra?order=${encodeURIComponent(response.data.id)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el pedido.");
    } finally {
      setSubmitting(false);
    }
  }

  // Carrito vacío
  if (items.length === 0) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-5xl">🛒</p>
        <h1 className="mt-4 text-2xl font-black text-white">Tu carrito está vacío</h1>
        <p className="mt-2 text-white/50">Agrega productos antes de finalizar la compra.</p>
        <Link
          href="/products"
          className="mt-6 inline-block rounded-xl bg-gradient-to-r from-[#FF2D75] to-[#7B5CFF] px-6 py-3 font-bold text-white"
        >
          Explorar productos
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 pb-28">
      <h1 className="text-2xl font-black text-white">Finalizar compra</h1>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* Formulario de envío */}
        <motion.form
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={onSubmit}
          className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-6"
        >
          <h2 className="font-bold text-white">📍 Dirección de entrega</h2>

          <label className="block">
            <span className="text-sm text-white/60">Dirección</span>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Av. Los Olivos 123, depto 4B"
              maxLength={200}
              required
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white placeholder-white/30 outline-none focus:border-[#FF2D75]"
            />
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-sm text-white/60">Distrito</span>
              <input
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                placeholder="Los Olivos"
                maxLength={80}
                required
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white placeholder-white/30 outline-none focus:border-[#FF2D75]"
              />
            </label>
            <label className="block">
              <span className="text-sm text-white/60">Ciudad</span>
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Lima"
                maxLength={80}
                required
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white placeholder-white/30 outline-none focus:border-[#FF2D75]"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-sm text-white/60">Notas (opcional)</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Referencias de entrega, horario preferido…"
              maxLength={500}
              rows={3}
              className="mt-1 w-full resize-none rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white placeholder-white/30 outline-none focus:border-[#FF2D75]"
            />
          </label>

          <div>
            <h2 className="font-bold text-white">💳 Método de pago</h2>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setPayment(m.id)}
                  className={`rounded-xl border px-3 py-3 text-sm font-semibold transition ${
                    payment === m.id
                      ? "border-[#FF2D75] bg-[#FF2D75]/15 text-white"
                      : "border-white/10 bg-white/5 text-white/60 hover:border-white/25"
                  }`}
                >
                  <span className="block text-xl">{m.emoji}</span>
                  {m.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-white/40">
              🧾 Pago Yape/Plin por WhatsApp: soporte valida el comprobante antes de enviar.
            </p>
          </div>

          {error && (
            <p role="alert" className="rounded-xl bg-red-500/15 px-4 py-3 text-sm text-red-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-gradient-to-r from-[#FF2D75] to-[#7B5CFF] py-4 font-black text-white transition hover:opacity-90 active:scale-95 disabled:cursor-wait disabled:opacity-60"
          >
            {submitting ? "Creando pedido…" : `🛡️ Iniciar compra · ${formatPrice(total)}`}
          </button>
          <p className="text-center text-xs text-white/45">
            Al iniciar, verás el proceso para comprador y vendedor. El pago se coordina con
            soporte por WhatsApp y el vendedor recibe la orden después de la validación.
          </p>
        </motion.form>

        {/* Resumen del pedido */}
        <motion.aside
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="h-fit rounded-3xl border border-white/10 bg-white/5 p-6"
        >
          <h2 className="font-bold text-white">Resumen</h2>

          <ul className="mt-4 space-y-3">
            {items.map((i) => (
              <li key={i.id} className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={i.image}
                  alt={i.title}
                  className="h-12 w-12 rounded-lg object-cover"
                  loading="lazy"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-white/80">{i.title}</p>
                  <p className="text-xs text-white/40">x{i.quantity}</p>
                </div>
                <span className="text-sm font-bold text-white">
                  {formatPrice(i.price * i.quantity)}
                </span>
              </li>
            ))}
          </ul>

          {/* Cupón */}
          <div className="mt-5 flex gap-2">
            <input
              value={coupon}
              onChange={(e) => setCoupon(e.target.value)}
              placeholder="Cupón (XSTORE10)"
              maxLength={20}
              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-[#7B5CFF]"
            />
            <button
              type="button"
              onClick={applyCoupon}
              className="rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-white/70 hover:border-white/30"
            >
              Aplicar
            </button>
          </div>

          <dl className="mt-5 space-y-2 border-t border-white/10 pt-4 text-sm">
            <div className="flex justify-between text-white/60">
              <dt>Subtotal</dt>
              <dd>{formatPrice(subtotal)}</dd>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-[#00E7A5]">
                <dt>Descuento {appliedCoupon}</dt>
                <dd>-{formatPrice(discount)}</dd>
              </div>
            )}
            <div className="flex justify-between text-white/60">
              <dt>Envío</dt>
              <dd>{formatPrice(SHIPPING_COST)}</dd>
            </div>
            <div className="flex justify-between border-t border-white/10 pt-2 text-lg font-black text-white">
              <dt>Total</dt>
              <dd>{formatPrice(total)}</dd>
            </div>
          </dl>
        </motion.aside>
      </div>
    </main>
  );
}
