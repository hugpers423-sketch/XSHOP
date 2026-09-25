// apps/web/components/live/LiveChat.tsx
'use client';

// Chat de comentarios en vivo — feed infinito optimizado (últimos 100)

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { LiveComment } from '@/lib/realtime';

interface LiveChatProps {
  comments: LiveComment[];
  onSend: (text: string) => void;
  onRequireAuth?: () => boolean;
  disabled?: boolean;
  connected?: boolean;
}

export function LiveChat({ comments, onSend, onRequireAuth, disabled, connected = true }: LiveChatProps) {
  const [draft, setDraft] = useState('');
  const feedRef = useRef<HTMLDivElement>(null);

  // Auto-scroll al comentario más reciente
  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: 'smooth' });
  }, [comments.length]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || disabled) return;
    if (onRequireAuth && !onRequireAuth()) return;
    onSend(text);
    setDraft('');
  }

  return (
    <div className="flex h-full flex-col rounded-3xl border border-white/10 bg-zinc-950">
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <p className="text-sm font-bold text-white">💬 Comentarios en vivo</p>
        <span className={`inline-flex items-center gap-1 text-[10px] font-bold ${connected ? 'text-emerald-400' : 'text-amber-300'}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-emerald-400' : 'bg-amber-300'}`} />
          {connected ? 'Conectado' : 'Modo local'}
        </span>
      </header>

      {/* Feed */}
      <div ref={feedRef} className="flex-1 space-y-2.5 overflow-y-auto p-4">
        <AnimatePresence initial={false}>
          {comments.map((c) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ type: 'spring', damping: 22, stiffness: 300 }}
              className="text-sm"
            >
              <span className="font-bold text-cyan-300">{c.userId.slice(0, 8)}… </span>
              <span className="text-white/85">{c.text}</span>
            </motion.div>
          ))}
        </AnimatePresence>

        {comments.length === 0 && (
          <p className="py-8 text-center text-xs text-white/35">
            Sé el primero en comentar 🙌
          </p>
        )}
      </div>

      {/* Input */}
      <form onSubmit={submit} className="flex items-center gap-2 border-t border-white/10 p-3">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Comenta algo…"
          maxLength={300}
          disabled={disabled}
          className="flex-1 rounded-full bg-white/10 px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#FF2D75] disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!draft.trim() || disabled}
          aria-label="Enviar comentario"
          className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-r from-[#FF2D75] to-[#7B5CFF] text-white transition active:scale-95 disabled:opacity-40"
        >
          ➤
        </button>
      </form>
    </div>
  );
}
