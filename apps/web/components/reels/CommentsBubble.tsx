// apps/web/components/reels/CommentsBubble.tsx
'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';

interface Comment {
  id: string;
  user: string;
  avatar: string;
  text: string;
  time: string;
}

const DEMO_COMMENTS: Comment[] = [
  { id: '1', user: 'lucia_m', avatar: '🧑‍🎤', text: '¿Llega a Arequipa? 😍', time: '2m' },
  { id: '2', user: 'carlos99', avatar: '🧑‍💻', text: 'Lo pedí y llegó en 1 día', time: '5m' },
  { id: '3', user: 'sofia_trends', avatar: '🧕', text: 'El color morado ¿tiene stock?', time: '8m' },
];

interface CommentsBubbleProps {
  reelId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function CommentsBubble({ isOpen, onClose }: CommentsBubbleProps) {
  const [draft, setDraft] = useState('');
  const [comments, setComments] = useState<Comment[]>(DEMO_COMMENTS);

  function submitComment(event: React.FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setComments((current) => [
      ...current,
      {
        id: `local-${Date.now()}`,
        user: 'tú',
        avatar: '🙋',
        text,
        time: 'ahora',
      },
    ]);
    setDraft('');
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            aria-hidden
          />
          <motion.aside
            role="dialog"
            aria-label="Comentarios"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 z-50 mx-auto flex h-[60vh] max-w-lg flex-col rounded-t-3xl border-t border-white/15 bg-[#0b0f1a]/95 backdrop-blur-2xl"
          >
            <header className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <h3 className="text-sm font-semibold text-white">Comentarios</h3>
              <button onClick={onClose} aria-label="Cerrar" className="text-white/60 hover:text-white">✕</button>
            </header>

            <ul className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              {comments.map((comment) => (
                <li key={comment.id} className="flex gap-3">
                  <span className="text-2xl" aria-hidden>{comment.avatar}</span>
                  <div>
                    <p className="text-xs text-white/50">@{comment.user} · {comment.time}</p>
                    <p className="text-sm text-white">{comment.text}</p>
                  </div>
                </li>
              ))}
            </ul>

            <form onSubmit={submitComment} className="flex gap-2 border-t border-white/10 p-4">
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Añade un comentario..."
                maxLength={200}
                className="flex-1 rounded-full bg-white/10 px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-cyan-400"
              />
              <button
                type="submit"
                disabled={!draft.trim()}
                className="rounded-full bg-gradient-to-r from-cyan-500 to-violet-600 px-5 text-sm font-bold text-white disabled:opacity-40"
              >
                Enviar
              </button>
            </form>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
