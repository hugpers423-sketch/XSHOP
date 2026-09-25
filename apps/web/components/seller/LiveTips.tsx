// apps/web/components/seller/LiveTips.tsx
'use client';

// Tips accionables para el vendedor antes de hacer su live.
// - variant='full'    → guía completa con grupos y horarios (/seller/live/new)
// - variant='compact' → resumen ejecutivo con CTA (portal del vendedor)
// Presentación pura: sin estado, animaciones montadas (no whileInView).

import Link from 'next/link';
import { motion } from 'framer-motion';

interface TipGroup {
  icon: string;
  title: string;
  tips: string[];
}

// Banco de tips — contenido estático mantenible por el equipo (producir:
// guía editorial interna; futura variante remota: GET /api/content/live-tips)
const TIP_GROUPS: TipGroup[] = [
  {
    icon: '🎬',
    title: 'Antes de salir al aire',
    tips: [
      'Ilumina el producto de frente (luz natural o ring light); nunca a contraluz, la cámara oscurece todo.',
      'Prueba sonido y WiFi5 minutos antes: un corte temprano hace perder a media audiencia.',
      'Ten precio, stock y ficha técnica de cada producto a mano — y revisa que estén publicados.',
    ],
  },
  {
    icon: '🎣',
    title: 'El gancho de los primeros10 segundos',
    tips: [
      'Saluda a quien entra por su nombre: "¡Hola Ana, bienvenida!" — el chat se activa al sentirse visto.',
      'Di la oferta de inmediato: "Hoy solo en el live:40% y envío mañana".',
      'Muestra el producto estrella de cerca antes de hablar de precio.',
    ],
  },
  {
    icon: '🎮',
    title: 'Durante la transmisión',
    tips: [
      'Fija2–3 productos y recuérdalos cada10–15 minutos: los compradores los ven siempre abajo.',
      'Lanza la trivia con X-Coins cada10 minutos: entretiene, retiene y premia a tu gente.',
      'Haz demostración real: textura, tamaño en la mano, cómo se usa — la cámara no miente.',
      'Responde el chat por nombre y repite las preguntas frecuentes en voz alta.',
    ],
  },
  {
    icon: '🚀',
    title: 'Cierra y fideliza',
    tips: [
      'Recuerda: el comprador coordina el pago por WhatsApp y tú recibes la orden después de la validación.',
      'Crea urgencia honesta: stock real y precio del live — exagerar destruye tu reputación.',
      'Despacha en24–48h y pide la reseña al confirmar: eso sostiene tu ⭐ y tu badge.',
    ],
  },
];

// Horarios recomendados (hora de Perú) — datos de uso de la plataforma
const SCHEDULE_CHIPS = [
  '🕚 Lun–Vie · 12:30–14:00 y19:00–22:00',
  '📅 Sábado · 10:00–13:00',
  '🌆 Domingo · 18:00–21:00',
];

// Versión compacta: la primera (mejor) tip de cada grupo — siempre definida
const TOP_TIPS: string[] = TIP_GROUPS.map((g) => g.tips[0]);

interface LiveTipsProps {
  /** 'full' = guía completa · 'compact' = resumen con CTA */
  variant?: 'full' | 'compact';
}

export function LiveTips({ variant = 'full' }: LiveTipsProps) {
  if (variant === 'compact') {
    return (
      <section
        aria-labelledby="live-tips-compact"
        className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-5"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="live-tips-compact" className="font-bold text-white">
              🎯 Tips para tu próximo live
            </h2>
            <p className="mt-1 text-sm text-white/50">
              Cuatro reglas que marcan la diferencia mientras transmites.
            </p>
          </div>
          <Link
            href="/seller/live/new"
            className="shrink-0 rounded-xl border border-white/15 bg-white/5 px-3.5 py-2 text-xs font-bold text-white transition hover:border-[#FF2D75]/50 hover:bg-white/10"
          >
            Guía completa →
          </Link>
        </div>

        <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
          {TOP_TIPS.map((tip, i) => (
            <motion.li
              key={tip}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-start gap-2 rounded-xl bg-white/[0.04] px-3 py-2.5"
            >
              <span aria-hidden className="mt-0.5 text-[#34D399]">
                ✓
              </span>
              <span className="text-sm leading-snug text-white/70">{tip}</span>
            </motion.li>
          ))}
        </ul>
      </section>
    );
  }

  // ---------- Guía completa ----------
  return (
    <section
      aria-labelledby="live-tips-full"
      className="rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6"
    >
      <header>
        <h2 id="live-tips-full" className="text-lg font-black text-white">
          🎯 Tips para que tu live venda más
        </h2>
        <p className="mt-1 text-sm text-white/50">
          Guía rápida de X-STORE: prepárate, engancha, entretén y cierra.
        </p>
      </header>

      <div className="mt-5 grid gap-4">
        {TIP_GROUPS.map((group, i) => (
          <motion.article
            key={group.title}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"
          >
            <div className="flex items-center gap-2">
              <span aria-hidden className="text-lg">
                {group.icon}
              </span>
              <h3 className="text-sm font-bold text-white">{group.title}</h3>
            </div>
            <ul className="mt-3 space-y-2">
              {group.tips.map((tip) => (
                <li key={tip} className="flex items-start gap-2">
                  <span aria-hidden className="mt-0.5 text-[#34D399]">
                    ✓
                  </span>
                  <span className="text-sm leading-snug text-white/70">{tip}</span>
                </li>
              ))}
            </ul>
          </motion.article>
        ))}
      </div>

      {/* Horarios recomendados */}
      <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
        <p className="text-xs font-bold text-amber-300">
          ⏰ Mejores horarios para transmitir (hora de Perú)
        </p>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {SCHEDULE_CHIPS.map((chip) => (
            <span
              key={chip}
              className="rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-100/90"
            >
              {chip}
            </span>
          ))}
        </div>
        <p className="mt-2.5 text-xs leading-relaxed text-white/50">
          Constancia gana:3 lives cortos por semana rinden más que una maratón
          ocasional. Apunta a sesiones de30–45 minutos.
        </p>
      </div>
    </section>
  );
}
