// app/page.tsx — X-STORE Home animada
// Hero con entrada escalonada · marquee EN VIVO · ofertas con countdown real
// tendencias con compra rápida · contadores animados · bento · confianza

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useCartStore } from '@/lib/cart';
import { track } from '@/lib/analytics';
import { toast } from '@/components/ui/Toast';
import { formatPrice, formatCount, emojiTile } from '@/lib/format';
import { PhoneShowcase } from '@/components/home/PhoneShowcase';
import { useAuth } from '@/lib/auth-context';

// ============================================================
// Datos demo (fáciles de sustituir por GET /api/products)
// ============================================================

const CATEGORIES = [
  { icon: '👗', label: 'Moda', href: '/products?cat=moda' },
  { icon: '📱', label: 'Tecnología', href: '/products?cat=tech' },
  { icon: '🏠', label: 'Hogar', href: '/products?cat=hogar' },
  { icon: '💄', label: 'Belleza', href: '/products?cat=belleza' },
  { icon: '🎮', label: 'Gaming', href: '/products?cat=gaming' },
  { icon: '⚡', label: 'Ofertas', href: '/products?cat=ofertas' },
];

const LIVE_STREAMS = [
  { id: 'live-1', title: 'Ofertas Flash de Tecnología', host: 'TechPerú Store', viewers: 1243, emoji: '📱', from: 'from-pink-500/40' },
  { id: 'live-2', title: 'Moda Verano 2026', host: 'Glitter Fashion', viewers: 876, emoji: '👙', from: 'from-violet-500/40' },
  { id: 'live-3', title: 'Cocina peruana 🍳', host: 'Hogar Total', viewers: 432, emoji: '🍳', from: 'from-emerald-500/40' },
  { id: 'live-4', title: 'JugaBaratos retro', host: 'RetroGamer PE', viewers: 210, emoji: '🎮', from: 'from-cyan-500/40' },
];

interface Trending {
  id: string;
  title: string;
  price: number;
  compareAt?: number;
  emoji: string;
  gradient: string;
  rating: number;
}

const TRENDING: Trending[] = [
  { id: 't1', title: 'Audífonos Pro ANC', price: 149.9, compareAt: 249.9, emoji: '🎧', gradient: 'from-indigo-500/40 to-violet-600/40', rating: 4.9 },
  { id: 't2', title: 'Hoodie Oversize Premium', price: 79.9, compareAt: 129.9, emoji: '🧥', gradient: 'from-rose-500/40 to-orange-500/40', rating: 4.8 },
  { id: 't3', title: 'Smartwatch AMOLED 1.43"', price: 189.0, compareAt: 259.0, emoji: '⌚', gradient: 'from-cyan-500/40 to-blue-600/40', rating: 4.7 },
  { id: 't4', title: 'Lámpara LED ambiente', price: 59.9, emoji: '💡', gradient: 'from-amber-400/40 to-orange-500/40', rating: 4.6 },
  { id: 't5', title: 'Mochila antirrobo Urban', price: 99.0, compareAt: 159.0, emoji: '🎒', gradient: 'from-emerald-500/40 to-teal-600/40', rating: 4.9 },
  { id: 't6', title: 'Perfumé Ambar Noir 100ml', price: 119.9, emoji: '🌙', gradient: 'from-fuchsia-500/40 to-pink-600/40', rating: 4.8 },
];

const FEATURES = [
  {
    title: 'Reels Commerce',
    desc: 'Videos verticales con compra de 1 clic',
    href: '/reels',
    icon: '🎬',
    gradient: 'from-cyan-500/20 to-violet-600/20',
    span: 'md:col-span-2 md:row-span-2',
  },
  {
    title: 'Marketplace cerca de ti',
    desc: 'Encuentra productos a menos de 5 km',
    href: '/marketplace',
    icon: '📍',
    gradient: 'from-emerald-500/20 to-cyan-600/20',
    span: '',
  },
  {
    title: 'Pago Yape por WhatsApp',
    desc: 'Soporte valida tu comprobante',
    href: '/compra',
    icon: '🔒',
    gradient: 'from-amber-500/20 to-rose-600/20',
    span: '',
  },
];

const STATS = [
  { label: 'Compradores', value: 128_000, suffix: '+' },
  { label: 'Productos', value: 45_000, suffix: '+' },
  { label: 'Ventas (S/ M)', value: 3, suffix: '.2M' },
  { label: 'Vendedores', value: 3_200, suffix: '+' },
];

// Oferta flash: fin calculado 1x por sesión (module scope = no impureza en render)
const DEAL_END = Date.now() + 4 * 60 * 60 * 1000 + 23 * 60 * 1000;

// ============================================================
// Subcomponentes
// ============================================================

/** Cuenta regresiva con intervalo (state solo en callbacks — reglas React) */
function Countdown() {
  const [label, setLabel] = useState('--:--:--');

  useEffect(() => {
    const fmt = () => {
      const diff = Math.max(0, DEAL_END - Date.now());
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1000);
      setLabel(
        `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      );
    };
    const id = setInterval(fmt, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <span className="font-mono text-lg font-black tabular-nums text-[#FFD166]">
      {label}
    </span>
  );
}

/** Contador animado con requestAnimationFrame (easeOutCubic) */
function CountUp({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const DURATION = 1400;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / DURATION);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);

  return (
    <span className="tabular-nums">
      {formatCount(value)}
      {suffix}
    </span>
  );
}

/** Tarjeta de tendencia con compra rápida (carrito + toast) */
function TrendCard({ p, index }: { p: Trending; index: number }) {
  const addItem = useCartStore((s) => s.addItem);
  const { requireAuth } = useAuth();

  const quickAdd = () => {
    if (!requireAuth()) return;
    addItem({
      productId: p.id,
      title: p.title,
      price: p.price,
      seller: 'X-STORE',
      image: emojiTile(p.emoji), // tile SVG data-URI — sin assets externos
    });
    track('add_to_cart', { productId: p.id, price: p.price, qty: 1, source: 'home' });
    toast.success(`"${p.title}" añadido al carrito 🛒`);
  };

  const discount = p.compareAt
    ? Math.round((1 - p.price / p.compareAt) * 100)
    : 0;

  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }} // reveal al montar (sin dependencia de scroll/IO)
      transition={{ delay: Math.min(index * 0.06, 0.36), type: 'spring', damping: 22 }}
      className="group w-56 shrink-0 overflow-hidden rounded-3xl border border-white/10 bg-white/5 transition hover:border-[#FF2D75]/50 sm:w-auto"
    >
      <div
        className={`relative grid aspect-square place-items-center bg-gradient-to-br ${p.gradient}`}
      >
        <span className="text-6xl transition duration-500 group-hover:scale-110 group-hover:-rotate-6">
          {p.emoji}
        </span>
        {discount > 0 && (
          <span className="absolute left-2 top-2 rounded-full bg-[#FF2D75] px-2 py-0.5 text-[10px] font-black text-white">
            -{discount}%
          </span>
        )}
      </div>
      <div className="p-3">
        <h3 className="line-clamp-2 text-sm font-medium text-white/90">{p.title}</h3>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-lg font-black text-white">{formatPrice(p.price)}</span>
          {p.compareAt && (
            <span className="text-xs text-white/35 line-through">
              {formatPrice(p.compareAt)}
            </span>
          )}
        </div>
        <div className="mt-1 flex items-center justify-between">
          <span className="text-[11px] text-white/45">⭐ {p.rating.toFixed(1)}</span>
          <button
            onClick={quickAdd}
            aria-label={`Añadir ${p.title} al carrito`}
            className="rounded-lg bg-gradient-to-r from-[#FF2D75] to-[#7B5CFF] px-2.5 py-1 text-[11px] font-bold text-white transition active:scale-95"
          >
            + Añadir
          </button>
        </div>
      </div>
    </motion.article>
  );
}

// ============================================================
// Página
// ============================================================

export default function HomePage() {
  return (
    <div className="min-h-screen bg-zinc-950 pb-24 text-white">
      {/* ============ HERO ============ */}
      <section className="relative overflow-hidden px-4 pt-14 pb-10">
        {/* Orbes flotantes (solo transform/blur — GPU friendly) */}
        <div className="pointer-events-none absolute -top-32 left-1/2 h-64 w-[500px] -translate-x-1/2 rounded-full bg-gradient-to-r from-cyan-500/30 via-violet-500/30 to-fuchsia-500/30 blur-3xl" />
        <motion.div
          aria-hidden
          animate={{ y: [0, 18, 0], x: [0, 10, 0] }}
          transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
          className="pointer-events-none absolute right-[8%] top-24 h-24 w-24 rounded-full bg-[#FF2D75]/25 blur-2xl"
        />
        <motion.div
          aria-hidden
          animate={{ y: [0, -14, 0], x: [0, -8, 0] }}
          transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
          className="pointer-events-none absolute left-[6%] top-40 h-20 w-20 rounded-full bg-cyan-400/20 blur-2xl"
        />

        <motion.div
          initial="hidden"
          animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.12 } } }}
          className="relative mx-auto max-w-4xl text-center"
        >
          <motion.span
            variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}
            className="glass inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold text-cyan-300"
          >
            🇵🇪 Hecho para el Perú · Yape · Plin · WhatsApp
          </motion.span>

          <motion.h1
            variants={{ hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0 } }}
            className="mt-5 bg-gradient-to-r from-white via-cyan-200 to-violet-300 bg-clip-text text-4xl font-black leading-tight tracking-tight text-transparent md:text-6xl"
          >
            Compra lo que ves.
            <br />
            En video. En vivo. Cerca de ti.
          </motion.h1>

          <motion.p
            variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}
            className="mx-auto mt-4 max-w-xl text-sm text-white/60 md:text-base"
          >
            Reels de productos, Live Shopping y un Marketplace hiper-local con pagos coordinados por WhatsApp.
          </motion.p>

          <motion.div
            variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}
            className="mt-7 flex flex-wrap items-center justify-center gap-3"
          >
            <Link
              href="/reels"
              className="rounded-2xl bg-gradient-to-r from-cyan-500 via-violet-500 to-fuchsia-500 px-7 py-3.5 text-sm font-bold shadow-lg shadow-violet-500/30 transition hover:opacity-90 active:scale-95"
            >
              ▶ Ver Reels
            </Link>
            <Link
              href="/live"
              className="glass flex items-center gap-2 rounded-2xl px-7 py-3.5 text-sm font-bold transition hover:bg-white/10"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
              </span>
              Live Shopping
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* ============ MARQUEE EN VIVO ============ */}
      <section aria-label="Transmisiones en vivo" className="mt-2 overflow-hidden">
        <div className="xs-marquee flex w-max gap-3 pl-3">
          {[...LIVE_STREAMS, ...LIVE_STREAMS].map((s, i) => (
            <Link
              key={`${s.id}-${i}`}
              href="/live"
              aria-hidden={i >= LIVE_STREAMS.length}
              tabIndex={i >= LIVE_STREAMS.length ? -1 : 0}
              className={`group flex w-64 shrink-0 items-center gap-3 rounded-2xl border border-white/10 bg-gradient-to-r ${s.from} to-transparent p-3 transition hover:border-red-400/50`}
            >
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-black/30 text-xl">
                {s.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-white">{s.title}</p>
                <p className="truncate text-[10px] text-white/55">{s.host}</p>
              </div>
              <div className="text-right">
                <span className="flex items-center gap-1 rounded-full bg-red-600 px-1.5 py-0.5 text-[9px] font-black text-white">
                  LIVE
                </span>
                <p className="mt-0.5 text-[9px] text-white/60">👁 {formatCount(s.viewers)}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ============ CATEGORÍAS ============ */}
      <section className="mx-auto mt-8 max-w-4xl px-4">
        <div className="scrollbar-none flex gap-3 overflow-x-auto pb-2">
          {CATEGORIES.map((c) => (
            <motion.div
              key={c.label}
              whileHover={{ y: -4, scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              className="shrink-0"
            >
              <Link
                href={c.href}
                className="glass flex flex-col items-center gap-1 rounded-2xl px-5 py-3 transition hover:border-cyan-400/40"
              >
                <span className="text-2xl">{c.icon}</span>
                <span className="text-xs font-semibold text-white/80">{c.label}</span>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ============ OFERTA FLASH (countdown real) ============ */}
      <section className="mx-auto mt-8 max-w-4xl px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }} // siempre visible tras montar
          className="relative overflow-hidden rounded-3xl border border-[#FFD166]/30 bg-gradient-to-r from-[#FFD166]/15 via-[#FF2D75]/10 to-[#7B5CFF]/15 p-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-[#FFD166]">
                ⚡ Oferta flash
              </p>
              <p className="mt-1 text-sm text-white/70">
                Hasta <span className="font-black text-white">-60%</span> en tecnología seleccionada
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Countdown />
              <Link
                href="/products?cat=ofertas"
                className="rounded-xl bg-[#FFD166] px-4 py-2.5 text-xs font-black text-black transition hover:opacity-90 active:scale-95"
              >
                Ver ofertas
              </Link>
            </div>
          </div>
          {/* Barra de progreso ilusoria con pulso */}
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="xs-progress h-full w-2/3 rounded-full bg-gradient-to-r from-[#FFD166] to-[#FF2D75]" />
          </div>
        </motion.div>
      </section>

      {/* ============ TENDENCIAS ============ */}
      <section className="mx-auto mt-10 max-w-5xl px-4">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-xl font-black">🔥 Tendencias de la semana</h2>
            <p className="text-xs text-white/45">Compra en 1 clic desde aquí</p>
          </div>
          <Link href="/products" className="text-sm font-semibold text-[#FF2D75] hover:underline">
            Ver todo →
          </Link>
        </div>

        <div className="scrollbar-none mt-4 flex gap-4 overflow-x-auto pb-2 sm:grid sm:grid-cols-2 sm:overflow-visible lg:grid-cols-3">
          {TRENDING.map((p, i) => (
            <TrendCard key={p.id} p={p} index={i} />
          ))}
        </div>
      </section>

      {/* ============ ESTADÍSTICAS ANIMADAS ============ */}
      <section className="mx-auto mt-10 max-w-4xl px-4">
        <div className="glass grid grid-cols-2 gap-4 rounded-3xl p-6 md:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-2xl font-black text-cyan-300 md:text-3xl">
                <CountUp target={s.value} suffix={s.suffix} />
              </p>
              <p className="mt-1 text-xs font-semibold text-white/55">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ============ CELULAR: demo de venta en vivo + feeds + seguridad ============ */}
      <PhoneShowcase />

      {/* ============ BENTO ============ */}
      <section className="mx-auto mt-10 max-w-4xl px-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }} // reveal al montar con stagger
              transition={{ delay: i * 0.08, type: 'spring', damping: 20 }}
              className={f.span}
            >
              <Link
                href={f.href}
                className={`group relative flex h-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br ${f.gradient} p-6 transition hover:border-white/25`}
              >
                {/* Brillo que recorre la tarjeta al hover */}
                <span
                  aria-hidden
                  className="absolute -inset-x-10 -top-16 h-16 rotate-12 bg-white/10 opacity-0 blur-xl transition duration-700 group-hover:translate-y-40 group-hover:opacity-100"
                />
                <span className="text-4xl">{f.icon}</span>
                <h2 className="mt-4 text-lg font-bold">{f.title}</h2>
                <p className="mt-1 text-sm text-white/60">{f.desc}</p>
                <span className="mt-4 inline-block text-xs font-bold text-cyan-300 opacity-0 transition group-hover:opacity-100">
                  Explorar →
                </span>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ============ CONFIANZA ============ */}
      <section className="mx-auto mt-10 max-w-4xl px-4">
        <div className="glass grid grid-cols-2 gap-4 rounded-3xl p-6 text-center md:grid-cols-4">
          {[
            ['🛡️', 'Pago protegido'],
            ['🚚', 'Envío 24-48h'],
            ['⭐', 'Vendedores verified'],
            ['💬', 'Soporte WhatsApp'],
          ].map(([icon, label], i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }} // badges de confianza siempre visibles
              transition={{ delay: i * 0.07 }}
            >
              <div className="text-2xl">{icon}</div>
              <p className="mt-1 text-xs font-semibold text-white/70">{label}</p>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}
