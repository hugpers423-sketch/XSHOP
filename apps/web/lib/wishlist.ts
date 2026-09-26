// apps/web/lib/wishlist.ts
'use client';

// Estado de la lista de deseos con actualización optimista y reversión.
//
// Regla de diseño: la UI responde al instante, pero si el servidor rechaza la
// operación se revierte y se avisa. Nunca se muestra un "guardado" falso.

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { toast } from '@/components/ui/Toast';

export interface WishlistEntry {
  id: string;
  addedAt: string;
  product: {
    id: string;
    title: string;
    price: number;
    compareAtPrice: number | null;
    stock: number;
    location: string | null;
    image: string;
    seller: string;
  };
}

export function useWishlist() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<WishlistEntry[]>([]);
  const [ids, setIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    if (!user) {
      setEntries([]);
      setIds(new Set());
      return;
    }
    setLoading(true);
    try {
      const res = await api.get<{ data: WishlistEntry[] }>('/api/wishlist');
      const list = Array.isArray(res.data) ? res.data : [];
      setEntries(list);
      setIds(new Set(list.map((entry) => entry.product.id)));
    } catch {
      // Un fallo de red deja la lista vacía en vez de romper la página.
      setEntries([]);
      setIds(new Set());
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const isSaved = useCallback((productId: string) => ids.has(productId), [ids]);

  /** Alterna guardado. Optimista: revierte si la API falla. */
  const toggle = useCallback(
    async (productId: string, productTitle?: string) => {
      if (!user) return false;
      if (pending.has(productId)) return false;

      const wasSaved = ids.has(productId);
      setPending((prev) => new Set(prev).add(productId));

      // 1) Aplicar de inmediato
      setIds((prev) => {
        const next = new Set(prev);
        if (wasSaved) next.delete(productId);
        else next.add(productId);
        return next;
      });
      if (!wasSaved) {
        setEntries((prev) => [
          {
            id: `optimistic-${productId}`,
            addedAt: new Date().toISOString(),
            product: {
              id: productId,
              title: productTitle ?? 'Producto',
              price: 0,
              compareAtPrice: null,
              stock: 0,
              location: null,
              image: '/icons/icon-192.png',
              seller: '',
            },
          },
          ...prev,
        ]);
      } else {
        setEntries((prev) => prev.filter((entry) => entry.product.id !== productId));
      }

      // 2) Confirmar con el servidor y revertir si hace falta
      try {
        if (wasSaved) {
          await api.delete(`/api/wishlist/${encodeURIComponent(productId)}`);
          toast.success('Quitado de tu lista');
        } else {
          await api.post('/api/wishlist', { productId });
          toast.success(productTitle ? `"${productTitle}" guardado` : 'Guardado en tu lista');
          // Reemplaza la entrada optimista por la real del servidor.
          await refresh();
        }
        return !wasSaved;
      } catch {
        // 3) Revertir
        setIds((prev) => {
          const next = new Set(prev);
          if (wasSaved) next.add(productId);
          else next.delete(productId);
          return next;
        });
        await refresh();
        toast.error('No se pudo actualizar tu lista. Inténtalo de nuevo.');
        return wasSaved;
      } finally {
        setPending((prev) => {
          const next = new Set(prev);
          next.delete(productId);
          return next;
        });
      }
    },
    [ids, pending, refresh, user]
  );

  return { entries, isSaved, toggle, loading, pending, refresh };
}
