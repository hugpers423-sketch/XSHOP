// apps/web/components/cart/CartCheckout.tsx
// Carrito integrado al store global (Zustand + localStorage) —
// el mismo que alimenta el badge del Header y el catálogo de simulación.
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { IMG_FALLBACK } from '@/lib/format';
import { useCartStore } from '@/lib/cart';

type PaymentMethod = 'yape' | 'plin' | 'cash';

export default function CartCheckout() {
  const router = useRouter();
  const items = useCartStore((s) => s.items);
  const removeItem = useCartStore((s) => s.removeItem);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('yape');

  // Calcular total
  const subtotal = items.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const shipping = subtotal > 0 ? 15.0 : 0.0;
  const total = subtotal + shipping;

  /**
   * Botón principal «Iniciar compra»:
   * redirige a la pantalla de proceso para ambas partes (/compra)
   * donde se explica y simula el pago al medio de la página y la
   * liberación de fondos al culminar la venta.
   */
  function startPurchase() {
    if (items.length === 0) return;
    router.push('/compra');
  }

  return (
    <div className="flex min-h-screen w-full justify-center bg-zinc-950 p-4 text-white md:p-8">
      <div className="grid w-full max-w-4xl grid-cols-1 gap-6 md:grid-cols-3">
        {/* Listado de Productos en el Carrito */}
        <div className="space-y-4 md:col-span-2">
          <h1 className="flex items-center gap-2 border-b border-zinc-800 pb-3 text-2xl font-black tracking-wide">
            🛒 Tu Carrito de Compras{' '}
            <span className="text-sm font-normal text-zinc-400">({items.length} productos)</span>
          </h1>

          {items.length === 0 ? (
            <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/50 p-10 text-center">
              <p className="text-4xl">🛒</p>
              <p className="mt-3 text-zinc-400">Tu carrito está vacío.</p>
              <p className="mt-1 text-sm text-zinc-500">
                Explora el catálogo de simulación y añade productos.
              </p>
              <Link
                href="/catalogo"
                className="mt-5 inline-block rounded-xl bg-gradient-to-r from-[#FF2D75] to-[#7B5CFF] px-6 py-3 font-bold text-white transition hover:opacity-90 active:scale-95"
              >
                🏷️ Explorar catálogo
              </Link>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="flex items-center space-x-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-4 shadow-lg"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.image}
                  alt={item.title}
                  loading="lazy"
                  onError={(e) => {
                    // Nunca mostrar imagen rota: caer a tile SVG genérico
                    e.currentTarget.src = IMG_FALLBACK;
                  }}
                  className="h-20 w-20 rounded-xl border border-zinc-700 object-cover"
                />
                <div className="flex-1">
                  <span className="text-xs font-semibold text-cyan-400">
                    Vendido por {item.seller}
                  </span>
                  <h3 className="line-clamp-1 text-sm font-semibold">{item.title}</h3>
                  <p className="mt-1 font-bold text-green-400">S/ {item.price.toFixed(2)}</p>
                </div>
                <div className="flex flex-col items-end space-y-2">
                  <button
                    onClick={() => removeItem(item.id)}
                    className="text-xs text-zinc-500 hover:text-red-400"
                  >
                    Eliminar
                  </button>
                  <div className="flex items-center space-x-2 rounded-lg bg-zinc-800 p-1">
                    <button
                      onClick={() => updateQuantity(item.id, -1)}
                      aria-label={`Reducir cantidad de ${item.title}`}
                      className="rounded px-2 py-0.5 text-zinc-300 hover:bg-zinc-700"
                    >
                      -
                    </button>
                    <span className="w-4 text-center text-sm font-bold">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.id, 1)}
                      aria-label={`Aumentar cantidad de ${item.title}`}
                      className="rounded px-2 py-0.5 text-zinc-300 hover:bg-zinc-700"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Resumen de Compra y Pago */}
        <div className="h-fit space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-xl">
          <h2 className="border-b border-zinc-800 pb-3 text-lg font-bold">Resumen de Pago</h2>

          <div className="space-y-2 text-sm text-zinc-300">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>S/ {subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Envío estimado</span>
              <span>S/ {shipping.toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-t border-zinc-800 pt-2 text-base font-black text-white">
              <span>Total a pagar</span>
              <span className="text-green-400">S/ {total.toFixed(2)}</span>
            </div>
          </div>

          <div className="pt-2">
            <label className="mb-2 block text-xs font-semibold text-zinc-400">Método de Pago</label>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { key: 'yape', label: 'Yape' },
                  { key: 'plin', label: 'Plin' },
                  { key: 'cash', label: 'Efectivo' },
                ] as const
              ).map((m) => (
                <button
                  key={m.key}
                  onClick={() => setPaymentMethod(m.key)}
                  aria-pressed={paymentMethod === m.key}
                  className={`rounded-xl border py-2 text-xs font-bold transition ${
                    paymentMethod === m.key
                      ? 'border-cyan-500 bg-cyan-500/20 text-cyan-400'
                      : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-500'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Botón principal: Iniciar compra → pantalla de proceso para ambas partes */}
          <button
            onClick={startPurchase}
            disabled={items.length === 0}
            className="mt-4 flex w-full items-center justify-center space-x-2 rounded-xl bg-gradient-to-r from-yellow-400 to-amber-500 py-3.5 font-extrabold text-black shadow-lg transition active:scale-95 disabled:opacity-50 hover:from-yellow-300 hover:to-amber-400"
          >
            <span>🛡️ Iniciar compra</span>
          </button>

          <p className="text-center text-[11px] leading-relaxed text-zinc-500">
            El pago va al medio de pago de la página y se libera al vendedor
            <br />
            solo al culminar la venta · Soporte: +51 904 918 121
          </p>
        </div>
      </div>
    </div>
  );
}
