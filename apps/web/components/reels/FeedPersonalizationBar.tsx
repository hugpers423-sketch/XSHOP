// apps/web/components/reels/FeedPersonalizationBar.tsx
'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';

const INTERESTS = ['Moda', 'Tecnología', 'Hogar', 'Belleza', 'Deportes', 'Gastronomía'];
const STORAGE_KEY = 'xshop-feed-interests-v1';

export function FeedPersonalizationBar({
  interests,
  onChange,
}: {
  interests: string[];
  onChange: (interests: string[]) => void;
}) {
  const [open, setOpen] = useState(false);

  // Recupera los intereses guardados en este dispositivo (sin tocar backend).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        onChange(parsed.filter((item): item is string => typeof item === 'string'));
      }
    } catch {
      // Si el almacenamiento está bloqueado, el feed sigue funcionando.
    }
  }, [onChange]);

  function toggleInterest(interest: string) {
    const next = interests.includes(interest)
      ? interests.filter((item) => item !== interest)
      : [...interests, interest];
    onChange(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Persistencia opcional: el ajuste sigue activo en esta sesión.
    }
  }

  return (
    <div className="pointer-events-none fixed left-3 top-3 z-40">
      <div className="pointer-events-auto relative">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="flex items-center gap-2 rounded-full border border-violet-300/25 bg-black/55 px-3 py-2 text-[11px] font-bold text-white shadow-lg shadow-violet-950/30 backdrop-blur-xl transition hover:border-violet-300/60"
        >
          <span className="text-violet-300">✦</span>
          <span>Para ti</span>
          <span className="max-w-[120px] truncate text-[10px] font-medium text-violet-100/70">
            {interests.length > 0 ? interests.join(' · ') : 'Ajusta tus intereses'}
          </span>
          <span className="text-[10px] text-white/50">▾</span>
        </button>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              className="mt-2 w-64 rounded-2xl border border-violet-300/20 bg-[#120f1c]/95 p-3 shadow-2xl shadow-black/40 backdrop-blur-xl"
            >
              <p className="text-xs font-black text-white">Hazlo más tuyo</p>
              <p className="mt-1 text-[10px] leading-relaxed text-white/45">
                Elige tus intereses y acomodaremos el feed sin borrar tu historial.
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {INTERESTS.map((interest) => {
                  const selected = interests.includes(interest);
                  return (
                    <button
                      key={interest}
                      type="button"
                      onClick={() => toggleInterest(interest)}
                      aria-pressed={selected}
                      className={`rounded-full border px-2.5 py-1.5 text-[10px] font-bold transition ${selected ? 'border-violet-300/70 bg-violet-400/20 text-violet-100' : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10'}`}
                    >
                      {selected ? '✓ ' : ''}{interest}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
