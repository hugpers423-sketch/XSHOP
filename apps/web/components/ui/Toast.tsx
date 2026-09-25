// apps/web/components/ui/Toast.tsx
'use client';

import { create } from 'zustand';
import { AnimatePresence, motion } from 'framer-motion';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface ToastStore {
  toasts: Toast[];
  push: (message: string, type?: Toast['type']) => void;
  remove: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  push: (message, type = 'info') => {
    const id = crypto.randomUUID();
    set((s) => ({ toasts: [...s.toasts.slice(-2), { id, message, type }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 3500);
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

const ICONS = { success: '✅', error: '⚠️', info: 'ℹ️' } as const;
const BORDERS = {
  success: 'border-emerald-500/40',
  error: 'border-rose-500/40',
  info: 'border-cyan-500/40',
} as const;

export function Toaster() {
  const { toasts, remove } = useToastStore();

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.button
            key={t.id}
            layout
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            onClick={() => remove(t.id)}
            className={`pointer-events-auto flex max-w-md items-center gap-2.5 rounded-2xl border bg-zinc-900/95 px-4 py-3 text-sm font-medium text-white shadow-2xl backdrop-blur-xl ${BORDERS[t.type]}`}
          >
            <span>{ICONS[t.type]}</span>
            <span className="text-left">{t.message}</span>
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}

// Helper: toast.success('Añadido al carrito')
export const toast = {
  success: (msg: string) => useToastStore.getState().push(msg, 'success'),
  error: (msg: string) => useToastStore.getState().push(msg, 'error'),
  info: (msg: string) => useToastStore.getState().push(msg, 'info'),
};
