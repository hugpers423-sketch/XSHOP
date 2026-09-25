// apps/web/app/compra/page.tsx
// Pantalla «Iniciar compra» — proceso para AMBAS partes:
// - Comprador coordina el pago por WhatsApp con soporte
// - El pago Yape/Plin se coordina con soporte por WhatsApp
// - Soporte valida el comprobante y el vendedor recibe la orden para enviar
// Incluye: simulador interactivo del flujo, medios de pago vigentes
// y el mecanismo de TARJETA listo para activar (no se desarma nada).
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { useCartStore } from '@/lib/cart';
import { formatPrice } from '@/lib/format';
import { openWhatsAppCheckout, SUPPORT_PHONE } from '@/lib/whatsapp';
import { track } from '@/lib/analytics';
import { toast } from '@/components/ui/Toast';

const SHIPPING_COST = 15;

/**
 * orderId simulado — helper en module scope para que la regla
 * react-hooks/purity no marque impureza dentro del cuerpo del componente.
 */
function simOrderId(): string {
  return `SIM-${Date.now().toString(36).toUpperCase()}`;
}

type PaymentId = 'yape' | 'plin' | 'transfer' | 'cash';

type CreatedOrder = {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  paymentUrl?: string;
};

const PAYMENT_METHODS: ReadonlyArray<{ id: PaymentId; label: string; emoji: string; hint: string }> = [
  { id: 'yape', label: 'Yape', emoji: '🟣', hint: 'Envía el comprobante por WhatsApp' },
  { id: 'plin', label: 'Plin', emoji: '🔵', hint: 'Envía el comprobante por WhatsApp' },
  { id: 'transfer', label: 'Transferencia', emoji: '🏦', hint: 'Transferencia y comprobante por WhatsApp' },
  { id: 'cash', label: 'Contra entrega', emoji: '💵', hint: 'Pago al recibir el producto' },
];

// Pasos del protocolo (simulador)
const STEPS = [
  {
    icon: '🛍️',
    title: 'Orden iniciada',
    desc: 'El comprador pulsa «Iniciar compra». Aún no se transfiere dinero.',
    action: 'Simular pago del comprador',
    actor: 'comprador',
  },
  {
    icon: '💳',
    title: 'Pago enviado por WhatsApp',
    desc: 'El comprador envía Yape/Plin/transferencia al número de soporte y conserva el comprobante.',
    action: 'Validar pago con soporte',
    actor: 'xstore',
  },
  {
    icon: '🧾',
    title: 'Pago validado por soporte',
    desc: 'Soporte confirma el comprobante y el vendedor puede preparar el envío.',
    action: 'Simular envío del vendedor',
    actor: 'vendedor',
  },
  {
    icon: '🚚',
    title: 'Producto en camino',
    desc: 'El vendedor envía el pedido (24-48h) después de la validación del comprobante.',
    action: 'Confirmar entrega',
    actor: 'comprador',
  },
  {
    icon: '🎉',
    title: 'Venta culminada — orden completada',
    desc: 'El comprador confirma la entrega y el pedido queda completado. Fin del proceso.',
    action: '',
    actor: 'ambos',
  },
] as const;

const BUYER_TIMELINE = [
  ['1', 'Inicias la compra desde el catálogo o el carrito.'],
  ['2', 'Envías el pago por WhatsApp (Yape/Plin/transferencia) y guardas el comprobante.'],
  ['3', 'Soporte valida el comprobante y actualiza el estado del pedido.'],
  ['4', 'Recibes el producto y verificas que esté todo bien.'],
  ['5', 'Confirmas la entrega y el pedido queda completado. ✅'],
] as const;

const SELLER_TIMELINE = [
  ['1', 'Recibes la orden después de que soporte valida el pago.'],
  ['2', 'Empacas y envías el pedido en24-48h.'],
  ['3', 'El comprador verifica la entrega contigo.'],
  ['4', 'Actualizas el estado cuando entregues. ✅'],
] as const;

export default function CompraPage() {
  const router = useRouter();
  const items = useCartStore((s) => s.items);
  const clear = useCartStore((s) => s.clear);

  const [step, setStep] = useState(0);
  const [payment, setPayment] = useState<PaymentId>('yape');
  const [delivery, setDelivery] = useState<string | null>(null);
  const [createdOrder, setCreatedOrder] = useState<CreatedOrder | null>(null);
  const [orderLoading, setOrderLoading] = useState(false);

  const subtotal = items.reduce((acc, i) => acc + i.price * i.quantity, 0);
  const total = subtotal + (items.length > 0 ? SHIPPING_COST : 0);

  // Leer datos de entrega guardados en /checkout (solo en cliente).
  // Lectura diferida en timer: evita setState síncrono en el cuerpo del effect
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      try {
        const raw = sessionStorage.getItem('xstore-delivery');
        if (raw && !cancelled) {
          const parsed = JSON.parse(raw) as { address?: string; district?: string };
          if (parsed.address && parsed.district) {
            setDelivery(`${parsed.address} · ${parsed.district}`);
          }
        }
      } catch {
        // sessionStorage corrupto o indisponible — seguir sin datos de entrega
      }
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    const orderId = new URLSearchParams(window.location.search).get('order');
    if (!orderId) return;
    let cancelled = false;
    setOrderLoading(true);
    void api.get<{ data: CreatedOrder }>(`/api/orders?id=${encodeURIComponent(orderId)}`)
      .then((response) => {
        if (!cancelled) setCreatedOrder(response.data);
      })
      .catch(() => {
        if (!cancelled) toast.error('No se pudo cargar el pedido, pero el pago puede continuarse por WhatsApp.');
      })
      .finally(() => {
        if (!cancelled) setOrderLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  /** Avanzar un paso del simulador (state solo en handler — seguro) */
  function advance() {
    if (step >= STEPS.length - 1) return;
    const next = step + 1;
    setStep(next);
    toast.info(`Paso ${next}/${STEPS.length - 1}: ${STEPS[next].title}`);
    if (next === STEPS.length - 1) {
      track('purchase', { value: total, items: items.length, simulation: true });
      toast.success('🎉 Venta culminada — orden completada');
    }
  }

  /** Reiniciar la simulación */
  function reset() {
    setStep(0);
    toast.info('Simulación reiniciada');
  }

  /** Completar: vaciar carrito y volver al catálogo */
  function finish() {
    clear();
    toast.success('Carrito vaciado — simulación completada ✅');
    router.push('/catalogo');
  }

  /** Iniciar pago Yape/Plin mediante WhatsApp */
  function startWhatsAppPayment() {
    track('begin_checkout', { total, items: items.length, payment, source: 'compra' });
    if (createdOrder?.paymentUrl) {
      window.open(createdOrder.paymentUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    openWhatsAppCheckout({
      orderId: createdOrder?.orderNumber || simOrderId(),
      items: items.map((i) => ({ title: i.title, qty: i.quantity, price: i.price })),
      subtotal,
      shipping: items.length > 0 ? SHIPPING_COST : 0,
      total: createdOrder?.total ?? total,
      paymentMethod: payment,
    });
  }

  return (
    <main className="mx-auto max-w-5xl px-4 pb-24 pt-8 text-white">
      {/* ============ Encabezado ============ */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl border border-emerald-500/25 bg-gradient-to-r from-emerald-500/15 via-cyan-500/10 to-violet-500/15 p-6"
      >
        <span className="inline-flex items-center gap-2 rounded-full bg-black/40 px-3 py-1 text-[11px] font-bold text-emerald-300">
          🛡️ Compra protegida · proceso para ambas partes
        </span>
        <h1 className="mt-3 text-2xl font-black md:text-3xl">Iniciar compra</h1>
        <p className="mt-1 max-w-2xl text-sm text-white/65">
          Este es el proceso que verán <b className="text-white">comprador</b> y{' '}
          <b className="text-white">vendedor</b>. El pago se coordina por WhatsApp con soporte
          y el vendedor recibe la orden después de la validación del comprobante.
        </p>
      </motion.div>

      {orderLoading && (
        <p className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
          Cargando tu pedido persistido…
        </p>
      )}
      {createdOrder && (
        <section className="mt-4 rounded-3xl border border-emerald-400/25 bg-emerald-500/10 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-emerald-300">Pedido guardado</p>
              <h2 className="mt-1 font-mono text-xl font-black">{createdOrder.orderNumber}</h2>
              <p className="mt-1 text-sm text-white/60">Total validado en servidor: {formatPrice(createdOrder.total)}</p>
            </div>
            <span className="rounded-full bg-yellow-400/15 px-3 py-1 text-xs font-bold text-yellow-200">
              {createdOrder.status === 'PENDING' ? 'Pago pendiente' : createdOrder.status}
            </span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={startWhatsAppPayment}
              className="rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-black text-black transition hover:brightness-110"
            >
              💬 Pagar por WhatsApp · Yape
            </button>
            <Link
              href={`/orders/${createdOrder.id}`}
              className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-bold text-white/80 transition hover:bg-white/10"
            >
              Ver seguimiento
            </Link>
          </div>
          <p className="mt-3 text-xs text-white/45">
            El pedido es real y queda pendiente hasta que soporte confirme el comprobante. No se solicita tarjeta ni datos bancarios dentro de la app.
          </p>
        </section>
      )}

      {/* ============ Resumen del pedido ============ */}
      <section aria-label="Resumen de la compra" className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">🧾 Resumen</h2>
          <span className="text-xs text-white/45">{items.length} producto(s)</span>
        </div>

        {items.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-dashed border-white/15 p-5 text-center">
            <p className="text-sm text-white/55">Tu carrito está vacío — puedes ver el proceso igual.</p>
            <Link
              href="/catalogo"
              className="mt-3 inline-block rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm font-bold transition hover:bg-white/10"
            >
              🏷️ Explorar catálogo de simulación
            </Link>
          </div>
        ) : (
          <>
            <ul className="mt-3 space-y-2">
              {items.map((i) => (
                <li key={i.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/30 p-2.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={i.image}
                    alt={i.title}
                    loading="lazy"
                    className="h-11 w-11 rounded-lg object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-white/85">{i.title}</p>
                    <p className="text-xs text-white/45">
                      x{i.quantity} · {i.seller}
                    </p>
                  </div>
                  <span className="text-sm font-bold">{formatPrice(i.price * i.quantity)}</span>
                </li>
              ))}
            </ul>

            <dl className="mt-3 space-y-1.5 border-t border-white/10 pt-3 text-sm">
              <div className="flex justify-between text-white/60">
                <dt>Subtotal</dt>
                <dd>{formatPrice(subtotal)}</dd>
              </div>
              <div className="flex justify-between text-white/60">
                <dt>Envío</dt>
                <dd>{formatPrice(SHIPPING_COST)}</dd>
              </div>
              <div className="flex justify-between border-t border-white/10 pt-1.5 text-lg font-black">
                <dt>Total a pagar</dt>
                <dd className="text-emerald-400">{formatPrice(total)}</dd>
              </div>
            </dl>

            {delivery && (
              <p className="mt-2 rounded-xl bg-white/5 px-3 py-2 text-xs text-white/55">
                📍 Entrega: {delivery}
              </p>
            )}
          </>
        )}
      </section>

      {/* ============ Proceso para ambas partes ============ */}
      <section aria-label="Proceso para comprador y vendedor" className="mt-6 grid gap-4 md:grid-cols-2">
        {/* Comprador */}
        <motion.div
          initial={{ opacity: 0, x: -18 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-3xl border border-cyan-400/25 bg-cyan-500/5 p-5"
        >
          <h2 className="font-black text-cyan-300">🟦 Vista del comprador</h2>
          <ol className="mt-4 space-y-3">
            {BUYER_TIMELINE.map(([n, text]) => (
              <li key={n} className="flex gap-3 text-sm">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-cyan-400/20 text-xs font-black text-cyan-300">
                  {n}
                </span>
                <span className="text-white/70">{text}</span>
              </li>
            ))}
          </ol>
        </motion.div>

        {/* Vendedor */}
        <motion.div
          initial={{ opacity: 0, x: 18 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.12 }}
          className="rounded-3xl border border-violet-400/25 bg-violet-500/5 p-5"
        >
          <h2 className="font-black text-violet-300">🟪 Vista del vendedor</h2>
          <ol className="mt-4 space-y-3">
            {SELLER_TIMELINE.map(([n, text]) => (
              <li key={n} className="flex gap-3 text-sm">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-violet-400/20 text-xs font-black text-violet-300">
                  {n}
                </span>
                <span className="text-white/70">{text}</span>
              </li>
            ))}
          </ol>
        </motion.div>
      </section>

      {/* ============ Simulador interactivo del proceso ============ */}
      <section aria-label="Simulador del proceso" className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold">🧪 Simulador del proceso</h2>
          <span className="rounded-full bg-amber-500/15 px-3 py-1 text-[11px] font-bold text-amber-300">
            Paso {step}/{STEPS.length - 1}
          </span>
        </div>

        {/* Stepper visual */}
        <ol className="mt-4 space-y-2.5">
          {STEPS.map((s, i) => {
            const done = i < step;
            const active = i === step;
            return (
              <li
                key={s.title}
                className={`flex items-center gap-3 rounded-2xl border px-3.5 py-3 transition ${
                  active
                    ? 'border-emerald-400/50 bg-emerald-500/10'
                    : done
                      ? 'border-white/10 bg-white/5 opacity-75'
                      : 'border-white/5 bg-black/20 opacity-45'
                }`}
                aria-current={active ? 'step' : undefined}
              >
                <span
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-base ${
                    done ? 'bg-emerald-500/25' : active ? 'bg-emerald-500/30' : 'bg-white/5'
                  }`}
                >
                  {done ? '✅' : s.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{s.title}</p>
                  <p className="line-clamp-2 text-xs text-white/55">{s.desc}</p>
                </div>
                <span className="hidden shrink-0 rounded-full bg-black/40 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-white/50 sm:block">
                  {s.actor}
                </span>
              </li>
            );
          })}
        </ol>

        {/* Acciones del simulador */}
        <AnimatePresence mode="wait">
          {step < STEPS.length - 1 ? (
            <motion.button
              key="advance"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              onClick={advance}
              className="mt-4 w-full rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 py-3.5 text-sm font-black text-black transition hover:opacity-90 active:scale-[0.98]"
            >
              ▶ {STEPS[step].action}
            </motion.button>
          ) : (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-4 rounded-2xl border border-emerald-400/40 bg-emerald-500/10 p-4 text-center"
            >
              <p className="text-2xl">🎉</p>
              <p className="mt-1 text-sm font-black text-emerald-300">
                ¡Venta culminada! El pedido quedó completado.
              </p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <button
                  onClick={finish}
                  className="rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-black text-black transition hover:bg-emerald-400 active:scale-95"
                >
                  Vaciar carrito y volver al catálogo
                </button>
                <button
                  onClick={reset}
                  className="rounded-xl border border-white/20 bg-white/5 px-4 py-2.5 text-sm font-bold transition hover:bg-white/10 active:scale-95"
                >
                  🔄 Reiniciar simulación
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* ============ Pago coordinado por WhatsApp ============ */}
      <section aria-label="Pago por WhatsApp" className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5">
        <h2 className="font-bold">💳 Pago por WhatsApp</h2>
        <p className="mt-1 text-xs text-white/50">
          El comprador envía el pago al número de soporte y conserva el comprobante. Soporte valida
          el estado antes de que el vendedor envíe.
        </p>

        <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {PAYMENT_METHODS.map((m) => (
            <button
              key={m.id}
              onClick={() => setPayment(m.id)}
              aria-pressed={payment === m.id}
              className={`rounded-xl border px-3 py-3 text-sm font-semibold transition active:scale-95 ${
                payment === m.id
                  ? 'border-[#FF2D75] bg-[#FF2D75]/15 text-white'
                  : 'border-white/10 bg-white/5 text-white/60 hover:border-white/25'
              }`}
            >
              <span className="block text-xl">{m.emoji}</span>
              {m.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-white/45">
          {PAYMENT_METHODS.find((m) => m.id === payment)?.hint}
        </p>

        <button
          onClick={startWhatsAppPayment}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-[#25D366] py-3.5 text-sm font-black text-black transition hover:opacity-90 active:scale-[0.98]"
        >
          📲 Iniciar pago por WhatsApp
        </button>
        <p className="mt-2 text-center text-[11px] text-white/45">
          Soporte oficial: +{SUPPORT_PHONE} · el pago queda pendiente hasta su validación
        </p>
      </section>

      {/* ============ TARJETA — listo para activar (no desarmado) ============ */}
      <section
        aria-label="Pagos con tarjeta — listo para activar"
        className="mt-6 rounded-3xl border border-dashed border-violet-400/40 bg-violet-500/5 p-5"
      >
        <div className="flex flex-wrap items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-violet-500/40 to-fuchsia-600/40 text-xl">
            💳
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-bold text-violet-200">
              Pagos con tarjeta{' '}
              <span className="ml-1 rounded-full bg-violet-500/25 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-violet-300">
                listo para activar
              </span>
            </h2>
            <p className="text-xs text-white/55">
              El mecanismo de tarjeta permanece vigente en la plataforma — sin desarmar — junto a
              Yape, Plin y transferencia.
            </p>
          </div>
          <button
            type="button"
            disabled
            aria-disabled="true"
            title="Se activará al contar con los permisos correspondientes para aceptar tarjetas"
            className="cursor-not-allowed rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-bold text-white/40"
          >
            🔒 Próximamente
          </button>
        </div>

        <ul className="mt-4 grid gap-2 text-xs text-white/60 sm:grid-cols-2">
          <li className="rounded-xl bg-black/30 px-3 py-2.5">
            📜 Se activa cuando la plataforma obtenga los <b>permisos correspondientes</b> para
            aceptar pagos con tarjeta.
          </li>
          <li className="rounded-xl bg-black/30 px-3 py-2.5">
            👥 Pensado primero para <b>clientes y vendedores recurrentes</b> de la plataforma.
          </li>
          <li className="rounded-xl bg-black/30 px-3 py-2.5">
            🧩 El checkout ya está preparado: aparecerá aquí junto a los métodos actuales sin
            tocar el resto del flujo.
          </li>
          <li className="rounded-xl bg-black/30 px-3 py-2.5">
            🔒 Mientras tanto, el protocolo vigente (pago al medio de la página + liberación al
            culminar la venta) mantiene las ventas <b>100% confiables</b>.
          </li>
        </ul>
      </section>

      {/* ============ Enlaces de apoyo ============ */}
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link
          href="/catalogo"
          className="glass rounded-xl px-5 py-3 text-sm font-bold transition hover:bg-white/10"
        >
          🏷️ Volver al catálogo
        </Link>
        <Link
          href="/cart"
          className="glass rounded-xl px-5 py-3 text-sm font-bold transition hover:bg-white/10"
        >
          🛒 Ver carrito
        </Link>
        <Link
          href="/live"
          className="glass rounded-xl px-5 py-3 text-sm font-bold transition hover:bg-white/10"
        >
          📡 Ver Live Shopping
        </Link>
      </div>
    </main>
  );
}
