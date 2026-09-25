// apps/web/components/live/LiveGame.tsx
'use client';

// Juego en vivo: trivia con recompensas en X-Coins.
// Los compradores responden y ganan monedas; el host (botón "demo host")
// puede lanzar la siguiente pregunta en cualquier momento. Sin setState
// síncronos en efectos: el índice se deriva de base + señal externa.

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from '@/components/ui/Toast';
import { track } from '@/lib/analytics';

interface QA {
  q: string;
  options: string[];
  correct: number;
}

// Banco de preguntas demo — producir: GET /api/live/trivia?streamId=
const QUESTIONS: QA[] = [
  {
    q: '¿Qué protege tu pago hasta que recibas el producto?',
    options: ['Pago por WhatsApp', 'Nada, pago directo', 'El courier'],
    correct: 0,
  },
  {
    q: 'Smartwatch AMOLED: precio del live de hoy',
    options: ['S/ 310', 'S/ 189', 'S/ 99'],
    correct: 1,
  },
  {
    q: '¿Cuántos X-Coins ganas por acertar?',
    options: ['+10 X-Coins', '+1 X-Coin', '+0 X-Coins'],
    correct: 0,
  },
  {
    q: '¿Dónde compras sin salir de la transmisión?',
    options: ['En el chat escribiendo', 'Producto fijado del host', 'Reinicio la app'],
    correct: 1,
  },
];

interface LiveGameProps {
  /** Incrementos externos (botón del host) que lanzan la siguiente pregunta */
  hostQuestionSignal?: number;
}

export function LiveGame({ hostQuestionSignal = 0 }: LiveGameProps) {
  // Avance interno (auto-tras responder) + señales del host = índice derivado
  const [base, setBase] = useState(0);
  // Respuestas por índice (evita resetear estado al cambiar de pregunta)
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [coins, setCoins] = useState(0);
  const [streak, setStreak] = useState(0);
  const timerRef = useRef<number | null>(null);

  const idx = (base + hostQuestionSignal) % QUESTIONS.length;
  const q = QUESTIONS[idx];
  const picked = answers[idx];
  const answered = picked !== undefined;
  const isCorrect = answered && picked === q.correct;

  // Limpiar auto-avance al desmontar (solo cleanup, sin setState en cuerpo)
  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  function pick(optIdx: number): void {
    if (answered) return;
    setAnswers((a) => ({ ...a, [idx]: optIdx }));

    const correct = optIdx === q.correct;
    if (correct) {
      setCoins((c) => c + 10);
      setStreak((s) => s + 1);
      toast.success('¡Correcto! +10 X-Coins 🪙');
    } else {
      setStreak(0);
      toast.info(`Casi… era: ${q.options[q.correct]}`);
    }
    track('live_trivia_answer', { correct, question: idx, streak });

    // Auto-avance a la siguiente pregunta tras el feedback
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setBase((b) => b + 1), 2200);
  }

  return (
    <section
      aria-label="Juego en vivo: trivia con X-Coins"
      className="shrink-0 rounded-2xl border border-amber-400/20 bg-gradient-to-b from-amber-500/10 to-white/[0.03] p-3"
    >
      {/* Cabecera: título + marcador */}
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-black text-white">
          🎮 Trivia en vivo
        </h3>
        <div className="flex items-center gap-1.5">
          <span className="rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-black text-amber-300">
            🪙 {coins} X-Coins
          </span>
          {streak >= 2 && (
            <motion.span
              key={streak}
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="rounded-full bg-orange-500/20 px-2 py-0.5 text-[10px] font-black text-orange-300"
            >
              🔥 racha ×{streak}
            </motion.span>
          )}
        </div>
      </div>

      {/* Pregunta + opciones (transición entre preguntas) */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={idx}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25 }}
        >
          <p className="mt-2 text-[11px] font-bold leading-snug text-white/90">{q.q}</p>
          <div className="mt-2 grid gap-1.5">
            {q.options.map((opt, i) => {
              const isPicked = picked === i;
              // Tras responder: resalta la correcta en verde y la errónea en rosa
              const state = !answered
                ? 'border-white/15 bg-white/5 hover:border-amber-400/50 hover:bg-amber-500/10'
                : i === q.correct
                  ? 'border-emerald-400/60 bg-emerald-500/15'
                  : isPicked
                    ? 'border-rose-400/60 bg-rose-500/15'
                    : 'border-white/10 bg-white/[0.02] opacity-60';
              return (
                <button
                  key={opt}
                  type="button"
                  disabled={answered}
                  onClick={() => pick(i)}
                  className={`flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-left text-[10px] font-semibold text-white transition ${state}`}
                >
                  <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-white/10 text-[8px] font-black text-white/70">
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span className="min-w-0 truncate">{opt}</span>
                  {answered && i === q.correct && (
                    <span className="ml-auto text-[10px]">✓</span>
                  )}
                </button>
              );
            })}
          </div>
        </motion.div>
      </AnimatePresence>

      <p className="mt-2 text-center text-[9px] leading-snug text-white/45">
        {answered
          ? isCorrect
            ? '¡Genial! Sigue la siguiente pregunta… 🎯'
            : 'A la próxima 💪 — Sigue la siguiente pregunta…'
          : 'Acierta y gana X-Coins · el host lanza preguntas'}
      </p>
    </section>
  );
}
