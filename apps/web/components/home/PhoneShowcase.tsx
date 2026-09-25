// apps/web/components/home/PhoneShowcase.tsx
// Silueta de celular en el landing con demo animada de la plataforma:
//5 escenas rotativas que muestran TODO lo que hace la app —
// (1) Live Shopping + juegos, (2) Feed Reels con video y audio,
// (3) Marketplace con mapa cerca de ti, (4) Pago protegido Escrow,
// (5) Reputación, chat y X-Coins.
// Ritmo calmado:8 s por escena + barra de progreso + pausa al
// pasar el cursor (para leer sin prisa). Respeta prefers-reduced-motion.
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';

// ============================================================
// Datos de las escenas (demo visual — sin assets externos)
// ============================================================

const SCENES = [
  { id: 'live', label: 'Live Shopping con juegos', dot: 'Live' },
  { id: 'feed', label: 'Feed de Reels con video y audio', dot: 'Reels' },
  { id: 'map', label: 'Marketplace con mapa', dot: 'Mapa' },
  { id: 'trust', label: 'Pago protegido y reputación', dot: 'Pago' },
  { id: 'rewards', label: 'Chat, perfil y X-Coins', dot: 'Recompensas' },
] as const;

//8 s por escena: tiempo ideal para leer4-5 líneas con calma
const ROTATION_MS = 8000;

/** Escena1: transmisión en vivo con chat, trivia, producto fijado y likes */
function LiveScene() {
  return (
    <div className="relative h-full w-full overflow-hidden bg-gradient-to-b from-[#2a0b1d] via-[#150b26] to-black">
      {/* "Host" de la transmisión */}
      <div className="flex h-full w-full flex-col items-center justify-center">
        <motion.span
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          className="text-7xl"
        >
          🎙️
        </motion.span>
        <span className="mt-3 rounded-full bg-black/50 px-3 py-1 text-[10px] font-bold text-white/80">
          TechStore Lima
        </span>
      </div>

      {/* Badge LIVE + vistas */}
      <div className="absolute left-3 top-3 flex items-center gap-2">
        <span className="flex items-center gap-1 rounded-md bg-red-600 px-1.5 py-0.5 text-[9px] font-black text-white">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> LIVE
        </span>
        <span className="rounded-md bg-black/60 px-1.5 py-0.5 text-[9px] font-semibold text-white/85">
          👁 1.2K
        </span>
      </div>

      {/* Corazones flotantes (likes) */}
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          aria-hidden
          animate={{ y: -90, opacity: [0, 1, 0], x: [0, i % 2 === 0 ? 14 : -14] }}
          transition={{ duration: 2.6, repeat: Infinity, delay: i * 0.85, ease: 'easeOut' }}
          className="absolute bottom-28 right-4 text-xl"
        >
          ❤️
        </motion.span>
      ))}

      {/* Chat en vivo */}
      <div className="absolute inset-x-3 bottom-24 space-y-1.5">
        {[
          ['Ana M.', '¿Envían a Arequipa? 📦'],
          ['Luis P.', 'Lo tomé, ya pagué ✅'],
          ['Sofi', 'Repetir stock porfa 🔥'],
        ].map(([who, msg], i) => (
          <motion.p
            key={who}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 + i * 0.7 }}
            className="w-fit max-w-[85%] rounded-xl rounded-bl-sm bg-black/60 px-2.5 py-1 text-[10px] text-white/90"
          >
            <b className="text-cyan-300">{who}:</b> {msg}
          </motion.p>
        ))}
      </div>

      {/* Chip del juego en vivo: trivia + X-Coins (compradores juegan) */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
        className="absolute inset-x-3 bottom-16 flex items-center justify-between rounded-xl border border-amber-400/40 bg-amber-500/15 px-2.5 py-1.5 backdrop-blur-md"
      >
        <span className="text-[10px] font-black text-amber-300">🎮 Trivia en vivo</span>
        <span className="rounded-full bg-black/50 px-2 py-0.5 text-[9px] font-black text-amber-300">
          +10 🪙
        </span>
      </motion.div>

      {/* Producto fijado por el host (pin → compra instantánea) */}
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="absolute inset-x-3 bottom-3 flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 p-2 backdrop-blur-md"
      >
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-indigo-500/50 to-violet-600/50 text-lg">
          🎧
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[10px] font-bold text-white">Audífonos Pro ANC</p>
          <p className="text-[10px] font-black text-emerald-400">S/ 149.90</p>
        </div>
        <span className="rounded-lg bg-gradient-to-r from-[#FF2D75] to-[#7B5CFF] px-2 py-1 text-[9px] font-black text-white">
          COMPRAR
        </span>
      </motion.div>
    </div>
  );
}

/** Escena2: feed vertical tipo Reels — video con AUDIO y compra de1 clic */
function FeedScene() {
  return (
    <div className="relative h-full w-full overflow-hidden bg-gradient-to-b from-[#0b1a2a] via-[#0e1226] to-black">
      {/* "Video" del producto con ecualizador (audio sonando) */}
      <div className="flex h-full w-full flex-col items-center justify-center">
        <motion.span
          animate={{ rotate: [-4, 4, -4], scale: [1, 1.06, 1] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
          className="text-7xl"
        >
          🎒
        </motion.span>
        {/* Ecualizador: el video se escucha con audio */}
        <div aria-hidden className="mt-4 flex h-5 items-end gap-1">
          {[0, 1, 2, 3, 4].map((i) => (
            <motion.span
              key={i}
              animate={{ scaleY: [0.3, 1, 0.5, 0.9, 0.4] }}
              transition={{
                duration: 0.9 + i * 0.15,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: i * 0.08,
              }}
              className="h-5 w-1.5 origin-bottom rounded-full bg-gradient-to-t from-cyan-500 to-violet-400"
            />
          ))}
        </div>
        <p className="mt-3 px-6 text-center text-[11px] leading-snug text-white/85">
          <b className="text-white">@urbangear.pe</b>
          <br />
          Mochila antirrobo — con sonido 🔊
        </p>
      </div>

      {/* Badge de audio activado */}
      <span className="absolute left-3 top-12 flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-[9px] font-bold text-white/85 backdrop-blur">
        🔊 Sonido activado
      </span>

      {/* Indicador "desliza" */}
      <motion.p
        animate={{ x: [0, -6, 0] }}
        transition={{ duration: 1.8, repeat: Infinity }}
        className="absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-black/50 px-2.5 py-1 text-[9px] font-semibold text-white/70"
      >
        ↑ desliza el feed
      </motion.p>

      {/* Rail lateral de interacción (feed) */}
      <div className="absolute bottom-20 right-2.5 space-y-3 text-center">
        {[
          ['❤️', '24K'],
          ['💬', '892'],
          ['↗️', '1.2K'],
        ].map(([ic, n]) => (
          <div key={n}>
            <span className="text-lg drop-shadow">{ic}</span>
            <p className="text-[8px] font-bold text-white/80">{n}</p>
          </div>
        ))}
      </div>

      {/* Chip de compra rápida1 clic */}
      <motion.div
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="absolute inset-x-3 bottom-3 flex items-center justify-between rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 backdrop-blur-md"
      >
        <div>
          <p className="text-[10px] font-bold text-white">Mochila antirrobo Urban</p>
          <p className="text-[10px] font-black text-emerald-400">S/ 99.00 · ⭐ 4.9</p>
        </div>
        <span className="rounded-lg bg-white px-2 py-1 text-[9px] font-black text-black">
          COMPRAR ▸
        </span>
      </motion.div>
    </div>
  );
}

/** Escena3: marketplace hiper-local — mapa con pines de productos cercanos */
function MapScene() {
  const pins = [
    { emoji: '📱', left: '18%', top: '26%', price: 'S/ 899' },
    { emoji: '👗', left: '66%', top: '20%', price: 'S/ 79' },
    { emoji: '🍳', left: '70%', top: '58%', price: 'S/ 129' },
    { emoji: '👟', left: '22%', top: '62%', price: 'S/ 149' },
  ] as const;

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#0a1420]">
      {/* Calles simuladas del mapa */}
      <div aria-hidden className="absolute inset-0">
        <span className="absolute left-0 top-[38%] h-2 w-full bg-white/[0.06]" />
        <span className="absolute left-0 top-[72%] h-1.5 w-full bg-white/[0.05]" />
        <span className="absolute left-[42%] top-0 h-full w-2 bg-white/[0.06]" />
        <span className="absolute left-[80%] top-0 h-full w-1.5 bg-white/[0.05]" />
        {/* Manzanas */}
        <span className="absolute left-[6%] top-[44%] h-[22%] w-[30%] rounded-md bg-emerald-900/30" />
        <span className="absolute left-[50%] top-[6%] h-[26%] w-[24%] rounded-md bg-white/[0.04]" />
      </div>

      {/* Radio de búsqueda (1-5 km) */}
      <div
        aria-hidden
        className="absolute left-1/2 top-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-400/40 bg-cyan-500/10"
      />

      {/* Posición del usuario */}
      <span className="absolute left-1/2 top-1/2 grid h-6 w-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-cyan-400 text-[10px] shadow-[0_0_16px_rgba(34,211,238,0.9)]">
        📍
      </span>

      {/* Pines de productos cercanos */}
      {pins.map((p, i) => (
        <motion.div
          key={p.emoji}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: [0, -4, 0] }}
          transition={{
            delay: 0.3 + i * 0.15,
            y: { duration: 2.2, repeat: Infinity, delay: i * 0.3 },
          }}
          style={{ left: p.left, top: p.top }}
          className="absolute flex flex-col items-center"
        >
          <span className="grid h-8 w-8 place-items-center rounded-full border border-white/20 bg-white/10 text-base backdrop-blur">
            {p.emoji}
          </span>
          <span className="mt-0.5 rounded bg-black/70 px-1 py-px text-[8px] font-black text-emerald-300">
            {p.price}
          </span>
        </motion.div>
      ))}

      {/* Chips de categoría (filtros del mapa) */}
      <div className="absolute left-3 top-3 flex gap-1.5">
        <span className="rounded-full bg-[#FF2D75] px-2 py-0.5 text-[9px] font-black text-white">
          🔥 Ofertas
        </span>
        <span className="rounded-full bg-black/60 px-2 py-0.5 text-[9px] font-semibold text-white/80">
          📱 Tech
        </span>
        <span className="rounded-full bg-black/60 px-2 py-0.5 text-[9px] font-semibold text-white/80">
          👗 Moda
        </span>
      </div>

      {/* Card inferior: resultado de la búsqueda cercana */}
      <div className="absolute inset-x-3 bottom-3 rounded-xl border border-white/15 bg-white/10 p-2.5 backdrop-blur-md">
        <p className="text-[10px] font-black text-white">
          📍3 tiendas cerca de ti
        </p>
        <p className="mt-0.5 text-[9px] text-white/65">
          A menos de2 km · Envío hoy o recojo en tienda
        </p>
        <div className="mt-1.5 flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          <span className="text-[9px] font-bold text-emerald-300">
            47 compradores viendo estas ofertas ahora
          </span>
        </div>
      </div>
    </div>
  );
}

/** Escena4: reputación verificada + seguridad de pago (ambos lados) */
function TrustScene() {
  const escrow = [
    ['💳', 'Pago enviado', 'comprador por WhatsApp'],
    ['🧾', 'Comprobante', 'soporte valida'],
    ['🚚', 'Producto enviado', 'vendedor despacha'],
    ['✅', 'Pedido completado', 'ambos informados'],
  ] as const;

  return (
    <div className="h-full w-full overflow-hidden bg-gradient-to-b from-[#071a17] via-[#0b1226] to-black p-4">
      {/* Ficha del vendedor con reputación */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-white/10 bg-white/5 p-3"
      >
        <div className="flex items-center gap-2.5">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-emerald-500/40 to-cyan-600/40 text-xl">
            🏪
          </span>
          <div className="min-w-0">
            <p className="truncate text-[11px] font-black text-white">
              TechStore Lima{' '}
              <span className="ml-0.5 rounded bg-emerald-500/25 px-1 text-[8px] font-bold text-emerald-300">
                ✓ VERIFICADO
              </span>
            </p>
            <p className="text-[9px] text-white/60">
              ⭐ 4.9 ·1,240 ventas · responde en10 min
            </p>
          </div>
        </div>
        {/* Barra de reputación */}
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: '96%' }}
            transition={{ duration: 1.1, delay: 0.3 }}
            className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400"
          />
        </div>
      </motion.div>

      {/* Timeline de pago coordinado por WhatsApp */}
      <p className="mt-4 text-[9px] font-black uppercase tracking-widest text-white/45">
        Pago protegido · ambos lados
      </p>
      <ol className="mt-2 space-y-2">
        {escrow.map(([ic, title, who], i) => (
          <motion.li
            key={title}
            initial={{ opacity: 0, x: -14 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.35 + i * 0.35 }}
            className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-black/40 px-2.5 py-2"
          >
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/10 text-sm">
              {ic}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[10px] font-bold text-white">{title}</p>
              <p className="truncate text-[8px] text-white/50">{who}</p>
            </div>
            <span className="ml-auto text-[9px] font-black text-emerald-400">✓</span>
          </motion.li>
        ))}
      </ol>

      <p className="mt-3 rounded-xl bg-emerald-500/10 px-2.5 py-2 text-center text-[9px] leading-snug text-emerald-300">
        🛡️ Soporte valida el pago y el vendedor recibe la orden para enviar.
      </p>
    </div>
  );
}

/** Escena5: perfil, chat directo y recompensas X-Coins */
function RewardsScene() {
  return (
    <div className="h-full w-full overflow-hidden bg-gradient-to-b from-[#1a1330] via-[#0e1226] to-black p-4">
      {/* Balance de X-Coins */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-amber-400/30 bg-gradient-to-r from-amber-500/15 to-orange-500/10 p-3"
      >
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-black uppercase tracking-wider text-amber-300">
            🪙 Tus X-Coins
          </span>
          <span className="text-lg font-black text-white">1,250</span>
        </div>
        <p className="mt-0.5 text-[9px] text-white/60">
          Canjéalos por descuentos · gana jugando y comprando
        </p>
        {/* Progreso al siguiente nivel */}
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: '68%' }}
            transition={{ duration: 1.2, delay: 0.35 }}
            className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500"
          />
        </div>
        <p className="mt-1 text-[8px] text-white/50">68% → Nivel Oro ⭐</p>
      </motion.div>

      {/* Chat directo comprador ↔ vendedor */}
      <p className="mt-4 text-[9px] font-black uppercase tracking-widest text-white/45">
        Chat directo
      </p>
      <div className="mt-2 space-y-1.5">
        <motion.p
          initial={{ opacity: 0, x: -14 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          className="w-fit max-w-[88%] rounded-xl rounded-bl-sm bg-black/50 px-2.5 py-1.5 text-[10px] text-white/90"
        >
          <b className="text-cyan-300">Tú:</b> ¿Llega mañana a Trujillo? 📦
        </motion.p>
        <motion.p
          initial={{ opacity: 0, x: 14 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.9 }}
          className="ml-auto w-fit max-w-[88%] rounded-xl rounded-br-sm bg-gradient-to-r from-[#FF2D75]/40 to-[#7B5CFF]/40 px-2.5 py-1.5 text-[10px] text-white"
        >
          <b>TechStore:</b> ¡Sí! Sale hoy mismo ✅
        </motion.p>
      </div>

      {/* Estado del pedido */}
      <p className="mt-4 text-[9px] font-black uppercase tracking-widest text-white/45">
        Mi pedido
      </p>
      <div className="mt-2 rounded-xl border border-white/10 bg-black/40 p-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-white">Pedido #XS-1042</span>
          <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[8px] font-black text-emerald-300">
            EN CAMINO
          </span>
        </div>
        {/* Mini timeline del pedido */}
        <div className="mt-2 flex items-center gap-1">
          {['Pagado', 'Enviado', 'Llega'].map((step, i) => (
            <div key={step} className="flex-1">
              <div
                className={`h-1 rounded-full ${i <= 1 ? 'bg-emerald-400' : 'bg-white/15'}`}
              />
              <p
                className={`mt-1 text-center text-[8px] ${i <= 1 ? 'font-bold text-emerald-300' : 'text-white/45'}`}
              >
                {step}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Componente principal — silueta de celular + copy del landing
// ============================================================

// Todo lo que hace la app (checklist legible mientras gira la demo)
const APP_CAPABILITIES: ReadonlyArray<readonly [string, string, string]> = [
  ['🎬', 'Reels con video y sonido', 'Mira, escucha y compra en1 clic sin salir del feed.'],
  ['📡', 'Live streaming fluido', 'Transmisiones con chat, likes y producto fijado.'],
  ['🎮', 'Juegos en vivo', 'Trivia con recompensas: juegan compradores y vendedores.'],
  ['📍', 'Marketplace cerca de ti', 'Mapa con ofertas a menos de2 km de tu ubicación.'],
  ['🛡️', 'Pago por WhatsApp', 'Soporte valida el comprobante antes del envío.'],
  ['⭐', 'Reputación verificada', 'Historial real de ventas, reseñas y vendedores ✓.'],
  ['💬', 'Chat directo', 'Comprador y vendedor resuelven todo en la app.'],
  ['🪙', 'X-Coins', 'Gana monedas comprando y jugando · canjéalas por descuentos.'],
];

export function PhoneShowcase() {
  const [scene, setScene] = useState(0);
  const [paused, setPaused] = useState(false);

  // Rotación calmada:8 s por escena; se detiene en pausa o con
  // preferencia de movimiento reducido (accesibilidad WCAG)
  useEffect(() => {
    if (paused) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = window.setTimeout(
      () => setScene((s) => (s + 1) % SCENES.length),
      ROTATION_MS,
    );
    return () => window.clearTimeout(id);
  }, [scene, paused]);

  return (
    <section
      aria-label="Demo de la plataforma en el celular"
      className="relative mx-auto mt-12 max-w-5xl px-4"
    >
      <div className="pointer-events-none absolute left-1/2 top-10 h-56 w-72 -translate-x-1/2 rounded-full bg-gradient-to-r from-[#FF2D75]/25 via-violet-500/25 to-cyan-500/25 blur-3xl" />

      <div className="grid items-center gap-10 md:grid-cols-[1fr_auto]">
        {/* ============ Copy + capacidades de la app ============ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', damping: 20 }}
        >
          <span className="glass inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-bold text-cyan-300">
            🎬 Reels · 📡 Live · 📍 Cerca
          </span>
          <h2 className="mt-4 text-2xl font-black leading-tight text-white md:text-3xl">
            Toda la plataforma{' '}
            <span className="bg-gradient-to-r from-cyan-300 to-violet-400 bg-clip-text text-transparent">
              en tu bolsillo
            </span>
          </h2>
          <p className="mt-2 max-w-md text-sm text-white/60">
            La demo del celular recorre en calma cada cosa que puedes hacer en X-STORE: ver
            videos con sonido, transmitir en vivo, jugar por recompensas, comprar cerca de ti y
            pagos protegidos para comprador y vendedor.
          </p>

          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {APP_CAPABILITIES.map(([ic, title, desc], i) => (
              <motion.li
                key={title}
                initial={{ opacity: 0, x: -18 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.12 + i * 0.07 }}
                className="flex gap-3"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 text-lg">
                  {ic}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white">{title}</p>
                  <p className="text-xs leading-snug text-white/55">{desc}</p>
                </div>
              </motion.li>
            ))}
          </ul>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/live"
              className="rounded-xl bg-gradient-to-r from-[#FF2D75] to-[#7B5CFF] px-5 py-3 text-sm font-bold text-white transition hover:opacity-90 active:scale-95"
            >
              📡 Ver Live ahora
            </Link>
            <Link
              href="/catalogo"
              className="glass rounded-xl px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10"
            >
              🏷️ Explorar catálogo
            </Link>
          </div>
        </motion.div>

        {/* ============ Silueta de celular ============ */}
        <motion.div
          initial={{ opacity: 0, y: 30, rotate: -3 }}
          animate={{ opacity: 1, y: 0, rotate: 0 }}
          transition={{ type: 'spring', damping: 16, delay: 0.1 }}
          className="mx-auto"
        >
          {/* Pausa al pasar el cursor / enfocar: da tiempo de leer con calma */}
          <div
            className="relative"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onFocusCapture={() => setPaused(true)}
            onBlurCapture={() => setPaused(false)}
          >
            {/* Botones laterales (detalle de silueta) */}
            <span aria-hidden className="absolute -left-1 top-24 h-10 w-1 rounded-l bg-white/25" />
            <span aria-hidden className="absolute -left-1 top-36 h-14 w-1 rounded-l bg-white/25" />
            <span aria-hidden className="absolute -right-1 top-32 h-16 w-1 rounded-r bg-white/25" />

            <div className="relative h-[520px] w-[264px] overflow-hidden rounded-[2.6rem] border-[3px] border-white/20 bg-black shadow-[0_0_60px_rgba(139,92,246,0.25)]">
              {/* Dynamic island */}
              <span
                aria-hidden
                className="absolute left-1/2 top-2 z-20 h-5 w-20 -translate-x-1/2 rounded-full bg-black ring-1 ring-white/10"
              />

              {/* Pantalla con escenas rotativas */}
              <div className="absolute inset-0 pt-8">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={SCENES[scene].id}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.02 }}
                    transition={{ duration: 0.3 }}
                    className="h-full w-full"
                  >
                    {scene === 0 && <LiveScene />}
                    {scene === 1 && <FeedScene />}
                    {scene === 2 && <MapScene />}
                    {scene === 3 && <TrustScene />}
                    {scene === 4 && <RewardsScene />}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Barra inferior del sistema */}
              <span
                aria-hidden
                className="absolute bottom-1.5 left-1/2 z-20 h-1 w-24 -translate-x-1/2 rounded-full bg-white/40"
              />
            </div>

            {/* Barra de progreso: cuánto falta para la siguiente escena */}
            <div
              className="mx-auto mt-4 h-1 w-44 overflow-hidden rounded-full bg-white/10"
              aria-hidden
            >
              <div
                key={`${scene}-${paused ? 'p' : 'r'}`}
                className="h-full w-full origin-left bg-gradient-to-r from-[#FF2D75] via-violet-500 to-cyan-400 xs-scene-progress"
                style={{ animationPlayState: paused ? 'paused' : 'running' }}
              />
            </div>

            {/* Indicadores de escena (clicables = control manual) */}
            <div
              className="mt-3 flex flex-wrap justify-center gap-2"
              role="tablist"
              aria-label="Escenas de la demo"
            >
              {SCENES.map((s, i) => (
                <button
                  key={s.id}
                  role="tab"
                  aria-selected={scene === i}
                  aria-label={`Escena ${i + 1}: ${s.label}`}
                  onClick={() => setScene(i)}
                  className={`rounded-full px-3 py-1 text-[10px] font-bold transition ${
                    scene === i
                      ? 'bg-gradient-to-r from-[#FF2D75] to-[#7B5CFF] text-white'
                      : 'border border-white/15 bg-white/5 text-white/50 hover:text-white'
                  }`}
                >
                  {s.dot}
                </button>
              ))}
            </div>
          </div>

          {/* Pista de lectura calmada */}
          <p className="mt-3 text-center text-[10px] text-white/45">
            ⏸️ Pasa el cursor para pausar y leer con calma
          </p>
        </motion.div>
      </div>
    </section>
  );
}
