// apps/web/lib/notifications.ts
'use client';

// Lectura del centro de notificaciones con recuento de no leídas.
// Sondeo espaciado: no se bombardea la API ni se enciende la radio del móvil.

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  data: unknown;
  isRead: boolean;
  createdAt: string;
}

const POLL_MS = 60_000;

export function useNotifications() {
  const { user } = useAuth();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setItems([]);
      setUnread(0);
      return;
    }
    try {
      const res = await api.get<{ data: AppNotification[]; meta: { unread: number } }>(
        '/api/notifications?limit=20'
      );
      if (!mounted.current) return;
      setItems(Array.isArray(res.data) ? res.data : []);
      setUnread(typeof res.meta?.unread === 'number' ? res.meta.unread : 0);
    } catch {
      // Silencioso a propósito: una campana que falla no debe molestar.
      if (mounted.current) {
        setItems([]);
        setUnread(0);
      }
    }
  }, [user]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setItems([]);
      setUnread(0);
      return;
    }
    setLoading(true);
    void refresh().finally(() => setLoading(false));

    const timer = window.setInterval(() => {
      // No se sondea con la app en segundo plano.
      if (document.visibilityState === 'visible') void refresh();
    }, POLL_MS);

    return () => window.clearInterval(timer);
  }, [user, refresh]);

  const markAllRead = useCallback(async () => {
    const previous = items;
    // Optimista: la campana se vacía al instante.
    setUnread(0);
    setItems((prev) => prev.map((item) => ({ ...item, isRead: true })));
    try {
      await api.patch('/api/notifications', { all: true });
    } catch {
      setItems(previous);
      setUnread(previous.filter((item) => !item.isRead).length);
    }
  }, [items]);

  const markOneRead = useCallback(async (id: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, isRead: true } : item))
    );
    setUnread((prev) => (prev > 0 ? prev - 1 : 0));
    try {
      await api.patch('/api/notifications', { ids: [id] });
    } catch {
      void refresh();
    }
  }, [refresh]);

  return { items, unread, loading, open, setOpen, refresh, markAllRead, markOneRead };
}
