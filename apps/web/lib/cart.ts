// apps/web/lib/cart.ts
// Estado global del carrito con persistencia en localStorage

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartItem {
  id: string;
  productId: string;
  variantId?: string;
  title: string;
  price: number;
  quantity: number;
  seller: string;
  image: string;
}

interface CartState {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'quantity' | 'id'>, qty?: number) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, delta: number) => void;
  clear: () => void;
  subtotal: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (item, qty = 1) =>
        set((state) => {
          const existing = state.items.find(
            (i) => i.productId === item.productId && i.variantId === item.variantId
          );
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.id === existing.id ? { ...i, quantity: i.quantity + qty } : i
              ),
            };
          }
          return { items: [...state.items, { ...item, id: crypto.randomUUID(), quantity: qty }] };
        }),

      removeItem: (id) => set((state) => ({ items: state.items.filter((i) => i.id !== id) })),

      updateQuantity: (id, delta) =>
        set((state) => ({
          items: state.items
            .map((i) => (i.id === id ? { ...i, quantity: i.quantity + delta } : i))
            .filter((i) => i.quantity > 0),
        })),

      clear: () => set({ items: [] }),

      subtotal: () => get().items.reduce((acc, i) => acc + i.price * i.quantity, 0),
    }),
    { name: 'xstore-cart' }
  )
);
